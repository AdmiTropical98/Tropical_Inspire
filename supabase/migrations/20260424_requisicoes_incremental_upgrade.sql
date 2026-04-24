-- MIGRAÇÃO INCREMENTAL: Requisições mais completas e profissionais
-- Data: 2026-04-24

-- 2️⃣ Adicionar tipo de requisição
ALTER TABLE public.requisicoes ADD COLUMN IF NOT EXISTS tipo_requisicao TEXT;

-- 3️⃣ Associar requisição à viatura (quando aplicável)
ALTER TABLE public.requisicoes ADD COLUMN IF NOT EXISTS km_viatura NUMERIC;
ALTER TABLE public.requisicoes ADD COLUMN IF NOT EXISTS tipo_intervencao TEXT;

-- 4️⃣ Permitir múltiplos itens por requisição (expandir tabela auxiliar)
ALTER TABLE public.requisicoes_itens ADD COLUMN IF NOT EXISTS item_nome TEXT;
ALTER TABLE public.requisicoes_itens ADD COLUMN IF NOT EXISTS stock_item_id UUID;
ALTER TABLE public.requisicoes_itens ADD COLUMN IF NOT EXISTS custo_estimado NUMERIC;
ALTER TABLE public.requisicoes_itens ADD COLUMN IF NOT EXISTS custo_real NUMERIC;

-- 5️⃣ Adicionar workflow de estados
ALTER TABLE public.requisicoes ADD COLUMN IF NOT EXISTS estado TEXT;

-- 7️⃣ Adicionar prioridade operacional
ALTER TABLE public.requisicoes ADD COLUMN IF NOT EXISTS prioridade TEXT;

-- 8️⃣ Adicionar anexos técnicos
CREATE TABLE IF NOT EXISTS public.requisicoes_anexos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requisicao_id UUID REFERENCES public.requisicoes(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    tipo TEXT, -- foto, pdf, orçamento, fatura, relatório
    nome_arquivo TEXT,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT now()
);
ALTER TABLE public.requisicoes_anexos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Access" ON public.requisicoes_anexos FOR ALL USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.requisicoes_anexos;

-- 9️⃣ Adicionar controlo financeiro (já incluso nos itens)
-- (custo_estimado, custo_real em requisicoes_itens)

-- 6️⃣ Integração com stock será feita na aplicação, não no banco.

-- 1️⃣ Clientes e Fornecedores já são opcionais (ON DELETE SET NULL)
-- Permitir criação inline será feito na aplicação.

--  🔟 Compatibilidade garantida: nenhuma coluna/tabela removida ou alterada.

-- FIM DA MIGRAÇÃO
