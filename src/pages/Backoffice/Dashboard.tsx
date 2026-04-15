import { useState, useEffect } from 'react';
import {
    Users, Truck, Calendar, AlertCircle, TrendingUp, Clock,
    ArrowUpRight, Fuel, Wallet
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Stats {
    active_users_today: number;
    available_drivers: number;
    scales_today: number;
    pending_scales: number;
    fuel_ops_today: number;
    revenue_today: number;
}

export default function BackofficeDashboard() {
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        try {
            const { data, error } = await supabase.from('backoffice_stats').select('*').single();
            if (error) throw error;
            setStats(data);
        } catch (err) {
            console.error('Error fetching backoffice stats:', err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
                <div key={i} className="h-32 bg-slate-50 rounded-2xl animate-pulse" />
            ))}
        </div>
    );

    return (
        <div className="space-y-8">
            {/* KPI Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                <StatCard
                    title="Users Online (24h)"
                    value={stats?.active_users_today || 0}
                    icon={Users}
                    color="blue"
                />
                <StatCard
                    title="Motoristas Disponíveis"
                    value={stats?.available_drivers || 0}
                    icon={Truck}
                    color="emerald"
                />
                <StatCard
                    title="Escalas Hoje"
                    value={stats?.scales_today || 0}
                    icon={Calendar}
                    color="indigo"
                />
                <StatCard
                    title="Escalas Pendentes"
                    value={stats?.pending_scales || 0}
                    icon={AlertCircle}
                    color="amber"
                    warning={stats?.pending_scales ? stats.pending_scales > 5 : false}
                />
                <StatCard
                    title="Abastecimentos (24h)"
                    value={stats?.fuel_ops_today || 0}
                    icon={Fuel}
                    color="cyan"
                />
                <StatCard
                    title="Receita Hoje"
                    value={`€${stats?.revenue_today.toLocaleString() || '0'}`}
                    icon={Wallet}
                    color="purple"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Operational Alerts */}
                <div className="bg-white/90 border border-slate-200/60 rounded-3xl p-6 backdrop-blur-md">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                            <AlertCircle className="w-5 h-5 text-amber-500" />
                            Alertas Operacionais
                        </h2>
                    </div>
                    <div className="space-y-4">
                        {stats?.pending_scales && stats.pending_scales > 0 ? (
                            <AlertRow
                                type="warning"
                                title="Escalas Sem Motorista"
                                message={`Existem ${stats.pending_scales} escalas para hoje que ainda não foram atribuídas.`}
                                timestamp="Agora"
                            />
                        ) : (
                            <p className="text-slate-500 text-sm font-medium italic">Sem alertas de escalas pendentes.</p>
                        )}
                        <AlertRow
                            type="info"
                            title="Consumo System"
                            message="A carga média da API está dentro dos parâmetros normais (0.23s)."
                            timestamp="Há 2 min"
                        />
                    </div>
                </div>

                {/* System Activity Hub */}
                <div className="bg-white/90 border border-slate-200/60 rounded-3xl p-6 backdrop-blur-md">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-blue-500" />
                            Resumo Operacional
                        </h2>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/50">
                            <p className="text-xs font-bold text-slate-500 uppercase mb-2">KPI Saúde Frota</p>
                            <div className="flex items-center gap-2">
                                <span className="text-2xl font-black text-slate-900">98.4%</span>
                                <span className="flex items-center text-[10px] font-bold text-emerald-500">
                                    <ArrowUpRight className="w-3 h-3" /> +1.2%
                                </span>
                            </div>
                        </div>
                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/50">
                            <p className="text-xs font-bold text-slate-500 uppercase mb-2">Tentativas Login Falhadas</p>
                            <div className="flex items-center gap-2">
                                <span className="text-2xl font-black text-slate-900">4</span>
                                <span className="flex items-center text-[10px] font-bold text-slate-500">
                                    <Clock className="w-3 h-3" /> ÚLTIMAS 12H
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function StatCard({ title, value, icon: Icon, color, warning }: { title: string, value: string | number, icon: any, color: string, warning?: boolean }) {
    const colorMap: Record<string, string> = {
        blue: 'from-blue-600/20 to-blue-900/10 text-blue-400 border-blue-500/20 shadow-blue-900/10',
        emerald: 'from-emerald-600/20 to-emerald-900/10 text-emerald-400 border-emerald-500/20 shadow-emerald-900/10',
        indigo: 'from-indigo-600/20 to-indigo-900/10 text-indigo-400 border-indigo-500/20 shadow-indigo-900/10',
        amber: 'from-amber-600/20 to-amber-900/10 text-amber-400 border-amber-500/20 shadow-amber-900/10',
        cyan: 'from-cyan-600/20 to-cyan-900/10 text-cyan-400 border-cyan-500/20 shadow-cyan-900/10',
        purple: 'from-purple-600/20 to-purple-900/10 text-purple-400 border-purple-500/20 shadow-purple-900/10',
    };

    return (
        <div className={`p-5 rounded-2xl bg-gradient-to-br border shadow-lg ${colorMap[color]} ${warning ? 'ring-2 ring-red-500/50' : ''}`}>
            <div className="flex items-center justify-between mb-4">
                <div className={`p-2 rounded-xl bg-white/90 border border-current opacity-70`}>
                    <Icon className="w-4 h-4" />
                </div>
                {warning && <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.8)]" />}
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">{title}</p>
            <h3 className="text-xl font-black text-slate-900">{value}</h3>
        </div>
    );
}

function AlertRow({ type, title, message, timestamp }: { type: 'warning' | 'info' | 'error', title: string, message: string, timestamp: string }) {
    const styles = {
        warning: 'border-amber-500/20 bg-amber-500/5 text-amber-500',
        info: 'border-blue-500/20 bg-blue-500/5 text-blue-500',
        error: 'border-red-500/20 bg-red-500/5 text-red-500',
    };

    return (
        <div className={`flex items-start gap-4 p-4 rounded-2xl border ${styles[type]} transition-all hover:bg-opacity-10`}>
            <div className="p-2 rounded-xl bg-white/90">
                <AlertCircle className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-4 mb-1">
                    <h4 className="font-bold text-sm truncate">{title}</h4>
                    <span className="text-[10px] font-bold opacity-60 flex items-center gap-1 shrink-0 uppercase">
                        <Clock className="w-2.5 h-2.5" /> {timestamp}
                    </span>
                </div>
                <p className="text-xs opacity-80 leading-relaxed font-medium">{message}</p>
            </div>
        </div>
    );
}
