import React, { useState, useEffect, useCallback } from 'react';
import { X, Upload, FileText } from 'lucide-react';
import type { SupplierInvoice, SupplierInvoiceLine, Fornecedor, CentroCusto, Viatura } from '../types';
import { supabase } from '../lib/supabase';
import StatusBadge from './common/StatusBadge';

interface InvoiceFormProps {
    invoice?: SupplierInvoice | null;
    suppliers: Fornecedor[];
    costCenters: CentroCusto[];
    vehicles: Viatura[];
    onSave: (invoice: Omit<SupplierInvoice, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
    onCancel: () => void;
}

export default function InvoiceForm({
    invoice,
    suppliers,
    costCenters,
    vehicles,
    onSave,
    onCancel
}: InvoiceFormProps) {
    const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

    const emptyLine = (): SupplierInvoiceLine => ({
        description: '',
        quantity: 1,
        net_value: 0,
        iva_rate: 23,
        iva_value: 0,
        total_value: 0
    });

    const normalizeLine = useCallback((line: SupplierInvoiceLine): SupplierInvoiceLine => {
        const netValue = round2(Math.max(line.net_value || 0, 0));
        const ivaValue = round2(netValue * ((line.iva_rate || 0) / 100));
        return {
            ...line,
            description: line.description || '',
            quantity: line.quantity || 1,
            net_value: netValue,
            iva_value: ivaValue,
            total_value: round2(netValue + ivaValue)
        };
    }, []);

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

    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        if (invoice) {
            const mappedLines = invoice.lines && invoice.lines.length > 0
                ? invoice.lines.map(normalizeLine)
                : [normalizeLine({
                    description: invoice.expense_type || 'Linha principal',
                    quantity: 1,
                    net_value: invoice.total_liquido || invoice.net_value || invoice.base_amount || 0,
                    iva_rate: inferLegacyRate(invoice),
                    iva_value: invoice.total_iva || invoice.vat_value || invoice.iva_value || 0,
                    total_value: invoice.total_final || invoice.total_value || invoice.total || 0
                })];

            setFormData({
                supplier_id: invoice.supplier_id || '',
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
        }
    }, [invoice, inferLegacyRate, normalizeLine]);

    const calculatedLines = formData.lines.map(normalizeLine);
    const totalLiquido = round2(calculatedLines.reduce((sum, line) => sum + line.net_value, 0));
    const totalIva = round2(calculatedLines.reduce((sum, line) => sum + line.iva_value, 0));
    const totalFinal = round2(totalLiquido + totalIva);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const validLines = calculatedLines.filter(line => line.description.trim() && line.net_value > 0);
        if (!validLines.length) {
            alert('Adicione pelo menos uma linha válida na fatura.');
            return;
        }

        const derivedExpenseType = validLines.map(line => line.description).join(' | ').slice(0, 180) || 'Fatura Fornecedor';

        await onSave({
            supplier_id: formData.supplier_id,
            invoice_number: formData.invoice_number,
            issue_date: formData.issue_date,
            due_date: formData.due_date,
            base_amount: totalLiquido,
            iva_rate: 23,
            iva_value: totalIva,
            discount: {
                type: 'amount',
                value: 0,
                applied_value: 0
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

    const updateLine = (index: number, field: 'description' | 'net_value' | 'iva_rate', rawValue: string) => {
        setFormData(prev => {
            const nextLines = prev.lines.map((line, lineIndex) => {
                if (lineIndex !== index) return line;
                return {
                    ...line,
                    [field]: field === 'description'
                        ? rawValue
                        : field === 'iva_rate'
                            ? (Number(rawValue) as 0 | 6 | 13 | 23)
                            : (parseFloat(rawValue) || 0)
                };
            });

            return { ...prev, lines: nextLines };
        });
    };

    const addLine = () => {
        setFormData(prev => ({
            ...prev,
            lines: [...prev.lines, emptyLine()]
        }));
    };

    const removeLine = (index: number) => {
        setFormData(prev => ({
            ...prev,
            lines: prev.lines.length > 1
                ? prev.lines.filter((_, lineIndex) => lineIndex !== index)
                : [emptyLine()]
        }));
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
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

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
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

                    {/* Invoice Lines */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <label className="block text-sm font-medium text-slate-300">Linhas da Fatura</label>
                            <button
                                type="button"
                                onClick={addLine}
                                className="px-3 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-white rounded-md transition-colors"
                            >
                                + Adicionar Linha
                            </button>
                        </div>

                        <div className="space-y-2">
                            <div className="grid grid-cols-12 gap-2 text-xs text-slate-400 px-1">
                                <span className="col-span-4">Descrição</span>
                                <span className="col-span-2">Valor Líquido (€)</span>
                                <span className="col-span-2">IVA %</span>
                                <span className="col-span-2">IVA (€)</span>
                                <span className="col-span-1">Total Linha</span>
                                <span className="col-span-1 text-right">Ação</span>
                            </div>

                            {calculatedLines.map((line, index) => (
                                <div key={index} className="grid grid-cols-12 gap-2">
                                    <input
                                        type="text"
                                        value={formData.lines[index]?.description || ''}
                                        onChange={(e) => updateLine(index, 'description', e.target.value)}
                                        placeholder="Descrição da linha"
                                        className="col-span-4 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={formData.lines[index]?.net_value || 0}
                                        onChange={(e) => updateLine(index, 'net_value', e.target.value)}
                                        className="col-span-2 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                                        value={line.iva_value}
                                        readOnly
                                        className="col-span-2 bg-slate-800/50 border border-slate-600 rounded-lg px-3 py-2 text-slate-300 cursor-not-allowed"
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

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Total Líquido (€)</label>
                                <input
                                    type="number"
                                    value={totalLiquido}
                                    readOnly
                                    className="w-full bg-slate-800/50 border border-slate-600 rounded-lg px-3 py-2 text-slate-300 cursor-not-allowed"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Total IVA (€)</label>
                                <input
                                    type="number"
                                    value={totalIva}
                                    readOnly
                                    className="w-full bg-slate-800/50 border border-slate-600 rounded-lg px-3 py-2 text-slate-300 cursor-not-allowed"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Total Final (€)</label>
                                <input
                                    type="number"
                                    value={totalFinal}
                                    readOnly
                                    className="w-full bg-slate-800/50 border border-slate-600 rounded-lg px-3 py-2 text-slate-300 cursor-not-allowed"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Cost Center */}
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

                    {/* Vehicle and Payment Status */}
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

                    {/* Payment Method and Notes */}
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
        </div>
    );
}