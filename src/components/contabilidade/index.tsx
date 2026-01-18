
import { useState, useEffect } from 'react';
import {
    Wallet, TrendingDown, DollarSign,
    Download, PieChart, BarChart3,
    ArrowUpRight, CreditCard,
    Receipt, RefreshCcw
} from 'lucide-react';
import NovaFatura from './NovaFatura';
import Alugueres from './Alugueres';
import ExpensesList from './ExpensesList';
import FixedCostsManager from './FixedCostsManager';
import { FinancialProvider, useFinancial } from '../../contexts/FinancialContext';
import { formatCurrency } from '../../utils/format';
import { supabase } from '../../lib/supabase';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Fatura } from '../../types';

function ContabilidadeContent() {
    // Only get what actually exists in the context
    const { summary, isLoading, refreshData } = useFinancial();
    const [activeTab, setActiveTab] = useState<'dashboard' | 'receitas' | 'despesas' | 'fixos' | 'alugueres'>('dashboard');
    const [view, setView] = useState<'list' | 'create' | 'edit'>('list');
    const [selectedInvoice, setSelectedInvoice] = useState<Fatura | null>(null);
    const [invoices, setInvoices] = useState<Fatura[]>([]);

    useEffect(() => {
        fetchInvoices();
    }, []);

    const fetchInvoices = async () => {
        const { data } = await supabase.from('faturas').select('*, itens:itens_fatura(*)').order('data', { ascending: false });
        if (data) {
            // Map to Fatura type if needed, usually direct match is close enough for MVP
            // Ensuring sub-tables are handled
            setInvoices(data as any);
        }
    };

    const generateCostCenterReport = async () => {
        try {
            const doc = new jsPDF();
            const pageWidth = doc.internal.pageSize.width;

            // Header (Simplified)
            doc.setFillColor(20, 60, 140);
            doc.rect(0, 0, pageWidth, 40, 'F');
            doc.setFontSize(22);
            doc.setTextColor(255, 255, 255);
            doc.text('Relatório Financeiro', 14, 25);

            // Content
            autoTable(doc, {
                startY: 50,
                head: [['Categoria', 'Valor']],
                body: summary.expenseBreakdown.map(i => [i.category, formatCurrency(i.value)]),
            });

            doc.save('Relatorio_Financeiro.pdf');
        } catch (e) {
            console.error(e);
            alert('Erro ao gerar PDF');
        }
    };

    const handleSaveInvoice = async (data: any) => {
        try {
            const payload = {
                ...data,
                id: selectedInvoice?.id || crypto.randomUUID(),
                status: 'emitida'
            };

            const { error } = await supabase.from('faturas').upsert(payload);
            if (error) throw error;

            // Handle items... simplified for verification fix
            refreshData();
            fetchInvoices();
            setView('list');
            setSelectedInvoice(null);
        } catch (e: any) {
            alert('Erro ao guardar: ' + e.message);
        }
    };

    const handleSaveRental = async (data: Fatura) => {
        // Similar to save invoice
        try {
            const { error } = await supabase.from('faturas').upsert(data);
            if (error) throw error;
            refreshData();
            fetchInvoices();
            alert('Aluguer guardado');
        } catch (e: any) {
            alert('Erro: ' + e.message);
        }
    };

    const handleDeleteInvoice = async (id: string) => {
        if (!confirm('Apagar fatura?')) return;
        await supabase.from('faturas').delete().eq('id', id);
        fetchInvoices();
        refreshData();
    };


    if (isLoading) return <div className="p-12 text-center text-slate-400">Carregando dados financeiros...</div>;

    if (view === 'create' || view === 'edit') {
        return (
            <NovaFatura
                onBack={() => { setView('list'); setSelectedInvoice(null); }}
                onSave={handleSaveInvoice}
                initialData={selectedInvoice}
            />
        );
    }

    const renderContent = () => {
        switch (activeTab) {
            case 'dashboard':
                return (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* KPI Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <KPICard title="Receita Total" value={summary.totalRevenue} icon={<Wallet className="w-5 h-5 text-emerald-400" />} color="bg-emerald-500/10 text-emerald-500 border-emerald-500/20" />
                            <KPICard title="Despesas Totais" value={summary.totalExpenses} icon={<TrendingDown className="w-5 h-5 text-red-400" />} color="bg-red-500/10 text-red-500 border-red-500/20" />
                            <KPICard title="Lucro Líquido" value={summary.netProfit} icon={<DollarSign className="w-5 h-5 text-indigo-400" />} color="bg-indigo-500/10 text-indigo-500 border-indigo-500/20" />
                            <KPICard title="Pendentes" value={summary.pendingPayments} icon={<CreditCard className="w-5 h-5 text-amber-400" />} color="bg-amber-500/10 text-amber-500 border-amber-500/20" />
                        </div>
                        {/* Charts Area */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="lg:col-span-2 bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
                                <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2"><PieChart className="w-5 h-5 text-slate-400" /> Distribuição de Custos</h3>
                                <div className="space-y-4">
                                    {summary.expenseBreakdown.map(item => (
                                        <div key={item.category}>
                                            <div className="flex justify-between text-sm mb-1"><span className="text-slate-300">{item.category}</span><span className="text-slate-400 font-medium">{formatCurrency(item.value)}</span></div>
                                            <div className="w-full bg-slate-700 rounded-full h-2"><div className={`h-2 rounded-full ${item.color}`} style={{ width: `${(item.value / (summary.totalExpenses || 1)) * 100}%` }}></div></div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
                                <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2"><BarChart3 className="w-5 h-5 text-slate-400" /> Top Centros Custo</h3>
                                <div className="space-y-4">
                                    {summary.topCostCenters.map((cc, i) => (
                                        <div key={cc.id} className="flex justify-between p-3 bg-slate-900/50 rounded-lg"><span className="text-slate-300">{i + 1}. {cc.nome}</span><span className="text-indigo-400">{formatCurrency(cc.total)}</span></div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case 'receitas': return <Alugueres invoices={invoices} onDelete={handleDeleteInvoice} onSaveRental={handleSaveRental} onRefresh={fetchInvoices} />;
            case 'despesas': return <ExpensesList />;
            case 'fixos': return <FixedCostsManager />;
            case 'alugueres': return <Alugueres invoices={invoices} onDelete={handleDeleteInvoice} onSaveRental={handleSaveRental} onRefresh={fetchInvoices} />;
            default: return null;
        }
    };


    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 p-8 pt-24 space-y-8">
            <div className="flex justify-between items-center flex-wrap gap-4">
                <div>
                    <h1 className="text-4xl font-black text-white tracking-tight mb-2">Gestão Financeira</h1>
                    <p className="text-slate-400 text-lg">Visão 360º das finanças.</p>
                </div>
                <div className="flex items-center gap-4">
                    <button
                        onClick={generateCostCenterReport}
                        className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-xl font-medium border border-slate-700 transition-all shadow-lg hidden md:flex"
                    >
                        <Download className="w-4 h-4" />
                        Relatório
                    </button>

                    <div className="flex bg-slate-800 p-1.5 rounded-xl border border-slate-700/50 overflow-x-auto">
                        {[
                            { id: 'dashboard', label: 'Visão Geral', icon: PieChart },
                            { id: 'receitas', label: 'Alugueres', icon: ArrowUpRight },
                            { id: 'despesas', label: 'Despesas', icon: Receipt },
                            { id: 'fixos', label: 'Fixos', icon: RefreshCcw },
                        ].map(tab => (
                            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all ${activeTab === tab.id ? 'bg-slate-700 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>
                                <tab.icon className="w-4 h-4" /> {tab.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
            {renderContent()}
        </div>
    );
}

export default function Contabilidade() {
    return (
        <FinancialProvider>
            <ContabilidadeContent />
        </FinancialProvider>
    );
}

function KPICard({ title, value, icon, color }: any) {
    return (
        <div className={`p-6 rounded-xl border ${color.split(' ')[2]} ${color.split(' ')[0]} backdrop-blur-sm relative overflow-hidden`}>
            <div className="flex items-center gap-3 mb-2"><div className={`p-2 rounded-lg bg-white/10 ${color.split(' ')[1]}`}>{icon}</div><h3 className="text-sm font-semibold uppercase opacity-80">{title}</h3></div>
            <p className="text-3xl font-bold mt-2">{formatCurrency(value)}</p>
        </div>
    );
}
