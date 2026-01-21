import ApprovalsModal from './modals/ApprovalsModal';
import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../contexts/PermissionsContext';
import { useWorkshop } from '../../contexts/WorkshopContext';
import { useLayout } from '../../contexts/LayoutContext';
import DraggableGrid from '../common/DraggableGrid';
import KPICard from './widgets/KPICard';
import FleetStatusChart from './widgets/FleetStatusChart';
import RevenueChart from './widgets/RevenueChart';
import ActivityTable from './widgets/ActivityTable';

import {
    Activity, User, Bus,
    CheckCircle2, AlertTriangle, Layout, X, LayoutTemplate,
    Calendar
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

    // --- Widgets Definition ---
    const getWidgets = () => {
        const widgets = [];

        // 1. KPI Cards (Top Row)
        if (hasAccess(userRole, 'requisicoes')) {
            widgets.push({
                id: 'kpi_services',
                content: <KPICard
                    title="Serviços Ativos"
                    value={activeServices}
                    icon={Activity}
                    color="blue"
                    trend={todayServices > 0 ? `+${todayServices} hoje` : undefined}
                    trendType="up"
                    subtext="em tempo real"
                />
            });
        }

        if (hasAccess(userRole, 'viaturas')) {
            widgets.push({
                id: 'kpi_fleet',
                content: <KPICard
                    title="Frota Disponível"
                    value={`${availableVehicles}`}
                    subtext={`/ ${totalVehicles}`}
                    icon={Bus}
                    color="emerald"
                    trendType="neutral"
                />
            });
        }

        if (hasAccess(userRole, 'motoristas')) {
            widgets.push({
                id: 'kpi_drivers',
                content: <KPICard
                    title="Motoristas Livres"
                    value={activeDrivers}
                    subtext={`/ ${totalDrivers}`}
                    icon={User}
                    color="indigo"
                    trendType="neutral"
                />
            });
        }

        // Alert KPI or Approvals KPI
        if (userRole === 'admin' && pendingRegistrations > 0) {
            widgets.push({
                id: 'kpi_approvals',
                content: (
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
                )
            });
        } else {
            widgets.push({
                id: 'kpi_alerts',
                content: <KPICard
                    title="Alertas Urgentes"
                    value={urgentRequests}
                    icon={AlertTriangle}
                    color="red"
                    trendType={urgentRequests > 0 ? "down" : "neutral"}
                />
            });
        }

        // 2. Charts (Middle Row)

        // Fleet Status Donut
        if (hasAccess(userRole, 'viaturas')) {
            widgets.push({
                id: 'chart_fleet_status',
                content: <FleetStatusChart
                    total={totalVehicles}
                    available={availableVehicles}
                    maintenance={maintenanceVehicles}
                    active={activeVehicles}
                />
            });
        }

        // Revenue / Services Bar Chart
        widgets.push({
            id: 'chart_revenue',
            content: <RevenueChart />
        });

        // 3. Activity Table (Bottom Row)
        widgets.push({
            id: 'table_activity',
            content: <ActivityTable items={activityItems} />
        });

        return widgets;
    };

    return (
        <div className="h-full overflow-y-auto custom-scrollbar p-6 space-y-8 bg-slate-900">
            {/* ... Modal ... */}
            {hasAccess(userRole, 'equipa-oficina') && (
                <ApprovalsModal isOpen={showApprovalsModal} onClose={() => setShowApprovalsModal(false)} />
            )}

            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-black text-white mb-2 tracking-tight">
                        {greeting}, <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-500">{currentUser?.nome?.split(' ')[0] || 'Gestor'}</span>
                        <span className="text-4xl">👋</span>
                    </h1>
                    <p className="text-slate-400 font-medium">
                        Resumo operacional e métricas em tempo real.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    {/* Control Buttons (Edit Mode) */}
                    {isEditMode ? (
                        <div className="flex gap-2 bg-slate-800 p-1.5 rounded-xl border border-slate-700 shadow-xl">
                            <button
                                onClick={saveChanges}
                                className="px-4 py-2 rounded-lg text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 animate-pulse flex items-center gap-2"
                            >
                                <CheckCircle2 className="w-4 h-4" /> Salvar
                            </button>
                            <button
                                onClick={resetLayout}
                                className="px-4 py-2 rounded-lg text-sm font-bold bg-slate-700 hover:bg-slate-600 text-slate-300 border border-slate-600 flex items-center gap-2"
                            >
                                <LayoutTemplate className="w-4 h-4" /> Reset
                            </button>
                            <button
                                onClick={cancelEditMode}
                                className="px-4 py-2 rounded-lg text-sm font-bold bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 flex items-center gap-2"
                            >
                                <X className="w-4 h-4" /> Cancelar
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={toggleEditMode}
                            className="px-4 py-3 rounded-xl text-sm font-bold bg-slate-800/80 border border-slate-700 hover:bg-slate-800 hover:border-slate-600 text-slate-300 transition-all flex items-center gap-2 backdrop-blur-sm"
                        >
                            <Layout className="w-4 h-4" /> Editor
                        </button>
                    )}

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

            {/* DRAGGABLE LAYOUT ZONE */}
            <DraggableGrid
                zoneId="dashboard_pro_v1" // Changed ID to force reset for new layout
                defaultLayouts={{
                    lg: [
                        { i: 'kpi_services', x: 0, y: 0, w: 3, h: 4 },
                        { i: 'kpi_fleet', x: 3, y: 0, w: 3, h: 4 },
                        { i: 'kpi_drivers', x: 6, y: 0, w: 3, h: 4 },
                        // Conditional logical handled by grid item existence, but coordinate must assume it exists
                        { i: 'kpi_approvals', x: 9, y: 0, w: 3, h: 4 },
                        { i: 'kpi_alerts', x: 9, y: 0, w: 3, h: 4 },

                        { i: 'chart_fleet_status', x: 0, y: 4, w: 4, h: 8 },
                        { i: 'chart_revenue', x: 4, y: 4, w: 8, h: 8 },

                        { i: 'table_activity', x: 0, y: 12, w: 12, h: 10 }
                    ],
                    md: [
                        { i: 'kpi_services', x: 0, y: 0, w: 5, h: 4 },
                        { i: 'kpi_fleet', x: 5, y: 0, w: 5, h: 4 },
                        { i: 'kpi_drivers', x: 0, y: 4, w: 5, h: 4 },
                        { i: 'kpi_approvals', x: 5, y: 4, w: 5, h: 4 },
                        { i: 'kpi_alerts', x: 5, y: 4, w: 5, h: 4 },

                        { i: 'chart_fleet_status', x: 0, y: 8, w: 6, h: 8 },
                        { i: 'chart_revenue', x: 6, y: 8, w: 4, h: 8 },

                        { i: 'table_activity', x: 0, y: 16, w: 10, h: 10 }
                    ],
                    sm: [
                        { i: 'kpi_services', x: 0, y: 0, w: 6, h: 4 },
                        { i: 'kpi_fleet', x: 0, y: 4, w: 6, h: 4 },
                        { i: 'kpi_drivers', x: 0, y: 8, w: 6, h: 4 },
                        { i: 'kpi_approvals', x: 0, y: 12, w: 6, h: 4 },
                        { i: 'kpi_alerts', x: 0, y: 12, w: 6, h: 4 },

                        { i: 'chart_fleet_status', x: 0, y: 16, w: 6, h: 8 },
                        { i: 'chart_revenue', x: 0, y: 24, w: 6, h: 8 },

                        { i: 'table_activity', x: 0, y: 32, w: 6, h: 10 }
                    ]
                }}
            >
                {getWidgets().map((widget, index) => (
                    <div
                        key={widget.id}
                        className="animate-in fade-in slide-in-from-bottom-8 duration-700 fill-mode-backwards"
                        style={{ animationDelay: `${index * 100}ms` }}
                    >
                        {widget.content}
                    </div>
                ))}
            </DraggableGrid>

        </div>
    );
}

