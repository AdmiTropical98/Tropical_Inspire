import { supabase } from '../lib/supabase';
import type { InvoiceImport, InvoiceImportStatus } from '../types';

const INVOICE_IMPORT_BUCKET = 'invoices';

const randomToken = () => Math.random().toString(36).slice(2);

export async function createInvoiceImportFromPdf(file: File): Promise<InvoiceImport> {
    const fileExt = file.name.split('.').pop() || 'pdf';
    const fileName = `${Date.now()}-${randomToken()}.${fileExt}`;
    const storagePath = `raw/${fileName}`;

    const { error: uploadError } = await supabase.storage
        .from(INVOICE_IMPORT_BUCKET)
        .upload(storagePath, file, { upsert: false, contentType: file.type || 'application/pdf' });

    if (uploadError) throw uploadError;

    const { data: importRow, error: insertError } = await supabase
        .from('invoice_imports')
        .insert({
            file_path: storagePath,
            status: 'processing',
        })
        .select('*')
        .single();

    if (insertError || !importRow) {
        throw insertError || new Error('Unable to create invoice import');
    }

    const { data: signedData, error: signedError } = await supabase.storage
        .from(INVOICE_IMPORT_BUCKET)
        .createSignedUrl(storagePath, 60 * 5);

    if (signedError || !signedData?.signedUrl) {
        throw signedError || new Error('Unable to generate signed URL for parsing');
    }

    supabase.functions
        .invoke('parse-invoice', {
            body: {
                importId: importRow.id,
                fileUrl: signedData.signedUrl,
            },
        })
        .catch((error) => {
            console.warn('Unable to invoke parse-invoice:', error);
        });

    return importRow as InvoiceImport;
}

export async function getInvoiceImport(importId: string): Promise<InvoiceImport> {
    const { data, error } = await supabase
        .from('invoice_imports')
        .select('*')
        .eq('id', importId)
        .single();

    if (error || !data) throw error || new Error('Invoice import not found');
    return data as InvoiceImport;
}

export async function markInvoiceImportConfirmed(importId: string, supplierInvoiceId: string) {
    void supplierInvoiceId;
    const { error } = await supabase
        .from('invoice_imports')
        .update({
            status: 'confirmed' as InvoiceImportStatus,
            error: null,
        })
        .eq('id', importId);

    if (error) throw error;
}

export async function reparseInvoiceImport(importId: string, filePath: string) {
    const { data: signedData, error: signedError } = await supabase.storage
        .from(INVOICE_IMPORT_BUCKET)
        .createSignedUrl(filePath, 60 * 5);

    if (signedError || !signedData?.signedUrl) {
        throw signedError || new Error('Unable to create signed URL');
    }

    const { error: markProcessingError } = await supabase
        .from('invoice_imports')
        .update({ status: 'processing' as InvoiceImportStatus, error: null })
        .eq('id', importId);

    if (markProcessingError) throw markProcessingError;

    supabase.functions
        .invoke('parse-invoice', {
            body: {
                importId,
                fileUrl: signedData.signedUrl,
            },
        })
        .catch((error) => {
            console.warn('Unable to re-invoke parse-invoice:', error);
        });
}
