-- ============================================================
-- PROMOTIONS MUST REFERENCE AN EXISTING SERVICE
-- Run this once in Supabase SQL Editor for existing projects.
-- ============================================================

ALTER TABLE public.promotions
  ADD COLUMN IF NOT EXISTS service_id UUID REFERENCES public.services(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_promotions_service ON public.promotions(service_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'promotions_service_required'
      AND conrelid = 'public.promotions'::regclass
  ) THEN
    -- NOT VALID keeps legacy rows working while enforcing the rule for new rows.
    ALTER TABLE public.promotions
      ADD CONSTRAINT promotions_service_required CHECK (service_id IS NOT NULL) NOT VALID;
  END IF;
END $$;

-- Optional cleanup after assigning service_id to old rows:
-- ALTER TABLE public.promotions VALIDATE CONSTRAINT promotions_service_required;
