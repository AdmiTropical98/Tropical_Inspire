-- Migration: Add faturas_dados JSONB column to requisicoes table
-- Description: Stores multiple invoices with VAT breakdown (net, rate, amount, total)

ALTER TABLE public.requisicoes 
ADD COLUMN IF NOT EXISTS faturas_dados JSONB DEFAULT '[]'::jsonb;
