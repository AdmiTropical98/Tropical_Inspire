-- ADICIONAR COLUNA "TYPE" E RECARREGAR CACHE
-- Corra este script no SQL Editor do Supabase

-- 1. Adicionar a coluna se nÃ£o existir
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'via_verde_toll_records' AND column_name = 'type') THEN
        ALTER TABLE public.via_verde_toll_records ADD COLUMN type TEXT DEFAULT 'toll';
    END IF;
END $$;

-- 2. ForÃ§ar o recarregamento da cache do esquema (para corrigir o erro PGRST204)
NOTIFY pgrst, 'reload config';
