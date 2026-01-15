-- Add SERIAL column for human-readable IDs
ALTER TABLE scale_batches
ADD COLUMN IF NOT EXISTS serial_number BIGSERIAL;

-- Create index for faster lookups if needed (though serial is usually fast enough)
CREATE INDEX IF NOT EXISTS idx_scale_batches_serial_number ON scale_batches(serial_number);

-- (Optional) If we wanted to backfill existing rows with numbers, the default BIGSERIAL behaviour 
-- might start at 1 for new rows but existing rows would be null unless we update them.
-- This block attempts to update existing rows that might be null
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM scale_batches WHERE serial_number IS NULL) THEN
        WITH ranked AS (
            SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) as rn
            FROM scale_batches
            WHERE serial_number IS NULL
        )
        UPDATE scale_batches sb
        SET serial_number = r.rn
        FROM ranked r
        WHERE sb.id = r.id;
    END IF;
END $$;
