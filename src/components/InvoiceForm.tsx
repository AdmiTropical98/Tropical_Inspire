import React, { useState, useEffect } from 'react';
import { X, Upload, FileText } from 'lucide-react';
import type { SupplierInvoice, Fornecedor, CentroCusto, Viatura } from '../types';
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

    const resolveIvaRate = (sourceInvoice: SupplierInvoice): 6 | 13 | 23 => {
        if (sourceInvoice.iva_rate === 6 || sourceInvoice.iva_rate === 13 || sourceInvoice.iva_rate === 23) {
            return sourceInvoice.iva_rate;
        }

        const referenceBase = sourceInvoice.base_amount || sourceInvoice.net_value || 0;
        const referenceIva = sourceInvoice.iva_value || sourceInvoice.vat_value || 0;
        if (referenceBase > 0) {
            const guessedRate = Math.round((referenceIva / referenceBase) * 100);
            if (guessedRate === 6 || guessedRate === 13 || guessedRate === 23) {
                return guessedRate;
            }
        }

        return 23;
    };

    const [formData, setFormData] = useState({
        supplier_id: '',
        invoice_number: '',
        issue_date: new Date().toISOString().split('T')[0],
        due_date: '',
        base_amount: 0,
        iva_rate: 23 as 6 | 13 | 23,
        discount_type: 'amount' as 'amount' | 'percentage',
        discount_value: 0,
        extra_expenses: [{ description: '', value: 0 }],
        expense_type: '',
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
            const discount = invoice.discount || { type: 'amount' as const, value: 0 };
            const extraExpenses = (invoice.extra_expenses && invoice.extra_expenses.length > 0)
                ? invoice.extra_expenses
                : [{ description: '', value: 0 }];

            setFormData({
                supplier_id: invoice.supplier_id || '',
                invoice_number: invoice.invoice_number,
                issue_date: invoice.issue_date,
                due_date: invoice.due_date,
                base_amount: invoice.base_amount || invoice.net_value || 0,
                iva_rate: resolveIvaRate(invoice),
                discount_type: discount.type === 'percentage' ? 'percentage' : 'amount',
                discount_value: discount.value || 0,
                extra_expenses: extraExpenses.map(expense => ({
                    description: expense.description || '',
                    value: expense.value || 0
                })),
                expense_type: invoice.expense_type,
                cost_center_id: invoice.cost_center_id || '',
                vehicle_id: invoice.vehicle_id || '',
                payment_status: invoice.payment_status,
                payment_method: invoice.payment_method || '',
                notes: invoice.notes || '',
                pdf_url: invoice.pdf_url || ''
            });
        }
    }, [invoice]);

    // Auto-suggest cost center for fuel expenses
    useEffect(() => {
        if (formData.expense_type.toLowerCase().includes('fuel') ||
            formData.expense_type.toLowerCase().includes('combustível') ||
            formData.expense_type.toLowerCase().includes('abastecimento')) {
            // Find a cost center that might be related to fuel
            const fuelCostCenter = costCenters.find(cc =>
                cc.nome.toLowerCase().includes('fuel') ||
                cc.nome.toLowerCase().includes('combustível') ||
                cc.nome.toLowerCase().includes('posto')
            );
            if (fuelCostCenter && !formData.cost_center_id) {
                setFormData(prev => ({ ...prev, cost_center_id: fuelCostCenter.id }));
            }
        }
    }, [formData.expense_type, costCenters, formData.cost_center_id]);

    const discountAppliedValue = round2(
        formData.discount_type === 'percentage'
            ? (formData.base_amount * formData.discount_value) / 100
            : formData.discount_value
    );
    const normalizedDiscountValue = Math.min(Math.max(discountAppliedValue, 0), Math.max(formData.base_amount, 0));
    const discountedBase = round2(Math.max(formData.base_amount - normalizedDiscountValue, 0));
    const ivaValue = round2(discountedBase * (formData.iva_rate / 100));
    const extraExpensesTotal = round2(
        formData.extra_expenses.reduce((sum, expense) => sum + (expense.value || 0), 0)
    );
    const totalValue = round2(discountedBase + extraExpensesTotal + ivaValue);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await onSave({
            supplier_id: formData.supplier_id,
            invoice_number: formData.invoice_number,
            issue_date: formData.issue_date,
            due_date: formData.due_date,
            base_amount: round2(formData.base_amount),
            iva_rate: formData.iva_rate,
            iva_value: ivaValue,
            discount: {
                type: formData.discount_type,
                value: round2(formData.discount_value),
                applied_value: normalizedDiscountValue
            },
            extra_expenses: formData.extra_expenses
                .filter(expense => expense.description.trim() || expense.value > 0)
                .map(expense => ({
                    description: expense.description.trim(),
                    value: round2(expense.value || 0)
                })),
            total: totalValue,
            net_value: discountedBase,
            vat_value: ivaValue,
            total_value: totalValue,
            expense_type: formData.expense_type,
            cost_center_id: formData.cost_center_id || undefined,
            vehicle_id: formData.vehicle_id || undefined,
            payment_status: formData.payment_status,
            payment_method: formData.payment_method || undefined,
            notes: formData.notes || undefined,
            pdf_url: formData.pdf_url || undefined
        });
    };

    const updateExtraExpense = (index: number, field: 'description' | 'value', rawValue: string) => {
        setFormData(prev => {
            const nextExpenses = prev.extra_expenses.map((expense, expenseIndex) => {
                if (expenseIndex !== index) return expense;
                return {
                    ...expense,
                    [field]: field === 'value' ? (parseFloat(rawValue) || 0) : rawValue
                };
            });

            return { ...prev, extra_expenses: nextExpenses };
        });
    };

    const addExtraExpenseRow = () => {
        setFormData(prev => ({
            ...prev,
            extra_expenses: [...prev.extra_expenses, { description: '', value: 0 }]
        }));
    };

    const removeExtraExpenseRow = (index: number) => {
        setFormData(prev => ({
            ...prev,
            extra_expenses: prev.extra_expenses.length > 1
                ? prev.extra_expenses.filter((_, expenseIndex) => expenseIndex !== index)
                : [{ description: '', value: 0 }]
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

                    {/* Financial Values */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Valor Base (€) *
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={formData.base_amount}
                                onChange={(e) => setFormData(prev => ({ ...prev, base_amount: parseFloat(e.target.value) || 0 }))}
                                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Desconto
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                <select
                                    value={formData.discount_type}
                                    onChange={(e) => setFormData(prev => ({
                                        ...prev,
                                        discount_type: e.target.value as 'amount' | 'percentage'
                                    }))}
                                    className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                >
                                    <option value="amount">€</option>
                                    <option value="percentage">%</option>
                                </select>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={formData.discount_value}
                                    onChange={(e) => setFormData(prev => ({ ...prev, discount_value: parseFloat(e.target.value) || 0 }))}
                                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                            <p className="text-xs text-slate-400 mt-1">
                                Aplicado: €{normalizedDiscountValue.toFixed(2)}
                            </p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                IVA
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                <select
                                    value={formData.iva_rate}
                                    onChange={(e) => setFormData(prev => ({
                                        ...prev,
                                        iva_rate: Number(e.target.value) as 6 | 13 | 23
                                    }))}
                                    className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                >
                                    <option value={6}>6%</option>
                                    <option value={13}>13%</option>
                                    <option value={23}>23%</option>
                                </select>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={ivaValue}
                                    readOnly
                                    className="w-full bg-slate-800/50 border border-slate-600 rounded-lg px-3 py-2 text-slate-300 cursor-not-allowed"
                                />
                            </div>
                            <p className="text-xs text-slate-400 mt-1">
                                Base após desconto: €{discountedBase.toFixed(2)}
                            </p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Total (€)
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                value={totalValue}
                                readOnly
                                className="w-full bg-slate-800/50 border border-slate-600 rounded-lg px-3 py-2 text-slate-300 cursor-not-allowed"
                            />
                        </div>
                    </div>

                    {/* Extra Expenses */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="block text-sm font-medium text-slate-300">
                                Despesas Extra
                            </label>
                            <button
                                type="button"
                                onClick={addExtraExpenseRow}
                                className="px-3 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-white rounded-md transition-colors"
                            >
                                Adicionar linha
                            </button>
                        </div>
                        <div className="space-y-2">
                            {formData.extra_expenses.map((expense, index) => (
                                <div key={index} className="grid grid-cols-12 gap-2">
                                    <input
                                        type="text"
                                        value={expense.description}
                                        onChange={(e) => updateExtraExpense(index, 'description', e.target.value)}
                                        placeholder="Descrição"
                                        className="col-span-7 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={expense.value}
                                        onChange={(e) => updateExtraExpense(index, 'value', e.target.value)}
                                        placeholder="0.00"
                                        className="col-span-4 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => removeExtraExpenseRow(index)}
                                        className="col-span-1 px-2 py-2 text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
                                        title="Remover despesa"
                                    >
                                        <X className="w-4 h-4 mx-auto" />
                                    </button>
                                </div>
                            ))}
                        </div>
                        <p className="text-xs text-slate-400 mt-2">
                            Total despesas extra: €{extraExpensesTotal.toFixed(2)}
                        </p>
                    </div>

                    {/* Expense Type and Cost Center */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Tipo de Despesa *
                            </label>
                            <input
                                type="text"
                                value={formData.expense_type}
                                onChange={(e) => setFormData(prev => ({ ...prev, expense_type: e.target.value }))}
                                placeholder="Ex: Combustível, Manutenção, etc."
                                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                required
                            />
                        </div>
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