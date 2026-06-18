-- Patch: Allow multiple IUC records per vehicle per year (remove unique constraint)
-- This allows registering corrections, partial payments and other edge cases.
ALTER TABLE public.vehicle_iuc_records
  DROP CONSTRAINT IF EXISTS vehicle_iuc_records_vehicle_id_fiscal_year_key;

-- Create a storage bucket for vehicle documents (if not exists)
-- NOTE: This requires execution with admin privileges in Supabase dashboard or a policy grant.
-- The app will attempt several buckets (vehicle-documents, uploads, documents, invoices)
-- and fall back gracefully to URL input if none are available.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'vehicle-documents',
  'vehicle-documents',
  true,
  52428800, -- 50MB limit
  ARRAY['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']
)
ON CONFLICT (id) DO NOTHING;

-- RLS policy for the bucket
INSERT INTO storage.policies (name, bucket_id, definition)
VALUES (
  'Authenticated users can upload vehicle documents',
  'vehicle-documents',
  '(role() = ''authenticated''::text)'
)
ON CONFLICT DO NOTHING;
