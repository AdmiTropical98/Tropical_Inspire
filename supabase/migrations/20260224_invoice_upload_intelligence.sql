-- Invoice Upload Intelligence
-- Async PDF import queue for AI-assisted supplier invoice prefill

CREATE TABLE IF NOT EXISTS public.invoice_imports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    storage_path TEXT NOT NULL,
    pdf_url TEXT,
    status TEXT NOT NULL DEFAULT 'processing'
        CHECK (status IN ('processing', 'ready', 'confirmed', 'error')),
    language TEXT NOT NULL DEFAULT 'pt-PT',
    extracted_json JSONB,
    error_message TEXT,
    supplier_invoice_id UUID NULL,
    created_by UUID NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at TIMESTAMPTZ NULL,
    confirmed_at TIMESTAMPTZ NULL
);

ALTER TABLE public.invoice_imports
    ADD CONSTRAINT invoice_imports_supplier_invoice_id_fkey
        FOREIGN KEY (supplier_invoice_id)
        REFERENCES public.supplier_invoices(id)
        ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_invoice_imports_status_created_at
    ON public.invoice_imports(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_invoice_imports_created_by
    ON public.invoice_imports(created_by);

ALTER TABLE public.invoice_imports ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'invoice_imports'
          AND policyname = 'Public Access'
    ) THEN
        CREATE POLICY "Public Access" ON public.invoice_imports FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

CREATE OR REPLACE FUNCTION public.update_invoice_imports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_invoice_imports_updated_at ON public.invoice_imports;
CREATE TRIGGER trigger_update_invoice_imports_updated_at
    BEFORE UPDATE ON public.invoice_imports
    FOR EACH ROW
    EXECUTE FUNCTION public.update_invoice_imports_updated_at();

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'invoice_imports'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.invoice_imports;
    END IF;
END $$;
