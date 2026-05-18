-- Migration: Granular Permissions System
-- Created: 2026-02-22

-- 1. Add permissions column to user_profiles
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT NULL;

-- 2. Create Role Permissions Defaults Table
CREATE TABLE IF NOT EXISTS public.role_permissions_defaults (
    role public.user_role PRIMARY KEY,
    permissions JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.role_permissions_defaults ENABLE ROW LEVEL SECURITY;

-- 3. Initial Defaults
INSERT INTO public.role_permissions_defaults (role, permissions)
VALUES 
('ADMIN_MASTER', '{
    "dashboard": ["ver", "criar", "editar", "eliminar", "exportar", "aprovar"],
    "frota": ["ver", "criar", "editar", "eliminar", "exportar", "aprovar"],
    "escalas": ["ver", "criar", "editar", "eliminar", "exportar", "aprovar"],
    "horas": ["ver", "criar", "editar", "eliminar", "exportar", "aprovar"],
    "combustivel": ["ver", "criar", "editar", "eliminar", "exportar", "aprovar"],
    "requisicoes": ["ver", "criar", "editar", "eliminar", "exportar", "aprovar"],
    "equipa": ["ver", "criar", "editar", "eliminar", "exportar", "aprovar"],
    "financeiro": ["ver", "criar", "editar", "eliminar", "exportar", "aprovar"],
    "relatorios": ["ver", "criar", "editar", "eliminar", "exportar", "aprovar"],
    "utilizadores": ["ver", "criar", "editar", "eliminar", "exportar", "aprovar"],
    "permissoes": ["ver", "criar", "editar", "eliminar", "exportar", "aprovar"],
    "mensagens": ["ver", "criar", "editar", "eliminar", "exportar", "aprovar"],
    "configuracoes": ["ver", "criar", "editar", "eliminar", "exportar", "aprovar"]
}'),
('ADMIN', '{
    "dashboard": ["ver", "criar", "editar", "eliminar", "exportar"],
    "frota": ["ver", "criar", "editar", "eliminar", "exportar"],
    "escalas": ["ver", "criar", "editar", "eliminar", "exportar"],
    "horas": ["ver", "criar", "editar", "eliminar", "exportar"],
    "combustivel": ["ver", "criar", "editar", "eliminar", "exportar"],
    "requisicoes": ["ver", "criar", "editar", "eliminar", "exportar"],
    "equipa": ["ver", "criar", "editar", "eliminar", "exportar"],
    "financeiro": ["ver", "criar", "editar", "eliminar", "exportar"],
    "relatorios": ["ver", "criar", "editar", "eliminar", "exportar"],
    "utilizadores": ["ver", "criar", "editar", "exportar"],
    "permissoes": ["ver"],
    "mensagens": ["ver", "criar", "editar", "eliminar", "exportar"],
    "configuracoes": ["ver", "editar"]
}'),
('GESTOR', '{
    "dashboard": ["ver"],
    "frota": ["ver", "criar", "editar", "exportar"],
    "escalas": ["ver", "criar", "editar", "exportar"],
    "horas": ["ver", "criar", "editar", "exportar"],
    "combustivel": ["ver", "criar", "editar", "exportar"],
    "requisicoes": ["ver", "criar", "editar"],
    "equipa": ["ver"],
    "financeiro": ["ver"],
    "relatorios": ["ver", "exportar"],
    "utilizadores": ["ver"],
    "permissoes": [],
    "mensagens": ["ver", "criar"],
    "configuracoes": []
}'),
('SUPERVISOR', '{
    "dashboard": ["ver"],
    "frota": ["ver"],
    "escalas": ["ver", "criar"],
    "horas": ["ver"],
    "combustivel": ["ver"],
    "requisicoes": ["ver", "criar"],
    "equipa": ["ver"],
    "financeiro": [],
    "relatorios": ["ver"],
    "utilizadores": ["ver"],
    "permissoes": [],
    "mensagens": ["ver", "criar"],
    "configuracoes": []
}'),
('OFICINA', '{
    "dashboard": ["ver"],
    "frota": ["ver"],
    "escalas": ["ver"],
    "horas": ["ver"],
    "combustivel": ["ver"],
    "requisicoes": ["ver", "criar", "editar"],
    "equipa": [],
    "financeiro": [],
    "relatorios": ["ver"],
    "utilizadores": [],
    "permissoes": [],
    "mensagens": ["ver", "criar"],
    "configuracoes": []
}'),
('MOTORISTA', '{
    "dashboard": ["ver"],
    "frota": [],
    "escalas": ["ver"],
    "horas": ["ver", "criar"],
    "combustivel": ["ver", "criar"],
    "requisicoes": [],
    "equipa": [],
    "financeiro": [],
    "relatorios": [],
    "utilizadores": [],
    "permissoes": [],
    "mensagens": ["ver", "criar"],
    "configuracoes": []
}')
ON CONFLICT (role) DO UPDATE SET permissions = EXCLUDED.permissions;

-- 4. Policies
CREATE POLICY "Anyone authenticated can view defaults" ON public.role_permissions_defaults
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Only Admin Master can edit defaults" ON public.role_permissions_defaults
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'ADMIN_MASTER'));

-- 5. Audit Log Enhancements
-- Already created audit_logs table in previous migration. 
-- We'll explicitly log permission changes via direct inserts in application logic as requested.
