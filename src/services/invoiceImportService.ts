import { supabase } from '../lib/supabase';
import type { InvoiceImport, InvoiceImportStatus } from '../types';

const INVOICE_IMPORT_BUCKET = 'documents';

const randomToken = () => Math.random().toString(36).slice(2);

export async function createInvoiceImportFromPdf(file: File): Promise<InvoiceImport> {
    const fileExt = file.name.split('.').pop() || 'pdf';
    const fileName = `${Date.now()}-${randomToken()}.${fileExt}`;
    const storagePath = `supplier-invoices/imports/${fileName}`;

    const { data: authData } = await supabase.auth.getUser();
    const createdBy = authData.user?.id || null;

    const { error: uploadError } = await supabase.storage
        .from(INVOICE_IMPORT_BUCKET)
        .upload(storagePath, file, { upsert: false, contentType: file.type || 'application/pdf' });

    if (uploadError) throw uploadError;

    const { data: publicData } = supabase.storage
        .from(INVOICE_IMPORT_BUCKET)
        .getPublicUrl(storagePath);

    const { data: importRow, error: insertError } = await supabase
        .from('invoice_imports')
        .insert({
            storage_path: storagePath,
            pdf_url: publicData.publicUrl,
            status: 'processing',
            language: 'pt-PT',
            created_by: createdBy,
        })
        .select('*')
        .single();

    if (insertError || !importRow) {
        throw insertError || new Error('Unable to create invoice import');
    }

    supabase.functions
        .invoke('process-invoice-import', { body: { importId: importRow.id } })
        .catch((error) => {
            console.warn('Unable to invoke process-invoice-import:', error);
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
    const { error } = await supabase
        .from('invoice_imports')
        .update({
            status: 'confirmed' as InvoiceImportStatus,
            supplier_invoice_id: supplierInvoiceId,
            confirmed_at: new Date().toISOString(),
            error_message: null,
        })
        .eq('id', importId);

    if (error) throw error;
}
