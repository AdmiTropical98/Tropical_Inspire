import { useState } from 'react';
import {
    Car, User, List,
    TrendingUp, Activity, Clock
} from 'lucide-react';
import { useWorkshop } from '../../contexts/WorkshopContext';

export default function ControloOperacional() {
    const {
        rotasPlaneadas, logsOperacionais, viaturas, motoristas, vehicleMetrics
    } = useWorkshop();

    const [activeView, setActiveView] = useState<'vehicles' | 'drivers' | 'logs'>('vehicles');

    const completedRoutes = rotasPlaneadas.filter(r => r.estado === 'concluida');
    const totalDeviation = completedRoutes.reduce((acc, r) => {
        if (!r.distancia_real) return acc;
        return acc + (Math.abs(r.distancia_real - r.distancia_estimada) / r.distancia_estimada);
    }, 0);
    const avgDeviation = completedRoutes.length > 0 ? (totalDeviation / completedRoutes.length) * 100 : 0;

    return (
        <div className="flex flex-col h-full bg-[#0a0a0f] text-slate-200">
            {/* Header */}
            <div className="p-8 border-b border-white/5 bg-[#161625]/50 backdrop-blur-xl shrink-0">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-indigo-600 rounded-2xl shadow-[0_0_30px_rgba(79,70,229,0.3)]">
                            <Activity className="w-8 h-8 text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black text-white uppercase tracking-tighter">Controlo Operacional</h1>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-[0.2em]">Gestão de Frota e Desempenho</span>
                                <div className="h-1 w-1 rounded-full bg-slate-600" />
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">{new Date().toLocaleDateString('pt-PT')}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 p-1.5 bg-[#0a0a0f]/80 rounded-2xl border border-white/5 shadow-inner">
                        <button
                            onClick={() => setActiveView('vehicles')}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${activeView === 'vehicles' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-500 hover:text-white'
                                }`}
                        >
                            <Car className="w-4 h-4" /> Viaturas
                        </button>
                        <button
                            onClick={() => setActiveView('drivers')}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${activeView === 'drivers' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-500 hover:text-white'
                                }`}
                        >
                            <User className="w-4 h-4" /> Motoristas
                        </button>
                        <button
                            onClick={() => setActiveView('logs')}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${activeView === 'logs' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-500 hover:text-white'
                                }`}
                        >
                            <List className="w-4 h-4" /> Auditoria
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-8">
                    <div className="bg-[#1e293b]/30 p-4 rounded-2xl border border-white/5 hover:border-indigo-500/30 transition-all">
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Rotas Planeadas</div>
                        <div className="text-3xl font-black text-white">{rotasPlaneadas.length}</div>
                    </div>
                    <div className="bg-[#1e293b]/30 p-4 rounded-2xl border border-white/5 hover:border-emerald-500/30 transition-all">
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Taxa Conclusão</div>
                        <div className="text-3xl font-black text-emerald-400">
                            {rotasPlaneadas.length > 0 ? Math.round((completedRoutes.length / rotasPlaneadas.length) * 100) : 0}%
                        </div>
                    </div>
                    <div className="bg-[#1e293b]/30 p-4 rounded-2xl border border-white/5 hover:border-indigo-500/30 transition-all">
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Desvio Médio KM</div>
                        <div className="text-3xl font-black text-white">{avgDeviation.toFixed(1)}%</div>
                    </div>
                    <div className="bg-[#1e293b]/30 p-4 rounded-2xl border border-white/5 hover:border-red-500/30 transition-all">
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Alertas Auditoria</div>
                        <div className="text-3xl font-black text-red-400">
                            {logsOperacionais.filter(l => l.detalhes_json?.urgente).length}
                        </div>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                {activeView === 'vehicles' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {viaturas.map(v => {
                            const metrics = vehicleMetrics.find(m => m.vehicleId === v.id);
                            const vRoutes = rotasPlaneadas.filter(r => r.viatura_id === v.id);
                            return (
                                <div key={v.id} className="bg-[#161625] rounded-3xl border border-white/5 p-6 hover:shadow-2xl hover:shadow-indigo-500/5 transition-all group">
                                    <div className="flex justify-between items-start mb-6">
                                        <div>
                                            <h3 className="text-xl font-black text-white uppercase tracking-tighter group-hover:text-indigo-400 transition-colors">{v.matricula}</h3>
                                            <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">{v.marca} {v.modelo}</p>
                                        </div>
                                        <div className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border ${v.estado === 'disponivel' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'
                                            }`}>
                                            {v.estado || 'Ativa'}
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="flex justify-between items-end border-b border-white/5 pb-4">
                                            <div className="space-y-1">
                                                <div className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1"><Clock className="w-3 h-3" /> Rotas (Mês)</div>
                                                <div className="text-lg font-black text-white">{vRoutes.length}</div>
                                            </div>
                                            <div className="space-y-1 text-right">
                                                <div className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1 justify-end"><TrendingUp className="w-3 h-3" /> Consumo Médio</div>
                                                <div className="text-lg font-black text-indigo-400">{metrics?.consumoMedio?.toFixed(1) || '--'} L/100</div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <div className="text-[9px] font-bold text-slate-500 uppercase mb-1">Autonomia Est.</div>
                                                <div className="text-sm font-black text-white">{metrics?.estimativaAutonomia ? Math.round(metrics.estimativaAutonomia) + ' KM' : '--'}</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-[9px] font-bold text-slate-500 uppercase mb-1">Custo Total</div>
                                                <div className="text-sm font-black text-white">{metrics?.totalCustoMes?.toFixed(2) || '0.00'} €</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {activeView === 'drivers' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {motoristas.map(m => {
                            const mRoutes = rotasPlaneadas.filter(r => r.motorista_id === m.id);
                            const mCompleted = mRoutes.filter(r => r.estado === 'concluida');
                            const mDeviations = mCompleted.filter(r => r.flag_desvio);

                            return (
                                <div key={m.id} className="bg-[#161625] rounded-3xl border border-white/5 p-6 hover:shadow-2xl transition-all group">
                                    <div className="flex items-center gap-4 mb-6">
                                        <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/20 flex items-center justify-center text-xl font-black text-indigo-400 uppercase">
                                            {m.nome.charAt(0)}
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-black text-white uppercase tracking-tight truncate w-32">{m.nome}</h3>
                                            <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">{m.vencimentoBase ? 'Contratado' : 'Motorista'}</p>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="grid grid-cols-2 gap-3 pb-4 border-b border-white/5">
                                            <div>
                                                <div className="text-[9px] font-bold text-slate-500 uppercase mb-1">Rotas</div>
                                                <div className="text-xl font-black text-white">{mRoutes.length}</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-[9px] font-bold text-slate-500 uppercase mb-1">Desvios (&gt;25%)</div>
                                                <div className={`text-xl font-black ${mDeviations.length > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                                                    {mDeviations.length}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="flex justify-between text-[9px] font-bold text-slate-500 uppercase">
                                                <span>Taxa Admissão</span>
                                                <span>{mRoutes.length > 0 ? Math.round((mCompleted.length / mRoutes.length) * 100) : 100}%</span>
                                            </div>
                                            <div className="h-1.5 bg-[#0a0a0f] rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-indigo-500 rounded-full"
                                                    style={{ width: `${mRoutes.length > 0 ? (mCompleted.length / mRoutes.length) * 100 : 0}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {activeView === 'logs' && (
                    <div className="bg-[#161625] rounded-3xl border border-white/5 overflow-hidden">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-[#0a0a0f]/50 border-b border-white/5">
                                <tr>
                                    <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Data/Hora</th>
                                    <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Utilizador</th>
                                    <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Ação</th>
                                    <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Detalhes</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {logsOperacionais.map(log => (
                                    <tr key={log.id} className="hover:bg-white/5 transition-colors group">
                                        <td className="p-4 text-xs font-mono text-slate-400">
                                            {new Date(log.data_hora).toLocaleString('pt-PT')}
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center text-[10px] font-bold uppercase text-slate-300">
                                                    {log.utilizador.charAt(0)}
                                                </div>
                                                <span className="text-xs font-bold text-white">{log.utilizador}</span>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <span className="px-2 py-1 rounded-md bg-indigo-500/10 text-indigo-400 text-[10px] font-black uppercase tracking-tight border border-indigo-500/20">
                                                {log.acao.replace(/_/g, ' ')}
                                            </span>
                                        </td>
                                        <td className="p-4 text-xs text-slate-500 max-w-md truncate">
                                            {JSON.stringify(log.detalhes_json)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
