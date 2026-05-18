-- Refactor Workshop Module: Separate Stock (Parts) from Inventory (Tools)

-- 1. Rename workshop_items to stock_items
ALTER TABLE IF EXISTS workshop_items RENAME TO stock_items;

-- Ensure triggers and constraints are still valid (Postgres renaming usually handles this)

-- 2. Create workshop_assets table for permanent tools
CREATE TABLE IF NOT EXISTS workshop_assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    category TEXT,
    serial_number TEXT,
    purchase_date DATE,
    purchase_value NUMERIC(15, 2),
    assigned_technician_id UUID, -- References utilizadores, motoristas or staff
    status TEXT DEFAULT 'available', -- 'available', 'assigned', 'maintenance', 'retired'
    location TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Update stock_movements columns if needed 
-- (currently it uses item_id which points to the renamed stock_items table)

-- 4. Enable RLS for workshop_assets
ALTER TABLE workshop_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to workshop_assets for authenticated users" 
ON workshop_assets FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- 5. Add update trigger for workshop_assets
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_workshop_assets_updated_at
    BEFORE UPDATE ON workshop_assets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
