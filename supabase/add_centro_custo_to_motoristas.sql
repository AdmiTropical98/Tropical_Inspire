-- Add centro_custo_id column to motoristas table
ALTER TABLE motoristas 
ADD COLUMN IF NOT EXISTS centro_custo_id UUID REFERENCES centros_custos(id) ON DELETE SET NULL;
