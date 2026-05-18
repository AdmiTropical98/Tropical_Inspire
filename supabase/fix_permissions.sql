-- Executar este comando no Editor SQL do Supabase para corrigir o problema dos botões não funcionarem

-- 1. Permitir atualizações na tabela de notificações
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all for authenticated users on notifications" ON notifications;

CREATE POLICY "Enable all for authenticated users on notifications"
ON notifications FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 2. Permitir atualizações na tabela de transações de combustível
ALTER TABLE fuel_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all for authenticated users on fuel_transactions" ON fuel_transactions;

CREATE POLICY "Enable all for authenticated users on fuel_transactions"
ON fuel_transactions FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
