import React, { useState } from 'react';
import { Fuel, ClipboardCheck, LogOut, User } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import CombustivelTablet from './CombustivelTablet';
import RequisicoesTablet from './RequisicoesTablet';

export default function TabletApp() {
    const [activeTab, setActiveTab] = useState<'combustivel' | 'requisicoes'>('combustivel');
    const { currentUser, logout } = useAuth();

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans selection:bg-amber-500/20 w-screen max-w-[100vw] overflow-x-hidden">
            {/* Top Navigation Bar */}
            <header className="bg-slate-900 text-white shadow-md z-10 sticky top-0 flex-none h-16 sm:h-20 flex items-center px-4 sm:px-6">
                <div className="flex items-center gap-3 w-1/4">
                    <img src="./LOGO.png" alt="Tropical Inspire" className="h-8 sm:h-10 object-contain" onError={(e) => e.currentTarget.style.display = 'none'} />
                    <span className="font-bold text-lg hidden sm:block tracking-tight">Tropical Inspire</span>
                </div>

                <div className="flex-1 flex justify-center h-full">
                    <nav className="flex h-full gap-2 sm:gap-4 p-2">
                        <button
                            onClick={() => setActiveTab('combustivel')}
                            className={`flex items-center gap-2 sm:gap-3 px-4 sm:px-8 py-2 rounded-xl text-sm sm:text-base font-bold transition-all h-full ${
                                activeTab === 'combustivel' 
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
                                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                            }`}
                        >
                            <Fuel className="w-5 h-5 sm:w-6 sm:h-6" />
                            <span>Combustíveis</span>
                        </button>
                        <button
                            onClick={() => setActiveTab('requisicoes')}
                            className={`flex items-center gap-2 sm:gap-3 px-4 sm:px-8 py-2 rounded-xl text-sm sm:text-base font-bold transition-all h-full ${
                                activeTab === 'requisicoes' 
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
                                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                            }`}
                        >
                            <ClipboardCheck className="w-5 h-5 sm:w-6 sm:h-6" />
                            <span>Requisições</span>
                        </button>
                    </nav>
                </div>

                <div className="w-1/4 flex justify-end items-center gap-4">
                    <div className="hidden sm:flex flex-col items-end text-right">
                        <span className="text-sm font-bold text-white">{currentUser?.nome || 'Operador'}</span>
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Tablet Mode</span>
                    </div>
                    <button
                        onClick={logout}
                        className="p-3 sm:p-4 rounded-xl bg-slate-800 text-slate-300 hover:bg-red-500 hover:text-white transition-all shadow-sm"
                        title="Terminar Sessão"
                    >
                        <LogOut className="w-5 h-5 sm:w-6 sm:h-6" />
                    </button>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 overflow-y-auto bg-slate-100 p-4 sm:p-6 lg:p-8">
                <div className="max-w-[1400px] mx-auto h-full">
                    {activeTab === 'combustivel' ? <CombustivelTablet /> : <RequisicoesTablet />}
                </div>
            </main>
        </div>
    );
}
