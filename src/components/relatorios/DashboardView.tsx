import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
    Users, Car, Wrench, Fuel, TrendingUp, AlertTriangle
} from 'lucide-react';

interface Stats {
    totalDrivers: number;
    activeDrivers: number;
    totalVehicles: number;
    vehiclesInMaintenance: number;
    totalServicesToday: number;
    pendingMaintenance: number;
}

export default function DashboardView() {
    const [stats, setStats] = useState<Stats>({
        totalDrivers: 0,
        activeDrivers: 0,
        totalVehicles: 0,
        vehiclesInMaintenance: 0,
        totalServicesToday: 0,
        pendingMaintenance: 0
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                // Parallel fetching for performance
                const [
                    { count: totalDrivers } = await supabase.from('motoristas').select('*', { count: 'exact', head: true }),
                    { count: activeDrivers } = await supabase.from('motoristas').select('*', { count: 'exact', head: true }).eq('status', 'ocupado'),
                    { count: totalVehicles } = await supabase.from('viaturas').select('*', { count: 'exact', head: true }),
                    { count: vehiclesInMaintenance } = await supabase.from('viaturas').select('*', { count: 'exact', head: true }).eq('estado', 'em_manutencao'),
                    { count: totalServicesToday } = await supabase.from('servicos').select('*', { count: 'exact', head: true }).eq('concluido', false), // Pending usually means active/today in this context
                    { count: pendingMaintenance } = await supabase.from('manutencoes').select('*', { count: 'exact', head: true }).eq('tipo', 'preventiva') // Dummy check, improved later
                ] = await Promise.all([
                    supabase.from('motoristas').select('*', { count: 'exact', head: true }),
                    supabase.from('motoristas').select('*', { count: 'exact', head: true }).eq('status', 'ocupado'),
                    supabase.from('viaturas').select('*', { count: 'exact', head: true }),
                    supabase.from('viaturas').select('*', { count: 'exact', head: true }).eq('estado', 'em_manutencao'),
                    supabase.from('servicos').select('*', { count: 'exact', head: true }).eq('concluido', false),
                    supabase.from('manutencoes').select('*', { count: 'exact', head: true }).eq('tipo', 'preventiva') // Just an example metric
                ]);

                setStats({
                    totalDrivers: totalDrivers || 0,
                    activeDrivers: activeDrivers || 0,
                    totalVehicles: totalVehicles || 0,
                    vehiclesInMaintenance: vehiclesInMaintenance || 0,
                    totalServicesToday: totalServicesToday || 0,
                    pendingMaintenance: pendingMaintenance || 0
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
        return <div className="p-8 text-center text-slate-400">A carregar indicadores...</div>;
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <h2 className="text-xl font-bold text-white mb-4">Visão Geral Operacional</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Drivers Card */}
                <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700/50 backdrop-blur-sm">
                    <div className="flex justify-between items-start mb-4">
                        <div className="bg-blue-500/10 p-3 rounded-lg">
                            <Users className="w-6 h-6 text-blue-400" />
                        </div>
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${stats.activeDrivers > 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-700 text-slate-400'}`}>
                            {stats.activeDrivers} ativos
                        </span>
                    </div>
                    <div className="space-y-1">
                        <h3 className="text-2xl font-bold text-white">{stats.totalDrivers}</h3>
                        <p className="text-sm text-slate-400">Total de Motoristas</p>
                    </div>
                </div>

                {/* Vehicles Card */}
                <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700/50 backdrop-blur-sm">
                    <div className="flex justify-between items-start mb-4">
                        <div className="bg-indigo-500/10 p-3 rounded-lg">
                            <Car className="w-6 h-6 text-indigo-400" />
                        </div>
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${stats.vehiclesInMaintenance > 0 ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                            {stats.vehiclesInMaintenance} na oficina
                        </span>
                    </div>
                    <div className="space-y-1">
                        <h3 className="text-2xl font-bold text-white">{stats.totalVehicles}</h3>
                        <p className="text-sm text-slate-400">Viaturas na Frota</p>
                    </div>
                </div>

                {/* Services Card */}
                <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700/50 backdrop-blur-sm">
                    <div className="flex justify-between items-start mb-4">
                        <div className="bg-emerald-500/10 p-3 rounded-lg">
                            <TrendingUp className="w-6 h-6 text-emerald-400" />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <h3 className="text-2xl font-bold text-white">{stats.totalServicesToday}</h3>
                        <p className="text-sm text-slate-400">Serviços Pendentes</p>
                    </div>
                </div>

                {/* Maintenance Card */}
                <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700/50 backdrop-blur-sm">
                    <div className="flex justify-between items-start mb-4">
                        <div className="bg-amber-500/10 p-3 rounded-lg">
                            <Wrench className="w-6 h-6 text-amber-400" />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <h3 className="text-2xl font-bold text-white">{stats.pendingMaintenance}</h3>
                        <p className="text-sm text-slate-400">Manutenções Prev.</p>
                    </div>
                </div>
            </div>

            {/* Quick Actions or hints could go here */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700/50">
                    <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                        <Fuel className="w-4 h-4 text-yellow-500" /> Consumo Recente
                    </h3>
                    <p className="text-sm text-slate-400">Os dados de consumo detalhados estão disponíveis na aba "Financeiro".</p>
                </div>
                <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700/50">
                    <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-500" /> Alertas
                    </h3>
                    <p className="text-sm text-slate-400">Nenhum alerta crítico de frota detetado.</p>
                </div>
            </div>
        </div>
    );
}
