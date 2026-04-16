import ApprovalsModal from './modals/ApprovalsModal';
import PageHeader from '../../components/common/PageHeader';
import { useState } from 'react';
import { Capacitor } from '@capacitor/core';
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
    const isAndroidNative = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

    return (
        <div className="android-native-dashboard w-full min-w-0 space-y-6 animate-in fade-in duration-700">
            {/* ... Modal ... */}
            {hasAccess(userRole, 'equipa-oficina') && (
                <ApprovalsModal isOpen={showApprovalsModal} onClose={() => setShowApprovalsModal(false)} />
            )}

            {isAndroidNative && (
                <section className="android-native-dashboard-brand">
                    <div className="android-native-dashboard-brand-head">
                        <img src="/LOGO.png?v=3" alt="Algartempo Frota" className="android-native-dashboard-brand-logo" />
                        <div>
                            <p className="android-native-dashboard-brand-kicker">Aplicação Operacional</p>
                            <h2 className="android-native-dashboard-brand-title">Centro de Comando</h2>
                        </div>
                    </div>

                    <button
                        onClick={() => setActiveTab('requisicoes')}
                        className="android-native-dashboard-brand-cta"
                    >
                        Novo Serviço
                    </button>
                </section>
            )}

            <PageHeader
                title={<span className="flex items-center gap-3">
                    <span className="text-slate-500">{greeting},</span>
                    <span className="text-slate-900">{currentUser?.nome?.split(' ')[0] || 'Gestor'}</span>
                </span>}
                subtitle="Visão operacional do sistema com leitura rápida e consistente."
                icon={Activity}
                actions={
                    <div className="flex items-center gap-3 bg-slate-50 p-2 pr-4 rounded-xl border border-slate-200 shadow-sm">
                        <div className="p-2 bg-blue-50 rounded-lg">
                            <Calendar className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="text-sm">
                            <p className="text-slate-900 font-bold">{new Date().toLocaleDateString('pt-PT', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
                        </div>
                    </div>
                }
            />

            <div className="p-3 md:p-8 space-y-5 md:space-y-8">

                {/* DASHBOARD GRID */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 md:gap-6 auto-rows-min">

                    {/* 1. KPIs Row */}
                    {hasAccess(userRole, 'requisicoes') && (
                        <div className="w-full min-w-0 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-0">
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
                        <div className="w-full min-w-0 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-75">
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
                        <div className="w-full min-w-0 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
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
                    <div className="w-full min-w-0 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-150">
                        {userRole === 'admin' && pendingRegistrations > 0 ? (
                            <div className="bg-white border border-amber-200 rounded-2xl p-6 h-full flex flex-col justify-between shadow-[0_8px_18px_-12px_rgba(15,23,42,0.22)]">
                                <div>
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="p-3 rounded-xl bg-amber-50 text-amber-600">
                                            <User className="w-6 h-6" />
                                        </div>
                                        <span className="bg-amber-50 text-amber-700 text-xs font-bold px-2 py-1 rounded-full border border-amber-200">Ação Necessária</span>
                                    </div>
                                    <h3 className="text-slate-900 font-bold text-lg mt-2">Aprovações Pendentes</h3>
                                    <p className="text-slate-600 text-sm mt-1">{pendingRegistrations} novos utilizadores</p>
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
                    <div className="w-full min-w-0 xl:col-span-1 h-full min-h-[220px] md:min-h-[300px] animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200">
                        <QuickActions
                            onNewService={() => setActiveTab('requisicoes')}
                            onNewClient={() => setActiveTab('clientes')}
                            onNewVehicle={() => setActiveTab('viaturas')}
                        />
                    </div>

                    {/* Fleet Status Chart - 1 Col */}
                    {hasAccess(userRole, 'viaturas') && (
                        <div className="w-full min-w-0 xl:col-span-1 h-full min-h-[220px] md:min-h-[300px] animate-in fade-in slide-in-from-bottom-4 duration-500 delay-300">
                            <FleetStatusChart
                                total={totalVehicles}
                                available={availableVehicles}
                                maintenance={maintenanceVehicles}
                                active={activeVehicles}
                            />
                        </div>
                    )}

                    {/* Revenue Chart - 2 Cols */}
                    <div className="w-full min-w-0 xl:col-span-2 h-full min-h-[220px] md:min-h-[300px] animate-in fade-in slide-in-from-bottom-4 duration-500 delay-400">
                        <RevenueChart services={servicos} />
                    </div>

                    {/* 3. Activity Table - Full Width */}
                    <div className="w-full min-w-0 col-span-1 xl:col-span-3 h-full min-h-[260px] md:min-h-[400px] animate-in fade-in slide-in-from-bottom-4 duration-500 delay-500">
                        <ActivityTable items={activityItems} />
                    </div>

                </div>
            </div>
        </div>
    );
}
