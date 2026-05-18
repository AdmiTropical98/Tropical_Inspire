-- Vehicle Profile: legacy association backfill (ID or matrícula)
-- Safe migration for environments with schema drift.

CREATE OR REPLACE FUNCTION public.normalize_plate_ref(input_text TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT UPPER(REGEXP_REPLACE(COALESCE(input_text, ''), '[^a-zA-Z0-9]', '', 'g'));
$$;

DO $$
DECLARE
  source_expr TEXT := NULL;
BEGIN
  -- Requisitions: fill viatura_id from legacy references (matrícula/textual id)
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'requisicoes'
      AND column_name = 'viatura_id'
  ) THEN

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'requisicoes' AND column_name = 'matricula'
    ) THEN
      source_expr := COALESCE(source_expr || ', ', '') || 'r.matricula';
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'requisicoes' AND column_name = 'license_plate'
    ) THEN
      source_expr := COALESCE(source_expr || ', ', '') || 'r.license_plate';
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'requisicoes' AND column_name = 'vehicle_id'
    ) THEN
      source_expr := COALESCE(source_expr || ', ', '') || 'r.vehicle_id::text';
    END IF;

    IF source_expr IS NOT NULL THEN
      EXECUTE format($sql$
        UPDATE public.requisicoes r
        SET viatura_id = v.id
        FROM public.viaturas v
        WHERE r.viatura_id IS NULL
          AND public.normalize_plate_ref(COALESCE(%1$s)) = public.normalize_plate_ref(v.matricula)
      $sql$, source_expr);
    END IF;
  END IF;
END $$;

DO $$
DECLARE
  vehicle_col_type TEXT;
  fuel_source_expr TEXT := NULL;
BEGIN
  -- Fuel records: normalize legacy vehicle_id values (plate/text) to canonical vehicle id
  SELECT data_type
  INTO vehicle_col_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'fuel_transactions'
    AND column_name = 'vehicle_id';

  IF vehicle_col_type IS NULL THEN
    RETURN;
  END IF;

  IF vehicle_col_type = 'uuid' THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'fuel_transactions' AND column_name = 'license_plate'
    ) THEN
      fuel_source_expr := COALESCE(fuel_source_expr || ', ', '') || 't.license_plate';
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'fuel_transactions' AND column_name = 'matricula'
    ) THEN
      fuel_source_expr := COALESCE(fuel_source_expr || ', ', '') || 't.matricula';
    END IF;

    IF fuel_source_expr IS NOT NULL THEN
      EXECUTE format($sql$
        UPDATE public.fuel_transactions t
        SET vehicle_id = v.id
        FROM public.viaturas v
        WHERE t.vehicle_id IS NULL
          AND public.normalize_plate_ref(COALESCE(%1$s)) = public.normalize_plate_ref(v.matricula)
      $sql$, fuel_source_expr);
    END IF;
  ELSE
    UPDATE public.fuel_transactions t
    SET vehicle_id = v.id::text
    FROM public.viaturas v
    WHERE public.normalize_plate_ref(t.vehicle_id) = public.normalize_plate_ref(v.matricula)
       OR t.vehicle_id = v.id::text;
  END IF;
END $$;

-- Helpful index for profile page joins/filters
CREATE INDEX IF NOT EXISTS idx_requisicoes_viatura_id ON public.requisicoes (viatura_id);
CREATE INDEX IF NOT EXISTS idx_fuel_transactions_vehicle_id ON public.fuel_transactions (vehicle_id);
