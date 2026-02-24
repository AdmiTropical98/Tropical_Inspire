import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { X, Upload, FileText } from 'lucide-react';
import type { SupplierInvoice, SupplierInvoiceLine, Fornecedor, CentroCusto, Viatura, Requisicao } from '../types';
import { supabase } from '../lib/supabase';
import StatusBadge from './common/StatusBadge';
import InvoiceFinancialSummary from './InvoiceFinancialSummary';
import { formatCurrency } from '../utils/format';

interface InvoiceFormProps {
    invoice?: SupplierInvoice | null;
    suppliers: Fornecedor[];
    costCenters: CentroCusto[];
    vehicles: Viatura[];
    requisitions: Requisicao[];
    initialRequisition?: Requisicao | null;
    onSave: (invoice: Omit<SupplierInvoice, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
    onCancel: () => void;
}

export default function InvoiceForm({
    invoice,
    suppliers,
    costCenters,
    vehicles,
    requisitions,
    initialRequisition,
    onSave,
    onCancel
}: InvoiceFormProps) {
    const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
    const hasMeaningfulDifference = (a: number, b: number) => Math.abs(a - b) >= 0.01;

    const calculateLine = useCallback((line: SupplierInvoiceLine) => {
        const quantity = line.quantity || 0;
        const inferredUnitPrice = line.unit_price ?? (quantity !== 0 ? (line.net_value || 0) / quantity : (line.net_value || 0));
        const unitPrice = round2(inferredUnitPrice || 0);
        const discountPercentage = Math.max(0, round2(line.discount_percentage || 0));
        const subtotal = round2(quantity * unitPrice);
        const discountValue = round2(subtotal * (discountPercentage / 100));
        const taxableBase = round2(subtotal - discountValue);
        const ivaValue = round2(taxableBase * ((line.iva_rate || 0) / 100));

        return {
            quantity,
            unitPrice,
            discountPercentage,
            subtotal,
            discountValue,
            taxableBase,
            ivaValue,
            totalValue: round2(taxableBase + ivaValue)
        };
    }, []);

    const emptyLine = (): SupplierInvoiceLine => ({
        description: '',
        quantity: 1,
        unit_price: 0,
        discount_percentage: 0,
        net_value: 0,
        iva_rate: 23,
        iva_value: 0,
        total_value: 0
    });

    const normalizeLine = useCallback((line: SupplierInvoiceLine, overrideIvaValue?: number | null): SupplierInvoiceLine => {
        const calculated = calculateLine(line);
        const effectiveIvaValue = Number.isFinite(overrideIvaValue) ? round2(overrideIvaValue as number) : calculated.ivaValue;

        return {
            ...line,
            description: line.description || '',
            quantity: calculated.quantity,
            unit_price: calculated.unitPrice,
            discount_percentage: calculated.discountPercentage,
            net_value: calculated.taxableBase,
            iva_value: effectiveIvaValue,
            total_value: round2(calculated.taxableBase + effectiveIvaValue)
        };
    }, [calculateLine]);

    const inferLegacyRate = useCallback((legacyInvoice: SupplierInvoice): 0 | 6 | 13 | 23 => {
        if (legacyInvoice.iva_rate === 0 || legacyInvoice.iva_rate === 6 || legacyInvoice.iva_rate === 13 || legacyInvoice.iva_rate === 23) {
            return legacyInvoice.iva_rate;
        }

        const referenceBase = legacyInvoice.net_value || legacyInvoice.base_amount || 0;
        const referenceIva = legacyInvoice.vat_value || legacyInvoice.iva_value || 0;
        if (referenceBase <= 0 || referenceIva <= 0) return 0;

        const guessedRate = Math.round((referenceIva / referenceBase) * 100);
        if (guessedRate === 6 || guessedRate === 13 || guessedRate === 23) return guessedRate;
        return 0;
    }, []);

    const [formData, setFormData] = useState({
        supplier_id: '',
        requisition_id: '',
        invoice_number: '',
        issue_date: new Date().toISOString().split('T')[0],
        due_date: '',
        lines: [emptyLine()],
        cost_center_id: '',
        vehicle_id: '',
        payment_status: 'pending' as const,
        payment_method: '',
        notes: '',
        pdf_url: ''
    });
    const [manualIvaOverrides, setManualIvaOverrides] = useState<(number | null)[]>([null]);
    const [financialImpact, setFinancialImpact] = useState<Array<{
        date: string;
        description: string;
        debit: number;
        credit: number;
        amount: number;
        account_code: string;
    }>>([]);

    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        if (invoice) {
            const sourceLines = invoice.lines && invoice.lines.length > 0
                ? invoice.lines
                : [{
                    description: invoice.expense_type || 'Linha principal',
                    quantity: 1,
                    unit_price: invoice.total_liquido || invoice.net_value || invoice.base_amount || 0,
                    discount_percentage: 0,
                    net_value: invoice.total_liquido || invoice.net_value || invoice.base_amount || 0,
                    iva_rate: inferLegacyRate(invoice),
                    iva_value: invoice.total_iva || invoice.vat_value || invoice.iva_value || 0,
                    total_value: invoice.total_final || invoice.total_value || invoice.total || 0
                }];

            const detectedOverrides = sourceLines.map((line) => {
                const autoIvaValue = calculateLine(line).ivaValue;
                const incomingIvaValue = round2(line.iva_value || 0);
                return hasMeaningfulDifference(incomingIvaValue, autoIvaValue) ? incomingIvaValue : null;
            });

            const mappedLines = sourceLines.map((line, index) => normalizeLine(line, detectedOverrides[index]));

            setFormData({
                supplier_id: invoice.supplier_id || '',
                requisition_id: invoice.requisition_id || '',
                invoice_number: invoice.invoice_number,
                issue_date: invoice.issue_date,
                due_date: invoice.due_date,
                lines: mappedLines,
                cost_center_id: invoice.cost_center_id || '',
                vehicle_id: invoice.vehicle_id || '',
                payment_status: invoice.payment_status,
                payment_method: invoice.payment_method || '',
                notes: invoice.notes || '',
                pdf_url: invoice.pdf_url || ''
            });

            setManualIvaOverrides(mappedLines.map((_, index) => detectedOverrides[index] ?? null));
        }
    }, [invoice, inferLegacyRate, normalizeLine, calculateLine]);

    useEffect(() => {
        if (invoice) return;

        setManualIvaOverrides((prev) => {
            if (prev.length === formData.lines.length) return prev;
            if (prev.length < formData.lines.length) {
                return [...prev, ...Array(formData.lines.length - prev.length).fill(null)];
            }
            return prev.slice(0, formData.lines.length);
        });
    }, [formData.lines.length, invoice]);

    useEffect(() => {
        if (invoice || !initialRequisition) return;

        setFormData(prev => ({
            ...prev,
            supplier_id: prev.supplier_id || initialRequisition.fornecedorId || '',
            vehicle_id: prev.vehicle_id || initialRequisition.viaturaId || '',
            cost_center_id: prev.cost_center_id || initialRequisition.centroCustoId || '',
            requisition_id: prev.requisition_id || initialRequisition.id
        }));
    }, [invoice, initialRequisition]);

    useEffect(() => {
        const loadFinancialImpact = async () => {
            if (!invoice?.id) {
                setFinancialImpact([]);
                return;
            }

            const { data, error } = await supabase
                .from('financial_movements')
                .select('date, description, debit, credit, amount, account_code')
                .eq('document_type', 'invoice')
                .eq('document_id', invoice.id)
                .order('created_at', { ascending: false });

            if (error) {
                console.warn('Unable to load financial impact:', error.message);
                setFinancialImpact([]);
                return;
            }

            setFinancialImpact(data || []);
        };

        loadFinancialImpact();
    }, [invoice?.id]);

    const getRequisitionStatusLabel = useCallback((status?: Requisicao['status']) => {
        if (status === 'concluida') return 'Concluída';
        return 'Pendente';
    }, []);

    const requisitionOptions = useMemo(() => {
        const byDateDesc = [...requisitions].sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

        return byDateDesc
            .filter(req => req.id === formData.requisition_id || !formData.supplier_id || req.fornecedorId === formData.supplier_id)
            .map(req => {
                const supplier = suppliers.find(item => item.id === req.fornecedorId);
                const vehicle = vehicles.find(item => item.id === req.viaturaId);
                const numberToken = String(req.numero || '').includes('/')
                    ? String(req.numero).split('/')[1]
                    : String(req.numero || '');

                return {
                    id: req.id,
                    label: `R:${numberToken || req.numero} — ${supplier?.nome || 'Fornecedor N/D'} — ${vehicle ? `${vehicle.marca} ${vehicle.modelo}` : 'Sem viatura'} — ${getRequisitionStatusLabel(req.status)}`
                };
            });
    }, [requisitions, formData.supplier_id, suppliers, vehicles, getRequisitionStatusLabel]);

    const lineBreakdowns = formData.lines.map((line, index) => {
        const calculated = calculateLine(line);
        const overrideIvaValue = manualIvaOverrides[index];
        const ivaValue = Number.isFinite(overrideIvaValue) ? round2(overrideIvaValue as number) : calculated.ivaValue;
        return {
            ...calculated,
            ivaValue,
            totalValue: round2(calculated.taxableBase + ivaValue)
        };
    });

    const calculatedLines = formData.lines.map((line, index) => normalizeLine(line, manualIvaOverrides[index]));
    const grossBaseTotal = round2(lineBreakdowns.reduce((sum, line) => sum + line.subtotal, 0));
    const discountTotal = round2(lineBreakdowns.reduce((sum, line) => sum + line.discountValue, 0));
    const totalLiquido = round2(lineBreakdowns.reduce((sum, line) => sum + line.taxableBase, 0));
    const totalIva = round2(lineBreakdowns.reduce((sum, line) => sum + line.ivaValue, 0));
    const totalFinal = round2(totalLiquido + totalIva);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const validLines = calculatedLines.filter(line => line.description.trim() && line.net_value !== 0);
        if (!validLines.length) {
            alert('Adicione pelo menos uma linha válida na fatura.');
            return;
        }

        const derivedExpenseType = validLines.map(line => line.description).join(' | ').slice(0, 180) || 'Fatura Fornecedor';

        await onSave({
            supplier_id: formData.supplier_id,
            requisition_id: formData.requisition_id || undefined,
            invoice_number: formData.invoice_number,
            issue_date: formData.issue_date,
            due_date: formData.due_date,
            base_amount: grossBaseTotal,
            iva_rate: 23,
            iva_value: totalIva,
            discount: {
                type: 'amount',
                value: discountTotal,
                applied_value: discountTotal
            },
            extra_expenses: [],
            total: totalFinal,
            total_liquido: totalLiquido,
            total_iva: totalIva,
            total_final: totalFinal,
            net_value: totalLiquido,
            vat_value: totalIva,
            total_value: totalFinal,
            lines: validLines,
            expense_type: derivedExpenseType,
            cost_center_id: formData.cost_center_id || undefined,
            vehicle_id: formData.vehicle_id || undefined,
            payment_status: formData.payment_status,
            payment_method: formData.payment_method || undefined,
            notes: formData.notes || undefined,
            pdf_url: formData.pdf_url || undefined
        });
    };

    const updateLine = (index: number, field: 'description' | 'quantity' | 'unit_price' | 'discount_percentage' | 'iva_rate', rawValue: string) => {
        setFormData(prev => {
            const nextLines = prev.lines.map((line, lineIndex) => {
                if (lineIndex !== index) return line;

                const numericValue = parseFloat(rawValue);
                return {
                    ...line,
                    [field]: field === 'description'
                        ? rawValue
                        : field === 'iva_rate'
                            ? (Number(rawValue) as 0 | 6 | 13 | 23)
                            : Number.isFinite(numericValue)
                                ? numericValue
                                : 0
                };
            });

            return { ...prev, lines: nextLines };
        });

        if (field !== 'description') {
            setManualIvaOverrides(prev => prev.map((value, lineIndex) => lineIndex === index ? null : value));
        }
    };

    const updateManualIva = (index: number, rawValue: string) => {
        const parsedValue = parseFloat(rawValue);
        setManualIvaOverrides(prev => prev.map((value, lineIndex) => {
            if (lineIndex !== index) return value;
            if (!Number.isFinite(parsedValue) || rawValue.trim() === '') return null;
            return round2(Math.max(0, parsedValue));
        }));
    };

    const addLine = () => {
        setFormData(prev => ({
            ...prev,
            lines: [...prev.lines, emptyLine()]
        }));
        setManualIvaOverrides(prev => [...prev, null]);
    };

    const removeLine = (index: number) => {
        setFormData(prev => ({
            ...prev,
            lines: prev.lines.length > 1
                ? prev.lines.filter((_, lineIndex) => lineIndex !== index)
                : [emptyLine()]
        }));
        setManualIvaOverrides(prev => prev.length > 1
            ? prev.filter((_, lineIndex) => lineIndex !== index)
            : [null]);
    };

    const handleFileUpload = async (file: File) => {
        if (!file) return;

        setUploading(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
            const filePath = `supplier-invoices/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('documents')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data } = supabase.storage
                .from('documents')
                .getPublicUrl(filePath);

            setFormData(prev => ({ ...prev, pdf_url: data.publicUrl }));
        } catch (error) {
            console.error('Error uploading file:', error);
            alert('Erro ao fazer upload do arquivo');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="w-full bg-slate-900 border border-slate-700 rounded-xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-700">
                <h2 className="text-xl font-semibold text-white">
                    {invoice ? 'Editar Fatura' : 'Nova Fatura de Fornecedor'}
                </h2>
                <button
                    onClick={onCancel}
                    className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
                >
                    <X className="w-5 h-5 text-slate-400" />
                </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-8">
                    {/* Supplier and Invoice Number */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Fornecedor *
                            </label>
                            <select
                                value={formData.supplier_id}
                                onChange={(e) => setFormData(prev => ({ ...prev, supplier_id: e.target.value }))}
                                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                required
                            >
                                <option value="">Selecionar fornecedor</option>
                                {suppliers.map(supplier => (
                                    <option key={supplier.id} value={supplier.id}>
                                        {supplier.nome}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Número da Fatura *
                            </label>
                            <input
                                type="text"
                                value={formData.invoice_number}
                                onChange={(e) => setFormData(prev => ({ ...prev, invoice_number: e.target.value }))}
                                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            Requisição Associada (Opcional)
                        </label>
                        <select
                            value={formData.requisition_id}
                            onChange={(e) => setFormData(prev => ({ ...prev, requisition_id: e.target.value }))}
                            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                            <option value="">Sem associação</option>
                            {requisitionOptions.map(req => (
                                <option key={req.id} value={req.id}>
                                    {req.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Dates */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Data de Emissão *
                            </label>
                            <input
                                type="date"
                                value={formData.issue_date}
                                onChange={(e) => setFormData(prev => ({ ...prev, issue_date: e.target.value }))}
                                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Data de Vencimento *
                            </label>
                            <input
                                type="date"
                                value={formData.due_date}
                                onChange={(e) => setFormData(prev => ({ ...prev, due_date: e.target.value }))}
                                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                required
                            />
                        </div>
                    </div>

                    {/* 1) Invoice Lines */}
                    <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-5 space-y-4">
                        <div className="flex items-center justify-between mb-3">
                            <label className="block text-sm font-semibold text-slate-200">Linhas da Fatura</label>
                            <button
                                type="button"
                                onClick={addLine}
                                className="px-3 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-white rounded-md transition-colors"
                            >
                                + Adicionar Linha
                            </button>
                        </div>

                        <div className="space-y-2">
                            <div className="grid grid-cols-13 gap-2 text-xs text-slate-400 px-1">
                                <span className="col-span-4">Descrição (artigo/serviço)</span>
                                <span className="col-span-1">Qtd</span>
                                <span className="col-span-2">Preço Unit. (€)</span>
                                <span className="col-span-1">Desc %</span>
                                <span className="col-span-2">IVA %</span>
                                <span className="col-span-1">IVA (€) manual</span>
                                <span className="col-span-1">Total Linha</span>
                                <span className="col-span-1 text-right">Ação</span>
                            </div>

                            {calculatedLines.map((line, index) => (
                                <div key={index} className="grid grid-cols-13 gap-2">
                                    <input
                                        type="text"
                                        value={formData.lines[index]?.description || ''}
                                        onChange={(e) => updateLine(index, 'description', e.target.value)}
                                        placeholder="Ex.: Serviço de manutenção do veículo"
                                        className="col-span-4 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={formData.lines[index]?.quantity ?? 0}
                                        onChange={(e) => updateLine(index, 'quantity', e.target.value)}
                                        className="col-span-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={formData.lines[index]?.unit_price ?? 0}
                                        onChange={(e) => updateLine(index, 'unit_price', e.target.value)}
                                        className="col-span-2 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={formData.lines[index]?.discount_percentage ?? 0}
                                        onChange={(e) => updateLine(index, 'discount_percentage', e.target.value)}
                                        className="col-span-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                    <select
                                        value={formData.lines[index]?.iva_rate ?? 23}
                                        onChange={(e) => updateLine(index, 'iva_rate', e.target.value)}
                                        className="col-span-2 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    >
                                        <option value={23}>23%</option>
                                        <option value={13}>13%</option>
                                        <option value={6}>6%</option>
                                        <option value={0}>0%</option>
                                    </select>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={manualIvaOverrides[index] ?? line.iva_value}
                                        onChange={(e) => updateManualIva(index, e.target.value)}
                                        className="col-span-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        title="Pode ajustar manualmente o IVA desta linha"
                                    />
                                    <input
                                        type="number"
                                        value={line.total_value}
                                        readOnly
                                        className="col-span-1 bg-slate-800/50 border border-slate-600 rounded-lg px-3 py-2 text-slate-300 cursor-not-allowed"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => removeLine(index)}
                                        className="col-span-1 px-2 py-2 text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
                                        title="Remover linha"
                                    >
                                        <X className="w-4 h-4 mx-auto" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-5 mt-8">
                        <InvoiceFinancialSummary
                            grossBaseTotal={grossBaseTotal}
                            discountTotal={discountTotal}
                            taxableBase={totalLiquido}
                            totalIva={totalIva}
                            totalFinal={totalFinal}
                        />
                    </div>

                    <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-5">
                        <h3 className="text-sm font-semibold text-slate-200 mb-3">Financial Impact</h3>
                        {invoice ? (
                            financialImpact.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="text-slate-400 border-b border-slate-700">
                                                <th className="text-left py-2 pr-3">Date</th>
                                                <th className="text-left py-2 pr-3">Account</th>
                                                <th className="text-left py-2 pr-3">Description</th>
                                                <th className="text-right py-2 pr-3">Debit</th>
                                                <th className="text-right py-2 pr-3">Credit</th>
                                                <th className="text-right py-2">Net</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {financialImpact.map((movement, index) => (
                                                <tr key={`${movement.account_code}-${index}`} className="border-b border-slate-800 last:border-0">
                                                    <td className="py-2 pr-3 text-slate-300">{new Date(movement.date).toLocaleDateString('pt-PT')}</td>
                                                    <td className="py-2 pr-3 text-white">{movement.account_code}</td>
                                                    <td className="py-2 pr-3 text-slate-300">{movement.description}</td>
                                                    <td className="py-2 pr-3 text-right text-red-300">{formatCurrency(Number(movement.debit || 0))}</td>
                                                    <td className="py-2 pr-3 text-right text-emerald-300">{formatCurrency(Number(movement.credit || 0))}</td>
                                                    <td className="py-2 text-right text-slate-200">{formatCurrency(Number(movement.amount || 0))}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <p className="text-sm text-slate-400">Nenhum movimento financeiro encontrado para esta fatura.</p>
                            )
                        ) : (
                            <p className="text-sm text-slate-400">O movimento financeiro será gerado automaticamente ao guardar a fatura.</p>
                        )}
                    </div>

                    {/* 3) Accounting / Payment */}
                    <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-5 space-y-4">
                        <h3 className="text-sm font-semibold text-slate-200">Contabilístico / Pagamento</h3>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Centro de Custo
                            </label>
                            <select
                                value={formData.cost_center_id}
                                onChange={(e) => setFormData(prev => ({ ...prev, cost_center_id: e.target.value }))}
                                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                <option value="">Selecionar centro de custo</option>
                                {costCenters.map(cc => (
                                    <option key={cc.id} value={cc.id}>
                                        {cc.nome}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Viatura (Opcional)
                            </label>
                            <select
                                value={formData.vehicle_id}
                                onChange={(e) => setFormData(prev => ({ ...prev, vehicle_id: e.target.value }))}
                                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                <option value="">Selecionar viatura</option>
                                {vehicles.map(vehicle => (
                                    <option key={vehicle.id} value={vehicle.id}>
                                        {vehicle.matricula} - {vehicle.marca} {vehicle.modelo}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Status de Pagamento
                            </label>
                            <div className="flex items-center gap-2">
                                <select
                                    value={formData.payment_status}
                                    onChange={(e) => setFormData(prev => ({
                                        ...prev,
                                        payment_status: e.target.value as SupplierInvoice['payment_status']
                                    }))}
                                    className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                >
                                    <option value="pending">Pendente</option>
                                    <option value="scheduled">Agendado</option>
                                    <option value="paid">Pago</option>
                                    <option value="overdue">Vencido</option>
                                </select>
                                <StatusBadge status={formData.payment_status} />
                            </div>
                        </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Método de Pagamento
                            </label>
                            <select
                                value={formData.payment_method}
                                onChange={(e) => setFormData(prev => ({ ...prev, payment_method: e.target.value }))}
                                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                <option value="">Selecionar método</option>
                                <option value="transfer">Transferência</option>
                                <option value="check">Cheque</option>
                                <option value="card">Cartão</option>
                                <option value="cash">Dinheiro</option>
                                <option value="direct_debit">Débito Direto</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Notas
                            </label>
                            <textarea
                                value={formData.notes}
                                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                                rows={3}
                                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                            />
                        </div>
                        </div>
                    </div>

                    {/* PDF Upload */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            PDF da Fatura
                        </label>
                        <div className="flex items-center gap-4">
                            <label className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg cursor-pointer transition-colors">
                                <Upload className="w-4 h-4" />
                                <span className="text-sm">Upload PDF</span>
                                <input
                                    type="file"
                                    accept=".pdf"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) handleFileUpload(file);
                                    }}
                                    className="hidden"
                                    disabled={uploading}
                                />
                            </label>
                            {uploading && <span className="text-slate-400">A fazer upload...</span>}
                            {formData.pdf_url && (
                                <a
                                    href={formData.pdf_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 text-blue-400 hover:text-blue-300"
                                >
                                    <FileText className="w-4 h-4" />
                                    <span className="text-sm">Ver PDF</span>
                                </a>
                            )}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="px-4 py-2 text-slate-300 hover:bg-slate-800 rounded-lg transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                        >
                            {invoice ? 'Atualizar' : 'Criar'} Fatura
                        </button>
                    </div>
            </form>
        </div>
    );
}