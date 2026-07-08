import { useMemo } from 'react';
import { X } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import InvoiceForm from '../../components/InvoiceForm';
import { useWorkshop } from '../../contexts/WorkshopContext';
import { useFinancial } from '../../contexts/FinancialContext';
import type { SupplierInvoice } from '../../types';
import { supabase } from '../../lib/supabase';

interface RequisitionInvoiceModalProps {
    requisitionId: string;
    invoiceId?: string | null;
    onClose: () => void;
    onSaved?: (invoiceId: string) => void;
}

export default function RequisitionInvoiceModal({
    requisitionId,
    invoiceId,
    onClose,
    onSaved
}: RequisitionInvoiceModalProps) {
    const { fornecedores, centrosCustos, viaturas, requisicoes, refreshData } = useWorkshop();
    const { supplierInvoices, addSupplierInvoice, updateSupplierInvoice } = useFinancial();
    const isMobileNative = Capacitor.isNativePlatform();

    const requisition = useMemo(() => {
        return requisicoes.find((req) => req.id === requisitionId) || null;
    }, [requisicoes, requisitionId]);

    const selectedInvoice = useMemo(() => {
        if (!invoiceId) return null;
        return supplierInvoices.find((invoice) => invoice.id === invoiceId) || null;
    }, [invoiceId, supplierInvoices]);

    const handleSave = async (data: Omit<SupplierInvoice, 'id' | 'created_at' | 'updated_at'>) => {
        const payload = {
            ...data,
            requisition_id: requisitionId,
        };

        const savedInvoiceId = selectedInvoice
            ? await updateSupplierInvoice(selectedInvoice.id, payload)
            : await addSupplierInvoice(payload);

        await refreshData();
        onSaved?.(savedInvoiceId);
        return savedInvoiceId;
    };

    const handlePersisted = async (payload: {
        savedInvoiceId: string;
        mode: 'create' | 'update';
        hadImport: boolean;
        hadDocument: boolean;
        documentReplaced: boolean;
        invoiceNumber: string;
        issueDate: string;
        totalValue: number;
    }) => {
        if (!requisition) return;

        const baseTs = Date.now();
        const historyEntries = [
            {
                id: `${payload.savedInvoiceId}-${payload.mode}-${baseTs}`,
                action: payload.mode === 'create' ? 'created' : 'updated',
                at: new Date(baseTs).toISOString(),
                description: payload.mode === 'create'
                    ? `Fatura criada${payload.invoiceNumber ? `: ${payload.invoiceNumber}` : ''}`
                    : `Fatura atualizada${payload.invoiceNumber ? `: ${payload.invoiceNumber}` : ''}`,
            },
            ...(payload.hadImport ? [
                {
                    id: `${payload.savedInvoiceId}-qr-${baseTs + 1000}`,
                    action: 'qr_read',
                    at: new Date(baseTs + 1000).toISOString(),
                    description: 'QR Code lido',
                },
                {
                    id: `${payload.savedInvoiceId}-ocr-${baseTs + 2000}`,
                    action: 'ocr_processed',
                    at: new Date(baseTs + 2000).toISOString(),
                    description: 'OCR concluído',
                },
            ] : []),
            ...(payload.hadDocument ? [{
                id: `${payload.savedInvoiceId}-${payload.documentReplaced ? 'replace' : 'document'}-${baseTs + 3000}`,
                action: payload.documentReplaced ? 'document_replaced' : 'document_uploaded',
                at: new Date(baseTs + 3000).toISOString(),
                description: payload.documentReplaced ? 'Documento da fatura substituído' : 'Documento da fatura associado',
            }] : []),
            {
                id: `${payload.savedInvoiceId}-validated-${baseTs + 4000}`,
                action: 'validated',
                at: new Date(baseTs + 4000).toISOString(),
                description: `Requisição faturada${payload.totalValue > 0 ? ` no valor de ${payload.totalValue.toFixed(2)} EUR` : ''}`,
            },
        ];

        const nextHistory = [...historyEntries, ...(requisition.invoice_history || [])].slice(0, 60);

        await supabase
            .from('requisicoes')
            .update({
                invoice_history: nextHistory,
                invoice_status: 'FATURADA',
            })
            .eq('id', requisitionId);

        await refreshData();
    };

    if (!requisition) {
        return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
                <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
                    <div className="mb-4 flex items-start justify-between gap-4">
                        <div>
                            <h3 className="text-xl font-bold text-slate-900">Requisição não encontrada</h3>
                            <p className="mt-1 text-sm text-slate-500">A requisição associada já não está disponível.</p>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-xl border border-slate-200 p-2 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`fixed inset-0 z-[100] overflow-y-auto ${isMobileNative ? 'bg-slate-950' : 'bg-slate-950/80 backdrop-blur-sm'}`}>
            <div className={`mx-auto flex min-h-full w-full items-start justify-center ${isMobileNative ? 'max-w-none p-0' : 'max-w-6xl p-4 md:p-6'}`}>
                <div className={`w-full ${isMobileNative ? 'space-y-0' : 'space-y-4'}`}>
                    <div className={`${isMobileNative ? 'border-b border-slate-800 bg-slate-950 px-5 py-4 text-white' : 'rounded-3xl border border-slate-200/80 bg-white/95 p-5 shadow-2xl'}`}>
                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                            <div>
                                <p className={`text-xs font-bold uppercase tracking-[0.24em] ${isMobileNative ? 'text-blue-300' : 'text-blue-600'}`}>Fatura da requisição</p>
                                <h3 className={`mt-1 text-2xl font-bold ${isMobileNative ? 'text-white' : 'text-slate-900'}`}>Requisição {requisition.numero}</h3>
                                <p className={`mt-2 max-w-3xl text-sm ${isMobileNative ? 'text-slate-300' : 'text-slate-600'}`}>
                                    Esta secção substitui o fecho manual: a requisição só fica concluída depois de guardar uma fatura associada.
                                    Em telemóvel, use a captura direta da câmara no botão "Tirar Fotografia".
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={onClose}
                                className={`inline-flex items-center justify-center self-start rounded-2xl p-3 transition-colors ${isMobileNative ? 'border border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white' : 'border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                    </div>

                    <InvoiceForm
                        invoice={selectedInvoice}
                        suppliers={fornecedores}
                        costCenters={centrosCustos}
                        vehicles={viaturas}
                        requisitions={requisicoes}
                        initialRequisition={requisition}
                        onSave={handleSave}
                        onPersisted={handlePersisted}
                        onCancel={onClose}
                    />
                </div>
            </div>
        </div>
    );
}
