-- Migration: Secure Operational Backoffice Infrastructure
-- Created: 2026-02-22

-- 1. Create User Status Enum
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_status') THEN
        CREATE TYPE public.user_status AS ENUM (
            'ACTIVE',
            'INACTIVE',
            'BLOCKED'
        );
    END IF;
END $$;

-- 2. Add user_status to user_profiles
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS status public.user_status DEFAULT 'ACTIVE';

-- 3. Create Dashboard Statistics View
CREATE OR REPLACE VIEW public.backoffice_stats AS
SELECT
    (SELECT COUNT(*) FROM public.user_profiles WHERE last_login > NOW() - INTERVAL '24 hours') as active_users_today,
    (SELECT COUNT(*) FROM public.motoristas WHERE status = 'available') as available_drivers,
    (SELECT COUNT(*) FROM public.escalas WHERE data = CURRENT_DATE) as scales_today,
    (SELECT COUNT(*) FROM public.escalas WHERE status = 'pendente') as pending_scales,
    (SELECT COUNT(*) FROM public.abastecimentos WHERE data_hora > NOW() - INTERVAL '24 hours') as fuel_ops_today,
    (SELECT COALESCE(SUM(valor_total), 0) FROM public.faturas WHERE data_emissao = CURRENT_DATE) as revenue_today;

-- 4. Secure RLS for Backoffice Stats
ALTER VIEW public.backoffice_stats SET (security_invoker = on);

-- 5. Update Permissions Defaults for ADMIN_MASTER (Add Backoffice Module)
UPDATE public.role_permissions_defaults
SET permissions = jsonb_set(
    permissions,
    '{backoffice}',
    '["ver", "criar", "editar", "eliminar", "exportar", "aprovar"]'::jsonb
)
WHERE role = 'ADMIN_MASTER';

-- 6. Add "utilizadores_master" permission to legacy system for ADMIN_MASTER
-- This is a safety measure for components still using legacy hasAccess
INSERT INTO public.role_permissions (role, modules)
SELECT 'admin_master', COALESCE(modules, '[]'::jsonb) || '["backoffice"]'::jsonb
FROM public.role_permissions
WHERE role = 'admin_master'
ON CONFLICT (role) DO UPDATE SET modules = EXCLUDED.modules;

-- 7. Audit Log for Backoffice Initialization
INSERT INTO public.audit_logs (action, details)
VALUES ('BACKOFFICE_INIT', '{"message": "Backoffice operational infrastructure created"}');
