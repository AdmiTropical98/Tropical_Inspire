-- Enable RLS and Realtime for all tables

-- 1. Centros de Custos
CREATE TABLE IF NOT EXISTS public.centros_custos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    localizacao TEXT,
    codigo TEXT
);
ALTER TABLE public.centros_custos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Access" ON public.centros_custos FOR ALL USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.centros_custos;

-- 2. Fornecedores
CREATE TABLE IF NOT EXISTS public.fornecedores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    nif TEXT,
    morada TEXT,
    contacto TEXT,
    email TEXT,
    obs TEXT,
    foto TEXT
);
ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Access" ON public.fornecedores FOR ALL USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.fornecedores;

-- 3. Clientes
CREATE TABLE IF NOT EXISTS public.clientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    nif TEXT,
    email TEXT,
    morada TEXT,
    telefone TEXT
);
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Access" ON public.clientes FOR ALL USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.clientes;

-- 4. Viaturas
CREATE TABLE IF NOT EXISTS public.viaturas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    matricula TEXT NOT NULL,
    marca TEXT NOT NULL,
    modelo TEXT NOT NULL,
    ano TEXT,
    obs TEXT,
    preco_diario NUMERIC,
    seguro JSONB,
    documentos JSONB -- Keeping small nested items as JSONB for simplicity
);
ALTER TABLE public.viaturas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Access" ON public.viaturas FOR ALL USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.viaturas;

-- 5. Viaturas - Manutenções (Separated)
CREATE TABLE IF NOT EXISTS public.viaturas_manutencoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    viatura_id UUID REFERENCES public.viaturas(id) ON DELETE CASCADE,
    data TIMESTAMP WITH TIME ZONE,
    tipo TEXT,
    km NUMERIC,
    oficina TEXT,
    custo NUMERIC,
    descricao TEXT,
    pdf_url TEXT
);
ALTER TABLE public.viaturas_manutencoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Access" ON public.viaturas_manutencoes FOR ALL USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.viaturas_manutencoes;

-- 6. Viaturas - Multas (Separated)
CREATE TABLE IF NOT EXISTS public.viaturas_multas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    viatura_id UUID REFERENCES public.viaturas(id) ON DELETE CASCADE,
    data TIMESTAMP WITH TIME ZONE,
    valor NUMERIC,
    motivo TEXT,
    local TEXT,
    pago BOOLEAN DEFAULT false,
    obs TEXT
);
ALTER TABLE public.viaturas_multas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Access" ON public.viaturas_multas FOR ALL USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.viaturas_multas;

-- 7. Motoristas
CREATE TABLE IF NOT EXISTS public.motoristas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    foto TEXT,
    contacto TEXT,
    carta_conducao TEXT,
    email TEXT,
    obs TEXT,
    pin TEXT,
    vencimento_base NUMERIC,
    valor_hora NUMERIC,
    folgas JSONB,
    blocked_permissions JSONB,
    turno_inicio TEXT,
    turno_fim TEXT,
    cartrack_key TEXT,
    data_registo TIMESTAMP WITH TIME ZONE DEFAULT now()
);
ALTER TABLE public.motoristas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Access" ON public.motoristas FOR ALL USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.motoristas;

-- 8. Motoristas - Ausências (Separated)
CREATE TABLE IF NOT EXISTS public.motoristas_ausencias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    motorista_id UUID REFERENCES public.motoristas(id) ON DELETE CASCADE,
    inicio TIMESTAMP WITH TIME ZONE,
    fim TIMESTAMP WITH TIME ZONE,
    tipo TEXT,
    motivo TEXT,
    aprovado BOOLEAN DEFAULT false
);
ALTER TABLE public.motoristas_ausencias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Access" ON public.motoristas_ausencias FOR ALL USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.motoristas_ausencias;

-- 9. Serviços
CREATE TABLE IF NOT EXISTS public.servicos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    motorista_id UUID REFERENCES public.motoristas(id) ON DELETE SET NULL,
    passageiro TEXT,
    hora TEXT,
    origem TEXT,
    destino TEXT,
    voo TEXT,
    obs TEXT,
    concluido BOOLEAN DEFAULT false,
    centro_custo_id UUID REFERENCES public.centros_custos(id) ON DELETE SET NULL
);
ALTER TABLE public.servicos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Access" ON public.servicos FOR ALL USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.servicos;

-- 10. Requisições
CREATE TABLE IF NOT EXISTS public.requisicoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero SERIAL, -- Auto increment number
    data TIMESTAMP WITH TIME ZONE DEFAULT now(),
    tipo TEXT,
    viatura_id UUID REFERENCES public.viaturas(id) ON DELETE SET NULL,
    centro_custo_id UUID REFERENCES public.centros_custos(id) ON DELETE SET NULL,
    fornecedor_id UUID REFERENCES public.fornecedores(id) ON DELETE SET NULL,
    obs TEXT,
    status TEXT DEFAULT 'pendente',
    fatura TEXT,
    criado_por TEXT
);
ALTER TABLE public.requisicoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Access" ON public.requisicoes FOR ALL USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.requisicoes;

-- 11. Requisições - Itens (Separated)
CREATE TABLE IF NOT EXISTS public.requisicoes_itens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requisicao_id UUID REFERENCES public.requisicoes(id) ON DELETE CASCADE,
    descricao TEXT,
    quantidade NUMERIC
);
ALTER TABLE public.requisicoes_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Access" ON public.requisicoes_itens FOR ALL USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.requisicoes_itens;

-- 12. Supervisores
CREATE TABLE IF NOT EXISTS public.supervisores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    foto TEXT,
    email TEXT,
    telemovel TEXT,
    pin TEXT,
    password TEXT,
    status TEXT DEFAULT 'active',
    blocked_permissions JSONB,
    data_registo TIMESTAMP WITH TIME ZONE DEFAULT now()
);
ALTER TABLE public.supervisores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Access" ON public.supervisores FOR ALL USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.supervisores;

-- 13. Oficina Users
CREATE TABLE IF NOT EXISTS public.oficina_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    foto TEXT,
    email TEXT, -- Optional now
    telemovel TEXT, -- NEW: For login
    pin TEXT,
    status TEXT DEFAULT 'active',
    blocked_permissions JSONB,
    data_registo TIMESTAMP WITH TIME ZONE DEFAULT now()
);
ALTER TABLE public.oficina_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Access" ON public.oficina_users FOR ALL USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.oficina_users;

-- 14. Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL,
    data JSONB,
    status TEXT,
    response JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Access" ON public.notifications FOR ALL USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- 15. Fuel Tank
CREATE TABLE IF NOT EXISTS public.fuel_tank (
    id TEXT PRIMARY KEY DEFAULT 'main',
    capacity NUMERIC,
    current_level NUMERIC,
    pump_totalizer NUMERIC,
    last_refill_date TIMESTAMP WITH TIME ZONE,
    average_price NUMERIC
);
ALTER TABLE public.fuel_tank ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Access" ON public.fuel_tank FOR ALL USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.fuel_tank;

-- 16. Fuel Transactions
CREATE TABLE IF NOT EXISTS public.fuel_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID REFERENCES public.motoristas(id) ON DELETE SET NULL,
    vehicle_id TEXT, -- Might link to viaturas but sometimes just text plate
    liters NUMERIC,
    km NUMERIC,
    staff_id TEXT,
    staff_name TEXT,
    status TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT now(),
    pump_counter_after NUMERIC,
    price_per_liter NUMERIC,
    total_cost NUMERIC,
    centro_custo_id UUID REFERENCES public.centros_custos(id) ON DELETE SET NULL
);
ALTER TABLE public.fuel_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Access" ON public.fuel_transactions FOR ALL USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.fuel_transactions;

-- 17. Tank Refills
CREATE TABLE IF NOT EXISTS public.tank_refills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    liters_added NUMERIC,
    level_before NUMERIC,
    level_after NUMERIC,
    total_spent_since_last NUMERIC,
    pump_meter_reading NUMERIC,
    system_expected_reading NUMERIC,
    supplier TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT now(),
    staff_id TEXT,
    staff_name TEXT,
    price_per_liter NUMERIC,
    total_cost NUMERIC
);
ALTER TABLE public.tank_refills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Access" ON public.tank_refills FOR ALL USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.tank_refills;

-- 18. Eva Transports
CREATE TABLE IF NOT EXISTS public.eva_transports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_date DATE,
    route TEXT,
    amount NUMERIC,
    notes TEXT,
    logged_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
ALTER TABLE public.eva_transports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Access" ON public.eva_transports FOR ALL USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.eva_transports;

-- 19. Eva Transport Days
CREATE TABLE IF NOT EXISTS public.eva_transport_days (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transport_id UUID REFERENCES public.eva_transports(id) ON DELETE CASCADE,
    date DATE,
    has_issue BOOLEAN DEFAULT false,
    issue_type TEXT,
    issue_description TEXT,
    issue_severity TEXT
);
ALTER TABLE public.eva_transport_days ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Access" ON public.eva_transport_days FOR ALL USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.eva_transport_days;

-- 20. User Layouts
CREATE TABLE IF NOT EXISTS public.user_layouts (
    user_id UUID PRIMARY KEY,
    layout_data JSONB,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
ALTER TABLE public.user_layouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Access" ON public.user_layouts FOR ALL USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_layouts;
