-- Align invoice_imports with ERP ingestion contract

CREATE TABLE IF NOT EXISTS public.invoice_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_path TEXT NOT NULL,
  extracted_json JSONB,
  status TEXT DEFAULT 'processing',
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.invoice_imports
  ADD COLUMN IF NOT EXISTS file_path TEXT,
  ADD COLUMN IF NOT EXISTS extracted_json JSONB,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'processing',
  ADD COLUMN IF NOT EXISTS error TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- Backward compatibility with previously introduced column naming
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'invoice_imports'
      AND column_name = 'storage_path'
  ) THEN
    UPDATE public.invoice_imports
    SET file_path = COALESCE(file_path, storage_path)
    WHERE file_path IS NULL;
  END IF;
END $$;

ALTER TABLE public.invoice_imports
  DROP CONSTRAINT IF EXISTS invoice_imports_status_check;

ALTER TABLE public.invoice_imports
  ADD CONSTRAINT invoice_imports_status_check
  CHECK (status IN ('processing', 'ready', 'failed', 'confirmed'));

CREATE INDEX IF NOT EXISTS idx_invoice_imports_status_created_at
  ON public.invoice_imports(status, created_at DESC);
