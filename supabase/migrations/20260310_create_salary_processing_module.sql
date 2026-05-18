-- Salary processing module for SmartFleet / Frota Live.
-- Adds payroll master data on motoristas and creates salary processing tables.

ALTER TABLE public.motoristas
  ADD COLUMN IF NOT EXISTS nif TEXT,
  ADD COLUMN IF NOT EXISTS niss TEXT,
  ADD COLUMN IF NOT EXISTS iban TEXT,
  ADD COLUMN IF NOT EXISTS base_salary NUMERIC(12, 2);

UPDATE public.motoristas
SET base_salary = COALESCE(base_salary, vencimento_base, 0)
WHERE base_salary IS NULL;

CREATE TABLE IF NOT EXISTS public.driver_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES public.motoristas(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  normal_hours NUMERIC(8, 2) NOT NULL DEFAULT 0,
  extra_hours NUMERIC(8, 2) NOT NULL DEFAULT 0,
  night_hours NUMERIC(8, 2) NOT NULL DEFAULT 0,
  reference_month INT,
  reference_year INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_driver_hours_driver_date
ON public.driver_hours(driver_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_driver_hours_reference
ON public.driver_hours(reference_year, reference_month);

CREATE TABLE IF NOT EXISTS public.driver_bonuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES public.motoristas(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  reference_date DATE,
  reference_month INT,
  reference_year INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_driver_bonuses_driver_reference
ON public.driver_bonuses(driver_id, reference_year, reference_month);

CREATE TABLE IF NOT EXISTS public.driver_deductions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES public.motoristas(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  reference_date DATE,
  reference_month INT,
  reference_year INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_driver_deductions_driver_reference
ON public.driver_deductions(driver_id, reference_year, reference_month);

CREATE TABLE IF NOT EXISTS public.salary_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month INT NOT NULL CHECK (month >= 1 AND month <= 12),
  year INT NOT NULL CHECK (year >= 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (month, year)
);

CREATE TABLE IF NOT EXISTS public.salary_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salary_run_id UUID NOT NULL REFERENCES public.salary_runs(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES public.motoristas(id) ON DELETE RESTRICT,
  base_salary NUMERIC(12, 2) NOT NULL DEFAULT 0,
  extra_pay NUMERIC(12, 2) NOT NULL DEFAULT 0,
  night_pay NUMERIC(12, 2) NOT NULL DEFAULT 0,
  bonuses NUMERIC(12, 2) NOT NULL DEFAULT 0,
  deductions NUMERIC(12, 2) NOT NULL DEFAULT 0,
  gross_salary NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ss_discount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  irs_discount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  net_salary NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (salary_run_id, driver_id)
);

CREATE INDEX IF NOT EXISTS idx_salary_lines_run_id
ON public.salary_lines(salary_run_id);

CREATE INDEX IF NOT EXISTS idx_salary_lines_driver_id
ON public.salary_lines(driver_id);

ALTER TABLE public.driver_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_bonuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_deductions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary_lines ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'driver_hours' AND policyname = 'Public Access'
  ) THEN
    CREATE POLICY "Public Access" ON public.driver_hours FOR ALL USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'driver_bonuses' AND policyname = 'Public Access'
  ) THEN
    CREATE POLICY "Public Access" ON public.driver_bonuses FOR ALL USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'driver_deductions' AND policyname = 'Public Access'
  ) THEN
    CREATE POLICY "Public Access" ON public.driver_deductions FOR ALL USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'salary_runs' AND policyname = 'Public Access'
  ) THEN
    CREATE POLICY "Public Access" ON public.salary_runs FOR ALL USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'salary_lines' AND policyname = 'Public Access'
  ) THEN
    CREATE POLICY "Public Access" ON public.salary_lines FOR ALL USING (true) WITH CHECK (true);
  END IF;
END;
$$;
