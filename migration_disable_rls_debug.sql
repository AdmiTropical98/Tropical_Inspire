-- DEBUG: DISABLE RLS COMPLETELY for User Tables
-- This removes all policy restrictions to prove if RLS is the cause.

ALTER TABLE public.motoristas DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.supervisores DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.gestores DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.oficina_users DISABLE ROW LEVEL SECURITY;

-- Verify/Grant basic permissions just in case
GRANT ALL ON public.motoristas TO authenticated;
GRANT ALL ON public.supervisores TO authenticated;
GRANT ALL ON public.gestores TO authenticated;
GRANT ALL ON public.oficina_users TO authenticated;
GRANT ALL ON public.motoristas TO service_role;
GRANT ALL ON public.supervisores TO service_role;
GRANT ALL ON public.gestores TO service_role;
GRANT ALL ON public.oficina_users TO service_role;
