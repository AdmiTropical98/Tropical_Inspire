-- Alter vehicle_other_costs to support manual fleet cost entries for all categories
ALTER TABLE public.vehicle_other_costs 
  DROP CONSTRAINT IF EXISTS vehicle_other_costs_cost_category_check;

-- Add optional columns for supplier, cost center and general observations notes
ALTER TABLE public.vehicle_other_costs 
  ADD COLUMN IF NOT EXISTS fornecedor_id UUID REFERENCES public.fornecedores(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS centro_custo_id UUID REFERENCES public.centros_custos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS notes TEXT;
