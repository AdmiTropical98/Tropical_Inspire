-- Fix requisition number shift after accidental duplicate creations on edit.
--
-- HOW TO USE
-- 1) Adjust the values in "params":
--    - target_year: year prefix used in numero (e.g. '26' for '26/0052')
--    - shift_by: how many numbers were added by mistake (e.g. 2)
-- 2) Run the preview query first.
-- 3) If preview is correct, run the UPDATE block.
--
-- IMPORTANT
-- - Always run in a transaction.
-- - Keep a backup/snapshot before applying in production.

-- ==========================================================
-- STEP 1: Preview (does not change data)
-- ==========================================================
WITH params AS (
    SELECT '26'::text AS target_year, 2::int AS shift_by
), candidates AS (
    SELECT
        r.id,
        r.numero AS numero_atual,
        split_part(r.numero, '/', 1) AS ano,
        split_part(r.numero, '/', 2)::int AS seq_atual,
        (
            split_part(r.numero, '/', 1) || '/' ||
            lpad((split_part(r.numero, '/', 2)::int - p.shift_by)::text, 4, '0')
        ) AS numero_corrigido
    FROM public.requisicoes r
    CROSS JOIN params p
    WHERE split_part(r.numero, '/', 1) = p.target_year
      AND split_part(r.numero, '/', 2) ~ '^[0-9]+$'
      AND split_part(r.numero, '/', 2)::int > p.shift_by
)
SELECT *
FROM candidates
ORDER BY seq_atual
LIMIT 200;

-- ==========================================================
-- STEP 2: Safety check for conflicts before update
-- If this returns rows, STOP and review before applying.
-- ==========================================================
WITH params AS (
    SELECT '26'::text AS target_year, 2::int AS shift_by
), candidates AS (
    SELECT
        r.id,
        r.numero AS numero_atual,
        (
            split_part(r.numero, '/', 1) || '/' ||
            lpad((split_part(r.numero, '/', 2)::int - p.shift_by)::text, 4, '0')
        ) AS numero_corrigido
    FROM public.requisicoes r
    CROSS JOIN params p
    WHERE split_part(r.numero, '/', 1) = p.target_year
      AND split_part(r.numero, '/', 2) ~ '^[0-9]+$'
      AND split_part(r.numero, '/', 2)::int > p.shift_by
)
SELECT c.id, c.numero_atual, c.numero_corrigido
FROM candidates c
JOIN public.requisicoes r2 ON r2.numero = c.numero_corrigido
ORDER BY c.numero_atual
LIMIT 200;

-- ==========================================================
-- STEP 3: Apply fix (uncomment and run)
-- ==========================================================
-- BEGIN;
--
-- WITH params AS (
--     SELECT '26'::text AS target_year, 2::int AS shift_by
-- )
-- LOCK TABLE public.requisicoes IN ROW EXCLUSIVE MODE;
--
-- UPDATE public.requisicoes r
-- SET numero = (
--     split_part(r.numero, '/', 1) || '/' ||
--     lpad((split_part(r.numero, '/', 2)::int - p.shift_by)::text, 4, '0')
-- )
-- FROM params p
-- WHERE split_part(r.numero, '/', 1) = p.target_year
--   AND split_part(r.numero, '/', 2) ~ '^[0-9]+$'
--   AND split_part(r.numero, '/', 2)::int > p.shift_by;
--
-- SELECT id, numero
-- FROM public.requisicoes
-- WHERE split_part(numero, '/', 1) = '26'
-- ORDER BY split_part(numero, '/', 2)::int
-- LIMIT 50;
--
-- COMMIT;
