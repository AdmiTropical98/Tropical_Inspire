import { useState } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import { useAuth } from '../../contexts/AuthContext';
import { useWorkshop } from '../../contexts/WorkshopContext';
import {
    LayoutTemplate, Clock, FileText, Share2, AlertTriangle,
    Send, Upload, Download, Car, Gauge, Shield, Sun, Navigation, Calendar,
    Check, Fuel
} from 'lucide-react';

export default function CentralMotorista() {
    const { t } = useTranslation();
    const { currentUser, userRole, userPhoto } = useAuth();
    const { addNotification } = useWorkshop();

    const [activeTab, setActiveTab] = useState<'overview' | 'viatura' | 'horas' | 'pedidos' | 'recibos' | 'reportar'>('overview');

    // Forms State
    const [hoursForm, setHoursForm] = useState({ date: new Date().toISOString().split('T')[0], start: '', end: '', break: '60' });
    const [requestForm, setRequestForm] = useState({ type: 'ferias', description: '' });
    const [reportForm, setReportForm] = useState({ type: 'acidente', description: '' });

    // Mock Data
    const [myRequests] = useState([
        { id: '1', type: 'férias', date: '2023-12-01', status: 'approved', desc: 'Férias de Natal' },
        { id: '2', type: 'adiantamento', date: '2023-11-15', status: 'pending', desc: 'Adiantamento de 100€' }
    ]);

    // Mock Vehicle Data (In real app, fetch from context/API based on assigned vehicle)
    const myVehicle = {
        plate: '22-VX-99',
        model: 'Mercedes-Benz Sprinter',
        status: 'active',
        fuel: 65,
        nextService: '145.000 km',
        insurance: '2025-06-12',
        cleaning: 'good'
    };

    const handleSubmitHours = (e: React.FormEvent) => {
        e.preventDefault();
        alert('Horas registadas com sucesso (Simulação)');
        setHoursForm({ ...hoursForm, start: '', end: '' });
    };

    const handleSubmitRequest = (e: React.FormEvent) => {
        e.preventDefault();
        addNotification({
            id: crypto.randomUUID(),
            type: 'system_alert',
            data: {
                title: `Novo Pedido: ${requestForm.type}`,
                message: `${currentUser?.nome} enviou um pedido: ${requestForm.description}`,
                priority: 'normal'
            },
            status: 'pending',
            timestamp: new Date().toISOString()
        });
        alert(t('central.success.request'));
        setRequestForm({ ...requestForm, description: '' });
    };

    const handleSubmitReport = (e: React.FormEvent) => {
        e.preventDefault();
        addNotification({
            id: crypto.randomUUID(),
            type: 'system_alert',
            data: {
                title: `Reporte de Motorista: ${reportForm.type}`,
                message: `${currentUser?.nome} reportou: ${reportForm.description}`,
                priority: 'high'
            },
            status: 'pending',
            timestamp: new Date().toISOString()
        });
        alert(t('central.success.report'));
        setReportForm({ ...reportForm, description: '' });
    };

    return (
        <div className="max-w-7xl mx-auto p-4 md:p-8 font-sans">
            {/* Header with improved styling */}
            <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                            <LayoutTemplate className="w-6 h-6 text-blue-500" />
                        </div>
                        {t('central.title')}
                    </h1>
                    <p className="text-slate-400">{t('central.subtitle')}</p>
                </div>

                {/* Live Date/Time Widget */}
                <div className="hidden md:flex flex-col items-end bg-slate-800/30 px-4 py-2 rounded-xl border border-slate-700/50">
                    <span className="text-xl font-mono font-bold text-white">
                        {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="text-xs text-slate-400 capitalize">
                        {new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </span>
                </div>
            </div>

            {/* Navigation Tabs - Modern Pill Design */}
            <div className="flex gap-2 mb-8 overflow-x-auto pb-2 scrollbar-hide">
                {[
                    { id: 'overview', icon: LayoutTemplate, label: 'Visão Geral', color: 'blue' },
                    { id: 'viatura', icon: Car, label: 'Minha Viatura', color: 'indigo' },
                    { id: 'horas', icon: Clock, label: t('central.tab.hours'), color: 'blue' },
                    { id: 'pedidos', icon: Share2, label: t('central.tab.requests'), color: 'purple' },
                    { id: 'recibos', icon: FileText, label: t('central.tab.payslips'), color: 'emerald' },
                    { id: 'reportar', icon: AlertTriangle, label: t('central.tab.report'), color: 'red' }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-bold transition-all whitespace-nowrap text-sm
                        ${activeTab === tab.id
                                ? `bg-${tab.color}-600 text-white shadow-lg shadow-${tab.color}-900/20 ring-2 ring-${tab.color}-500/30`
                                : 'bg-slate-800/40 text-slate-400 hover:bg-slate-800 hover:text-white border border-slate-700/50'}`}
                    >
                        <tab.icon className="w-4 h-4" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Content Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">

                {/* Main Action Panel */}
                <div className="lg:col-span-2 space-y-6">

                    {/* NEW TAB: OVERVIEW */}
                    {activeTab === 'overview' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

                            {/* Hero Status Card */}
                            <div className="bg-gradient-to-br from-blue-900/40 to-slate-900/40 border border-blue-500/10 rounded-3xl p-6 relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>

                                <div className="relative z-10">
                                    <div className="flex justify-between items-start mb-6">
                                        <div>
                                            <h2 className="text-2xl font-bold text-white mb-1">Olá, {currentUser?.nome?.split(' ')[0] || (userRole === 'admin' ? 'Miguel' : 'Motorista')}</h2>
                                            <p className="text-slate-400">Pronto para o serviço de hoje?</p>
                                        </div>
                                        <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">
                                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                            <span className="text-xs font-bold text-emerald-400 uppercase">Online</span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-700/50">
                                            <div className="flex items-center gap-2 text-slate-400 mb-2">
                                                <Navigation className="w-4 h-4" />
                                                <span className="text-xs font-bold uppercase">Próximo Serviço</span>
                                            </div>
                                            <p className="text-white font-bold text-lg">08:30</p>
                                            <p className="text-xs text-slate-500 truncate">Aeroporto Faro &rarr; Albufeira</p>
                                        </div>

                                        <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-700/50">
                                            <div className="flex items-center gap-2 text-slate-400 mb-2">
                                                <Car className="w-4 h-4" />
                                                <span className="text-xs font-bold uppercase">Viatura</span>
                                            </div>
                                            <p className="text-white font-bold text-lg">{myVehicle.plate}</p>
                                            <p className="text-xs text-slate-500 truncate">{myVehicle.model}</p>
                                        </div>

                                        <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-700/50">
                                            <div className="flex items-center gap-2 text-slate-400 mb-2">
                                                <Sun className="w-4 h-4" />
                                                <span className="text-xs font-bold uppercase">Meteorologia</span>
                                            </div>
                                            <p className="text-white font-bold text-lg">22°C</p>
                                            <p className="text-xs text-slate-500">Céu Limpo</p>
                                        </div>

                                        <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-700/50">
                                            <div className="flex items-center gap-2 text-slate-400 mb-2">
                                                <Clock className="w-4 h-4" />
                                                <span className="text-xs font-bold uppercase">Turno</span>
                                            </div>
                                            <p className="text-white font-bold text-lg">08h - 17h</p>
                                            <p className="text-xs text-emerald-400">A Decorrer</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Quick Actions Grid */}
                            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider ml-1">Ações Rápidas</h3>
                            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                                <button
                                    onClick={() => setActiveTab('horas')}
                                    className="p-4 bg-slate-800/40 hover:bg-slate-800 border border-slate-700/50 hover:border-slate-500 rounded-2xl transition-all group text-left"
                                >
                                    <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 mb-3 group-hover:scale-110 transition-transform">
                                        <Clock className="w-5 h-5" />
                                    </div>
                                    <span className="font-bold text-slate-200 block">Registar Ponto</span>
                                    <span className="text-xs text-slate-500">Entradas e saídas</span>
                                </button>

                                <button
                                    onClick={() => setActiveTab('reportar')}
                                    className="p-4 bg-slate-800/40 hover:bg-slate-800 border border-slate-700/50 hover:border-red-500/50 rounded-2xl transition-all group text-left"
                                >
                                    <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-400 mb-3 group-hover:scale-110 transition-transform">
                                        <AlertTriangle className="w-5 h-5" />
                                    </div>
                                    <span className="font-bold text-slate-200 block">Reportar Incidente</span>
                                    <span className="text-xs text-slate-500">Avarias ou atrasos</span>
                                </button>

                                <button
                                    onClick={() => setActiveTab('pedidos')}
                                    className="p-4 bg-slate-800/40 hover:bg-slate-800 border border-slate-700/50 hover:border-purple-500/50 rounded-2xl transition-all group text-left"
                                >
                                    <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-400 mb-3 group-hover:scale-110 transition-transform">
                                        <Calendar className="w-5 h-5" />
                                    </div>
                                    <span className="font-bold text-slate-200 block">Pedir Folga</span>
                                    <span className="text-xs text-slate-500">Férias e ausências</span>
                                </button>
                            </div>

                        </div>
                    )}

                    {/* NEW TAB: VIATURA */}
                    {activeTab === 'viatura' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                            <div className="bg-[#1e293b]/50 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-8 shadow-2xl">
                                <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-8 border-b border-slate-700/50 pb-8">
                                    <div className="flex items-center gap-4">
                                        <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center">
                                            <Car className="w-8 h-8 text-blue-400" />
                                        </div>
                                        <div>
                                            <h3 className="text-2xl font-bold text-white">{myVehicle.model}</h3>
                                            <p className="text-slate-400 font-mono text-lg">{myVehicle.plate}</p>
                                        </div>
                                    </div>
                                    <div className="text-center md:text-right">
                                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                                            <Check className="w-4 h-4 text-emerald-500" />
                                            <span className="text-sm font-bold text-emerald-400 uppercase">Viatura Operacional</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="bg-slate-900/50 p-5 rounded-2xl border border-slate-800">
                                        <div className="flex items-center gap-3 mb-2">
                                            <Fuel className="w-5 h-5 text-yellow-500" />
                                            <span className="text-sm font-bold text-slate-400">Combustível</span>
                                        </div>
                                        <div className="flex items-end gap-2">
                                            <span className="text-3xl font-bold text-white">{myVehicle.fuel}%</span>
                                            <span className="text-sm text-slate-500 mb-1">Tanque</span>
                                        </div>
                                        <div className="w-full h-2 bg-slate-800 rounded-full mt-3 overflow-hidden">
                                            <div className="h-full bg-yellow-500" style={{ width: `${myVehicle.fuel}%` }}></div>
                                        </div>
                                    </div>

                                    <div className="bg-slate-900/50 p-5 rounded-2xl border border-slate-800">
                                        <div className="flex items-center gap-3 mb-2">
                                            <Gauge className="w-5 h-5 text-blue-500" />
                                            <span className="text-sm font-bold text-slate-400">Próxima Revisão</span>
                                        </div>
                                        <div className="flex items-end gap-2">
                                            <span className="text-2xl font-bold text-white">{myVehicle.nextService}</span>
                                        </div>
                                        <p className="text-xs text-slate-500 mt-2">Manutenção regular programada</p>
                                    </div>

                                    <div className="bg-slate-900/50 p-5 rounded-2xl border border-slate-800">
                                        <div className="flex items-center gap-3 mb-2">
                                            <Shield className="w-5 h-5 text-purple-500" />
                                            <span className="text-sm font-bold text-slate-400">Seguro</span>
                                        </div>
                                        <div className="flex items-end gap-2">
                                            <span className="text-xl font-bold text-white">Válido até Jun 2025</span>
                                        </div>
                                        <p className="text-xs text-emerald-400 mt-2 flex items-center gap-1">
                                            <Check className="w-3 h-3" /> Documentação em dia
                                        </p>
                                    </div>

                                    <div className="bg-slate-900/50 p-5 rounded-2xl border border-slate-800">
                                        <div className="flex items-center gap-3 mb-2">
                                            <Car className="w-5 h-5 text-slate-400" />
                                            <span className="text-sm font-bold text-slate-400">Estado Limpeza</span>
                                        </div>
                                        <div className="flex items-end gap-2">
                                            <span className="text-xl font-bold text-white">Bom Estado</span>
                                        </div>
                                        <p className="text-xs text-slate-500 mt-2">Última verificação hoje</p>
                                    </div>
                                </div>

                                <div className="mt-8 pt-8 border-t border-slate-700/50">
                                    <h4 className="font-bold text-white mb-4">Ações da Viatura</h4>
                                    <div className="flex gap-4">
                                        <button className="flex-1 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-xl font-bold text-sm transition-all">
                                            Reportar Avaria
                                        </button>
                                        <button className="flex-1 py-3 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/20 rounded-xl font-bold text-sm transition-all">
                                            Solicitar Limpeza
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB: HORAS */}
                    {activeTab === 'horas' && (
                        <div className="bg-[#1e293b]/50 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-8 shadow-2xl animate-in slide-in-from-left-2 fade-in">
                            <h3 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
                                <Clock className="w-5 h-5 text-blue-400" />
                                Registo de Horas
                            </h3>
                            <p className="text-slate-500 mb-6 text-sm">{t('central.hours.intro')}</p>

                            <form onSubmit={handleSubmitHours} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase mb-2">{t('central.label.date')}</label>
                                    <input
                                        type="date"
                                        required
                                        value={hoursForm.date}
                                        onChange={e => setHoursForm({ ...hoursForm, date: e.target.value })}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white outline-none focus:border-blue-500"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Entrada</label>
                                        <input
                                            type="time"
                                            required
                                            value={hoursForm.start}
                                            onChange={e => setHoursForm({ ...hoursForm, start: e.target.value })}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white outline-none focus:border-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Saída</label>
                                        <input
                                            type="time"
                                            required
                                            value={hoursForm.end}
                                            onChange={e => setHoursForm({ ...hoursForm, end: e.target.value })}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white outline-none focus:border-blue-500"
                                        />
                                    </div>
                                </div>
                                <button className="md:col-span-2 bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl transition-all shadow-lg active:scale-95">
                                    Registrar Horas
                                </button>
                            </form>
                        </div>
                    )}

                    {/* TAB: PEDIDOS */}
                    {activeTab === 'pedidos' && (
                        <div className="bg-[#1e293b]/50 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-8 shadow-2xl animate-in slide-in-from-left-2 fade-in">
                            <h3 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
                                <Share2 className="w-5 h-5 text-purple-400" />
                                {t('central.tab.requests')}
                            </h3>
                            <p className="text-slate-500 mb-6 text-sm">{t('central.requests.intro')}</p>

                            <form onSubmit={handleSubmitRequest} className="space-y-6">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase mb-2">{t('central.label.type')}</label>
                                    <select
                                        value={requestForm.type}
                                        onChange={e => setRequestForm({ ...requestForm, type: e.target.value })}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white outline-none focus:border-purple-500"
                                    >
                                        <option value="ferias">Pedido de Férias</option>
                                        <option value="folga">Pedido de Folga</option>
                                        <option value="adiantamento">Adiantamento de Vencimento</option>
                                        <option value="documentacao">Declaração / Documentação</option>
                                        <option value="outros">Outros</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase mb-2">{t('central.label.description')}</label>
                                    <textarea
                                        required
                                        value={requestForm.description}
                                        onChange={e => setRequestForm({ ...requestForm, description: e.target.value })}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white outline-none focus:border-purple-500 min-h-[120px]"
                                        placeholder={t('central.placeholder.desc')}
                                    ></textarea>
                                </div>
                                <button className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-4 rounded-xl transition-all shadow-lg active:scale-95">
                                    {t('central.action.submit')}
                                </button>
                            </form>
                        </div>
                    )}

                    {/* TAB: REPORTAR */}
                    {activeTab === 'reportar' && (
                        <div className="bg-[#1e293b]/50 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-8 shadow-2xl animate-in slide-in-from-left-2 fade-in">
                            <h3 className="text-xl font-bold text-white mb-1 flex items-center gap-2 text-red-400">
                                <AlertTriangle className="w-5 h-5" />
                                {t('central.tab.report')}
                            </h3>
                            <p className="text-slate-500 mb-6 text-sm">{t('central.report.intro')}</p>

                            <form onSubmit={handleSubmitReport} className="space-y-6">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Tipo de Ocorrência</label>
                                    <select
                                        value={reportForm.type}
                                        onChange={e => setReportForm({ ...reportForm, type: e.target.value })}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white outline-none focus:border-red-500"
                                    >
                                        <option value="acidente">Acidente / Sinistro</option>
                                        <option value="avaria">Avaria Mecânica</option>
                                        <option value="cliente">Problema com Cliente</option>
                                        <option value="atraso">Atraso Involuntário</option>
                                        <option value="outros">Outros</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Detalhes</label>
                                    <textarea
                                        required
                                        value={reportForm.description}
                                        onChange={e => setReportForm({ ...reportForm, description: e.target.value })}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white outline-none focus:border-red-500 min-h-[120px]"
                                        placeholder="Descreva o que aconteceu..."
                                    ></textarea>
                                </div>
                                <button className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-4 rounded-xl transition-all shadow-lg active:scale-95 animate-pulse hover:animate-none">
                                    Reportar Imediatamente
                                </button>
                            </form>
                        </div>
                    )}

                    {/* TAB: RECIBOS */}
                    {activeTab === 'recibos' && (
                        <div className="bg-[#1e293b]/50 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-8 shadow-2xl animate-in slide-in-from-left-2 fade-in">
                            <h3 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
                                <FileText className="w-5 h-5 text-emerald-400" />
                                {t('central.tab.payslips')}
                            </h3>
                            <p className="text-slate-500 mb-6 text-sm">{t('central.payslips.intro')}</p>

                            <div className="border-2 border-dashed border-slate-700 rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all group">
                                <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                    <Upload className="w-8 h-8 text-slate-400 group-hover:text-emerald-400" />
                                </div>
                                <h4 className="font-bold text-white mb-2">Carregar Recibo</h4>
                                <p className="text-xs text-slate-500">Clique para selecionar ou arraste o ficheiro PDF</p>
                            </div>

                            <div className="mt-8 space-y-3">
                                <h4 className="text-xs font-bold text-slate-500 uppercase">Recibos Recentes</h4>
                                {/* Mock List */}
                                <div className="flex items-center justify-between p-4 bg-slate-900/50 border border-slate-800 rounded-xl hover:border-slate-700 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <FileText className="w-5 h-5 text-slate-400" />
                                        <div>
                                            <p className="text-sm font-bold text-white">Recibo_Vencimento_Nov2025.pdf</p>
                                            <p className="text-xs text-slate-500">Adicionado a 01/12/2025</p>
                                        </div>
                                    </div>
                                    <button className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg">
                                        <Download className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Sidebar Info Panel */}
                <div className="space-y-6">
                    {/* User Profile Summary */}
                    <div className="bg-slate-800/20 border border-slate-700/50 rounded-3xl p-6 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/10 rounded-full blur-2xl -mr-10 -mt-10 transition-all group-hover:bg-blue-600/20"></div>

                        <div className="flex flex-col items-center text-center relative z-10">
                            <div className="w-24 h-24 rounded-full bg-slate-700 mb-4 flex items-center justify-center text-3xl font-bold text-white shadow-xl border-4 border-[#0f172a] overflow-hidden">
                                {userPhoto ? (
                                    <img src={userPhoto} alt="Profile" className="w-full h-full object-cover" />
                                ) : (
                                    currentUser?.nome?.charAt(0) || (userRole === 'admin' ? 'A' : 'U')
                                )}
                            </div>
                            <h3 className="font-bold text-xl text-white">{currentUser?.nome || (userRole === 'admin' ? 'Miguel Madeira' : 'Utilizador')}</h3>
                            <p className="text-sm text-slate-400">Motorista Profissional</p>

                            <div className="flex gap-2 mt-4">
                                <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full capitalize flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                    Ativo
                                </span>
                                <span className="text-xs bg-slate-800 border border-slate-700 px-3 py-1 rounded-full text-slate-400 font-mono">
                                    ID: {currentUser?.id?.slice(0, 6)}
                                </span>
                            </div>
                        </div>

                        <div className="mt-8 pt-6 border-t border-slate-700/50 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-slate-900/50 p-3 rounded-xl text-center">
                                    <span className="block text-2xl font-bold text-white">4.9</span>
                                    <span className="text-[10px] text-slate-500 uppercase tracking-wider">Avaliação</span>
                                </div>
                                <div className="bg-slate-900/50 p-3 rounded-xl text-center">
                                    <span className="block text-2xl font-bold text-white">124</span>
                                    <span className="text-[10px] text-slate-500 uppercase tracking-wider">Viagens</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Simplified Feed of My Requests */}
                    <div className="bg-slate-800/20 border border-slate-700/50 rounded-3xl p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="font-bold text-white text-sm uppercase flex items-center gap-2">
                                <Send className="w-4 h-4 text-blue-400" />
                                Pedidos Recentes
                            </h4>
                            <button onClick={() => setActiveTab('pedidos')} className="text-xs text-blue-400 hover:text-blue-300">Ver Todos</button>
                        </div>

                        <div className="space-y-3">
                            {myRequests.map(req => (
                                <div key={req.id} className="p-3 bg-slate-900/50 rounded-xl border border-slate-800/50 hover:border-slate-700 transition-colors cursor-default">
                                    <div className="flex justify-between items-start mb-1">
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase
                                            ${req.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}
                                        `}>
                                            {req.status === 'approved' ? t('central.status.approved') : t('central.status.pending')}
                                        </span>
                                        <span className="text-[10px] text-slate-500 text-right">{req.date}</span>
                                    </div>
                                    <p className="text-sm font-bold text-white capitalize mt-1">{req.type}</p>
                                    <p className="text-xs text-slate-400 truncate">{req.desc}</p>
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={() => setActiveTab('pedidos')}
                            className="w-full mt-4 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold text-slate-300 transition-colors"
                        >
                            Novo Pedido
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}
