-- Create table for Service History (Audit Log)
CREATE TABLE IF NOT EXISTS servico_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    servico_id UUID REFERENCES servicos(id) ON DELETE CASCADE,
    action TEXT NOT NULL, -- 'CREATE', 'UPDATE', 'DELETE'
    previous_data JSONB,
    new_data JSONB,
    changed_by TEXT, -- Store User ID (UUID string)
    changed_by_name TEXT, -- Store User Name for easy display
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster filtering by service or date
CREATE INDEX IF NOT EXISTS idx_servico_history_servico_id ON servico_history(servico_id);
CREATE INDEX IF NOT EXISTS idx_servico_history_timestamp ON servico_history(timestamp);
