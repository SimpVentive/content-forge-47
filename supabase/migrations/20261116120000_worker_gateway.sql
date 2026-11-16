-- Worker gateway: progress timestamps for stale-job detection, the claim record (hash only), and the atomic claim.
--
-- ADDITIVE ONLY. It adds one column to module_jobs, one table, and one function. It does not alter or drop anything
-- that already exists. Safe to re-run: IF NOT EXISTS, CREATE OR REPLACE, and DROP ... IF EXISTS before each policy or trigger.

-- 1. When the job last made progress (set on claim and on each progress update). Used for the stale-job timeout.
ALTER TABLE public.module_jobs ADD COLUMN IF NOT EXISTS progress_at timestamptz NULL;

-- 2. The claim record: which job is held, and a hash of the worker's claim token. Never the token itself.
--    RLS is on and there are no policies, so browser users (anon, authenticated) cannot read or write it.
CREATE TABLE IF NOT EXISTS public.module_job_claims (
  job_id uuid PRIMARY KEY REFERENCES public.module_jobs(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  claimed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.module_job_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.module_job_claims FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.module_job_claims TO service_role;

-- 3. Atomic claim. Takes the oldest queued job, marks it generating, and records the hash of the claim token.
--    First it fails any job that has been generating with no progress for 45 minutes ("worker stopped").
--    It returns the job id, or NULL when nothing is queued. The service role may call it. Nobody else may.
CREATE OR REPLACE FUNCTION public.claim_next_module_job(p_token_hash text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job uuid;
  v_swept uuid[];
BEGIN
  IF p_token_hash IS NULL OR length(p_token_hash) <> 64 THEN
    RAISE EXCEPTION 'invalid claim' USING ERRCODE = '22023';
  END IF;

  -- Stale sweep.
  SELECT array_agg(s.id) INTO v_swept
  FROM (
    SELECT id FROM public.module_jobs
    WHERE status = 'generating'
      AND COALESCE(progress_at, updated_at) < now() - interval '45 minutes'
    FOR UPDATE SKIP LOCKED
  ) s;

  IF v_swept IS NOT NULL THEN
    UPDATE public.module_jobs
    SET status = 'failed', progress = 'Failed', error = 'worker stopped', progress_at = now()
    WHERE id = ANY (v_swept);
    INSERT INTO public.module_job_events (job_id, status, message)
    SELECT unnest(v_swept), 'failed', 'worker stopped';
    DELETE FROM public.module_job_claims WHERE job_id = ANY (v_swept);
  END IF;

  -- Claim the oldest queued job.
  SELECT id INTO v_job
  FROM public.module_jobs
  WHERE status = 'queued'
  ORDER BY created_at
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_job IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.module_jobs
  SET status = 'generating', progress = 'Preparing the trainer', progress_at = now()
  WHERE id = v_job;

  INSERT INTO public.module_job_claims (job_id, token_hash)
  VALUES (v_job, p_token_hash)
  ON CONFLICT (job_id) DO UPDATE SET token_hash = EXCLUDED.token_hash, claimed_at = now();

  INSERT INTO public.module_job_events (job_id, status, message)
  VALUES (v_job, 'generating', 'Worker started');

  RETURN v_job;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_next_module_job(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_next_module_job(text) TO service_role;
