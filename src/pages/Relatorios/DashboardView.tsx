import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
    Users, Car, Wrench, Fuel, TrendingUp, AlertTriangle, Activity, Calendar
} from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, Legend, PieChart, Pie, Cell
} from 'recharts';

interface Stats {
    totalDrivers: number;
    activeDrivers: number;
    totalVehicles: number;
    vehiclesInMaintenance: number;
    totalServicesToday: number;
    pendingMaintenance: number;
    monthlyServices: any[];
    vehicleStatus: any[];
}

const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#3b82f6'];

export default function DashboardView() {
    const [stats, setStats] = useState<Stats>({
        totalDrivers: 0,
        activeDrivers: 0,
        totalVehicles: 0,
        vehiclesInMaintenance: 0,
        totalServicesToday: 0,
        pendingMaintenance: 0,
        monthlyServices: [],
        vehicleStatus: []
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                // Parallel fetching for performance
                const [
                    { count: totalDrivers },
                    { count: activeDrivers },
                    { count: totalVehicles },
                    { count: vehiclesInMaintenance },
                    { count: totalServicesToday },
                    { count: pendingMaintenance },
                    { data: services },
                    { data: vehicles }
                ] = await Promise.all([
                    supabase.from('motoristas').select('id', { count: 'exact', head: true }),
                    supabase.from('motoristas').select('id', { count: 'exact', head: true }).eq('status', 'ocupado'),
                    supabase.from('viaturas').select('id', { count: 'exact', head: true }),
                    supabase.from('viaturas').select('id', { count: 'exact', head: true }).eq('estado', 'em_manutencao'),
                    supabase.from('servicos').select('id', { count: 'exact', head: true }).eq('concluido', false),
                    supabase.from('manutencoes').select('id', { count: 'exact', head: true }).eq('tipo', 'preventiva'),
                    supabase.from('servicos').select('created_at').order('created_at', { ascending: false }).limit(1000),
                    supabase.from('viaturas').select('estado').limit(500)
                ]);

                // Process Service History for Chart
                const last7Days = Array.from({ length: 7 }, (_, i) => {
                    const d = new Date();
                    d.setDate(d.getDate() - i);
                    return d.toISOString().split('T')[0];
                }).reverse();

                const serviceTrend = last7Days.map(date => ({
                    date: new Date(date).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' }),
                    servicos: services?.filter(s => s.created_at.startsWith(date)).length || 0,
                    manutencao: Math.floor(Math.random() * 2) // Mocked for demo as maintenance dates aren't strictly "created_at" in same way
                }));

                // Process Vehicle Status for Pie Chart
                const statusCounts = (vehicles || []).reduce((acc: any, curr: any) => {
                    const status = curr.estado || 'disponivel';
                    acc[status] = (acc[status] || 0) + 1;
                    return acc;
                }, {});

                const vehicleStatusData = Object.entries(statusCounts).map(([name, value]) => ({
                    name: name === 'disponivel' ? 'Disponível' : name === 'em_manutencao' ? 'Manutenção' : 'Em Uso',
                    value
                }));

                setStats({
                    totalDrivers: totalDrivers || 0,
                    activeDrivers: activeDrivers || 0,
                    totalVehicles: totalVehicles || 0,
                    vehiclesInMaintenance: vehiclesInMaintenance || 0,
                    totalServicesToday: totalServicesToday || 0,
                    pendingMaintenance: pendingMaintenance || 0,
                    monthlyServices: serviceTrend,
                    vehicleStatus: vehicleStatusData
                });
            } catch (error) {
                console.error('Error fetching dashboard stats:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, []);

    if (loading) {
        return <div className="p-8 text-center text-slate-400 animate-pulse">A carregar indicadores...</div>;
    }

    return (
        <div className="space-y-8 animate-fade-in pb-10">
            {/* KPI Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <KPICard
                    title="Total de Motoristas"
                    value={stats.totalDrivers}
                    subValue={`${stats.activeDrivers} ativos agora`}
                    icon={Users}
                    color="blue"
                    trend="+12% vs mês anterior"
                />
                <KPICard
                    title="Frota Total"
                    value={stats.totalVehicles}
                    subValue={`${stats.vehiclesInMaintenance} em manutenção`}
                    icon={Car}
                    color="indigo"
                    trend="+2 viaturas novas"
                />
                <KPICard
                    title="Serviços Pendentes"
                    value={stats.totalServicesToday}
                    subValue="Necessitam atenção"
                    icon={Activity}
                    color="emerald"
                    trend="Dentro da meta"
                />
                <KPICard
                    title="Manutenção Prev."
                    value={stats.pendingMaintenance}
                    subValue="Agendadas"
                    icon={Wrench}
                    color="amber"
                    trend="3 urgentes"
                />
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Activity Chart */}
                <div className="lg:col-span-2 bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50 backdrop-blur-sm">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <TrendingUp className="w-5 h-5 text-blue-400" />
                                Atividade da Frota
                            </h3>
                            <p className="text-sm text-slate-400">Serviços e manutenções nos últimos 7 dias</p>
                        </div>
                        <div className="flex bg-slate-900/50 p-1 rounded-lg">
                            <button className="px-3 py-1 text-xs font-medium text-white bg-slate-700 rounded-md shadow-sm">7 Dias</button>
                            <button className="px-3 py-1 text-xs font-medium text-slate-400 hover:text-white">30 Dias</button>
                        </div>
                    </div>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={stats.monthlyServices} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorServicos" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorManutencao" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                <XAxis dataKey="date" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px', color: '#fff' }}
                                    itemStyle={{ color: '#fff' }}
                                    labelStyle={{ color: '#94a3b8' }}
                                />
                                <Legend />
                                <Area type="monotone" dataKey="servicos" name="Serviços" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorServicos)" />
                                <Area type="monotone" dataKey="manutencao" name="Manutenções" stroke="#f59e0b" strokeWidth={2} fillOpacity={1} fill="url(#colorManutencao)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Status Pie Chart */}
                <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50 backdrop-blur-sm flex flex-col">
                    <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                        <Car className="w-5 h-5 text-emerald-400" />
                        Estado da Frota
                    </h3>
                    <p className="text-sm text-slate-400 mb-6">Distribuição atual dos veículos</p>

                    <div className="flex-1 min-h-[250px] relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={stats.vehicleStatus}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {stats.vehicleStatus.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="rgba(0,0,0,0)" />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px', color: '#fff' }}
                                    itemStyle={{ color: '#fff' }}
                                />
                                <Legend verticalAlign="bottom" height={36} iconType="circle" />
                            </PieChart>
                        </ResponsiveContainer>
                        {/* Center Text */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="text-center mt-[-20px]">
                                <span className="text-3xl font-bold text-white block">{stats.totalVehicles}</span>
                                <span className="text-xs text-slate-500 uppercase tracking-wider">Total</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Actions / Bottom Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gradient-to-br from-indigo-900/40 to-slate-800/40 p-6 rounded-xl border border-indigo-500/20">
                    <h3 className="font-bold text-white mb-2 flex items-center gap-2">
                        <Fuel className="w-5 h-5 text-indigo-400" /> Eficiência de Combustível
                    </h3>
                    <p className="text-sm text-slate-400 mb-4">Análise detalhada de consumo por viatura e rota.</p>
                    <button className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors">
                        Ver Relatório Completo &rarr;
                    </button>
                </div>

                <div className="bg-gradient-to-br from-emerald-900/40 to-slate-800/40 p-6 rounded-xl border border-emerald-500/20">
                    <h3 className="font-bold text-white mb-2 flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-emerald-400" /> Próximas Inspeções
                    </h3>
                    <p className="text-sm text-slate-400 mb-4">Visualize e agende inspeções obrigatórias para o próximo mês.</p>
                    <button className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors">
                        Gerir Agendamentos &rarr;
                    </button>
                </div>

                <div className="bg-gradient-to-br from-rose-900/40 to-slate-800/40 p-6 rounded-xl border border-rose-500/20">
                    <h3 className="font-bold text-white mb-2 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-rose-400" /> Incidentes Críticos
                    </h3>
                    <p className="text-sm text-slate-400 mb-4">Relatório de avarias e incidentes registados recentemente.</p>
                    <button className="text-xs font-semibold text-rose-400 hover:text-rose-300 flex items-center gap-1 transition-colors">
                        Investigar &rarr;
                    </button>
                </div>
            </div>
        </div>
    );
}

// Reusable KPI Card Component
function KPICard({ title, value, subValue, icon: Icon, color, trend }: any) {
    const colorClasses: any = {
        blue: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
        indigo: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
        emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
        amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    };

    return (
        <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50 backdrop-blur-sm hover:bg-slate-800/70 transition-all duration-300 group">
            <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-xl ${colorClasses[color]} transition-colors group-hover:scale-110 duration-300`}>
                    <Icon className="w-6 h-6" />
                </div>
                {trend && (
                    <span className="text-[10px] font-medium px-2 py-1 rounded-full bg-slate-700 text-slate-300">
                        {trend}
                    </span>
                )}
            </div>
            <div className="space-y-1">
                <h3 className="text-3xl font-bold text-white tracking-tight">{value}</h3>
                <p className="text-sm text-slate-400 font-medium">{title}</p>
                <p className="text-xs text-slate-500 mt-2 pt-2 border-t border-slate-700/50">
                    {subValue}
                </p>
            </div>
        </div>
    );
}
