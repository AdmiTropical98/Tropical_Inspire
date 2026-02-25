import { supabase } from '../lib/supabase';
import type { InvoiceImport, InvoiceImportStatus } from '../types';

const INVOICE_IMPORT_BUCKET = 'invoices';
const FALLBACK_IMPORT_BUCKET = 'documents';
const IMPORT_BUCKETS = [INVOICE_IMPORT_BUCKET, FALLBACK_IMPORT_BUCKET];

const randomToken = () => Math.random().toString(36).slice(2);

const resolveImportStatus = (status: unknown): InvoiceImportStatus => {
    if (status === 'ready' || status === 'processing' || status === 'confirmed' || status === 'failed') {
        return status;
    }
    if (status === 'error') return 'failed';
    return 'processing';
};

const normalizeImportRow = (row: any): InvoiceImport => ({
    ...row,
    file_path: row?.file_path || row?.storage_path || '',
    status: resolveImportStatus(row?.status),
    error: row?.error ?? row?.error_message ?? null,
});

const getMissingColumn = (error: any): string | null => {
    const message = String(error?.message || '');
    const details = String(error?.details || '');
    const combined = `${message}\n${details}`;

    const postgrestMatch = combined.match(/Could not find the '([^']+)' column/i);
    if (postgrestMatch?.[1]) return postgrestMatch[1];

    const postgresMatch = combined.match(/column\s+"?([a-zA-Z0-9_]+)"?\s+does not exist/i);
    if (postgresMatch?.[1]) return postgresMatch[1];

    return null;
};

const resolveImportStoragePath = (row: any): string => row?.file_path || row?.storage_path || '';

const uploadToAvailableBucket = async (storagePath: string, file: File) => {
    let lastError: any = null;

    for (const bucket of IMPORT_BUCKETS) {
        const { error } = await supabase.storage
            .from(bucket)
            .upload(storagePath, file, { upsert: false, contentType: file.type || 'application/pdf' });

        if (!error) {
            return { bucket, storagePath };
        }

        lastError = error;
    }

    throw lastError || new Error('Unable to upload file to any supported bucket');
};

const createSignedUrlFromAvailableBucket = async (storagePath: string) => {
    let lastError: any = null;

    for (const bucket of IMPORT_BUCKETS) {
        const { data, error } = await supabase.storage
            .from(bucket)
            .createSignedUrl(storagePath, 60 * 5);

        if (!error && data?.signedUrl) {
            return { bucket, signedUrl: data.signedUrl };
        }

        lastError = error;
    }

    throw lastError || new Error('Unable to generate signed URL for parsing');
};

const insertImportRowWithFallback = async (storagePath: string) => {
    const payload: Record<string, unknown> = {
        file_path: storagePath,
        status: 'processing',
    };

    for (let attempt = 0; attempt < 6; attempt += 1) {
        const { data, error } = await supabase
            .from('invoice_imports')
            .insert(payload)
            .select('*')
            .single();

        if (!error && data) return data;

        const missingColumn = getMissingColumn(error);
        if (!missingColumn || !(missingColumn in payload)) {
            throw error || new Error('Unable to create invoice import');
        }

        delete payload[missingColumn];
        if (missingColumn === 'file_path') {
            payload.storage_path = storagePath;
        }
    }

    throw new Error('Unable to create invoice import');
};

const updateImportRowWithFallback = async (importId: string, data: Record<string, unknown>) => {
    const payload = { ...data };

    for (let attempt = 0; attempt < 8; attempt += 1) {
        const { error } = await supabase
            .from('invoice_imports')
            .update(payload)
            .eq('id', importId);

        if (!error) return;

        const missingColumn = getMissingColumn(error);
        if (!missingColumn || !(missingColumn in payload)) {
            throw error;
        }

        delete payload[missingColumn];
    }

    throw new Error('Unable to update invoice import');
};

const invokeInvoiceParser = async (importId: string, signedUrl: string): Promise<string | null> => {
    const parseResult = await supabase.functions.invoke('parse-invoice', {
        body: {
            importId,
            fileUrl: signedUrl,
        },
    });

    if (!parseResult.error) return null;

    const fallbackResult = await supabase.functions.invoke('process-invoice-import', {
        body: {
            importId,
        },
    });

    if (!fallbackResult.error) return null;

    const parseErrorMessage = String((parseResult.error as any)?.message || parseResult.error || 'parse-invoice failed');
    const fallbackErrorMessage = String((fallbackResult.error as any)?.message || fallbackResult.error || 'process-invoice-import failed');
    return `OCR unavailable: ${parseErrorMessage} | fallback: ${fallbackErrorMessage}`;
};

export async function createInvoiceImportFromPdf(file: File): Promise<InvoiceImport> {
    const fileExt = file.name.split('.').pop() || 'pdf';
    const fileName = `${Date.now()}-${randomToken()}.${fileExt}`;
    const storagePath = `raw/${fileName}`;

    await uploadToAvailableBucket(storagePath, file);

    const importRow = await insertImportRowWithFallback(storagePath);

    const { signedUrl } = await createSignedUrlFromAvailableBucket(resolveImportStoragePath(importRow));

    const parserError = await invokeInvoiceParser(importRow.id, signedUrl);

    if (parserError) {
        try {
            await updateImportRowWithFallback(importRow.id, {
                status: 'failed' as InvoiceImportStatus,
                error: parserError,
                error_message: parserError,
                processed_at: new Date().toISOString(),
            });
        } catch {
            // ignore secondary update failures
        }

        return normalizeImportRow({
            ...importRow,
            status: 'failed',
            error: parserError,
            error_message: parserError,
        });
    }

    return normalizeImportRow(importRow);
}

export async function getInvoiceImport(importId: string): Promise<InvoiceImport> {
    const { data, error } = await supabase
        .from('invoice_imports')
        .select('*')
        .eq('id', importId)
        .single();

    if (error || !data) throw error || new Error('Invoice import not found');
    return normalizeImportRow(data);
}

export async function markInvoiceImportConfirmed(importId: string, supplierInvoiceId: string) {
    await updateImportRowWithFallback(importId, {
        status: 'confirmed' as InvoiceImportStatus,
        supplier_invoice_id: supplierInvoiceId,
        error: null,
        error_message: null,
        confirmed_at: new Date().toISOString(),
    });
}

export async function reparseInvoiceImport(importId: string, filePath: string) {
    const { signedUrl } = await createSignedUrlFromAvailableBucket(filePath);

    await updateImportRowWithFallback(importId, {
        status: 'processing' as InvoiceImportStatus,
        error: null,
        error_message: null,
        processed_at: null,
    });

    const parserError = await invokeInvoiceParser(importId, signedUrl);
    if (parserError) {
        try {
            await updateImportRowWithFallback(importId, {
                status: 'failed' as InvoiceImportStatus,
                error: parserError,
                error_message: parserError,
                processed_at: new Date().toISOString(),
            });
        } catch {
            // ignore secondary update failures
        }
    }
}

export async function getInvoiceImportPreviewUrl(filePath: string): Promise<string | null> {
    if (!filePath) return null;

    for (const bucket of IMPORT_BUCKETS) {
        const { data, error } = await supabase.storage.from(bucket).createSignedUrl(filePath, 60 * 10);
        if (!error && data?.signedUrl) return data.signedUrl;
    }

    return null;
}
