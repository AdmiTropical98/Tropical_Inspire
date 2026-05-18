import { Filter, Archive, CheckCircle2, Clock, AlertTriangle, UserPlus, Truck, Calendar } from 'lucide-react';

interface ActivityItem {
    id: string;
    type: string;
    title: string;
    subtitle: string;
    date: Date;
    status: 'pending' | 'completed' | 'in_progress' | 'warning';
}

interface ActivityTableProps {
    items: ActivityItem[];
    title?: string;
}

export default function ActivityFeed({ items, title = "Timeline de Atividade" }: ActivityTableProps) {

    const getIcon = (type: string) => {
        if (type.includes('URGENT')) return AlertTriangle;
        if (type.includes('REGIST')) return UserPlus;
        if (type.includes('VEHICLE')) return Truck;
        if (type.includes('SCHEDULE')) return Calendar;
        return Archive;
    };

    const getColor = (type: string) => {
        if (type.includes('URGENT')) return 'red';
        if (type.includes('REGIST')) return 'amber';
        if (type.includes('VEHICLE')) return 'blue';
        return 'indigo';
    };

    return (
        <div className="bg-white border border-slate-200 rounded-3xl h-full flex flex-col overflow-hidden shadow-[0_8px_18px_-12px_rgba(15,23,42,0.22)]">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                        <Clock className="w-5 h-5" />
                    </div>
                    <h3 className="font-bold text-slate-900 text-lg tracking-tight">{title}</h3>
                </div>
                <button className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-700 transition-all">
                    <Filter className="w-4 h-4" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 relative">
                {/* Vertical Line */}
                <div className="absolute left-[2.25rem] top-6 bottom-6 w-0.5 bg-slate-200 rounded-full" />

                <div className="space-y-8">
                    {items.length === 0 ? (
                        <div className="text-center text-slate-500 py-12 italic">
                            Sem atividade recente.
                        </div>
                    ) : (
                        items.map((item) => {
                            const Icon = getIcon(item.type);
                            const color = getColor(item.type);

                            return (
                                <div key={item.id} className="relative pl-12 group">
                                    {/* Timeline Dot */}
                                    <div className={`absolute left-0 top-1 w-10 h-10 rounded-2xl border-4 border-white flex items-center justify-center transition-all duration-300 group-hover:scale-110 shadow-sm
                                        ${String(item.status || '').toUpperCase() === 'COMPLETED'
                                            ? 'bg-emerald-500/20 text-emerald-400 ring-2 ring-emerald-500/20'
                                            : `bg-${color}-500/20 text-${color}-400 ring-2 ring-${color}-500/20`
                                        }
                                    `}>
                                        <Icon className="w-5 h-5" />
                                    </div>

                                    {/* Content Card */}
                                    <div className={`
                                        bg-slate-50 hover:bg-white border border-slate-200 hover:border-slate-300 
                                        rounded-2xl p-4 transition-all duration-300 hover:translate-x-1
                                    `}>
                                        <div className="flex justify-between items-start mb-1">
                                            <h4 className="font-bold text-slate-900 text-sm">{item.title}</h4>
                                            <span className="text-[10px] font-bold text-slate-500 bg-white px-2 py-1 rounded-lg border border-slate-200">
                                                {item.date.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <p className="text-sm text-slate-600 leading-relaxed mb-3">{item.subtitle}</p>

                                        <div className="flex items-center gap-2">
                                            {String(item.status || '').toUpperCase() === 'COMPLETED' ? (
                                                <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                                                    <CheckCircle2 className="w-3 h-3" /> Concluído
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20 animate-pulse">
                                                    <Clock className="w-3 h-3" /> Pendente
                                                </span>
                                            )}
                                            <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider">
                                                {item.date.toLocaleDateString('pt-PT')}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}

