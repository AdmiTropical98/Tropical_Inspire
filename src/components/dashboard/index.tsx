import { useAuth } from '../../contexts/AuthContext';
import { useWorkshop } from '../../contexts/WorkshopContext';
import { usePermissions } from '../../contexts/PermissionsContext';
import {
    User, AlertTriangle, TrendingUp,
    Clock, Bus, Wrench, CheckCircle2, ChevronRight, Fuel,
    FileText, Calendar, Activity, Bell, Users
} from 'lucide-react';
import AdminManagement from './AdminManagement';

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

            {/* Main Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

                {/* 1. Services / Requests */}
                {hasAccess(userRole, 'requisicoes') ? (
                    <QuickStat
                        label="Serviços Ativos"
                        value={activeServices}
                        icon={Activity}
                        color="blue"
                        trend={todayServices > 0 ? `+${todayServices} hoje` : undefined}
                    />
                ) : (
                    <QuickStat label="Minhas Tarefas" value="0" icon={CheckCircle2} color="slate" />
                )}

                {/* 2. Fleet Status */}
                {hasAccess(userRole, 'viaturas') ? (
                    <QuickStat
                        label="Viaturas Disponíves"
                        value={`${availableVehicles} / ${totalVehicles}`}
                        icon={Bus}
                        color="emerald"
                    />
                ) : (
                    <QuickStat label="Viaturas" value="--" icon={Bus} color="slate" />
                )}

                {/* 3. Drivers Status */}
                {hasAccess(userRole, 'motoristas') ? (
                    <QuickStat
                        label="Motoristas Livres"
                        value={`${activeDrivers}`}
                        icon={User}
                        color="indigo"
                    />
                ) : (
                    <QuickStat label="Equipa" value="--" icon={Users} color="slate" />
                )}

                {/* 4. Alerts / Costs */}
                {userRole === 'admin' ? (
                    <QuickStat
                        label="Alertas Urgentes"
                        value={urgentRequests}
                        icon={AlertTriangle}
                        color="red"
                    />
                ) : (
                    <QuickStat
                        label="Notificações"
                        value={notifications.filter(n => n.status === 'pending' && n.type !== 'fuel_confirmation_request').length}
                        icon={Bell}
                        color="amber"
                    />
                )}
            </div>

            {/* Content Split: Operations vs Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* LEFT: Operational Overview (2/3) */}
                <div className="lg:col-span-2 space-y-6">

                    {/* Live Operations Panel */}
                    <div className="bg-[#1e293b]/40 backdrop-blur-md border border-slate-700/50 rounded-2xl p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <Activity className="w-5 h-5 text-blue-500" />
                                Operações em Tempo Real
                            </h2>
                            <button onClick={() => setActiveTab('escalas')} className="text-sm text-blue-400 hover:text-blue-300 flex items-center transition-colors">
                                Ver Escalas <ChevronRight className="w-4 h-4 ml-1" />
                            </button>
                        </div>

                        {/* If Admin/Manager, show detailed fleet breakdown */}
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

                    {/* Quick Access Grid */}
                    <div className="bg-[#1e293b]/40 backdrop-blur-md border border-slate-700/50 rounded-2xl p-6">
                        <h2 className="text-lg font-bold text-white mb-4">Acesso Rápido</h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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

                </div>


                {/* RIGHT: Activity & Alerts (1/3) */}
                <div className="space-y-6">

                    {/* Admin Management (Only for Admins) */}
                    {activeTab === 'admin_users' && userRole === 'admin' && (
                        <div className="bg-[#1e293b]/40 backdrop-blur-md border border-slate-700/50 rounded-2xl p-6">
                            <AdminManagement />
                        </div>
                    )}



                    {/* Activity Feed */}
                    <div className="bg-[#1e293b]/40 backdrop-blur-md border border-slate-700/50 rounded-2xl p-6 h-full min-h-[400px]">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-bold text-white">Atividade Recente</h2>
                            <Bell className="w-4 h-4 text-slate-400" />
                        </div>

                        <div className="space-y-1">
                            {/* Mock Activity if empty */}
                            {notifications.length === 0 ? (
                                <p className="text-slate-500 text-sm text-center py-10">Sem atividade recente.</p>
                            ) : (
                                notifications.slice(0, 6).map(n => (
                                    <ActivityItem
                                        key={n.id}
                                        icon={n.type.includes('urgent') ? AlertTriangle : FileText}
                                        title={n.type.replace(/_/g, ' ').toUpperCase()}
                                        time="há 5 min" // Mock time for now or use relative calc
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
                </div>
            </div>

        </div >
    );
}
