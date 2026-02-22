-- ============================================================
-- MIGRATION: Criar tabelas de Modelos de Escala (Templates)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.escala_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome TEXT NOT NULL,
    centro_custo_id UUID REFERENCES public.centros_custos(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by UUID REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS public.escala_template_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id UUID REFERENCES public.escala_templates(id) ON DELETE CASCADE NOT NULL,
    hora_entrada TEXT,
    hora_saida TEXT,
    passageiro TEXT,
    local TEXT NOT NULL,
    referencia TEXT,
    obs TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS
ALTER TABLE public.escala_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escala_template_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read templates" ON public.escala_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to insert templates" ON public.escala_templates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated users to update templates" ON public.escala_templates FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to delete templates" ON public.escala_templates FOR DELETE TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to read template items" ON public.escala_template_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to insert template items" ON public.escala_template_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated users to update template items" ON public.escala_template_items FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to delete template items" ON public.escala_template_items FOR DELETE TO authenticated USING (true);

GRANT ALL ON public.escala_templates TO authenticated, anon, service_role;
GRANT ALL ON public.escala_template_items TO authenticated, anon, service_role;

-- ============================================================
-- SEED: Inserir Template Padrão (Escala Permanente Hotel)
-- ============================================================

DO $$
DECLARE
    template_id UUID;
BEGIN
    -- Criar o template padrão
    INSERT INTO public.escala_templates (id, nome)
    VALUES (uuid_generate_v4(), '🏨 Escala Permanente — Hotel')
    RETURNING id INTO template_id;

    -- Inserir os itens do template (12 turnos típicos de hotel)
    INSERT INTO public.escala_template_items (template_id, hora_entrada, hora_saida, passageiro, local) VALUES
    (template_id, '06:00', '14:00', 'Rececionista — Turno Manhã',  'Hotel'),
    (template_id, '06:30', '14:30', 'Cozinheiro — Turno Manhã',    'Hotel'),
    (template_id, '07:00', '15:00', 'Empregado de Mesa A',         'Hotel'),
    (template_id, '07:00', '15:00', 'Empregado de Mesa B',         'Hotel'),
    (template_id, '08:00', '17:00', 'Animador A',                  'Hotel'),
    (template_id, '08:00', '17:00', 'Animador B',                  'Hotel'),
    (template_id, '09:00', '17:00', 'Governanta',                  'Hotel'),
    (template_id, '14:00', '22:00', 'Rececionista — Turno Tarde',  'Hotel'),
    (template_id, '14:30', '22:30', 'Cozinheiro — Turno Tarde',    'Hotel'),
    (template_id, '15:00', '23:00', 'Empregado de Mesa C',         'Hotel'),
    (template_id, '22:00', '06:00', 'Segurança — Turno Noite',     'Hotel'),
    (template_id, '22:30', '06:30', 'Rececionista — Turno Noite',  'Hotel');

    RAISE NOTICE 'Template "Escala Permanente — Hotel" criado com sucesso! ID: %', template_id;
END $$;
