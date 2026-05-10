-- RPCs and schema additions required by the edge functions in
-- supabase/functions. Apply after 20260509000000_unified_auth_schema.sql.

-- ============================================================================
-- billing_transactions.invoice_pdf_path
-- ============================================================================
-- Storage path (within INVOICE_BUCKET) of the generated GST invoice PDF.
-- Populated by an out-of-band invoice generator (cron / function); read by
-- the generate-invoice edge function which signs a short-lived URL.
alter table public.billing_transactions
  add column if not exists invoice_pdf_path text;

-- ============================================================================
-- complete_razorpay_payment
-- ============================================================================
-- Idempotent. Called by:
--   - razorpay-verify (after frontend HMAC verification)
--   - razorpay-webhook (on payment.captured / order.paid)
-- Both can fire for the same order — second call is a no-op.
--
-- Locks the billing_transactions row, marks it paid, and increments the
-- user's credits_total. Returns a JSON summary including new balance.
create or replace function public.complete_razorpay_payment(
  p_order_id text,
  p_payment_id text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tx          record;
  v_new_balance int;
begin
  select id, user_id, credits_purchased, status
    into v_tx
    from public.billing_transactions
    where razorpay_order_id = p_order_id
    for update;

  if not found then
    raise exception 'unknown_order: %', p_order_id;
  end if;

  if v_tx.status = 'paid' then
    select credits_total into v_new_balance
      from public.profiles where id = v_tx.user_id;
    return json_build_object(
      'transaction_id',     v_tx.id,
      'user_id',            v_tx.user_id,
      'credits_purchased',  v_tx.credits_purchased,
      'new_balance',        v_new_balance,
      'already_processed',  true
    );
  end if;

  update public.billing_transactions
    set status = 'paid',
        razorpay_payment_id = p_payment_id
    where id = v_tx.id;

  update public.profiles
    set credits_total = credits_total + v_tx.credits_purchased
    where id = v_tx.user_id
    returning credits_total into v_new_balance;

  return json_build_object(
    'transaction_id',     v_tx.id,
    'user_id',            v_tx.user_id,
    'credits_purchased',  v_tx.credits_purchased,
    'new_balance',        v_new_balance,
    'already_processed',  false
  );
end;
$$;

-- ============================================================================
-- spend_credits
-- ============================================================================
-- Atomic credit deduction. Acquires a row lock on profiles, validates the
-- user has enough available balance (credits_total - credits_used >=
-- p_amount), and updates credits_used. Raises errcode P0001 with message
-- 'insufficient_credits' if the user can't afford the spend.
--
-- Returns the new remaining (available) balance.
create or replace function public.spend_credits(
  p_user_id uuid,
  p_amount  int,
  p_reason  text default null
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total     int;
  v_used      int;
  v_available int;
  v_new_used  int;
begin
  if p_amount <= 0 then
    raise exception 'amount_must_be_positive';
  end if;

  select credits_total, credits_used
    into v_total, v_used
    from public.profiles
    where id = p_user_id
    for update;

  if not found then
    raise exception 'unknown_user';
  end if;

  v_available := v_total - v_used;
  if p_amount > v_available then
    raise exception 'insufficient_credits' using errcode = 'P0001';
  end if;

  v_new_used := v_used + p_amount;
  update public.profiles
    set credits_used = v_new_used
    where id = p_user_id;

  -- Touch the reason argument so a future credit_ledger insert can hang off
  -- it without changing the function signature.
  perform p_reason;

  return v_total - v_new_used;
end;
$$;

-- ============================================================================
-- Privilege lockdown
-- ============================================================================
-- These RPCs are SECURITY DEFINER, so we restrict who can EXECUTE them.
-- Only the service_role (edge functions, server-side workers) should call
-- them — never end-users via PostgREST.
revoke all on function public.complete_razorpay_payment(text, text) from public, anon, authenticated;
revoke all on function public.spend_credits(uuid, int, text) from public, anon, authenticated;

grant execute on function public.complete_razorpay_payment(text, text) to service_role;
grant execute on function public.spend_credits(uuid, int, text) to service_role;
