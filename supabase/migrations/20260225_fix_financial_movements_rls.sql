-- Fix RLS violations when posting immutable ledger movements
-- Ensures policies exist and posting function can insert via trigger flows.

ALTER TABLE public.financial_movements ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    policy_row RECORD;
BEGIN
    FOR policy_row IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'financial_movements'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.financial_movements', policy_row.policyname);
    END LOOP;
END
$$;

CREATE POLICY "financial_movements_select_all"
    ON public.financial_movements
    FOR SELECT
    USING (true);

CREATE POLICY "financial_movements_insert_all"
    ON public.financial_movements
    FOR INSERT
    WITH CHECK (true);

ALTER FUNCTION public.post_financial_movement(
    TIMESTAMPTZ,
    TEXT,
    UUID,
    TEXT,
    TEXT,
    UUID,
    UUID,
    NUMERIC,
    NUMERIC,
    UUID,
    UUID,
    BOOLEAN,
    UUID
) SECURITY DEFINER;

ALTER FUNCTION public.post_financial_movement(
    TIMESTAMPTZ,
    TEXT,
    UUID,
    TEXT,
    TEXT,
    UUID,
    UUID,
    NUMERIC,
    NUMERIC,
    UUID,
    UUID,
    BOOLEAN,
    UUID
) SET search_path = public;
