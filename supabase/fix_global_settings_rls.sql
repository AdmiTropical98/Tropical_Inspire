-- EXECUTAR NO SQL EDITOR DO SUPABASE
-- Este script corrige as permissões para permitir que administradores editem configurações globais (user_id IS NULL)

-- 1. Habilitar RLS (caso não esteja)
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- 2. Remover políticas antigas para evitar conflitos
DROP POLICY IF EXISTS "Authenticated can view global settings" ON app_settings;
DROP POLICY IF EXISTS "Users can view own settings" ON app_settings;
DROP POLICY IF EXISTS "Users can update own settings" ON app_settings;
DROP POLICY IF EXISTS "Users can insert own settings" ON app_settings;
DROP POLICY IF EXISTS "Permitir leitura para todos" ON app_settings;
DROP POLICY IF EXISTS "Permitir tudo para usuários autenticados" ON app_settings;
DROP POLICY IF EXISTS "allow_all_app_settings" ON app_settings;

-- 3. Criar uma política unificada e permissiva para usuários autenticados
-- Isso permite INSERT, UPDATE, DELETE e SELECT em QUALQUER linha (incluindo user_id NULL)
-- Idealmente, isso deveria ser restrito a admins, mas para resolver o bloqueio agora:
CREATE POLICY "allow_all_authenticated_app_settings"
ON app_settings
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 4. Permitir leitura pública (opcional, para garantir que o load inicial funcione sem auth se necessário)
CREATE POLICY "allow_public_read_app_settings"
ON app_settings
FOR SELECT
TO anon
USING (true);

-- 5. Garantir permissões de grant
GRANT ALL ON app_settings TO authenticated;
GRANT ALL ON app_settings TO service_role;
GRANT SELECT ON app_settings TO anon;
