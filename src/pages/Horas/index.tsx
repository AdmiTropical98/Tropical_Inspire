import { useState } from 'react';
import { Clock, Calendar, FileText, Layers } from 'lucide-react';
import HoursDailyView from './HoursDailyView';
import HoursMonthlyReport from './HoursMonthlyReport';
import HoursBatchView from './HoursBatchView';

export default function Horas() {
    const [activeTab, setActiveTab] = useState<'daily' | 'monthly' | 'batch'>('daily');

    // Date States
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().substring(0, 7)); // YYYY-MM

    return (
        <div className="w-full min-h-0 bg-transparent">
            {/* Header Toolbar */}
            <div className="h-16 border-b border-slate-800 flex items-center justify-between px-8 bg-[#0f172a]/95 backdrop-blur z-10 shrink-0">
                <h1 className="text-xl font-bold text-white flex items-center gap-2">
                    <Clock className="w-5 h-5 text-emerald-500" />
                    Gestão de Horas
                </h1>

                {/* Tabs */}
                <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-800">
                    <button
                        onClick={() => setActiveTab('daily')}
                        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'daily' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                    >
                        Registo Diário
                    </button>
                    <button
                        onClick={() => setActiveTab('batch')}
                        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'batch' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                    >
                        Lançamento em Massa
                    </button>
                    <button
                        onClick={() => setActiveTab('monthly')}
                        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'monthly' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                    >
                        Relatório Mensal
                    </button>
                </div>

                {/* Date Controls */}
                <div className="flex items-center gap-4">
                    {activeTab === 'daily' && (
                        <div className="flex items-center gap-2 text-sm bg-slate-900/50 px-4 py-2 rounded-lg border border-slate-700/50">
                            <Calendar className="w-4 h-4 text-slate-400" />
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="bg-transparent text-white border-none focus:ring-0 p-0 text-sm"
                            />
                        </div>
                    )}
                    {activeTab === 'monthly' && (
                        <div className="flex items-center gap-2 text-sm bg-slate-900/50 px-4 py-2 rounded-lg border border-slate-700/50">
                            <FileText className="w-4 h-4 text-slate-400" />
                            <input
                                type="month"
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(e.target.value)}
                                className="bg-transparent text-white border-none focus:ring-0 p-0 text-sm"
                            />
                        </div>
                    )}
                    {activeTab === 'batch' && (
                        <div className="flex items-center gap-2 text-sm text-slate-400">
                            <Layers className="w-4 h-4" />
                            <span>Modo em Lote</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
                <div className="w-full">
                    {activeTab === 'daily' && <HoursDailyView selectedDate={selectedDate} />}
                    {activeTab === 'batch' && <HoursBatchView />}
                    {activeTab === 'monthly' && <HoursMonthlyReport selectedMonth={selectedMonth} />}
                </div>
            </div>
        </div>
    );
}
