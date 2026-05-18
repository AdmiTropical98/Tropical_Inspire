-- Ensure invoice upload buckets and storage policies exist

INSERT INTO storage.buckets (id, name, public)
VALUES ('invoices', 'invoices', false)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public;

INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'storage'
          AND tablename = 'objects'
          AND policyname = 'invoice_upload_select'
    ) THEN
        CREATE POLICY "invoice_upload_select"
            ON storage.objects
            FOR SELECT
            USING (bucket_id IN ('invoices', 'documents'));
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'storage'
          AND tablename = 'objects'
          AND policyname = 'invoice_upload_insert'
    ) THEN
        CREATE POLICY "invoice_upload_insert"
            ON storage.objects
            FOR INSERT
            WITH CHECK (bucket_id IN ('invoices', 'documents'));
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'storage'
          AND tablename = 'objects'
          AND policyname = 'invoice_upload_update'
    ) THEN
        CREATE POLICY "invoice_upload_update"
            ON storage.objects
            FOR UPDATE
            USING (bucket_id IN ('invoices', 'documents'))
            WITH CHECK (bucket_id IN ('invoices', 'documents'));
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'storage'
          AND tablename = 'objects'
          AND policyname = 'invoice_upload_delete'
    ) THEN
        CREATE POLICY "invoice_upload_delete"
            ON storage.objects
            FOR DELETE
            USING (bucket_id IN ('invoices', 'documents'));
    END IF;
END
$$;
