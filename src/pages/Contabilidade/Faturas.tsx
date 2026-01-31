import { useState } from 'react';
import { Plus, Search, FileText, Download, Eye, Trash2, Pencil } from 'lucide-react';
import type { Fatura } from '../../types';
import { useTranslation } from '../../hooks/useTranslation';

import { useWorkshop } from '../../contexts/WorkshopContext';

interface FaturasProps {
    invoices: Fatura[];
    onCreateNew: () => void;
    onDelete: (id: string) => void;
    onDownload: (invoice: Fatura) => void;
    onEdit: (invoice: Fatura) => void;
    onView: (invoice: Fatura) => void;
}

export default function Faturas({ invoices, onCreateNew, onDelete, onDownload, onEdit, onView }: FaturasProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const { clientes } = useWorkshop();
    const { t } = useTranslation();

    const getStatusColor = (status: Fatura['status']) => {
        switch (status) {
            case 'paga': return 'bg-emerald-500/10 text-emerald-400';
            case 'emitida': return 'bg-blue-500/10 text-blue-400';
            case 'anulada': return 'bg-red-500/10 text-red-400';
            default: return 'bg-slate-500/10 text-slate-400';
        }
    };

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(val);
    };

    return (
        <div className="space-y-6">
            {/* Header Actions */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-[#1e293b]/50 backdrop-blur-sm p-4 rounded-xl border border-slate-700/50">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder={t('accounting.invoices.search')}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-slate-900 border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white"
                    />
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    <button className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors text-sm border border-slate-700">
                        <Download className="w-4 h-4" />
                        {t('accounting.invoices.export')}
                    </button>
                    <button
                        onClick={onCreateNew}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors text-sm font-medium shadow-lg shadow-blue-500/20"
                    >
                        <Plus className="w-4 h-4" />
                        {t('accounting.invoices.new')}
                    </button>
                </div>
            </div>

            {/* Invoices List */}
            <div className="bg-[#1e293b]/50 backdrop-blur-sm rounded-xl border border-slate-700/50 overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-slate-400 uppercase bg-slate-800/50">
                        <tr>
                            <th className="px-6 py-4">Fatura</th>
                            <th className="px-6 py-4">Cliente</th>
                            <th className="px-6 py-4">Data</th>
                            <th className="px-6 py-4">Vencimento</th>
                            <th className="px-6 py-4 text-right">Valor Total</th>
                            <th className="px-6 py-4 text-center">Status</th>
                            <th className="px-6 py-4 text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                        {invoices.map((invoice) => (
                            <tr key={invoice.id} className="hover:bg-slate-800/30 transition-colors group">
                                <td className="px-6 py-4 font-medium text-white flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-slate-500" />
                                    {invoice.numero}
                                </td>
                                <td className="px-6 py-4 text-slate-300">
                                    {invoice.isExpense
                                        ? (invoice.cliente?.nome || 'Fornecedor')
                                        : (clientes.find(c => c.id === invoice.clienteId)?.nome || 'Cliente Desconhecido')}
                                </td>
                                <td className="px-6 py-4 text-slate-400">{invoice.data}</td>
                                <td className="px-6 py-4 text-slate-400">{invoice.vencimento}</td>
                                <td className="px-6 py-4 text-right font-medium text-white">
                                    <span className={invoice.total < 0 ? 'text-red-400' : 'text-emerald-400'}>
                                        {formatCurrency(invoice.total)}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${getStatusColor(invoice.status)}`}>
                                        {invoice.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <button
                                            onClick={() => onView(invoice)}
                                            title="Ver Detalhes"
                                            className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
                                        >
                                            <Eye className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => onEdit(invoice)}
                                            title="Editar"
                                            className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
                                        >
                                            <Pencil className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => onDownload(invoice)}
                                            title="Baixar PDF"
                                            className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
                                        >
                                            <Download className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => onDelete(invoice.id)}
                                            title={t('accounting.invoices.delete_confirm')}
                                            className="p-2 hover:bg-red-500/10 rounded-lg text-slate-400 hover:text-red-400 transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {invoices.length === 0 && (
                    <div className="p-12 text-center text-slate-400">
                        <FileText className="w-12 h-12 mx-auto mb-4 opacity-20" />
                        <p>{t('accounting.invoices.empty')}</p>
                    </div>
                )}
            </div>
        </div>
    );
}
