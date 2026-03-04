CREATE TABLE IF NOT EXISTS public.service_passengers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID NOT NULL REFERENCES public.servicos(id) ON DELETE CASCADE,
    employee_id TEXT NOT NULL,
    employee_name TEXT NOT NULL,
    hotel_name TEXT,
    transport_price_per_day NUMERIC(10,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (service_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_service_passengers_service_id
    ON public.service_passengers(service_id);

CREATE INDEX IF NOT EXISTS idx_service_passengers_employee_id
    ON public.service_passengers(employee_id);

CREATE INDEX IF NOT EXISTS idx_service_passengers_hotel_name
    ON public.service_passengers(hotel_name);

CREATE TABLE IF NOT EXISTS public.passenger_trips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id TEXT NOT NULL,
    service_id UUID NOT NULL REFERENCES public.servicos(id) ON DELETE CASCADE,
    trip_date DATE NOT NULL,
    origin TEXT,
    destination TEXT,
    driver_id UUID REFERENCES public.motoristas(id) ON DELETE SET NULL,
    hotel_name TEXT,
    transport_price_per_day NUMERIC(10,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (employee_id, service_id)
);

CREATE INDEX IF NOT EXISTS idx_passenger_trips_date
    ON public.passenger_trips(trip_date);

CREATE INDEX IF NOT EXISTS idx_passenger_trips_employee_date
    ON public.passenger_trips(employee_id, trip_date);

CREATE INDEX IF NOT EXISTS idx_passenger_trips_hotel_date
    ON public.passenger_trips(hotel_name, trip_date);

CREATE OR REPLACE FUNCTION public.sync_passenger_trip_from_service()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_trip_date DATE;
    v_driver_id UUID;
    v_origin TEXT;
    v_destination TEXT;
BEGIN
    SELECT
        COALESCE(s.data, (s.created_at AT TIME ZONE 'UTC')::date),
        s.motorista_id,
        s.origem,
        s.destino
    INTO v_trip_date, v_driver_id, v_origin, v_destination
    FROM public.servicos s
    WHERE s.id = NEW.service_id;

    INSERT INTO public.passenger_trips (
        employee_id,
        service_id,
        trip_date,
        origin,
        destination,
        driver_id,
        hotel_name,
        transport_price_per_day
    )
    VALUES (
        NEW.employee_id,
        NEW.service_id,
        COALESCE(v_trip_date, CURRENT_DATE),
        v_origin,
        v_destination,
        v_driver_id,
        NEW.hotel_name,
        NEW.transport_price_per_day
    )
    ON CONFLICT (employee_id, service_id)
    DO UPDATE SET
        trip_date = EXCLUDED.trip_date,
        origin = EXCLUDED.origin,
        destination = EXCLUDED.destination,
        driver_id = EXCLUDED.driver_id,
        hotel_name = EXCLUDED.hotel_name,
        transport_price_per_day = EXCLUDED.transport_price_per_day;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_passenger_trip_from_service ON public.service_passengers;
CREATE TRIGGER trg_sync_passenger_trip_from_service
AFTER INSERT OR UPDATE ON public.service_passengers
FOR EACH ROW
EXECUTE FUNCTION public.sync_passenger_trip_from_service();

CREATE OR REPLACE VIEW public.vw_transport_stats_by_hotel_monthly AS
SELECT
    date_trunc('month', pt.trip_date)::date AS month,
    COALESCE(NULLIF(pt.hotel_name, ''), 'Sem Hotel') AS hotel,
    COUNT(DISTINCT pt.service_id) AS total_transportes,
    COUNT(DISTINCT pt.employee_id) AS funcionarios_transportados,
    COUNT(*) AS viagens_realizadas
FROM public.passenger_trips pt
GROUP BY 1, 2;

CREATE OR REPLACE VIEW public.vw_transport_stats_by_driver_daily AS
SELECT
    pt.trip_date,
    COALESCE(NULLIF(pt.hotel_name, ''), 'Sem Hotel') AS hotel,
    pt.driver_id,
    m.nome AS motorista,
    COUNT(DISTINCT pt.service_id) AS transportes_realizados,
    COUNT(*) AS funcionarios_transportados
FROM public.passenger_trips pt
LEFT JOIN public.motoristas m ON m.id = pt.driver_id
GROUP BY pt.trip_date, COALESCE(NULLIF(pt.hotel_name, ''), 'Sem Hotel'), pt.driver_id, m.nome;

CREATE OR REPLACE VIEW public.vw_employee_transport_monthly AS
SELECT
    date_trunc('month', pt.trip_date)::date AS month,
    pt.employee_id,
    MAX(sp.employee_name) AS employee_name,
    COUNT(DISTINCT pt.trip_date) AS transport_days,
    SUM(pt.transport_price_per_day) AS total_cost
FROM public.passenger_trips pt
LEFT JOIN public.service_passengers sp
    ON sp.service_id = pt.service_id
   AND sp.employee_id = pt.employee_id
GROUP BY 1, 2;

ALTER TABLE public.service_passengers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passenger_trips ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'service_passengers'
          AND policyname = 'Public Access'
    ) THEN
        CREATE POLICY "Public Access"
        ON public.service_passengers
        FOR ALL
        USING (TRUE)
        WITH CHECK (TRUE);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'passenger_trips'
          AND policyname = 'Public Access'
    ) THEN
        CREATE POLICY "Public Access"
        ON public.passenger_trips
        FOR ALL
        USING (TRUE)
        WITH CHECK (TRUE);
    END IF;
END;
$$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.service_passengers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.passenger_trips;