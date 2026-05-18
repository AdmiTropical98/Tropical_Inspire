CREATE TABLE IF NOT EXISTS public.driver_vehicle_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID NOT NULL REFERENCES public.motoristas(id) ON DELETE CASCADE,
    vehicle_id TEXT NOT NULL,
    start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    end_time TIMESTAMPTZ,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT driver_vehicle_sessions_active_end_time_chk
        CHECK ((active = TRUE AND end_time IS NULL) OR active = FALSE)
);

CREATE INDEX IF NOT EXISTS idx_driver_vehicle_sessions_driver_active
    ON public.driver_vehicle_sessions(driver_id, active, start_time DESC);

CREATE INDEX IF NOT EXISTS idx_driver_vehicle_sessions_vehicle_active
    ON public.driver_vehicle_sessions(vehicle_id, active, start_time DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_driver_vehicle_sessions_driver_active
    ON public.driver_vehicle_sessions(driver_id)
    WHERE active = TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS uq_driver_vehicle_sessions_vehicle_active
    ON public.driver_vehicle_sessions(vehicle_id)
    WHERE active = TRUE;

ALTER TABLE public.driver_vehicle_sessions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'driver_vehicle_sessions'
          AND policyname = 'Public Access'
    ) THEN
        CREATE POLICY "Public Access"
        ON public.driver_vehicle_sessions
        FOR ALL
        USING (TRUE)
        WITH CHECK (TRUE);
    END IF;
END;
$$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_vehicle_sessions;

CREATE OR REPLACE FUNCTION public.get_vehicle_by_driver(p_driver_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
    SELECT s.vehicle_id
    FROM public.driver_vehicle_sessions s
    WHERE s.driver_id = p_driver_id
      AND s.active = TRUE
      AND s.end_time IS NULL
    ORDER BY s.start_time DESC
    LIMIT 1;
$$;
