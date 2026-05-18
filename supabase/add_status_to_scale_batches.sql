-- Add status column for soft delete / cancellation
ALTER TABLE scale_batches 
ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';

-- Add created_by_role if it was missed earlier (defensive)
ALTER TABLE scale_batches 
ADD COLUMN IF NOT EXISTS created_by_role text;

-- Add constraint to ensure data integrity
ALTER TABLE scale_batches 
DROP CONSTRAINT IF EXISTS valid_status;

ALTER TABLE scale_batches 
ADD CONSTRAINT valid_status CHECK (status IN ('active', 'cancelled', 'completed'));

-- Update existing records to have 'active' status if null
UPDATE scale_batches 
SET status = 'active' 
WHERE status IS NULL;
