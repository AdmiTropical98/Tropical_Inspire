-- Add faturas_dados column to requisicoes table to support multiple invoices
ALTER TABLE public.requisicoes ADD COLUMN IF NOT EXISTS faturas_dados JSONB DEFAULT '[]'::jsonb;
