import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Plus, Search, FileText, Download, Eye, Edit, Trash2,
    CheckCircle, Filter
} from 'lucide-react';
import type { SupplierInvoice } from '../../types';
import { useWorkshop } from '../../contexts/WorkshopContext';
import { useFinancial } from '../../contexts/FinancialContext';
import StatusBadge from '../../components/common/StatusBadge';
import { formatCurrency } from '../../utils/format';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function SupplierInvoices() {
    const navigate = useNavigate();
    const { fornecedores, centrosCustos, viaturas } = useWorkshop();
    const {
        supplierInvoices,
        updateSupplierInvoice,
        deleteSupplierInvoice
    } = useFinancial();

    const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState({
        supplier: '',
        vehicle: '',
        costCenter: '',
        status: '',
        dateFrom: '',
        dateTo: ''
    });

    const getInvoiceTotal = (invoice: SupplierInvoice) => invoice.total_final ?? invoice.total ?? invoice.total_value ?? 0;
    const getInvoiceBase = (invoice: SupplierInvoice) => invoice.total_liquido ?? invoice.base_amount ?? invoice.net_value ?? 0;

    // Filter invoices
    const filteredInvoices = supplierInvoices.filter(invoice => {
        const matchesSearch = !searchTerm ||
            invoice.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
            invoice.supplier?.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
            invoice.expense_type.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesSupplier = !filters.supplier || invoice.supplier_id === filters.supplier;
        const matchesVehicle = !filters.vehicle || invoice.vehicle_id === filters.vehicle;
        const matchesCostCenter = !filters.costCenter || invoice.cost_center_id === filters.costCenter;
        const matchesStatus = !filters.status || invoice.payment_status === filters.status;
        const matchesDateFrom = !filters.dateFrom || invoice.issue_date >= filters.dateFrom;
        const matchesDateTo = !filters.dateTo || invoice.issue_date <= filters.dateTo;

        return matchesSearch && matchesSupplier && matchesVehicle &&
               matchesCostCenter && matchesStatus && matchesDateFrom && matchesDateTo;
    });

    const handleCreateNew = () => {
        navigate('/finance/faturas/nova');
    };

    const handleEdit = (invoice: SupplierInvoice) => {
        navigate(`/finance/faturas/${invoice.id}/editar`);
    };

    const handleView = (invoice: SupplierInvoice) => {
        // For now, just edit. Could add a read-only view later
        handleEdit(invoice);
    };

    const handleMarkAsPaid = async (invoice: SupplierInvoice) => {
        if (confirm('Marcar esta fatura como paga?')) {
            await updateSupplierInvoice(invoice.id, { payment_status: 'paid' });
        }
    };

    const handleDelete = async (invoice: SupplierInvoice) => {
        if (confirm('Tem certeza que deseja excluir esta fatura?')) {
            await deleteSupplierInvoice(invoice.id);
        }
    };

    const generateReport = async (groupBy: 'vehicle' | 'supplier' | 'cost_center' | 'period') => {
        try {
            const doc = new jsPDF();
            const pageWidth = doc.internal.pageSize.width;

            // Header
            doc.setFillColor(20, 60, 140);
            doc.rect(0, 0, pageWidth, 40, 'F');
            doc.setFontSize(22);
            doc.setTextColor(255, 255, 255);
            doc.text('Relatório de Faturas de Fornecedor', 14, 25);

            const groupedData: Record<string, SupplierInvoice[]> = {};

            // Group data
            filteredInvoices.forEach(invoice => {
                let key = '';
                switch (groupBy) {
                    case 'vehicle':
                        key = invoice.vehicle?.matricula || 'Sem Viatura';
                        break;
                    case 'supplier':
                        key = invoice.supplier?.nome || 'Sem Fornecedor';
                        break;
                    case 'cost_center':
                        key = invoice.cost_center?.nome || 'Sem Centro Custo';
                        break;
                    case 'period':
                        key = new Date(invoice.issue_date).toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });
                        break;
                }
                if (!groupedData[key]) groupedData[key] = [];
                groupedData[key].push(invoice);
            });

            let yPosition = 50;

            Object.entries(groupedData).forEach(([group, invoices]) => {
                const total = invoices.reduce((sum, inv) => sum + getInvoiceTotal(inv), 0);

                // Group header
                doc.setFontSize(14);
                doc.setTextColor(0, 0, 0);
                doc.text(`${group} - Total: ${formatCurrency(total)}`, 14, yPosition);
                yPosition += 10;

                // Table
                autoTable(doc, {
                    startY: yPosition,
                    head: [['Fatura', 'Fornecedor', 'Valor', 'Status', 'Vencimento']],
                    body: invoices.map(inv => [
                        inv.invoice_number,
                        inv.supplier?.nome || '',
                        formatCurrency(getInvoiceTotal(inv)),
                        inv.payment_status,
                        new Date(inv.due_date).toLocaleDateString('pt-PT')
                    ]),
                    styles: { fontSize: 8 },
                    headStyles: { fillColor: [41, 128, 185] }
                });

                const lastAutoTable = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable;
                yPosition = (lastAutoTable?.finalY || yPosition) + 15;
            });

            doc.save(`relatorio_faturas_${groupBy}.pdf`);
        } catch (error) {
            console.error('Error generating report:', error);
            alert('Erro ao gerar relatório');
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Faturas de Fornecedores</h1>
                    <p className="text-slate-600">Gerencie faturas de fornecedores e acompanhe pagamentos</p>
                </div>
                <button
                    onClick={handleCreateNew}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    Nova Fatura
                </button>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                    <Filter className="w-4 h-4 text-slate-500" />
                    <span className="text-sm font-medium text-slate-700">Filtros</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                        <label className="block text-xs text-slate-500 mb-1">Fornecedor</label>
                        <select
                            value={filters.supplier}
                            onChange={(e) => setFilters(prev => ({ ...prev, supplier: e.target.value }))}
                            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        >
                            <option value="">Todos</option>
                            {fornecedores.map(supplier => (
                                <option key={supplier.id} value={supplier.id}>
                                    {supplier.nome}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs text-slate-500 mb-1">Viatura</label>
                        <select
                            value={filters.vehicle}
                            onChange={(e) => setFilters(prev => ({ ...prev, vehicle: e.target.value }))}
                            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        >
                            <option value="">Todas</option>
                            {viaturas.map(vehicle => (
                                <option key={vehicle.id} value={vehicle.id}>
                                    {vehicle.matricula}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs text-slate-500 mb-1">Centro Custo</label>
                        <select
                            value={filters.costCenter}
                            onChange={(e) => setFilters(prev => ({ ...prev, costCenter: e.target.value }))}
                            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        >
                            <option value="">Todos</option>
                            {centrosCustos.map(cc => (
                                <option key={cc.id} value={cc.id}>
                                    {cc.nome}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs text-slate-500 mb-1">Status</label>
                        <select
                            value={filters.status}
                            onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        >
                            <option value="">Todos</option>
                            <option value="pending">Pendente</option>
                            <option value="scheduled">Agendado</option>
                            <option value="paid">Pago</option>
                            <option value="overdue">Vencido</option>
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div>
                        <label className="block text-xs text-slate-500 mb-1">Data Inicial</label>
                        <input
                            type="date"
                            value={filters.dateFrom}
                            onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-slate-500 mb-1">Data Final</label>
                        <input
                            type="date"
                            value={filters.dateTo}
                            onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                    </div>
                </div>
            </div>

            {/* Search and Export */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Buscar faturas..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-lg pl-10 pr-4 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={() => generateReport('supplier')}
                        className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors text-sm border border-slate-200"
                    >
                        <Download className="w-4 h-4" />
                        Por Fornecedor
                    </button>
                    <button
                        onClick={() => generateReport('vehicle')}
                        className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors text-sm border border-slate-200"
                    >
                        <Download className="w-4 h-4" />
                        Por Viatura
                    </button>
                    <button
                        onClick={() => generateReport('cost_center')}
                        className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors text-sm border border-slate-200"
                    >
                        <Download className="w-4 h-4" />
                        Por Centro Custo
                    </button>
                </div>
            </div>

            {/* Invoices Table */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                    Fatura
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                                    Fornecedor
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                                    Valor
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                                    Status
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                                    Vencimento
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                                    Viatura
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                                    Ações
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {filteredInvoices.map((invoice) => (
                                <tr key={invoice.id} className="hover:bg-slate-50">
                                    <td className="px-4 py-4 whitespace-nowrap">
                                        <div className="text-sm font-medium text-slate-900">
                                            {invoice.invoice_number}
                                        </div>
                                        <div className="text-sm text-slate-500">
                                            {invoice.expense_type}
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap">
                                        <div className="text-sm text-slate-900">
                                            {invoice.supplier?.nome}
                                        </div>
                                        <div className="text-sm text-slate-500">
                                            {invoice.cost_center?.nome}
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap">
                                        <div className="text-sm font-medium text-slate-900">
                                            {formatCurrency(getInvoiceTotal(invoice))}
                                        </div>
                                        <div className="text-sm text-slate-500">
                                            Base: {formatCurrency(getInvoiceBase(invoice))}
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap">
                                        <StatusBadge status={invoice.payment_status} />
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap">
                                        <div className="text-sm text-slate-900">
                                            {new Date(invoice.due_date).toLocaleDateString('pt-PT')}
                                        </div>
                                        <div className="text-sm text-slate-500">
                                            Emissão: {new Date(invoice.issue_date).toLocaleDateString('pt-PT')}
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap">
                                        <div className="text-sm text-slate-900">
                                            {invoice.vehicle?.matricula}
                                        </div>
                                        <div className="text-sm text-slate-500">
                                            {invoice.vehicle?.marca} {invoice.vehicle?.modelo}
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => handleView(invoice)}
                                                className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
                                                title="Ver"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleEdit(invoice)}
                                                className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
                                                title="Editar"
                                            >
                                                <Edit className="w-4 h-4" />
                                            </button>
                                            {invoice.payment_status !== 'paid' && (
                                                <button
                                                    onClick={() => handleMarkAsPaid(invoice)}
                                                    className="p-1 text-slate-400 hover:text-green-600 transition-colors"
                                                    title="Marcar como Pago"
                                                >
                                                    <CheckCircle className="w-4 h-4" />
                                                </button>
                                            )}
                                            {invoice.pdf_url && (
                                                <a
                                                    href={invoice.pdf_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
                                                    title="Ver PDF"
                                                >
                                                    <FileText className="w-4 h-4" />
                                                </a>
                                            )}
                                            <button
                                                onClick={() => handleDelete(invoice)}
                                                className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                                                title="Excluir"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {filteredInvoices.length === 0 && (
                    <div className="text-center py-12">
                        <FileText className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                        <p className="text-slate-400">Nenhuma fatura encontrada</p>
                    </div>
                )}
            </div>
        </div>
    );
}