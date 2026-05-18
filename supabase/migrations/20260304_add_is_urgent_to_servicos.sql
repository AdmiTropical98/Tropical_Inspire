ALTER TABLE public.servicos
ADD COLUMN IF NOT EXISTS is_urgent BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_servicos_is_urgent
ON public.servicos(is_urgent);