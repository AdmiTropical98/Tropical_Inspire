ALTER TABLE public.servicos
ADD COLUMN IF NOT EXISTS origem_location_id UUID REFERENCES public.locais(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS destino_location_id UUID REFERENCES public.locais(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS origin_arrival_time TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS destination_arrival_time TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_servicos_origem_location_id
ON public.servicos(origem_location_id);

CREATE INDEX IF NOT EXISTS idx_servicos_destino_location_id
ON public.servicos(destino_location_id);

CREATE INDEX IF NOT EXISTS idx_servicos_origin_arrival_time
ON public.servicos(origin_arrival_time);

CREATE INDEX IF NOT EXISTS idx_servicos_destination_arrival_time
ON public.servicos(destination_arrival_time);
