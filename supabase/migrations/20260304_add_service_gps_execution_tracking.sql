ALTER TABLE public.servicos
ADD COLUMN IF NOT EXISTS origin_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS destination_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS origin_departure_time TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS destination_departure_time TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_servicos_origin_confirmed
ON public.servicos(origin_confirmed);

CREATE INDEX IF NOT EXISTS idx_servicos_destination_confirmed
ON public.servicos(destination_confirmed);

CREATE INDEX IF NOT EXISTS idx_servicos_origin_departure_time
ON public.servicos(origin_departure_time);

CREATE INDEX IF NOT EXISTS idx_servicos_destination_departure_time
ON public.servicos(destination_departure_time);

CREATE TABLE IF NOT EXISTS public.service_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID NOT NULL REFERENCES public.servicos(id) ON DELETE CASCADE,
    vehicle_id TEXT,
    event_type TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
    location_id UUID REFERENCES public.locais(id) ON DELETE SET NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_service_events_service_id_timestamp
ON public.service_events(service_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_service_events_event_type
ON public.service_events(event_type);

ALTER TABLE public.service_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'service_events'
          AND policyname = 'Public Access'
    ) THEN
        CREATE POLICY "Public Access"
        ON public.service_events
        FOR ALL
        USING (true)
        WITH CHECK (true);
    END IF;
END;
$$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.service_events;
