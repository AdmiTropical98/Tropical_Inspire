import ApprovalsModal from './modals/ApprovalsModal';
import { useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../contexts/PermissionsContext';
import { useWorkshop } from '../../contexts/WorkshopContext';
import FleetStatusChart from './widgets/FleetStatusChart';
import RevenueChart from './widgets/RevenueChart';
import ActivityTable from './widgets/ActivityTable';
import QuickActions from './widgets/QuickActions';

// Novos componentes Frota UI
import { FrotaPageHeader } from '../../components/ui/frota/FrotaPageHeader';
import { FrotaKPI } from '../../components/ui/frota/FrotaKPI';
import { FrotaCard } from '../../components/ui/frota/FrotaCard';

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

    const [showApprovalsModal, setShowApprovalsModal] = useState(false);
    const isAndroidNative = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

    return (
        <div className="w-full min-w-0 flex flex-col space-y-6 animate-in fade-in duration-700">
            {hasAccess(userRole, 'equipa-oficina') && (
                <ApprovalsModal isOpen={showApprovalsModal} onClose={() => setShowApprovalsModal(false)} />
            )}

            <FrotaPageHeader
                title={`${greeting}, ${currentUser?.nome?.split(' ')[0] || 'Gestor'}`}
                subtitle="Visão global e controlo operacional da frota."
                icon={<Activity className="w-6 h-6" />}
                actions={
                    <div className="flex items-center gap-3 bg-white p-2 pr-4 rounded-xl border border-slate-200/80 shadow-sm">
                        <div className="p-2 bg-slate-50 rounded-lg">
                            <Calendar className="w-5 h-5 text-slate-500" />
                        </div>
                        <div className="text-sm">
                            <p className="text-slate-900 font-bold tracking-tight">
                                {new Date().toLocaleDateString('pt-PT', { weekday: 'short', day: 'numeric', month: 'short' })}
                            </p>
                        </div>
                    </div>
                }
            />

            {/* DASHBOARD GRID */}
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-4 md:gap-6 auto-rows-min">
                
                {/* 1. KPIs Row */}
                <div className="xl:col-span-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                    {hasAccess(userRole, 'requisicoes') && (
                        <FrotaKPI
                            title="Serviços Ativos"
                            value={activeServices}
                            icon={<Activity className="w-5 h-5" />}
                            trend={todayServices}
                            trendLabel="hoje"
                            trendType="good"
                        />
                    )}

                    {hasAccess(userRole, 'viaturas') && (
                        <FrotaKPI
                            title="Frota Disponível"
                            value={`${availableVehicles} / ${totalVehicles}`}
                            icon={<Bus className="w-5 h-5" />}
                        />
                    )}

                    {hasAccess(userRole, 'motoristas') && (
                        <FrotaKPI
                            title="Motoristas Livres"
                            value={`${activeDrivers} / ${totalDrivers}`}
                            icon={<User className="w-5 h-5" />}
                        />
                    )}

                    {userRole === 'admin' && pendingRegistrations > 0 ? (
                        <div className="bg-amber-500 border border-amber-600 rounded-2xl p-5 shadow-sm flex flex-col justify-between relative overflow-hidden text-white">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-2.5 bg-amber-400/30 rounded-xl">
                                    <User className="w-5 h-5 text-white" />
                                </div>
                                <span className="bg-white/20 text-white text-[10px] font-bold px-2 py-1 rounded-md border border-white/20 uppercase tracking-wider">Ação</span>
                            </div>
                            <div>
                                <h3 className="text-2xl font-black tracking-tight">{pendingRegistrations}</h3>
                                <p className="text-sm font-medium text-amber-100 mt-1">Aprovações Pendentes</p>
                            </div>
                            <button
                                onClick={() => setShowApprovalsModal(true)}
                                className="absolute inset-0 w-full h-full cursor-pointer opacity-0"
                            />
                        </div>
                    ) : (
                        <FrotaKPI
                            title="Alertas Urgentes"
                            value={urgentRequests}
                            icon={<AlertTriangle className="w-5 h-5" />}
                            trendType="bad"
                        />
                    )}
                </div>

                {/* 2. Charts & Widgets Row */}
                
                {/* Fleet Status Chart */}
                {hasAccess(userRole, 'viaturas') && (
                    <FrotaCard noPadding className="w-full min-w-0 xl:col-span-1 min-h-[300px]">
                        <FleetStatusChart
                            total={totalVehicles}
                            available={availableVehicles}
                            maintenance={maintenanceVehicles}
                            active={activeVehicles}
                        />
                    </FrotaCard>
                )}

                {/* Revenue Chart */}
                <FrotaCard noPadding className="w-full min-w-0 xl:col-span-2 min-h-[300px]">
                    <RevenueChart services={servicos} />
                </FrotaCard>

                {/* Quick Actions */}
                <FrotaCard noPadding className="w-full min-w-0 xl:col-span-1 min-h-[300px]">
                    <QuickActions
                        onNewService={() => setActiveTab('requisicoes')}
                        onNewClient={() => setActiveTab('clientes')}
                        onNewVehicle={() => setActiveTab('viaturas')}
                    />
                </FrotaCard>

                {/* 3. Activity Table - Full Width */}
                <FrotaCard noPadding className="w-full min-w-0 xl:col-span-4 min-h-[400px]">
                    <ActivityTable items={activityItems} />
                </FrotaCard>

            </div>
        </div>
    );
}
