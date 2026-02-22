-- Create tables for Schedule Templates
CREATE TABLE IF NOT EXISTS public.escala_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome TEXT NOT NULL,
    centro_custo_id UUID REFERENCES public.centros_custo(id) ON DELETE SET NULL,
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

-- Policies for escala_templates
CREATE POLICY "Allow authenticated users to read templates" ON public.escala_templates
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to insert templates" ON public.escala_templates
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update templates" ON public.escala_templates
    FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to delete templates" ON public.escala_templates
    FOR DELETE TO authenticated USING (true);

-- Policies for escala_template_items
CREATE POLICY "Allow authenticated users to read template items" ON public.escala_template_items
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to insert template items" ON public.escala_template_items
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update template items" ON public.escala_template_items
    FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to delete template items" ON public.escala_template_items
    FOR DELETE TO authenticated USING (true);

-- Grant permissions
GRANT ALL ON public.escala_templates TO authenticated, anon, service_role;
GRANT ALL ON public.escala_template_items TO authenticated, anon, service_role;
