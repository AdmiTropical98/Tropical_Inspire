-- Central de Comunicacoes (conversas operacionais em tempo real)
-- Compatibiliza as tabelas existentes (conversations/messages) e cria participantes.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 0) Bootstrap: garantir tabelas base em ambientes sem chat legado
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  participant_id UUID,
  type TEXT DEFAULT 'private',
  name TEXT,
  vehicle_id UUID,
  team_code TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  last_message_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID,
  user_id UUID,
  content TEXT,
  message TEXT,
  attachment_url TEXT,
  attachment_name TEXT,
  attachment_mime TEXT,
  mentions JSONB DEFAULT '[]'::jsonb,
  read_by UUID[] DEFAULT '{}'::uuid[],
  source TEXT DEFAULT 'user',
  type TEXT DEFAULT 'normal',
  metadata JSONB,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'conversations'
      AND policyname = 'Public Access conversations'
  ) THEN
    CREATE POLICY "Public Access conversations"
    ON public.conversations FOR ALL
    USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'messages'
      AND policyname = 'Public Access messages'
  ) THEN
    CREATE POLICY "Public Access messages"
    ON public.messages FOR ALL
    USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 1) conversations: expand to support team/vehicle/private/system
ALTER TABLE public.conversations
ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.conversations
ALTER COLUMN participant_id DROP NOT NULL;

ALTER TABLE public.conversations
DROP CONSTRAINT IF EXISTS conversations_user_id_fkey;

ALTER TABLE public.conversations
DROP CONSTRAINT IF EXISTS conversations_participant_id_fkey;

ALTER TABLE public.conversations
DROP CONSTRAINT IF EXISTS conversations_user_id_participant_id_key;

ALTER TABLE public.conversations
ADD COLUMN IF NOT EXISTS type TEXT;

ALTER TABLE public.conversations
ADD COLUMN IF NOT EXISTS name TEXT;

ALTER TABLE public.conversations
ADD COLUMN IF NOT EXISTS vehicle_id UUID;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'viaturas'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'conversations_vehicle_id_fkey'
    ) THEN
      ALTER TABLE public.conversations
      ADD CONSTRAINT conversations_vehicle_id_fkey
      FOREIGN KEY (vehicle_id) REFERENCES public.viaturas(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

ALTER TABLE public.conversations
ADD COLUMN IF NOT EXISTS team_code TEXT;

UPDATE public.conversations
SET type = 'private'
WHERE type IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'conversations_type_check'
  ) THEN
    ALTER TABLE public.conversations
    ADD CONSTRAINT conversations_type_check
    CHECK (type IN ('team', 'vehicle', 'private', 'system'));
  END IF;
END $$;

ALTER TABLE public.conversations
ALTER COLUMN type SET DEFAULT 'private';

-- 2) conversation_participants
CREATE TABLE IF NOT EXISTS public.conversation_participants (
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  user_name TEXT,
  user_role TEXT,
  joined_at TIMESTAMPTZ DEFAULT now(),
  last_read_at TIMESTAMPTZ,
  PRIMARY KEY (conversation_id, user_id)
);

-- Backfill participants from legacy conversation pair model
INSERT INTO public.conversation_participants (conversation_id, user_id)
SELECT c.id, c.user_id
FROM public.conversations c
WHERE c.user_id IS NOT NULL
ON CONFLICT (conversation_id, user_id) DO NOTHING;

INSERT INTO public.conversation_participants (conversation_id, user_id)
SELECT c.id, c.participant_id
FROM public.conversations c
WHERE c.participant_id IS NOT NULL
ON CONFLICT (conversation_id, user_id) DO NOTHING;

-- 3) messages: requested fields + compatibility
ALTER TABLE public.messages
ALTER COLUMN sender_id DROP NOT NULL;

ALTER TABLE public.messages
DROP CONSTRAINT IF EXISTS messages_sender_id_fkey;

ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS user_id UUID;

ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS message TEXT;

ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS attachment_url TEXT;

ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS attachment_name TEXT;

ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS attachment_mime TEXT;

ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS mentions JSONB DEFAULT '[]'::jsonb;

ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS read_by UUID[] DEFAULT '{}'::uuid[];

ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'user';

UPDATE public.messages
SET user_id = COALESCE(user_id, sender_id)
WHERE user_id IS NULL;

UPDATE public.messages
SET message = COALESCE(message, content)
WHERE message IS NULL;

-- 4) Driver operational status
ALTER TABLE public.motoristas
ADD COLUMN IF NOT EXISTS estado_operacional TEXT;

UPDATE public.motoristas
SET estado_operacional = 'disponivel'
WHERE estado_operacional IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'motoristas'
      AND column_name = 'status'
  ) THEN
    EXECUTE $sql$
      UPDATE public.motoristas
      SET estado_operacional = CASE
        WHEN status = 'ocupado' THEN 'em_servico'
        WHEN status = 'indisponivel' THEN 'indisponivel'
        ELSE 'disponivel'
      END
      WHERE estado_operacional IS NULL OR estado_operacional = 'disponivel'
    $sql$;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'motoristas_estado_operacional_check'
  ) THEN
    ALTER TABLE public.motoristas
    ADD CONSTRAINT motoristas_estado_operacional_check
    CHECK (estado_operacional IN ('disponivel', 'em_servico', 'a_abastecer', 'em_oficina', 'indisponivel'));
  END IF;
END $$;

ALTER TABLE public.motoristas
ALTER COLUMN estado_operacional SET DEFAULT 'disponivel';

ALTER TABLE public.motoristas
ALTER COLUMN estado_operacional SET NOT NULL;

-- 5) RLS policies for participants table
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Access conversation participants" ON public.conversation_participants;
CREATE POLICY "Public Access conversation participants"
ON public.conversation_participants FOR ALL
USING (true) WITH CHECK (true);

-- 6) Useful indexes
DO $$
BEGIN
  IF to_regclass('public.conversations') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_conversations_type ON public.conversations(type);
    CREATE INDEX IF NOT EXISTS idx_conversations_vehicle_id ON public.conversations(vehicle_id);
  END IF;

  IF to_regclass('public.messages') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_messages_conversation_created_at ON public.messages(conversation_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_messages_user_id ON public.messages(user_id);
  END IF;

  IF to_regclass('public.conversation_participants') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_conversation_participants_user_id ON public.conversation_participants(user_id);
  END IF;
END $$;

-- 7) Realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'conversation_participants'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_participants;
  END IF;
END $$;
