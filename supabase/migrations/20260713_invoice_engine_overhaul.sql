-- Invoice Engine Overhaul

-- 1. Add fields to invoice_imports for full OCR text and confidence scores
ALTER TABLE public.invoice_imports
ADD COLUMN IF NOT EXISTS ocr_text TEXT,
ADD COLUMN IF NOT EXISTS confidence_scores JSONB;

-- 2. Create the learning rules table
CREATE TABLE IF NOT EXISTS public.invoice_learning_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_nif TEXT NOT NULL,
    keyword_match TEXT,
    suggested_description TEXT,
    suggested_category TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoice_learning_rules_nif ON public.invoice_learning_rules(supplier_nif);

ALTER TABLE public.invoice_learning_rules ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'invoice_learning_rules'
          AND policyname = 'Public Access'
    ) THEN
        CREATE POLICY "Public Access" ON public.invoice_learning_rules FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

CREATE OR REPLACE FUNCTION public.update_invoice_learning_rules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_invoice_learning_rules_updated_at ON public.invoice_learning_rules;
CREATE TRIGGER trigger_update_invoice_learning_rules_updated_at
    BEFORE UPDATE ON public.invoice_learning_rules
    FOR EACH ROW
    EXECUTE FUNCTION public.update_invoice_learning_rules_updated_at();

-- 3. Add to realtime if necessary
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'invoice_learning_rules'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.invoice_learning_rules;
    END IF;
END $$;
