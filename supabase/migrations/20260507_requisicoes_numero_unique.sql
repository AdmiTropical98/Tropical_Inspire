-- Guarantee requisition number uniqueness at DB level.
-- This protects against race conditions when multiple users create requisitions at the same time.
CREATE UNIQUE INDEX IF NOT EXISTS idx_requisicoes_numero_unique
ON public.requisicoes (numero)
WHERE numero IS NOT NULL AND btrim(numero) <> '';
