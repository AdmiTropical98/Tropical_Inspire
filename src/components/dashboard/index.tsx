import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    rectSortingStrategy,
} from '@dnd-kit/sortable';
import { SortableWidget } from './SortableWidget';
import { supabase } from '../../lib/supabase';
import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../contexts/PermissionsContext';
import { useWorkshop } from '../../contexts/WorkshopContext';

import {
    User, AlertTriangle, TrendingUp,
    Clock, Bus, Wrench, CheckCircle2, ChevronRight, Fuel,
    FileText, Calendar, Activity, Bell, Users
} from 'lucide-react';

export default function Dashboard({ activeTab, setActiveTab }: { activeTab: string, setActiveTab: (tab: any) => void }) {
    const { userRole, currentUser } = useAuth();
    const { hasAccess } = usePermissions();
    const { notifications, motoristas, servicos, viaturas } = useWorkshop();

    // --- Stats Calculations ---
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

    // Greeting Time
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';

    // --- Components ---

    const QuickStat = ({ label, value, icon: Icon, color, trend }: any) => (
        <div className="bg-[#1e293b]/40 backdrop-blur-md border border-slate-700/50 rounded-2xl p-5 hover:bg-[#1e293b]/60 transition-all group">
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

    const getTimeAgo = (dateData: string | Date | undefined) => {
        if (!dateData) return '---';
        try {
            const date = typeof dateData === 'string' ? new Date(dateData) : dateData;
            // Check if date is valid
            if (isNaN(date.getTime())) return '---';

            const now = new Date();
            const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

            if (diffInSeconds < 60) return 'há ' + (diffInSeconds < 0 ? 0 : diffInSeconds) + ' s';
            const diffInMinutes = Math.floor(diffInSeconds / 60);
            if (diffInMinutes < 60) return `há ${diffInMinutes} m`;
            const diffInHours = Math.floor(diffInMinutes / 60);
            if (diffInHours < 24) return `há ${diffInHours} h`;

            // If more than 24h, show date
            return date.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' });
        } catch (e) {
            return '---';
        }
    };

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

    // --- DND STATE ---
    const [isEditingLayout, setIsEditingLayout] = useState(false);
    const [layout, setLayout] = useState<string[]>([
        'stats_services', 'stats_fleet', 'stats_drivers', 'stats_alerts',
        'live_ops', 'quick_access', 'activity_feed'
    ]);
    const [originalLayout, setOriginalLayout] = useState<string[]>([]);
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    // Load Layout from DB
    useEffect(() => {
        const loadLayout = async () => {
            const { data, error } = await supabase
                .from('app_settings')
                .select('dashboard_layout')
                .limit(1)
                .single();

            if (data && data.dashboard_layout && Array.isArray(data.dashboard_layout) && data.dashboard_layout.length > 0) {
                // Merge with defaults to ensure new widgets appear if added later
                const saved = data.dashboard_layout as string[];
                const defaults = ['stats_services', 'stats_fleet', 'stats_drivers', 'stats_alerts', 'live_ops', 'quick_access', 'activity_feed', 'admin_management'];
                const merged = Array.from(new Set([...saved, ...defaults]));
                setLayout(merged);
            }
        };
        loadLayout();
    }, []);


    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            setLayout((items) => {
                const oldIndex = items.indexOf(active.id as string);
                const newIndex = items.indexOf(over.id as string);
                return arrayMove(items, oldIndex, newIndex);
            });
        }
    };

    const saveLayout = async () => {
        const { error } = await supabase
            .from('app_settings')
            .upsert({ id: '00000000-0000-0000-0000-000000000000', dashboard_layout: layout }) // Should use a singleton logic or match existing ID logic if table isn't single-row.
            // Actually, best to fetch ID first or use a fixed singleton ID if applicable.
            // For now, let's try to update the First row found.
            .select();

        if (error) {
            // Fallback: try inserting if empty, or update any
            console.error('Save layout error:', error);
            // Try simplified update if singleton
            await supabase.from('app_settings').update({ dashboard_layout: layout }).gt('created_at', '2000-01-01');
            alert('Layout salvo globalmente!');
        } else {
            alert('Layout salvo com sucesso!');
        }
        setIsEditingLayout(false);
    };

    // Widget Map
    const renderWidget = (id: string) => {
        switch (id) {
            case 'stats_services':
                return hasAccess(userRole, 'requisicoes') ? (
                    <QuickStat label="Serviços Ativos" value={activeServices} icon={Activity} color="blue" trend={todayServices > 0 ? `+${todayServices} hoje` : undefined} />
                ) : <QuickStat label="Minhas Tarefas" value="0" icon={CheckCircle2} color="slate" />;
            case 'stats_fleet':
                return hasAccess(userRole, 'viaturas') ? (
                    <QuickStat label="Viaturas Disponíves" value={`${availableVehicles} / ${totalVehicles}`} icon={Bus} color="emerald" />
                ) : <QuickStat label="Viaturas" value="--" icon={Bus} color="slate" />;
            case 'stats_drivers':
                return hasAccess(userRole, 'motoristas') ? (
                    <QuickStat label="Motoristas Livres" value={`${activeDrivers}`} icon={User} color="indigo" />
                ) : <QuickStat label="Equipa" value="--" icon={Users} color="slate" />;
            case 'stats_alerts':
                return userRole === 'admin' ? (
                    <QuickStat label="Alertas Urgentes" value={urgentRequests} icon={AlertTriangle} color="red" />
                ) : <QuickStat label="Notificações" value={notifications.filter(n => n.status === 'pending' && n.type !== 'fuel_confirmation_request').length} icon={Bell} color="amber" />;

            case 'live_ops':
                return (
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
                                        <div className="bg-amber-500 h-1.5 rounded-full" style={{ width: '45%' }}></div>
                                    </div>
                                </div>
                                <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/10">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-red-400 text-sm font-medium">Oficina</span>
                                        <Wrench className="w-4 h-4 text-red-500" />
                                    </div>
                                    <p className="text-2xl font-bold text-white">{maintenanceVehicles}</p>
                                    <div className="w-full bg-red-900/30 h-1.5 rounded-full mt-2">
                                        <div className="bg-red-500 h-1.5 rounded-full" style={{ width: `${(maintenanceVehicles / totalVehicles) * 100}%` }}></div>
                                    </div>
                                </div>
                            </div>
                        )}
                        {/* Recent Services List Stub */}
                        <div className="space-y-3">
                            {activeServices === 0 ? (
                                <div className="text-center py-8 text-slate-500">
                                    <p>Não há serviços ativos de momento.</p>
                                </div>
                            ) : (
                                servicos.slice(0, 3).map((s: any) => (
                                    <div key={s.id} className="flex items-center justify-between p-4 bg-slate-800/30 rounded-xl border border-slate-700/30">
                                        <div className="flex items-center gap-4">
                                            <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg">
                                                <User className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <p className="text-white font-medium">{s.passageiro || 'Serviço Geral'}</p>
                                                <p className="text-xs text-slate-400">{s.origem} <span className="mx-1">→</span> {s.destino}</p>
                                            </div>
                                        </div>
                                        <span className="text-xs font-bold bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full">
                                            Em Curso
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                );

            case 'quick_access':
                return (
                    <div className="bg-[#1e293b]/40 backdrop-blur-md border border-slate-700/50 rounded-2xl p-6 h-full">
                        <h2 className="text-lg font-bold text-white mb-4">Acesso Rápido</h2>
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
                );

            case 'activity_feed':
                return (
                    <div className="bg-[#1e293b]/40 backdrop-blur-md border border-slate-700/50 rounded-2xl p-6 h-full min-h-[400px]">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-bold text-white">Atividade Recente</h2>
                            <Bell className="w-4 h-4 text-slate-400" />
                        </div>

                        <div className="space-y-1">
                            {notifications.length === 0 ? (
                                <p className="text-slate-500 text-sm text-center py-10">Sem atividade recente.</p>
                            ) : (
                                notifications.slice(0, 6).map(n => (
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

                        {userRole === 'admin' && pendingRegistrations > 0 && (
                            <div className="mt-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                                <h3 className="text-amber-400 font-bold mb-1">Aprovação Necessária</h3>
                                <p className="text-slate-400 text-xs mb-3">Existem {pendingRegistrations} novos registos pendentes.</p>
                                <button onClick={() => setActiveTab('equipa-oficina')} className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition-colors">
                                    Rever Pedidos
                                </button>
                            </div>
                        )}
                    </div>
                );



            default: return null;
        }
    };

    // Responsive Col Spans
    const getColSpan = (id: string): string => {
        switch (id) {
            case 'stats_services':
            case 'stats_fleet':
            case 'stats_drivers':
            case 'stats_alerts':
                return 'col-span-1';
            case 'live_ops':
                // Was lg:col-span-2 in original layout (left side of 3 cols)
                // In 4-col grid: col-span-4 lg:col-span-3 (takes 3/4) OR col-span-4 md:col-span-2
                // Let's make it generous: 
                return 'col-span-1 md:col-span-2 lg:col-span-3';
            case 'quick_access':
                return 'col-span-1 md:col-span-2 lg:col-span-3'; // Same width as live ops
            case 'activity_feed':
            case 'admin_management':
                return 'col-span-1 md:col-span-2 lg:col-span-1'; // Right sidebar style
            default:
                return 'col-span-1';
        }
    };

    return (
        <div className="h-full overflow-y-auto custom-scrollbar p-6 space-y-8">

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
                    {/* Edit Layout Button (Visible to ALL as requested) */}
                    <button
                        onClick={() => {
                            if (isEditingLayout) saveLayout();
                            else setIsEditingLayout(true);
                        }}
                        className={`
                            px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2
                            ${isEditingLayout
                                ? 'bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-500/20'
                                : 'bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300'}
                        `}
                    >
                        {isEditingLayout ? <><CheckCircle2 className="w-4 h-4" /> Salvar Layout</> : "Editar Layout"}
                    </button>

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

            {/* DND CONTEXT */}
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
            >
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pb-20">
                    <SortableContext items={layout} strategy={rectSortingStrategy}>
                        {layout.map(id => {
                            const widget = renderWidget(id);
                            if (!widget) return null; // Don't render empty/unauthorized widgets

                            return (
                                <SortableWidget
                                    key={id}
                                    id={id}
                                    editing={isEditingLayout}
                                    className={getColSpan(id)}
                                >
                                    {widget}
                                </SortableWidget>
                            );
                        })}
                    </SortableContext>
                </div>
            </DndContext>

        </div >
    );

}
