-- Add routing and auditing tables

-- 1. Table for planned routes
CREATE TABLE IF NOT EXISTS public.rotas_planeadas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    motorista_id UUID REFERENCES public.motoristas(id),
    viatura_id UUID REFERENCES public.viaturas(id),
    data DATE NOT NULL DEFAULT CURRENT_DATE,
    distancia_estimada DECIMAL(10,2),
    tempo_estimado INTEGER, -- minutes
    consumo_estimado DECIMAL(10,2),
    custo_estimado DECIMAL(10,2),
    rota_json JSONB NOT NULL,
    estado TEXT DEFAULT 'planeada' CHECK (estado IN ('planeada', 'concluida', 'cancelada')),
    flag_desvio BOOLEAN DEFAULT FALSE,
    justificacao_desvio TEXT,
    distancia_real DECIMAL(10,2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    concluida_at TIMESTAMPTZ
);

-- 2. Table for operational logs (Auditing)
CREATE TABLE IF NOT EXISTS public.logs_operacionais (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    utilizador TEXT NOT NULL, -- Name or email of the actor
    acao TEXT NOT NULL,
    data_hora TIMESTAMPTZ DEFAULT NOW(),
    referencia_id TEXT, -- ID of the related object (route, transaction, etc.)
    detalhes_json JSONB,
    cost_center_id UUID REFERENCES public.centros_custos(id)
);

-- 3. Enable RLS
ALTER TABLE public.rotas_planeadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs_operacionais ENABLE ROW LEVEL SECURITY;

-- 4. Simple policies (Allow all for now as per project context, or refine if needed)
CREATE POLICY "Allow all on rotas_planeadas" ON public.rotas_planeadas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on logs_operacionais" ON public.logs_operacionais FOR ALL USING (true) WITH CHECK (true);

-- 5. Add index for performance
CREATE INDEX IF NOT EXISTS idx_rotas_data ON public.rotas_planeadas(data);
CREATE INDEX IF NOT EXISTS idx_rotas_motorista ON public.rotas_planeadas(motorista_id);
CREATE INDEX IF NOT EXISTS idx_logs_data ON public.logs_operacionais(data_hora);
