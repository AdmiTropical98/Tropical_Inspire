import { useState } from 'react';
import { BarChart3, BusFront, FileText, PieChart, SlidersHorizontal } from 'lucide-react';
import DashboardView from './DashboardView';
import PresetReportsView from './PresetReportsView';
import CustomReportBuilder from './CustomReportBuilder';
import TransportReportsView from './TransportReportsView';
import MonthlyReportsView from './MonthlyReportsView';

export default function Relatorios() {
    const [activeTab, setActiveTab] = useState<'dashboard' | 'presets' | 'custom' | 'transport' | 'monthly'>('dashboard');

    return (
        <div className="flex flex-col space-y-8">
            {/* Header Section */}
            <div className="pb-8 border-b border-slate-800/50 bg-[#0f172a]/50 backdrop-blur-xl z-10">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                            <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20">
                                <BarChart3 className="w-8 h-8 text-blue-500" />
                            </div>
                            Relatórios e Análise
                        </h1>
                        <p className="text-slate-400 mt-2 ml-1">
                            Visualize métricas operacionais e exporte dados da frota.
                        </p>
                    </div>

                    {/* Navigation Tabs */}
                    <div className="flex bg-slate-900/50 p-1.5 rounded-xl border border-slate-800/50">
                        <button
                            onClick={() => setActiveTab('dashboard')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${activeTab === 'dashboard'
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
                                : 'text-slate-400 hover:text-white hover:bg-slate-800'
                                }`}
                        >
                            <PieChart className="w-4 h-4" />
                            Visão Geral
                        </button>
                        <button
                            onClick={() => setActiveTab('presets')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${activeTab === 'presets'
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
                                : 'text-slate-400 hover:text-white hover:bg-slate-800'
                                }`}
                        >
                            <FileText className="w-4 h-4" />
                            Relatórios Prontos
                        </button>
                        <button
                            onClick={() => setActiveTab('custom')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${activeTab === 'custom'
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
                                : 'text-slate-400 hover:text-white hover:bg-slate-800'
                                }`}
                        >
                            <SlidersHorizontal className="w-4 h-4" />
                            Personalizado
                        </button>
                        <button
                            onClick={() => setActiveTab('transport')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${activeTab === 'transport'
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
                                : 'text-slate-400 hover:text-white hover:bg-slate-800'
                                }`}
                        >
                            <BusFront className="w-4 h-4" />
                            Transporte
                        </button>
                        <button
                            onClick={() => setActiveTab('monthly')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${activeTab === 'monthly'
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
                                : 'text-slate-400 hover:text-white hover:bg-slate-800'
                                }`}
                        >
                            <FileText className="w-4 h-4" />
                            Mensal
                        </button>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <main className="flex-1">
                <div className="">
                    {activeTab === 'dashboard' && <DashboardView />}
                    {activeTab === 'presets' && <PresetReportsView />}
                    {activeTab === 'custom' && <CustomReportBuilder />}
                    {activeTab === 'transport' && <TransportReportsView />}
                    {activeTab === 'monthly' && <MonthlyReportsView />}
                </div>
            </main>
        </div>
    );
}
