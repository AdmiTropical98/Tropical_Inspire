-- Add user role/type to motoristas without breaking existing relations.
-- Fuel/history records remain linked to motoristas.id (driver_id), so changing role keeps history intact.

ALTER TABLE public.motoristas
ADD COLUMN IF NOT EXISTS tipo_utilizador TEXT;

-- Backfill existing rows safely.
UPDATE public.motoristas
SET tipo_utilizador = 'motorista'
WHERE tipo_utilizador IS NULL;

-- Restrict to allowed values.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'motoristas_tipo_utilizador_check'
    ) THEN
        ALTER TABLE public.motoristas
        ADD CONSTRAINT motoristas_tipo_utilizador_check
        CHECK (tipo_utilizador IN ('motorista', 'supervisor', 'oficina'));
    END IF;
END $$;

ALTER TABLE public.motoristas
ALTER COLUMN tipo_utilizador SET DEFAULT 'motorista';

ALTER TABLE public.motoristas
ALTER COLUMN tipo_utilizador SET NOT NULL;
