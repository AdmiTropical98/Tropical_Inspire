ALTER TABLE public.servicos
ADD COLUMN IF NOT EXISTS status TEXT;

ALTER TABLE public.servicos
ALTER COLUMN status SET DEFAULT 'scheduled';

UPDATE public.servicos
SET status = CASE
    WHEN COALESCE(destination_confirmed, FALSE)
      OR destination_arrival_time IS NOT NULL
      OR COALESCE(concluido, FALSE)
        THEN 'completed'
    WHEN (
        hora ~ '^[0-9]{2}:[0-9]{2}$'
        AND ((COALESCE(data::date, CURRENT_DATE)::text || ' ' || hora)::timestamp <= NOW())
    )
      OR (
        hora ~ '^\d{4}-\d{2}-\d{2}T'
        AND (hora::timestamptz <= NOW())
      )
        THEN 'active'
    ELSE 'scheduled'
END
WHERE status IS NULL
   OR status IN ('pending', 'started', 'URGENTE', 'active', 'completed', 'scheduled');

UPDATE public.servicos
SET concluido = TRUE
WHERE status = 'completed' AND COALESCE(concluido, FALSE) = FALSE;

CREATE INDEX IF NOT EXISTS idx_servicos_status
ON public.servicos(status);
