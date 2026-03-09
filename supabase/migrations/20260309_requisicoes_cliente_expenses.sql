-- Allow requisitions to be assigned to a client (optional)
-- NULL cliente_id means internal company expense (Tropical).

ALTER TABLE public.requisicoes
ADD COLUMN IF NOT EXISTS cliente_id UUID;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'clientes'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'requisicoes_cliente_id_fkey'
    ) THEN
      ALTER TABLE public.requisicoes
      ADD CONSTRAINT requisicoes_cliente_id_fkey
      FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_requisicoes_cliente_id ON public.requisicoes(cliente_id);
CREATE INDEX IF NOT EXISTS idx_requisicoes_cliente_id_data ON public.requisicoes(cliente_id, data DESC);

-- Aggregation helpers for client expense dashboards
CREATE OR REPLACE FUNCTION public.get_client_requisition_total_expense(p_cliente_id UUID)
RETURNS NUMERIC
LANGUAGE SQL
STABLE
AS $$
  SELECT COALESCE(SUM(COALESCE(custo, approved_value, 0)), 0)::NUMERIC
  FROM public.requisicoes
  WHERE cliente_id = p_cliente_id;
$$;

CREATE OR REPLACE FUNCTION public.get_client_requisition_monthly_expenses(p_cliente_id UUID)
RETURNS TABLE(month_key TEXT, total NUMERIC)
LANGUAGE SQL
STABLE
AS $$
  SELECT
    to_char(date_trunc('month', COALESCE(data, now())), 'YYYY-MM') AS month_key,
    COALESCE(SUM(COALESCE(custo, approved_value, 0)), 0)::NUMERIC AS total
  FROM public.requisicoes
  WHERE cliente_id = p_cliente_id
  GROUP BY 1
  ORDER BY 1;
$$;
