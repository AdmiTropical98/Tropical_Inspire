
import React, { useState } from 'react';
import { useFinancial } from '../../contexts/FinancialContext';
import { Plus, Trash2, Edit2, CheckCircle, RefreshCcw } from 'lucide-react';
import { formatCurrency } from '../../utils/format';
import { Expense } from '../../types';

export default function FixedCostsManager() {
    const { expenses, addExpense, deleteExpense, updateExpense } = useFinancial();

    // Filter only fixed/recurring expenses
    // Note: In a real app we might have a separate table for "Recurring Definitions" vs "Instanced Expenses".
    // For this MVP, we will treat existing expenses marked as 'recurring' as the definitions OR instance list.
    // Ideally, we want a list of "Active Subscriptions/Bills".
    // Let's filter by category='fixo' and recurring=true.

    const fixedCosts = expenses.filter(e => e.category === 'fixo' && e.recurring);

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Summary Cards */}
                <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <RefreshCcw className="w-16 h-16 text-purple-500" />
                    </div>
                    <h3 className="text-slate-400 text-sm font-medium uppercase tracking-wide mb-1">Total Custos Fixos (Mensal)</h3>
                    <p className="text-3xl font-bold text-white mt-2">
                        {formatCurrency(fixedCosts.reduce((acc, curr) => acc + curr.amount, 0))}
                    </p>
                    <p className="text-xs text-slate-500 mt-2">Previsão para o próximo mês</p>
                </div>
            </div>

            <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-xl overflow-hidden">
                <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-900/30">
                    <div>
                        <h3 className="text-lg font-bold text-white">Custos Recorrentes</h3>
                        <p className="text-slate-400 text-sm">Gerir rendas, subscrições e contas mensais.</p>
                    </div>
                    <button className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg shadow-purple-900/20 transition-all">
                        <Plus className="w-4 h-4" />
                        Adicionar Novo
                    </button>
                </div>

                <div className="grid grid-cols-1 divide-y divide-slate-700">
                    {fixedCosts.map(cost => (
                        <div key={cost.id} className="p-6 flex items-center justify-between hover:bg-slate-700/20 transition-colors group">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 group-hover:bg-purple-500/20 group-hover:text-purple-400 transition-colors">
                                    <RefreshCcw className="w-6 h-6" />
                                </div>
                                <div>
                                    <h4 className="text-white font-medium text-lg">{cost.description}</h4>
                                    <div className="flex gap-4 mt-1">
                                        <span className="text-xs text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
                                            {cost.recurrence_period === 'monthly' ? 'Mensal' : 'Anual'}
                                        </span>
                                        <span className="text-xs text-slate-500">Próximo: 01/{new Date().getMonth() + 2}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-8">
                                <div className="text-right">
                                    <p className="text-white font-bold text-lg">{formatCurrency(cost.amount)}</p>
                                    <p className="text-xs text-emerald-500 flex items-center justify-end gap-1">
                                        <CheckCircle className="w-3 h-3" /> Ativo
                                    </p>
                                </div>
                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors">
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button
                                        className="p-2 hover:bg-red-900/30 rounded-lg text-slate-400 hover:text-red-500 transition-colors"
                                        onClick={() => {
                                            if (window.confirm('Remover este custo fixo?')) deleteExpense(cost.id);
                                        }}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}

                    {fixedCosts.length === 0 && (
                        <div className="p-12 text-center">
                            <p className="text-slate-500">Nenhum custo fixo configurado.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
