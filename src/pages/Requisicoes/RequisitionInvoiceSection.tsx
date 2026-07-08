import { useMemo, useState } from 'react';
import {
    ExternalLink,
    FileBadge2,
    FileDown,
    FileImage,
    FileText,
    Pencil,
    ReceiptText,
    RotateCw,
    Search,
    ShieldAlert,
    Trash2,
} from 'lucide-react';
import type { Fornecedor, Requisicao, SupplierInvoice } from '../../types';

interface TimelineEntry {
    id: string;
    at: string;
    label: string;
    detail: string;
}

interface RequisitionInvoiceSectionProps {
    requisition: Requisicao;
    supplier?: Fornecedor;
    invoices: SupplierInvoice[];
    totalInvoicedAmount: number;
    badge: { label: string; className: string };
    timeline: TimelineEntry[];
    formatCurrency: (value: number) => string;
    formatSmallDate: (value: string) => string;
    formatDateTime: (value?: string) => string;
    getPaymentStatusLabel: (status?: string) => string;
    onAddInvoice: () => void;
    onEditInvoice: (invoiceId: string) => void;
    onDeleteInvoice: (invoice: SupplierInvoice) => void;
}

const isPdfUrl = (value?: string | null) => /\.pdf($|\?)/i.test(String(value || ''));
const isImageUrl = (value?: string | null) => /\.(png|jpe?g|webp|gif|bmp|svg)($|\?)/i.test(String(value || '')) || String(value || '').startsWith('data:image/');

export default function RequisitionInvoiceSection({
    requisition,
    supplier,
    invoices,
    totalInvoicedAmount,
    badge,
    timeline,
    formatCurrency,
    formatSmallDate,
    formatDateTime,
    getPaymentStatusLabel,
    onAddInvoice,
    onEditInvoice,
    onDeleteInvoice,
}: RequisitionInvoiceSectionProps) {
    const [activeTab, setActiveTab] = useState<'summary' | 'preview' | 'timeline'>('summary');
    const [previewZoom, setPreviewZoom] = useState(1);
    const [previewRotation, setPreviewRotation] = useState(0);

    const latestInvoice = invoices[0];
    const previewUrl = latestInvoice?.pdf_url || requisition.invoice_document_url || '';
    const hasPreview = Boolean(previewUrl);
    const previewKind = isPdfUrl(previewUrl) ? 'pdf' : isImageUrl(previewUrl) ? 'image' : 'unknown';

    const summaryFields = useMemo(() => ([
        { label: 'Nº Fatura', value: latestInvoice?.invoice_number || 'Sem fatura' },
        { label: 'Data', value: latestInvoice?.issue_date ? formatSmallDate(latestInvoice.issue_date) : 'Por definir' },
        { label: 'Fornecedor', value: latestInvoice?.supplier?.nome || supplier?.nome || 'Por definir' },
        { label: 'Valor Líquido', value: formatCurrency(Number(latestInvoice?.net_value ?? latestInvoice?.total_liquido ?? 0)) },
        { label: 'IVA', value: formatCurrency(Number(latestInvoice?.vat_value ?? latestInvoice?.total_iva ?? 0)) },
        { label: 'Valor Total', value: formatCurrency(Number(latestInvoice?.total_final ?? latestInvoice?.total ?? latestInvoice?.total_value ?? 0)) },
    ]), [formatCurrency, formatSmallDate, latestInvoice, supplier]);

    const renderPreview = () => {
        if (!hasPreview) {
            return (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-8 text-center text-sm text-slate-500">
                    Ainda não existe documento para pré-visualizar.
                </div>
            );
        }

        const transform = `scale(${previewZoom}) rotate(${previewRotation}deg)`;

        return (
            <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setPreviewZoom((value) => Math.max(0.8, Number((value - 0.2).toFixed(2))))}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                        >
                            <Search className="h-4 w-4" />
                            Zoom -
                        </button>
                        <button
                            type="button"
                            onClick={() => setPreviewZoom((value) => Math.min(2.4, Number((value + 0.2).toFixed(2))))}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                        >
                            <Search className="h-4 w-4" />
                            Zoom +
                        </button>
                        <button
                            type="button"
                            onClick={() => setPreviewRotation((value) => value + 90)}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                        >
                            <RotateCw className="h-4 w-4" />
                            Rodar
                        </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <a
                            href={previewUrl}
                            download
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                        >
                            <FileDown className="h-4 w-4" />
                            Download
                        </a>
                        <a
                            href={previewUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                        >
                            <ExternalLink className="h-4 w-4" />
                            Nova janela
                        </a>
                    </div>
                </div>

                <div className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-950/95 p-4">
                    <div className="flex min-h-[320px] items-center justify-center overflow-auto rounded-2xl bg-slate-900 p-4">
                        {previewKind === 'pdf' ? (
                            <div style={{ transform, transformOrigin: 'center center' }} className="h-[70vh] w-full max-w-5xl transition-transform duration-200">
                                <iframe
                                    src={previewUrl}
                                    title={`Preview ${latestInvoice?.invoice_number || 'fatura'}`}
                                    className="h-full w-full rounded-2xl border border-slate-700 bg-white"
                                    loading="lazy"
                                />
                            </div>
                        ) : previewKind === 'image' ? (
                            <img
                                src={previewUrl}
                                alt={latestInvoice?.invoice_number || 'Fatura'}
                                className="max-h-[70vh] rounded-2xl object-contain transition-transform duration-200"
                                style={{ transform, transformOrigin: 'center center' }}
                            />
                        ) : (
                            <div className="rounded-2xl border border-dashed border-slate-600 bg-slate-800/80 p-8 text-center text-sm text-slate-300">
                                Documento disponível, mas sem motor de preview dedicado para este formato.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="mt-3 overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_25px_70px_-40px_rgba(15,23,42,0.35)]">
            <div className="border-b border-slate-200 bg-gradient-to-r from-slate-950 via-slate-900 to-blue-950 px-5 py-5 text-white">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                        <div className="flex items-center gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/10 backdrop-blur-sm">
                                <ReceiptText className="h-6 w-6 text-blue-200" />
                            </div>
                            <div>
                                <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-blue-200/90">Secção Fatura</p>
                                <h4 className="mt-1 text-xl font-bold">Módulo de faturação da requisição</h4>
                            </div>
                        </div>
                        <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300">
                            Esta requisição só pode ser considerada concluída quando existir documento, fornecedor, número e valor da fatura validados.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <span className={`inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] ${badge.className}`}>
                            <FileBadge2 className="h-4 w-4" />
                            {badge.label}
                        </span>
                        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-right">
                            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Total faturado</p>
                            <p className="mt-1 text-lg font-bold text-white">{formatCurrency(totalInvoicedAmount)}</p>
                        </div>
                        <button
                            type="button"
                            onClick={onAddInvoice}
                            className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition-colors hover:bg-blue-50"
                        >
                            <ReceiptText className="h-4 w-4" />
                            Adicionar Fatura
                        </button>
                    </div>
                </div>
            </div>

            <div className="p-5 md:p-6 space-y-5">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
                    {summaryFields.map((field) => (
                        <div key={field.label} className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
                            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">{field.label}</p>
                            <p className="mt-1.5 truncate text-sm font-semibold text-slate-900">{field.value}</p>
                        </div>
                    ))}
                </div>

                <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
                    {[
                        { id: 'summary', label: 'Resumo', icon: ReceiptText },
                        { id: 'preview', label: 'Preview', icon: previewKind === 'image' ? FileImage : FileText },
                        { id: 'timeline', label: 'Timeline', icon: ShieldAlert },
                    ].map((tab) => {
                        const Icon = tab.icon;
                        const selected = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setActiveTab(tab.id as 'summary' | 'preview' | 'timeline')}
                                className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold transition-colors ${selected ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                            >
                                <Icon className="h-4 w-4" />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>

                {activeTab === 'summary' && (
                    <div className="space-y-4">
                        <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Observações</p>
                            <p className="mt-2 text-sm leading-6 text-slate-700">{latestInvoice?.notes?.trim() || 'Sem observações registadas.'}</p>
                        </div>

                        {invoices.length > 0 ? (
                            <div className="overflow-x-auto rounded-2xl border border-slate-200">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-50 text-slate-500">
                                        <tr>
                                            <th className="px-4 py-3 text-left font-semibold">Nº Fatura</th>
                                            <th className="px-4 py-3 text-left font-semibold">Data</th>
                                            <th className="px-4 py-3 text-left font-semibold">Fornecedor</th>
                                            <th className="px-4 py-3 text-right font-semibold">Valor Total</th>
                                            <th className="px-4 py-3 text-left font-semibold">Estado</th>
                                            <th className="px-4 py-3 text-right font-semibold">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {invoices.map((invoice) => (
                                            <tr key={invoice.id} className="border-t border-slate-100 hover:bg-slate-50/70">
                                                <td className="px-4 py-3 font-semibold text-slate-900">{invoice.invoice_number}</td>
                                                <td className="px-4 py-3 text-slate-600">{formatSmallDate(invoice.issue_date)}</td>
                                                <td className="px-4 py-3 text-slate-600">{invoice.supplier?.nome || supplier?.nome || 'Por definir'}</td>
                                                <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatCurrency(Number(invoice.total_final ?? invoice.total ?? invoice.total_value ?? 0))}</td>
                                                <td className="px-4 py-3 text-slate-600">{getPaymentStatusLabel(invoice.payment_status)}</td>
                                                <td className="px-4 py-3">
                                                    <div className="flex justify-end gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => onEditInvoice(invoice.id)}
                                                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                            Editar
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => onDeleteInvoice(invoice)}
                                                            className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-100"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                            Apagar
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-8 text-center text-sm text-slate-500">
                                Ainda não existem faturas associadas a esta requisição.
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'preview' && renderPreview()}

                {activeTab === 'timeline' && (
                    <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-5">
                        {timeline.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-slate-300 bg-white/80 p-8 text-center text-sm text-slate-500">
                                Ainda não existem eventos registados na timeline da faturação.
                            </div>
                        ) : (
                            <div className="relative space-y-5 before:absolute before:left-[11px] before:top-2 before:h-[calc(100%-1rem)] before:w-px before:bg-slate-200">
                                {timeline.map((entry) => (
                                    <div key={entry.id} className="relative pl-9">
                                        <span className="absolute left-0 top-1.5 inline-flex h-6 w-6 items-center justify-center rounded-full border border-blue-200 bg-blue-50 text-blue-700">
                                            <ReceiptText className="h-3.5 w-3.5" />
                                        </span>
                                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{formatDateTime(entry.at)}</p>
                                        <p className="mt-1 text-base font-semibold text-slate-900">{entry.label}</p>
                                        <p className="mt-1 text-sm text-slate-600">{entry.detail}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
