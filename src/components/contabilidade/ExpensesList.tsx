
import React, { useState, useMemo } from 'react';
import { useFinancial } from '../../contexts/FinancialContext';
import { Search, Filter, Plus, FileText, ArrowUpRight, ArrowDownRight, Calendar } from 'lucide-react';
import { formatCurrency } from '../../utils/format';

export default function ExpensesList() {
    const { expenses, isLoading } = useFinancial();
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState<string>('all');

    // Sort logic
    const [sortField, setSortField] = useState<'date' | 'amount'>('date');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

    const filteredExpenses = useMemo(() => {
        return expenses.filter(expense => {
            const matchesSearch = expense.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                expense.cost_center_id?.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = filterCategory === 'all' || expense.category === filterCategory;

            return matchesSearch && matchesCategory;
        }).sort((a, b) => {
            const multiplier = sortDirection === 'asc' ? 1 : -1;
            if (sortField === 'date') return multiplier * (new Date(a.date).getTime() - new Date(b.date).getTime());
            if (sortField === 'amount') return multiplier * (a.amount - b.amount);
            return 0;
        });
    }, [expenses, searchTerm, filterCategory, sortField, sortDirection]);

    if (isLoading) return <div className="p-8 text-slate-400">Loading expenses...</div>;

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        <ArrowDownRight className="w-6 h-6 text-red-500" />
                        Despesas e Custos
                    </h2>
                    <p className="text-slate-400 text-sm mt-1">Registo unificado de todas as saídas (Combustível, Manutenção, Salários, Fixos)</p>
                </div>

                <div className="flex gap-2">
                    <button className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg shadow-emerald-900/20 transition-all">
                        <Plus className="w-4 h-4" />
                        Nova Despesa
                    </button>
                    <button className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-lg flex items-center gap-2 transition-all">
                        <FileText className="w-4 h-4" />
                        Exportar
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 backdrop-blur-sm grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="relative col-span-2">
                    <Search className="absolute left-3 top-2.5 w-5 h-5 text-slate-500" />
                    <input
                        type="text"
                        placeholder="Pesquisar despesa..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-slate-900/50 border border-slate-700 text-slate-200 pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:border-indigo-500"
                    />
                </div>

                <div>
                    <select
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                        className="w-full bg-slate-900/50 border border-slate-700 text-slate-200 px-4 py-2 rounded-lg focus:outline-none focus:border-indigo-500 appearance-none"
                    >
                        <option value="all">Todas as Categorias</option>
                        <option value="variavel">Variáveis (Combustível/Manut.)</option>
                        <option value="fixo">Custos Fixos</option>
                        <option value="salario">Salários</option>
                        <option value="imposto">Impostos</option>
                        <option value="outro">Outros</option>
                    </select>
                </div>

                <div>
                    {/* Date Filter Placeholder - could be improved with DateRangePicker */}
                    <button className="w-full bg-slate-900/50 border border-slate-700 text-slate-200 px-4 py-2 rounded-lg flex items-center justify-between hover:bg-slate-900 transition-colors">
                        <span className="text-slate-400">Este Mês</span>
                        <Calendar className="w-4 h-4 text-slate-500" />
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700 shadow-xl">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-900/50 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-700">
                            <th className="px-6 py-4 font-semibold">Data</th>
                            <th className="px-6 py-4 font-semibold">Descrição</th>
                            <th className="px-6 py-4 font-semibold">Categoria</th>
                            <th className="px-6 py-4 font-semibold">C. Custo</th>
                            <th className="px-6 py-4 font-semibold text-right">Valor</th>
                            <th className="px-6 py-4 font-semibold text-center">Status</th>
                            <th className="px-6 py-4 font-semibold text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                        {filteredExpenses.map((expense) => (
                            <tr key={expense.id} className="hover:bg-slate-700/30 transition-colors group">
                                <td className="px-6 py-4 text-slate-300 font-medium">
                                    {new Date(expense.date).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-col">
                                        <span className="text-slate-200 font-medium">{expense.description}</span>
                                        {expense.recurring && <span className="text-xs text-indigo-400 flex items-center gap-1">Recorrente ({expense.recurrence_period})</span>}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <Badge category={expense.category} />
                                </td>
                                <td className="px-6 py-4 text-slate-400 text-sm">
                                    {expense.cost_center_id || '-'}
                                </td>
                                <td className="px-6 py-4 text-right font-medium text-red-400">
                                    - {formatCurrency(expense.amount)}
                                </td>
                                <td className="px-6 py-4 text-center">
                                    {expense.paid ? (
                                        <span className="px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-xs font-bold uppercase">Pago</span>
                                    ) : (
                                        <span className="px-2 py-1 rounded-full bg-amber-500/10 text-amber-500 text-xs font-bold uppercase">Pendente</span>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button className="text-slate-400 hover:text-white text-sm">Editar</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {filteredExpenses.length === 0 && (
                    <div className="p-12 text-center text-slate-500">
                        <ArrowDownRight className="w-12 h-12 mx-auto mb-4 opacity-20" />
                        <p>Nenhuma despesa encontrada.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

function Badge({ category }: { category: string }) {
    const styles: Record<string, string> = {
        fixo: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
        variavel: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
        imposto: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
        salario: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
        outro: 'bg-slate-500/20 text-slate-400 border-slate-500/30'
    };

    return (
        <span className={`px-2.5 py-0.5 rounded border text-xs font-medium uppercase tracking-wide ${styles[category] || styles.outro}`}>
            {category}
        </span>
    );
}
