-- Create a key-value store for application settings
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS app_settings (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read settings (needed for initial app load permissions)
CREATE POLICY "Everyone can read app_settings" 
ON app_settings FOR SELECT 
USING (true);

-- Allow only Admins to insert/update (You might need to adjust this policy based on your auth setup, 
-- but for now assuming 'authenticated' or manual insert via dashboard checks)
-- Since we don't have a rigid 'admin' role in auth.users metadata yet for all flows, 
-- we'll rely on app logic + maybe restrict write to authenticated users generally 
-- but strictly validation happens in UI.Ideally we restrict this to specific emails.
CREATE POLICY "Authenticated users can update app_settings" 
ON app_settings FOR ALL 
USING (auth.role() = 'authenticated');

-- Insert default permissions if they don't exist
INSERT INTO app_settings (key, value)
VALUES 
('permissions_supervisor', '["requisicoes", "requisicoes_edit", "requisicoes_delete", "viaturas", "motoristas", "fornecedores", "escalas", "escalas_import", "escalas_print", "escalas_create", "escalas_urgent", "escalas_view_pending", "horas", "hours_view_costs", "equipa-oficina", "combustivel", "combustivel_calibrate", "combustivel_edit_history", "centros_custos", "plataformas_externas"]'::jsonb),
('permissions_motorista', '["central_motorista", "requisicoes", "requisicoes_edit", "requisicoes_delete", "horas", "escalas", "plataformas_externas"]'::jsonb),
('permissions_oficina', '["viaturas", "requisicoes", "requisicoes_edit", "combustivel", "centros_custos"]'::jsonb)
ON CONFLICT (key) DO NOTHING;
