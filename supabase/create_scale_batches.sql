-- Create scale_batches table to group service launches
CREATE TABLE IF NOT EXISTS scale_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT, -- Stores user ID or Name
    reference_date DATE NOT NULL,
    centro_custo_id UUID REFERENCES centros_custos(id) ON DELETE SET NULL,
    notes TEXT
);

-- Add batch_id to servicos table to link services to their creation batch
ALTER TABLE servicos 
ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES scale_batches(id) ON DELETE SET NULL;

-- Index for faster lookup of batches
CREATE INDEX IF NOT EXISTS idx_servicos_batch_id ON servicos(batch_id);
