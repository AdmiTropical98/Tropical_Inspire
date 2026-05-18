-- EXECUTAR NO SQL EDITOR DO SUPABASE
-- Este script corrige a permissão de gravação na tabela de configurações

-- 1. Garante que as políticas antigas sejam removidas
DROP POLICY IF EXISTS "Authenticated users can update app_settings" ON app_settings;
DROP POLICY IF EXISTS "Everyone can select app_settings" ON app_settings;

-- 2. Permite que qualquer pessoa (mesmo sem login) leia as configurações (necessário para carregar as permissões no início)
CREATE POLICY "Permitir leitura para todos"
ON app_settings FOR SELECT
USING (true);

-- 3. Permite que usuários autenticados (Admin) façam tudo na tabela
-- Usamos 'true' no USING e WITH CHECK para garantir que o RLS não bloqueie o UPSERT
CREATE POLICY "Permitir tudo para usuários autenticados"
ON app_settings FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 4. Garante que o RLS está ativo
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
