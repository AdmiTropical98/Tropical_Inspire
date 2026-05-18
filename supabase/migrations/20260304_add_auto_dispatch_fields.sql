ALTER TABLE public.viaturas
ADD COLUMN IF NOT EXISTS vehicle_capacity INTEGER NOT NULL DEFAULT 8;

CREATE INDEX IF NOT EXISTS idx_viaturas_vehicle_capacity
ON public.viaturas(vehicle_capacity);

ALTER TABLE public.servicos
ADD COLUMN IF NOT EXISTS vehicle_id UUID REFERENCES public.viaturas(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS passenger_count INTEGER NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS occupancy_rate NUMERIC(5,2);

CREATE INDEX IF NOT EXISTS idx_servicos_vehicle_id
ON public.servicos(vehicle_id);

CREATE INDEX IF NOT EXISTS idx_servicos_passenger_count
ON public.servicos(passenger_count);