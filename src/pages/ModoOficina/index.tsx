import React, { useState, useEffect } from 'react';
import { Clock, Calendar, LogOut, Fuel, ArrowDownToLine, History, Wrench } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import AbastecerViatura from './components/AbastecerViatura';
import ReceberCombustivel from './components/ReceberCombustivel';
import HistoricoOficina from './components/HistoricoOficina';

type Tab = 'abastecer' | 'receber' | 'historico';

const ModoOficina: React.FC = () => {
    const { currentUser, logout } = useAuth();
    const navigate = useNavigate();
    const [currentTime, setCurrentTime] = useState(new Date());
    const [activeTab, setActiveTab] = useState<Tab>('abastecer');

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const formatDate = (date: Date) => {
        return date.toLocaleDateString('pt-PT', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('pt-PT', {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
            {/* Topbar */}
            <header className="bg-slate-900 text-white p-4 shadow-md flex justify-between items-center z-10 shrink-0">
                <div className="flex items-center gap-4">
                    <div className="bg-amber-500 text-slate-900 p-2 rounded-xl">
                        <Wrench className="w-8 h-8" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black uppercase tracking-wider">Modo Oficina</h1>
                        <p className="text-slate-400 text-sm font-medium">Terminal de Combustíveis</p>
                    </div>
                </div>

                <div className="flex items-center gap-8">
                    <div className="flex items-center gap-6 bg-slate-800/50 px-6 py-3 rounded-2xl border border-slate-700/50">
                        <div className="flex items-center gap-2 text-slate-300">
                            <Calendar className="w-5 h-5 text-amber-500" />
                            <span className="font-medium text-lg capitalize">{formatDate(currentTime)}</span>
                        </div>
                        <div className="w-px h-6 bg-slate-700"></div>
                        <div className="flex items-center gap-2 text-white">
                            <Clock className="w-5 h-5 text-amber-500" />
                            <span className="font-bold text-2xl tracking-widest">{formatTime(currentTime)}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="text-right hidden sm:block">
                            <p className="text-sm font-bold">{currentUser?.nome || 'Operador'}</p>
                            <p className="text-xs text-slate-400">Sessão Ativa</p>
                        </div>
                        <button 
                            onClick={logout}
                            className="bg-slate-800 hover:bg-red-600 transition-colors p-4 rounded-xl text-slate-300 hover:text-white group"
                            title="Terminar Sessão"
                        >
                            <LogOut className="w-6 h-6 group-hover:scale-110 transition-transform" />
                        </button>
                    </div>
                </div>
            </header>

            {/* Navigation Tabs */}
            <div className="bg-white border-b border-slate-200 px-6 py-4 flex gap-4 overflow-x-auto shrink-0 shadow-sm">
                <button
                    onClick={() => setActiveTab('abastecer')}
                    className={\`flex-1 py-6 px-4 rounded-2xl flex flex-col items-center justify-center gap-3 transition-all \${
                        activeTab === 'abastecer' 
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 ring-2 ring-blue-600 ring-offset-2' 
                        : 'bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-800 border border-slate-200'
                    }\`}
                >
                    <Fuel className={\`w-10 h-10 \${activeTab === 'abastecer' ? 'text-blue-200' : 'text-slate-400'}\`} />
                    <span className="font-black text-xl tracking-wide">Abastecer Viatura</span>
                </button>

                <button
                    onClick={() => setActiveTab('receber')}
                    className={\`flex-1 py-6 px-4 rounded-2xl flex flex-col items-center justify-center gap-3 transition-all \${
                        activeTab === 'receber' 
                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 ring-2 ring-emerald-600 ring-offset-2' 
                        : 'bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-800 border border-slate-200'
                    }\`}
                >
                    <ArrowDownToLine className={\`w-10 h-10 \${activeTab === 'receber' ? 'text-emerald-200' : 'text-slate-400'}\`} />
                    <span className="font-black text-xl tracking-wide">Receber Combustível</span>
                </button>

                <button
                    onClick={() => setActiveTab('historico')}
                    className={\`flex-1 py-6 px-4 rounded-2xl flex flex-col items-center justify-center gap-3 transition-all \${
                        activeTab === 'historico' 
                        ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30 ring-2 ring-amber-600 ring-offset-2' 
                        : 'bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-800 border border-slate-200'
                    }\`}
                >
                    <History className={\`w-10 h-10 \${activeTab === 'historico' ? 'text-amber-200' : 'text-slate-400'}\`} />
                    <span className="font-black text-xl tracking-wide">Histórico</span>
                </button>
            </div>

            {/* Main Content Area */}
            <main className="flex-1 overflow-y-auto p-6 flex flex-col">
                <div className="max-w-6xl w-full mx-auto flex-1 flex flex-col">
                    {activeTab === 'abastecer' && <AbastecerViatura />}
                    {activeTab === 'receber' && <ReceberCombustivel />}
                    {activeTab === 'historico' && <HistoricoOficina />}
                </div>
            </main>
        </div>
    );
};

export default ModoOficina;
