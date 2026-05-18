-- Add 'tipo' column to servicos table
-- Values: 'entrada', 'saida', 'outro'
ALTER TABLE servicos 
ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT 'outro';

-- Optional: Create an index if we plan to filter by this often
CREATE INDEX IF NOT EXISTS idx_servicos_tipo ON servicos(tipo);
