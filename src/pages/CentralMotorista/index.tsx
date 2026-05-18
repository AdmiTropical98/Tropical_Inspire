import { useState, useEffect } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import type { Servico } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { useWorkshop } from '../../contexts/WorkshopContext';
import {
    LayoutTemplate, Clock, FileText, AlertTriangle,
    Send, Car, Sun, Navigation, Calendar,
    Fuel, Settings2, ArrowRight,
    CloudSun, CloudLightning, CloudRain, Snowflake, Star, Info
} from 'lucide-react';
import MyScheduleView from './MyScheduleView';
import NavigationApp from './NavigationApp';
import TagRegistrationModal from '../../components/common/TagRegistrationModal';
import { supabase } from '../../lib/supabase';
import { cleanTagId } from '../../services/cartrack';

export default function CentralMotorista() {
    const { t } = useTranslation();
    const { currentUser } = useAuth();
    const { motoristas, servicos, viaturas, updateServico, updateMotorista } = useWorkshop();

    const [activeTab, setActiveTab] = useState<'status' | 'servicos' | 'info' | 'viatura' | 'report' | 'recibos'>('status');
    const [currentTime, setCurrentTime] = useState(new Date());
    const [navigationOpen, setNavigationOpen] = useState(false);
    const [tagModalOpen, setTagModalOpen] = useState(false);

    const normalizePlate = (value?: string | null) => String(value ?? '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

    // Get current driver data
    const driver = motoristas.find(m => m.id === currentUser?.id);
    const driverServices = servicos.filter(s => s.motoristaId === currentUser?.id);
    const assignedVehicle = viaturas.find(v =>
        v.id === (driver as any)?.vehicleId ||
        normalizePlate(v.matricula) === normalizePlate(driver?.currentVehicle)
    );

    // Weather Simulation
    const getWeatherIcon = () => {
        const hour = currentTime.getHours();
        if (hour >= 6 && hour < 18) return <Sun className="w-8 h-8 text-amber-400" />;
        return <CloudSun className="w-8 h-8 text-blue-400" />;
    };

    // Update time every minute
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    const handleServiceUpdate = async (service: any) => {
        try {
            await updateServico({
                ...service,
                status: service.status,
                concluido: service.concluido,
                failureReason: service.failureReason
            });
        } catch (error) {
            console.error('Error updating service:', error);
            alert('Erro ao atualizar o serviço. Por favor, tente novamente.');
        }
    };

    const handleReportSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        alert('Reporte enviado com sucesso! O supervisor foi notificado.');
        setReportForm({ type: 'vandalismo', description: '' });
    };

    const [reportForm, setReportForm] = useState({ type: 'vandalismo', description: '' });

    // Handle Tag Registration
    const handleTagRegistered = async (tagId: string) => {
        if (!currentUser?.id) return;
        const cleaned = cleanTagId(tagId);
        try {
            if (driver) {
                await updateMotorista({ ...driver, cartrackKey: cleaned });
            } else {
                const { error } = await supabase
                    .from('motoristas')
                    .update({ cartrack_key: cleaned })
                    .eq('id', currentUser.id);

                if (error) throw error;
            }

            alert('Tag registada com sucesso!');
        } catch (err) {
            console.error('Error saving tag:', err);
            alert('Erro ao guardar a tag.');
        }
    };

    return (
        <div className="text-slate-700 font-sans selection:bg-blue-100">
            {/* Header / Dashboard HUD */}
            <div className="bg-white border-b border-slate-200 pb-8 pt-6 shadow-sm">
                <div className="w-full">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                        <div className="flex items-center gap-5">
                            <div className="relative">
                                <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-2xl shadow-blue-900/40">
                                    <Star className="w-8 h-8 md:w-10 md:h-10 text-slate-900/90" />
                                </div>
                                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 rounded-full border-4 border-white flex items-center justify-center">
                                    <div className="w-1.5 h-1.5 bg-white rounded-full animate-ping"></div>
                                </div>
                            </div>
                            <div>
                                <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight uppercase">
                                    {driver?.nome || 'Motorista'}
                                </h1>
                                <div className="flex items-center gap-3 mt-1 text-slate-500">
                                    <span className="flex items-center gap-1.5 text-xs font-bold bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 text-slate-700">
                                        <Car className="w-3.5 h-3.5 text-blue-400" />
                                        {assignedVehicle?.matricula || 'Sem Viatura'}
                                    </span>
                                    <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                    <span className="text-xs font-medium uppercase tracking-widest text-slate-500">{t('oficina.active')}</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-4 bg-slate-50 p-2 rounded-2xl border border-slate-200 self-stretch md:self-auto">
                            <div className="px-4 py-2 text-right hidden sm:block">
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none mb-1">{currentTime.toLocaleDateString('pt-PT', { weekday: 'long' })}</p>
                                <p className="text-xl font-black text-slate-900 leading-none tracking-tight">
                                    {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </div>
                            <div className="w-px h-10 bg-slate-200 mx-1 hidden sm:block"></div>
                            <div className="flex items-center gap-3 px-3">
                                {getWeatherIcon()}
                                <div>
                                    <p className="text-lg font-black text-slate-900 leading-none">22°</p>
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Albufeira, PT</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content Areas */}
            <div className="w-full py-8">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                    {/* Left Sidebar - Navigation Tabs (Grid columns 3) */}
                    <div className="lg:col-span-3 space-y-3">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] px-3 mb-4">Central de Controlo</p>

                        {[
                            { id: 'status', label: 'Início', icon: LayoutTemplate, color: 'text-blue-400' },
                            { id: 'servicos', label: 'Minha Escala', icon: Calendar, color: 'text-purple-400' },
                            { id: 'viatura', label: 'Viatura', icon: Car, color: 'text-emerald-400' },
                            { id: 'recibos', label: 'Recibos', icon: FileText, color: 'text-amber-400' },
                            { id: 'report', label: 'Reportar Ocorrência', icon: AlertTriangle, color: 'text-rose-400' }
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-300 group
                                    ${activeTab === tab.id
                                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-100 border border-blue-600'
                                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
                            >
                                <tab.icon className={`w-5 h-5 transition-transform duration-300 group-hover:scale-110 ${activeTab === tab.id ? 'text-white' : tab.color}`} />
                                <span className="font-bold text-sm uppercase tracking-wide">{tab.label}</span>
                                {activeTab === tab.id && <ArrowRight className="w-4 h-4 ml-auto animate-pulse" />}
                            </button>
                        ))}

                        {/* Quick Register Tag Button */}
                        <div className="mt-8 pt-6 border-t border-slate-200">
                            <button
                                onClick={() => setTagModalOpen(true)}
                                className="w-full flex flex-col items-center gap-2 p-6 rounded-3xl bg-white border border-slate-200 hover:border-blue-300 transition-all text-center group shadow-sm"
                            >
                                <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover:bg-blue-600 group-hover:text-slate-900 transition-all">
                                    <Settings2 className="w-6 h-6" />
                                </div>
                                <p className="text-xs font-bold text-slate-900 uppercase tracking-wider mt-1">Configurar Tag</p>
                                <p className="text-[10px] text-slate-500 leading-tight">Emparelhe o seu identificador para registo automático</p>
                            </button>
                        </div>
                    </div>

                    {/* Right Content Area (Grid columns 9) */}
                    <div className="lg:col-span-9">
                        <div className="min-h-[600px]">

                            {activeTab === 'status' && (
                                <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                                    {/* Stats Grid */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm group hover:border-blue-300 transition-all">
                                            <div className="flex justify-between items-start mb-6">
                                                <div className="p-3 bg-blue-500/10 rounded-2xl text-blue-400 group-hover:bg-blue-600 group-hover:text-slate-900 transition-all">
                                                    <Clock className="w-6 h-6" />
                                                </div>
                                                <span className="text-[10px] font-black bg-blue-500/10 text-blue-400 px-3 py-1 rounded-full uppercase tracking-tighter">Hoje</span>
                                            </div>
                                            <h3 className="text-4xl font-black text-slate-900 mb-1">{driverServices.filter((s: Servico) => s.status === 'pending').length}</h3>
                                            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Serviços Pendentes</p>
                                        </div>

                                        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm group hover:border-emerald-300 transition-all">
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-400 group-hover:bg-emerald-600 group-hover:text-slate-900 transition-all">
                                                    <Navigation className="w-6 h-6" />
                                                </div>
                                                <span className="text-[10px] font-black bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-full uppercase tracking-tighter">Total</span>
                                            </div>
                                            <h3 className="text-4xl font-black text-slate-900 mb-1">{driverServices.filter((s: Servico) => String(s.status || '').toUpperCase() === 'COMPLETED').length}</h3>
                                            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Serviços Concluídos</p>
                                        </div>

                                        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm group hover:border-amber-300 transition-all">
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="p-3 bg-amber-500/10 rounded-2xl text-amber-400 group-hover:bg-amber-600 group-hover:text-slate-900 transition-all">
                                                    <Fuel className="w-6 h-6" />
                                                </div>
                                                <span className="text-[10px] font-black bg-amber-500/10 text-amber-400 px-3 py-1 rounded-full uppercase tracking-tighter">Eco</span>
                                            </div>
                                            <h3 className="text-4xl font-black text-slate-900 mb-1">94%</h3>
                                            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Eficiência de Condução</p>
                                        </div>
                                    </div>

                                    {/* Next Service Teaser */}
                                    {driverServices.filter((s: Servico) => s.status === 'pending').length > 0 && (
                                        <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm relative overflow-hidden group">
                                            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-100 blur-[100px] -mr-32 -mt-32"></div>
                                            <div className="relative z-10">
                                                <div className="flex items-center gap-3 mb-6">
                                                    <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></div>
                                                    <span className="text-[10px] font-black text-blue-400 uppercase tracking-[0.3em]">Próximo Destino</span>
                                                </div>

                                                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8">
                                                    <div className="flex-1">
                                                        <h2 className="text-4xl font-black text-slate-900 tracking-tight mb-4">
                                                            {driverServices.filter((s: Servico) => s.status === 'pending')[0].destino}
                                                        </h2>
                                                        <div className="flex flex-wrap gap-4">
                                                            <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-200">
                                                                <Clock className="w-4 h-4 text-slate-500" />
                                                                <span className="text-sm font-bold text-slate-900">
                                                                    {driverServices.filter((s: Servico) => s.status === 'pending')[0].hora}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-200">
                                                                <Car className="w-4 h-4 text-slate-500" />
                                                                <span className="text-sm font-bold text-slate-900">4 Passageiros</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <button
                                                        onClick={() => setNavigationOpen(true)}
                                                        className="px-8 py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-3xl font-black text-sm uppercase tracking-widest flex items-center gap-3 shadow-2xl shadow-blue-900/40 active:scale-95 transition-all"
                                                    >
                                                        <Navigation className="w-5 h-5" />
                                                        Iniciar Navegação
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {navigationOpen && (
                                        <NavigationApp
                                            onBack={() => setNavigationOpen(false)}
                                            destination={driverServices.filter((s: Servico) => s.status === 'pending')[0]?.destino}
                                            vehicleRegistration={assignedVehicle?.matricula}
                                        />
                                    )}

                                    {tagModalOpen && (
                                        <TagRegistrationModal
                                            onClose={() => setTagModalOpen(false)}
                                            onDetected={handleTagRegistered}
                                        />
                                    )}
                                </div>
                            )}

                            {activeTab === 'servicos' && (
                                <MyScheduleView
                                    services={driverServices}
                                    onUpdateStatus={handleServiceUpdate}
                                />
                            )}

                            {activeTab === 'viatura' && (
                                <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                                    <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                                        <div className="h-48 bg-gradient-to-br from-slate-100 to-blue-50 relative">
                                            <div className="absolute inset-0 flex items-center justify-center opacity-10">
                                                <Car className="w-64 h-64" />
                                            </div>
                                            <div className="absolute bottom-6 left-8">
                                                <span className="px-3 py-1 bg-blue-600 text-[10px] font-black text-white rounded-full uppercase tracking-tighter mb-2 inline-block">Viatura Atribuída</span>
                                                <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase">{assignedVehicle?.matricula || 'N/A'}</h2>
                                            </div>
                                        </div>

                                        <div className="p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                                            <div className="space-y-1">
                                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Modelo</p>
                                                <p className="text-slate-900 font-bold">{assignedVehicle?.modelo || 'Não especificado'}</p>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Quilometragem</p>
                                                <p className="text-slate-900 font-bold">{(assignedVehicle as any)?.km?.toLocaleString() || '---'} km</p>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Próxima Inspeção</p>
                                                <p className="text-slate-900 font-bold">14 Jan 2025</p>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Estado</p>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                                    <span className="text-emerald-500 font-bold uppercase text-[10px] tracking-widest">Operacional</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'report' && (
                                <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm animate-in fade-in slide-in-from-right-4 duration-500">
                                    <div className="flex items-center gap-4 mb-8">
                                        <div className="p-3 bg-red-500/10 rounded-2xl text-red-500">
                                            <AlertTriangle className="w-8 h-8" />
                                        </div>
                                        <div>
                                            <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Reportar Ocorrência</h2>
                                            <p className="text-slate-600 text-sm">Informe-nos sobre qualquer incidente com a viatura ou serviço.</p>
                                        </div>
                                    </div>

                                    <form onSubmit={handleReportSubmit} className="space-y-8">
                                        <div className="space-y-4">
                                            <label className="text-sm font-bold text-slate-500 uppercase tracking-wide">Tipo de Incidente</label>
                                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                                {[
                                                    { id: 'vandalismo', label: 'Vandalismo', icon: Snowflake },
                                                    { id: 'avaria', label: 'Avaria Mecânica', icon: CloudLightning },
                                                    { id: 'acidente', label: 'Acidente', icon: AlertTriangle },
                                                    { id: 'limpeza', label: 'Limpeza', icon: CloudRain },
                                                    { id: 'outro', label: 'Outro', icon: Info }
                                                ].map(type => (
                                                    <button
                                                        key={type.id}
                                                        type="button"
                                                        onClick={() => setReportForm({ ...reportForm, type: type.id })}
                                                        className={`flex flex-col items-center gap-3 p-6 rounded-2xl border-2 transition-all
                                                            ${reportForm.type === type.id
                                                                ? 'bg-red-600/10 border-red-600 text-red-500'
                                                                : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'}`}
                                                    >
                                                        <type.icon className="w-8 h-8" />
                                                        <span className="text-xs font-bold uppercase tracking-wider">{type.label}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-slate-500 uppercase tracking-wide">Descrição Detalhada</label>
                                            <textarea
                                                value={reportForm.description}
                                                onChange={e => setReportForm({ ...reportForm, description: e.target.value })}
                                                className="w-full h-32 bg-white border border-slate-300 rounded-xl p-4 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-red-500 transition-colors"
                                                placeholder="Descreva o que aconteceu..."
                                                required
                                            />
                                        </div>
                                        <div className="flex justify-end">
                                            <button type="submit" className="px-8 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold text-sm uppercase tracking-wide shadow-lg shadow-red-900/30 transition-all flex items-center gap-2">
                                                <Send className="w-4 h-4" />
                                                Enviar Reporte
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            )}

                            {activeTab === 'recibos' && (
                                <div className="bg-white p-12 rounded-3xl border border-slate-200 shadow-sm min-h-[400px] flex flex-col items-center justify-center text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-500 mb-6 border border-emerald-500/20">
                                        <FileText className="w-10 h-10" />
                                    </div>
                                    <h3 className="text-2xl font-black text-slate-900 mb-2">Recibos de Vencimento</h3>
                                    <p className="text-slate-600 max-w-md mx-auto">
                                        Esta funcionalidade estará disponível em breve. Poderá consultar e descarregar os seus recibos de vencimento diretamente aqui.
                                    </p>
                                </div>
                            )}

                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
