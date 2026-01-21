import { ChevronRight, Filter, Activity, AlertCircle, CheckCircle2, Clock } from 'lucide-react';

interface ActivityItem {
    id: string;
    type: string;
    title: string;
    subtitle: string;
    date: Date;
    status: 'pending' | 'completed' | 'in_progress' | 'warning';
    priority?: 'high' | 'normal' | 'low';
}

interface ActivityTableProps {
    items: ActivityItem[];
    title?: string;
}

export default function ActivityTable({ items, title = "Atividade Recente" }: ActivityTableProps) {
    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'completed': return (
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 text-emerald-400 text-xs font-bold rounded-lg border border-emerald-500/20 shadow-sm shadow-emerald-900/10">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Concluído</span>
                </div>
            );
            case 'pending': return (
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 text-amber-400 text-xs font-bold rounded-lg border border-amber-500/20 shadow-sm shadow-amber-900/10 relative overflow-hidden">
                    {/* Pulsing Dot */}
                    <div className="absolute top-0 right-0 -mr-1 -mt-1 w-2 h-2 rounded-full bg-amber-400 animate-ping opacity-75"></div>
                    <Clock className="w-3 h-3" />
                    <span>Pendente</span>
                </div>
            );
            case 'in_progress': return (
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-500/10 text-blue-400 text-xs font-bold rounded-lg border border-blue-500/20 shadow-sm shadow-blue-900/10">
                    <Activity className="w-3 h-3 animate-pulse" />
                    <span>Em Curso</span>
                </div>
            );
            case 'warning': return (
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-500/10 text-red-400 text-xs font-bold rounded-lg border border-red-500/20 shadow-sm shadow-red-900/10">
                    <AlertCircle className="w-3 h-3" />
                    <span>Atenção</span>
                </div>
            );
            default: return null;
        }
    };

    const getTypeIcon = (type: string) => {
        // Simple mapping, can be expanded
        if (type.includes('URGENT')) return <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center text-red-500 border border-red-500/20 shadow-lg shadow-red-500/10"><AlertCircle className="w-4 h-4" /></div>;
        if (type.includes('REGIST')) return <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-500 border border-blue-500/20 shadow-lg shadow-blue-500/10"><Activity className="w-4 h-4" /></div>;
        return <div className="w-8 h-8 rounded-full bg-slate-700/50 flex items-center justify-center text-slate-400 border border-slate-600/30"><Activity className="w-4 h-4" /></div>;
    };

    return (
        <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl h-full flex flex-col overflow-hidden shadow-2xl shadow-black/20">
            <div className="p-5 border-b border-slate-700/50 flex items-center justify-between bg-slate-800/30">
                <div className="flex items-center gap-2">
                    <div className="w-1 h-6 bg-gradient-to-b from-blue-500 to-indigo-600 rounded-full"></div>
                    <h3 className="font-bold text-white text-lg tracking-tight">{title}</h3>
                </div>
                <button className="p-2 hover:bg-slate-700/50 rounded-xl text-slate-400 hover:text-white transition-all border border-transparent hover:border-slate-600/50">
                    <Filter className="w-4 h-4" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-800/50 sticky top-0 backdrop-blur-md z-10 rounded-lg">
                        <tr>
                            <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest pl-6">Entidade</th>
                            <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Detalhes</th>
                            <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Estado</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/30">
                        {items.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="p-12 text-center text-slate-500 text-sm italic">
                                    Sem atividade recente para mostrar.
                                </td>
                            </tr>
                        ) : (
                            items.map((item) => (
                                <tr key={item.id} className="group hover:bg-slate-800/40 transition-all duration-300 rounded-xl">
                                    <td className="p-4 pl-6">
                                        <div className="flex items-center gap-4">
                                            {getTypeIcon(item.type)}
                                            <div className="flex flex-col">
                                                <span className="font-bold text-white group-hover:text-blue-400 transition-colors tracking-tight shadow-black drop-shadow-sm">{item.title}</span>
                                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{item.type.replace(/_/g, ' ')}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-sm text-slate-300 font-medium line-clamp-1">{item.subtitle}</span>
                                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                                <Clock className="w-3 h-3" />
                                                <span>{item.date.toLocaleDateString('pt-PT')}</span>
                                                <span className="w-1 h-1 rounded-full bg-slate-600"></span>
                                                <span>{item.date.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4 text-right">
                                        <div className="flex justify-end items-center gap-3">
                                            <div className="scale-90 opacity-80 group-hover:scale-100 group-hover:opacity-100 transition-all">
                                                {getStatusBadge(item.status)}
                                            </div>
                                            <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
