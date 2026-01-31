import ApprovalsModal from './modals/ApprovalsModal';
import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../contexts/PermissionsContext';
import { useWorkshop } from '../../contexts/WorkshopContext';
import KPICard from './widgets/KPICard';
import FleetStatusChart from './widgets/FleetStatusChart';
import RevenueChart from './widgets/RevenueChart';
import ActivityTable from './widgets/ActivityTable';
import QuickActions from './widgets/QuickActions';

import {
    User,
    AlertTriangle,
    Bus,
    Calendar,
    Activity,
} from 'lucide-react';


export default function Dashboard({
    setActiveTab
}: {
    setActiveTab: (tab: any) => void;
}) {

    const { userRole, currentUser } = useAuth();
    const { hasAccess } = usePermissions();
    const { notifications, motoristas, servicos, viaturas } = useWorkshop();

    // --- Stats Data Prep ---
    const urgentRequests = notifications.filter(n => n.type === 'urgent_transport_request' && n.status === 'pending').length;
    const pendingRegistrations = notifications.filter(n => n.type === 'registration_request' && n.status === 'pending').length;

    // Services
    const activeServices = servicos.filter(s => !s.concluido).length;
    const todayServices = servicos.filter(s => new Date(s.data).toDateString() === new Date().toDateString()).length;

    // Drivers
    const totalDrivers = motoristas.length;
    const activeDrivers = motoristas.filter(m => m.status === 'disponivel').length;

    // Vehicles
    const totalVehicles = viaturas?.length || 0;
    const availableVehicles = viaturas?.filter(v => v.estado === 'disponivel').length || 0;
    const maintenanceVehicles = viaturas?.filter(v => v.estado === 'em_manutencao').length || 0;
    const activeVehicles = totalVehicles - availableVehicles - maintenanceVehicles;

    // Activity Feed Transformation
    const activityItems = notifications.map(n => ({
        id: n.id,
        type: n.type,
        title: n.type.replace(/_/g, ' ').toUpperCase(),
        subtitle: (n as any).mensagem || 'Nova notificação do sistema',
        date: n.timestamp ? new Date(n.timestamp) : new Date(),
        status: n.status === 'pending' ? 'pending' : 'completed' as any
    })).sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 15);

    // Greeting
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';

    // --- Modals ---
    const [showApprovalsModal, setShowApprovalsModal] = useState(false);

    return (
        <div className="h-full overflow-y-auto custom-scrollbar p-4 md:p-8 space-y-8 bg-slate-950">
            {/* ... Modal ... */}
            {hasAccess(userRole, 'equipa-oficina') && (
                <ApprovalsModal isOpen={showApprovalsModal} onClose={() => setShowApprovalsModal(false)} />
            )}

            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
                <div className="p-6 pr-12 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/20 to-purple-500/20 blur-3xl rounded-full -mr-10 -mt-10 pointer-events-none" />

                    <h1 className="text-4xl font-black text-white mb-2 tracking-tight flex items-center gap-3">
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 animate-gradient-x">{greeting},</span>
                        <span className="text-white">{currentUser?.nome?.split(' ')[0] || 'Gestor'}</span>
                    </h1>
                    <p className="text-slate-400 font-medium flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        Sistema operacional e online.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-3 bg-slate-800/80 backdrop-blur-sm p-2 pr-4 rounded-xl border border-slate-700/50 shadow-sm">
                        <div className="p-2 bg-indigo-500/20 rounded-lg">
                            <Calendar className="w-5 h-5 text-indigo-400" />
                        </div>
                        <div className="text-sm">
                            <p className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Hoje</p>
                            <p className="font-semibold text-white">{new Date().toLocaleDateString('pt-PT', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* DASHBOARD GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 auto-rows-min">

                {/* 1. KPIs Row */}
                {hasAccess(userRole, 'requisicoes') && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-0">
                        <KPICard
                            title="Serviços Ativos"
                            value={activeServices}
                            icon={Activity}
                            color="blue"
                            trend={todayServices > 0 ? `+${todayServices} hoje` : undefined}
                            trendType="up"
                            subtext="em tempo real"
                        />
                    </div>
                )}

                {hasAccess(userRole, 'viaturas') && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-75">
                        <KPICard
                            title="Frota Disponível"
                            value={`${availableVehicles}`}
                            subtext={`/ ${totalVehicles}`}
                            icon={Bus}
                            color="emerald"
                            trendType="neutral"
                        />
                    </div>
                )}

                {hasAccess(userRole, 'motoristas') && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
                        <KPICard
                            title="Motoristas Livres"
                            value={activeDrivers}
                            subtext={`/ ${totalDrivers}`}
                            icon={User}
                            color="indigo"
                            trendType="neutral"
                        />
                    </div>
                )}

                {/* Approvals / Alerts */}
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-150">
                    {userRole === 'admin' && pendingRegistrations > 0 ? (
                        <div className="bg-amber-500/10 backdrop-blur-md border border-amber-500/20 rounded-2xl p-6 h-full flex flex-col justify-between animate-pulse-slow">
                            <div>
                                <div className="flex justify-between items-start mb-2">
                                    <div className="p-3 rounded-xl bg-amber-500/20 text-amber-500">
                                        <User className="w-6 h-6" />
                                    </div>
                                    <span className="bg-amber-500/20 text-amber-400 text-xs font-bold px-2 py-1 rounded-full">Ação Necessária</span>
                                </div>
                                <h3 className="text-amber-400 font-bold text-lg mt-2">Aprovações Pendentes</h3>
                                <p className="text-slate-400 text-sm mt-1">{pendingRegistrations} novos utilizadores</p>
                            </div>
                            <button
                                onClick={() => setShowApprovalsModal(true)}
                                className="w-full py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm font-bold shadow-lg shadow-amber-900/20 transition-all mt-4"
                            >
                                Rever Agora
                            </button>
                        </div>
                    ) : (
                        <KPICard
                            title="Alertas Urgentes"
                            value={urgentRequests}
                            icon={AlertTriangle}
                            color="red"
                            trendType={urgentRequests > 0 ? "down" : "neutral"}
                        />
                    )}
                </div>

                {/* 2. Charts & Widgets Row */}

                {/* Quick Actions - 1 Col */}
                <div className="md:col-span-1 lg:col-span-1 h-full min-h-[300px] animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200">
                    <QuickActions
                        onNewService={() => setActiveTab('requisicoes')}
                        onNewClient={() => setActiveTab('clientes')}
                        onNewVehicle={() => setActiveTab('viaturas')}
                    />
                </div>

                {/* Fleet Status Chart - 1 Col */}
                {hasAccess(userRole, 'viaturas') && (
                    <div className="md:col-span-1 lg:col-span-1 h-full min-h-[300px] animate-in fade-in slide-in-from-bottom-4 duration-500 delay-300">
                        <FleetStatusChart
                            total={totalVehicles}
                            available={availableVehicles}
                            maintenance={maintenanceVehicles}
                            active={activeVehicles}
                        />
                    </div>
                )}

                {/* Revenue Chart - 2 Cols */}
                <div className="md:col-span-2 lg:col-span-2 h-full min-h-[300px] animate-in fade-in slide-in-from-bottom-4 duration-500 delay-400">
                    <RevenueChart services={servicos} />
                </div>

                {/* 3. Activity Table - Full Width */}
                <div className="col-span-1 md:col-span-2 lg:col-span-4 h-full min-h-[400px] animate-in fade-in slide-in-from-bottom-4 duration-500 delay-500">
                    <ActivityTable items={activityItems} />
                </div>

            </div>
        </div>
    );
}
