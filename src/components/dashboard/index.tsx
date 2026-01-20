import ApprovalsModal from './modals/ApprovalsModal';
import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../contexts/PermissionsContext';
import { useWorkshop } from '../../contexts/WorkshopContext';
import { useLayout } from '../../contexts/LayoutContext';
import DraggableGrid from '../common/DraggableGrid';

import {
    User, AlertTriangle, TrendingUp,
    Clock, Bus, Wrench, CheckCircle2, ChevronRight, Fuel,
    FileText, Calendar, Activity, Bell, Users, Check, X, Layout, LayoutTemplate
} from 'lucide-react';

export default function Dashboard({ activeTab, setActiveTab }: { activeTab: string, setActiveTab: (tab: any) => void }) {
    const { userRole, currentUser } = useAuth();
    const { hasAccess } = usePermissions();
    const { notifications, motoristas, servicos, viaturas } = useWorkshop();
    const { toggleEditMode, isEditMode, saveChanges, cancelEditMode, resetLayout } = useLayout();

    // --- Stats Data Prep ---
    const urgentRequests = notifications.filter(n => n.type === 'urgent_transport_request' && n.status === 'pending').length;
    const pendingRegistrations = notifications.filter(n => n.type === 'registration_request' && n.status === 'pending').length;

    // Services
    const activeServices = servicos.filter(s => !s.concluido).length;
    const todayServices = servicos.filter(s => new Date(s.data).toDateString() === new Date().toDateString()).length;

    // Drivers
    const activeDrivers = motoristas.filter(m => m.status === 'disponivel').length;

    // Vehicles
    const totalVehicles = viaturas?.length || 0;
    const availableVehicles = viaturas?.filter(v => v.estado === 'disponivel').length || 0;
    const maintenanceVehicles = viaturas?.filter(v => v.estado === 'em_manutencao').length || 0;

    // Greeting
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';

    // --- Helper Components ---
    const QuickStat = ({ label, value, icon: Icon, color, trend }: any) => (
        <div className="bg-[#1e293b]/40 backdrop-blur-md border border-slate-700/50 rounded-2xl p-5 hover:bg-[#1e293b]/60 transition-all group h-full">
            <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-xl bg-${color}-500/10 text-${color}-500 group-hover:scale-110 transition-transform`}>
                    <Icon className="w-6 h-6" />
                </div>
                {trend && (
                    <span className="flex items-center text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full">
                        <TrendingUp className="w-3 h-3 mr-1" />
                        {trend}
                    </span>
                )}
            </div>
            <div>
                <p className="text-slate-400 text-sm font-medium mb-1">{label}</p>
                <h3 className="text-2xl font-bold text-white">{value}</h3>
            </div>
        </div>
    );

    const ActivityItem = ({ icon: Icon, title, time, type }: any) => (
        <div className="flex items-start gap-4 p-4 rounded-xl hover:bg-slate-800/30 transition-colors border border-transparent hover:border-slate-700/50">
            <div className={`mt-1 p-2 rounded-lg ${type === 'alert' ? 'bg-red-500/10 text-red-400' : 'bg-blue-500/10 text-blue-400'}`}>
                <Icon className="w-4 h-4" />
            </div>
            <div className="flex-1">
                <p className="text-sm font-medium text-slate-200">{title}</p>
                <p className="text-xs text-slate-500 mt-1 flex items-center">
                    <Clock className="w-3 h-3 mr-1" /> {time}
                </p>
            </div>
        </div>
    );

    const ActionButton = ({ icon: Icon, label, color, onClick }: any) => (
        <button
            onClick={onClick}
            className={`
                flex flex-col items-center justify-center p-4 rounded-xl 
                bg-slate-800/40 border border-slate-700/50 hover:bg-slate-800 
                hover:border-${color}-500/30 transition-all group w-full aspect-square
            `}
        >
            <div className={`mb-3 p-3 rounded-full bg-${color}-500/10 text-${color}-500 group-hover:bg-${color}-500 group-hover:text-white transition-colors`}>
                <Icon className="w-6 h-6" />
            </div>
            <span className="text-xs font-medium text-slate-300 group-hover:text-white text-center">{label}</span>
        </button>
    );

    // --- Utils ---
    const getTimeAgo = (dateData: string | Date | undefined) => {
        if (!dateData) return '---';
        try {
            const date = typeof dateData === 'string' ? new Date(dateData) : dateData;
            if (isNaN(date.getTime())) return '---';
            const now = new Date();
            const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
            if (diffInSeconds < 60) return 'há ' + (diffInSeconds < 0 ? 0 : diffInSeconds) + ' s';
            const diffInMinutes = Math.floor(diffInSeconds / 60);
            if (diffInMinutes < 60) return `há ${diffInMinutes} m`;
            const diffInHours = Math.floor(diffInMinutes / 60);
            if (diffInHours < 24) return `há ${diffInHours} h`;
            return date.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' });
        } catch (e) { return '---'; }
    };

    // --- Modals ---
    const [showApprovalsModal, setShowApprovalsModal] = useState(false);

    // --- Widgets Definition ---
    const getWidgets = () => {
        const widgets = [];

        // 1. APPROVALS ALERT
        if (userRole === 'admin' && pendingRegistrations > 0) {
            widgets.push({
                id: 'stats_approvals',
                content: (
                    <div className="bg-amber-500/10 backdrop-blur-md border border-amber-500/20 rounded-2xl p-6 h-full flex flex-col justify-center animate-pulse-slow">
                        <div className="flex items-center gap-3 mb-2">
                            <AlertTriangle className="w-6 h-6 text-amber-500" />
                            <h3 className="text-amber-400 font-bold text-lg">Aprovação Necessária</h3>
                        </div>
                        <p className="text-slate-300 text-sm mb-4">Existem {pendingRegistrations} novos registos de utilizadores pendentes.</p>
                        <button
                            onClick={() => setShowApprovalsModal(true)}
                            className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-amber-900/20 transition-all"
                        >
                            Rever Pedidos
                        </button>
                    </div>
                )
            });
        }

        // 2. Stats Cards
        if (hasAccess(userRole, 'requisicoes')) {
            widgets.push({
                id: 'stats_services',
                content: <QuickStat label="Serviços Ativos" value={activeServices} icon={Activity} color="blue" trend={todayServices > 0 ? `+${todayServices} hoje` : undefined} />
            });
        }
        if (hasAccess(userRole, 'viaturas')) {
            widgets.push({
                id: 'stats_fleet',
                content: <QuickStat label="Viaturas Disponíveis" value={`${availableVehicles} / ${totalVehicles}`} icon={Bus} color="emerald" />
            });
        }
        if (hasAccess(userRole, 'motoristas')) {
            widgets.push({
                id: 'stats_drivers',
                content: <QuickStat label="Motoristas Livres" value={`${activeDrivers}`} icon={User} color="indigo" />
            });
        }

        // Alerts Stat
        widgets.push({
            id: 'stats_alerts',
            content: userRole === 'admin' ? (
                <QuickStat label="Alertas Urgentes" value={urgentRequests} icon={AlertTriangle} color="red" />
            ) : (
                <QuickStat label="Notificações" value={notifications.filter(n => n.status === 'pending' && n.type !== 'fuel_confirmation_request').length} icon={Bell} color="amber" />
            )
        });

        // 3. Live Ops
        widgets.push({
            id: 'live_ops',
            content: (
                <div className="bg-[#1e293b]/40 backdrop-blur-md border border-slate-700/50 rounded-2xl p-6 h-full">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <Activity className="w-5 h-5 text-blue-500" />
                            Operações em Tempo Real
                        </h2>
                        <button onClick={() => setActiveTab('escalas')} className="text-sm text-blue-400 hover:text-blue-300 flex items-center transition-colors">
                            Ver Escalas <ChevronRight className="w-4 h-4 ml-1" />
                        </button>
                    </div>
                    {/* Fleet Breakdown */}
                    {hasAccess(userRole, 'viaturas') && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                            <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-emerald-400 text-sm font-medium">Disponíveis</span>
                                    <Bus className="w-4 h-4 text-emerald-500" />
                                </div>
                                <p className="text-2xl font-bold text-white">{availableVehicles}</p>
                                <div className="w-full bg-emerald-900/30 h-1.5 rounded-full mt-2">
                                    <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${(availableVehicles / totalVehicles) * 100}%` }}></div>
                                </div>
                            </div>
                            <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/10">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-amber-400 text-sm font-medium">Em Serviço</span>
                                    <Activity className="w-4 h-4 text-amber-500" />
                                </div>
                                <p className="text-2xl font-bold text-white">{totalVehicles - availableVehicles - maintenanceVehicles}</p>
                                <div className="w-full bg-amber-900/30 h-1.5 rounded-full mt-2">
                                    <div className="bg-amber-500 h-1.5 rounded-full" style={{ width: `${((totalVehicles - availableVehicles - maintenanceVehicles) / totalVehicles) * 100}%` }}></div>
                                </div>
                            </div>
                            <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/10">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-red-400 text-sm font-medium">Oficina</span>
                                    <Wrench className="w-4 h-4 text-red-500" />
                                </div>
                                <p className="text-2xl font-bold text-white">{maintenanceVehicles}</p>
                            </div>
                        </div>
                    )}
                    {/* Active Services List Preview */}
                    <div className="space-y-3">
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Serviços a Decorrer</h3>
                        {activeServices === 0 ? (
                            <p className="text-slate-500 text-sm">Sem serviços ativos no momento.</p>
                        ) : (
                            servicos.filter(s => !s.concluido).slice(0, 3).map((s: any) => (
                                <div key={s.id} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400">
                                            <Bus className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-white">{s.rota || 'Serviço Geral'}</p>
                                            <p className="text-xs text-slate-400">{s.viatura?.matricula || '---'} • {s.motorista?.nome || '---'}</p>
                                        </div>
                                    </div>
                                    <span className="text-xs px-2 py-1 rounded-full bg-blue-500/10 text-blue-400">Em Curso</span>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )
        });

        // 4. Quick Access
        widgets.push({
            id: 'quick_access',
            content: (
                <div className="bg-[#1e293b]/40 backdrop-blur-md border border-slate-700/50 rounded-2xl p-6 h-full">
                    <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        Ações Rápidas
                    </h2>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {hasAccess(userRole, 'requisicoes') && (
                            <ActionButton icon={Clock} label="Nova Requisição" color="blue" onClick={() => setActiveTab('requisicoes')} />
                        )}
                        {hasAccess(userRole, 'combustivel') && (
                            <ActionButton icon={Fuel} label="Registar Abastecimento" color="orange" onClick={() => setActiveTab('combustivel')} />
                        )}
                        {hasAccess(userRole, 'viaturas') && (
                            <ActionButton icon={Bus} label="Gerir Viaturas" color="emerald" onClick={() => setActiveTab('viaturas')} />
                        )}
                        {hasAccess(userRole, 'motoristas') && (
                            <ActionButton icon={User} label="Contactar Motorista" color="indigo" onClick={() => setActiveTab('mensagens')} />
                        )}
                    </div>
                </div>
            )
        });

        // 5. Activity Feed
        widgets.push({
            id: 'activity_feed',
            content: (
                <div className="bg-[#1e293b]/40 backdrop-blur-md border border-slate-700/50 rounded-2xl p-6 h-full min-h-[400px]">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-bold text-white">Atividade Recente</h2>
                        <Bell className="w-4 h-4 text-slate-400" />
                    </div>

                    <div className="space-y-1">
                        {notifications.length === 0 ? (
                            <p className="text-slate-500 text-sm text-center py-10">Sem atividade recente.</p>
                        ) : (
                            notifications.slice(0, 8).map(n => (
                                <ActivityItem
                                    key={n.id}
                                    icon={n.type.includes('urgent') ? AlertTriangle : FileText}
                                    title={n.type.replace(/_/g, ' ').toUpperCase()}
                                    time={getTimeAgo(n.timestamp || new Date())}
                                    type={n.type.includes('urgent') ? 'alert' : 'info'}
                                />
                            ))
                        )}
                    </div>
                </div>
            )
        });

        return widgets;
    };

    return (
        <div className="h-full overflow-y-auto custom-scrollbar p-6 space-y-8">
            {/* ... Modal ... */}
            {hasAccess(userRole, 'equipa-oficina') && (
                <ApprovalsModal isOpen={showApprovalsModal} onClose={() => setShowApprovalsModal(false)} />
            )}

            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">
                        {greeting}, <span className="text-blue-500">{currentUser?.nome?.split(' ')[0] || 'Gestor'}</span>
                    </h1>
                    <p className="text-slate-400">
                        Aqui está o resumo operacional de hoje.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {/* Toggle Edit Mode via Context */}
                    {/* Toggle Edit Mode via Context */}
                    {isEditMode ? (
                        <div className="flex gap-2">
                            <button
                                onClick={saveChanges}
                                className="px-4 py-2 rounded-xl text-sm font-bold bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-500/20 animate-pulse flex items-center gap-2"
                            >
                                <CheckCircle2 className="w-4 h-4" /> Salvar
                            </button>
                            <button
                                onClick={resetLayout}
                                className="px-4 py-2 rounded-xl text-sm font-bold bg-slate-700 hover:bg-slate-600 text-slate-300 border border-slate-600 flex items-center gap-2"
                            >
                                <LayoutTemplate className="w-4 h-4" /> Reset
                            </button>
                            <button
                                onClick={cancelEditMode}
                                className="px-4 py-2 rounded-xl text-sm font-bold bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 flex items-center gap-2"
                            >
                                <X className="w-4 h-4" /> Cancelar
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={toggleEditMode}
                            className="px-4 py-2 rounded-xl text-sm font-bold bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 transition-all flex items-center gap-2"
                        >
                            <Layout className="w-4 h-4" /> Personalizar
                        </button>
                    )}

                    <div className="flex items-center gap-3 bg-slate-800/50 p-2 pr-4 rounded-xl border border-slate-700/50">
                        <div className="p-2 bg-blue-500/20 rounded-lg">
                            <Calendar className="w-5 h-5 text-blue-400" />
                        </div>
                        <div className="text-sm">
                            <p className="text-slate-400 text-xs">Data de Hoje</p>
                            <p className="font-semibold text-white">{new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* DRAGGABLE LAYOUT ZONE */}
            {/* DRAGGABLE LAYOUT ZONE */}
            <DraggableGrid
                zoneId="dashboard_main_rgl"
                defaultLayouts={{
                    lg: [
                        { i: 'stats_approvals', x: 0, y: 0, w: 12, h: 4 },
                        { i: 'stats_services', x: 0, y: 4, w: 4, h: 3 },
                        { i: 'stats_fleet', x: 4, y: 4, w: 4, h: 3 },
                        { i: 'stats_drivers', x: 8, y: 4, w: 4, h: 3 },
                        { i: 'stats_alerts', x: 0, y: 7, w: 12, h: 2 },
                        { i: 'live_ops', x: 0, y: 9, w: 8, h: 9 },
                        { i: 'activity_feed', x: 8, y: 9, w: 4, h: 9 },
                        { i: 'quick_access', x: 0, y: 18, w: 12, h: 4 }
                    ],
                    md: [
                        { i: 'stats_approvals', x: 0, y: 0, w: 10, h: 4 },
                        { i: 'stats_services', x: 0, y: 4, w: 5, h: 3 },
                        { i: 'stats_fleet', x: 5, y: 4, w: 5, h: 3 },
                        { i: 'stats_drivers', x: 0, y: 7, w: 5, h: 3 },
                        { i: 'stats_alerts', x: 5, y: 7, w: 5, h: 3 },
                        { i: 'live_ops', x: 0, y: 10, w: 10, h: 9 },
                        { i: 'activity_feed', x: 0, y: 19, w: 10, h: 8 },
                        { i: 'quick_access', x: 0, y: 27, w: 10, h: 4 }
                    ],
                    sm: [
                        { i: 'stats_approvals', x: 0, y: 0, w: 6, h: 4 },
                        { i: 'stats_services', x: 0, y: 4, w: 6, h: 3 },
                        { i: 'stats_fleet', x: 0, y: 7, w: 6, h: 3 },
                        { i: 'stats_drivers', x: 0, y: 10, w: 6, h: 3 },
                        { i: 'stats_alerts', x: 0, y: 13, w: 6, h: 3 },
                        { i: 'live_ops', x: 0, y: 16, w: 6, h: 10 },
                        { i: 'activity_feed', x: 0, y: 26, w: 6, h: 8 },
                        { i: 'quick_access', x: 0, y: 34, w: 6, h: 5 }
                    ]
                }}
            >
                {getWidgets().map(widget => (
                    <div key={widget.id}>
                        {widget.content}
                    </div>
                ))}
            </DraggableGrid>


        </div >
    );
}
