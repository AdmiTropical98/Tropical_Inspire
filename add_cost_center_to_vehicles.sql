-- Migration: Add Cost Center to Vehicles
-- This allows assigning a default Cost Center to a Vehicle for automated expense allocation.

ALTER TABLE viaturas
ADD COLUMN centro_custo_id UUID REFERENCES centros_custos(id);

-- Optional: Create an index for performance
CREATE INDEX idx_viaturas_centro_custo_id ON viaturas(centro_custo_id);

-- Notes: 
-- After running this, existing vehicles will have NULL cost center.
-- You must go to the "Viaturas" page and assign Cost Centers to existing vehicles.
