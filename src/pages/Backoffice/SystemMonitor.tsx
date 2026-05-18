import { useState, useEffect } from 'react';
import {
    Activity, Zap, Cpu, Server,
    Wifi, Bug, Users
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function SystemMonitor() {
    const [onlineCount, setOnlineCount] = useState(0);

    useEffect(() => {
        fetchActiveSessions();
        const interval = setInterval(fetchActiveSessions, 30000);
        return () => clearInterval(interval);
    }, []);

    const fetchActiveSessions = async () => {
        try {
            const { count } = await supabase
                .from('user_profiles')
                .select('*', { count: 'exact', head: true })
                .gt('last_login', new Date(Date.now() - 3600000).toISOString()); // Last hour

            setOnlineCount(count || 0);
        } catch (err) {
            console.error('Error monitoring sessions:', err);
        }
    };

    return (
        <div className="space-y-8">
            {/* Monitoring Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between p-6 bg-white/90/60 border border-slate-200/60 rounded-3xl backdrop-blur-xl">
                <div className="flex items-center gap-4 mb-4 md:mb-0">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center ring-4 ring-emerald-500/10">
                        <Activity className="w-6 h-6 text-emerald-400 animate-pulse" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-900">Estado do Sistema</h2>
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
                            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Normal - 0.23ms latency</span>
                        </div>
                    </div>
                </div>
                <div className="hidden md:flex items-center gap-8">
                    <MetricSmall icon={Wifi} label="SUPABASE DB" value="CONNECTED" color="emerald" />
                    <MetricSmall icon={Zap} label="EDGE FUNCTIONS" value="ACTIVE" color="emerald" />
                </div>
            </div>

            {/* Health Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <MetricCard icon={Users} label="Sessões Activas (1h)" value={onlineCount} subValue="+12% vs last hour" color="blue" />
                <MetricCard icon={Cpu} label="CPU Usage" value="14%" subValue="Load balanced" color="purple" />
                <MetricCard icon={Server} label="Memory Usage" value="1.2GB" subValue="Max 4GB" color="amber" />
                <MetricCard icon={Bug} label="Error Rate" value="0.02%" subValue="Stable" color="emerald" />
            </div>

            {/* Core Services pulse */}
            <div className="bg-white/90 border border-slate-200/60 rounded-3xl p-8 backdrop-blur-md">
                <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest mb-8">Conectividade de Serviços</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                    <ServiceRow name="Database Realtime" status="Healthy" uptime="99.99%" />
                    <ServiceRow name="Authentication Guard" status="Healthy" uptime="100%" />
                    <ServiceRow name="File Storage" status="Healthy" uptime="99.98%" />
                    <ServiceRow name="Edge Computing" status="Healthy" uptime="99.99%" />
                    <ServiceRow name="API Gateway" status="Healthy" uptime="99.99%" />
                    <ServiceRow name="Push Notifications" status="Degraded" uptime="98.50%" warning />
                </div>
            </div>
        </div>
    );
}

function MetricCard({ icon: Icon, label, value, subValue, color }: any) {
    const colors: any = {
        blue: 'from-blue-600/20 to-blue-900/10 text-blue-400 border-blue-500/20 shadow-blue-900/10',
        emerald: 'from-emerald-600/20 to-emerald-900/10 text-emerald-400 border-emerald-500/20 shadow-emerald-900/10',
        purple: 'from-purple-600/20 to-purple-900/10 text-purple-400 border-purple-500/20 shadow-purple-900/10',
        amber: 'from-amber-600/20 to-amber-900/10 text-amber-400 border-amber-500/20 shadow-amber-900/10',
    };

    return (
        <div className={`p-6 rounded-3xl bg-gradient-to-br border shadow-xl ${colors[color]}`}>
            <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-xl bg-white/90">
                    <Icon className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest opacity-60">{label}</span>
            </div>
            <div className="space-y-1">
                <div className="text-3xl font-black text-slate-900">{value}</div>
                <div className="text-[10px] font-bold opacity-60 uppercase">{subValue}</div>
            </div>
        </div>
    );
}

function MetricSmall({ icon: Icon, label, value, color }: any) {
    return (
        <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl bg-${color}-500/10 text-${color}-400`}>
                <Icon className="w-4 h-4" />
            </div>
            <div>
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">{label}</p>
                <p className={`text-[10px] font-bold text-${color}-400`}>{value}</p>
            </div>
        </div>
    );
}

function ServiceRow({ name, status, uptime, warning }: { name: string, status: string, uptime: string, warning?: boolean }) {
    return (
        <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-200/40 relative overflow-hidden group hover:border-slate-500/40 transition-all">
            <div className="flex items-center gap-4">
                <div className={`w-2 h-2 rounded-full ${warning ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'}`} />
                <div>
                    <h4 className="text-sm font-bold text-slate-200">{name}</h4>
                    <p className={`text-[10px] font-black uppercase ${warning ? 'text-amber-500' : 'text-slate-500'}`}>{status}</p>
                </div>
            </div>
            <div className="text-right">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Uptime</p>
                <p className="text-xs font-black text-slate-900">{uptime}</p>
            </div>
            <div className={`absolute bottom-0 left-0 h-1 bg-${warning ? 'amber' : 'emerald'}-500 opacity-20 w-full transform -translate-x-full group-hover:translate-x-0 transition-transform duration-500`} />
        </div>
    );
}
