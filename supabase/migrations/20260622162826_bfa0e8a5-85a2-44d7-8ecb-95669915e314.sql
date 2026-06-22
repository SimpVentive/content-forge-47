CREATE OR REPLACE FUNCTION public.spend_credits(p_user_id uuid, p_amount integer, p_reason text DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total integer;
  v_used integer;
  v_remaining integer;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'amount must be positive';
  END IF;

  SELECT credits_total, credits_used INTO v_total, v_used
  FROM public.profiles WHERE id = p_user_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile not found';
  END IF;

  v_remaining := COALESCE(v_total,0) - COALESCE(v_used,0);
  IF v_remaining < p_amount THEN
    RAISE EXCEPTION 'insufficient_credits' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.profiles
    SET credits_used = COALESCE(credits_used,0) + p_amount,
        updated_at = now()
    WHERE id = p_user_id;

  RETURN COALESCE(v_total,0) - (COALESCE(v_used,0) + p_amount);
END;
$$;

GRANT EXECUTE ON FUNCTION public.spend_credits(uuid, integer, text) TO authenticated, service_role;