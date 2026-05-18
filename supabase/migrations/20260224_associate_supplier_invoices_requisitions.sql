-- Link supplier invoices to requisitions (optional 1:N)
-- Requisition (1) ---- (N) Supplier Invoices

ALTER TABLE public.supplier_invoices
    ADD COLUMN IF NOT EXISTS requisition_id UUID NULL;

ALTER TABLE public.supplier_invoices
    DROP CONSTRAINT IF EXISTS supplier_invoices_requisition_id_fkey;

ALTER TABLE public.supplier_invoices
    ADD CONSTRAINT supplier_invoices_requisition_id_fkey
        FOREIGN KEY (requisition_id)
        REFERENCES public.requisicoes(id)
        ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_supplier_invoices_requisition_id
    ON public.supplier_invoices(requisition_id);

-- Financial tracking fields on requisitions (for ERP-style closure workflow)
ALTER TABLE public.requisicoes
    ADD COLUMN IF NOT EXISTS financial_status TEXT NOT NULL DEFAULT 'PENDING'
        CHECK (financial_status IN ('PENDING', 'PARTIAL', 'INVOICED')),
    ADD COLUMN IF NOT EXISTS total_invoiced_amount NUMERIC NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_requisicoes_financial_status
    ON public.requisicoes(financial_status);
