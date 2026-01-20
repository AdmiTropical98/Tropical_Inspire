import { ChevronRight, Filter } from 'lucide-react';

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
            case 'completed': return <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 text-xs font-bold rounded-full border border-emerald-500/10">Concluído</span>;
            case 'pending': return <span className="px-2 py-1 bg-amber-500/10 text-amber-400 text-xs font-bold rounded-full border border-amber-500/10">Pendente</span>;
            case 'in_progress': return <span className="px-2 py-1 bg-blue-500/10 text-blue-400 text-xs font-bold rounded-full border border-blue-500/10">Em Curso</span>;
            case 'warning': return <span className="px-2 py-1 bg-red-500/10 text-red-400 text-xs font-bold rounded-full border border-red-500/10">Atenção</span>;
            default: return null;
        }
    };

    return (
        <div className="bg-[#1e293b]/40 backdrop-blur-md border border-slate-700/50 rounded-2xl h-full flex flex-col overflow-hidden">
            <div className="p-6 border-b border-slate-700/50 flex items-center justify-between">
                <h3 className="font-bold text-white text-lg">{title}</h3>
                <button className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors">
                    <Filter className="w-4 h-4" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-800/30 sticky top-0 backdrop-blur-sm z-10">
                        <tr>
                            <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Descrição</th>
                            <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Data</th>
                            <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Estado</th>
                            <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/30">
                        {items.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="p-8 text-center text-slate-500 text-sm">
                                    Sem dados para mostrar.
                                </td>
                            </tr>
                        ) : (
                            items.map((item) => (
                                <tr key={item.id} className="group hover:bg-slate-800/40 transition-colors">
                                    <td className="p-4">
                                        <div className="flex flex-col">
                                            <span className="font-medium text-slate-200 group-hover:text-blue-400 transition-colors">{item.title}</span>
                                            <span className="text-xs text-slate-500">{item.subtitle}</span>
                                        </div>
                                    </td>
                                    <td className="p-4 text-sm text-slate-400">
                                        {item.date.toLocaleDateString('pt-PT')} <span className="text-slate-600 text-xs">{item.date.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}</span>
                                    </td>
                                    <td className="p-4 text-right">
                                        {getStatusBadge(item.status)}
                                    </td>
                                    <td className="p-4 text-right">
                                        <button className="p-1 hover:bg-blue-500/20 rounded text-slate-600 hover:text-blue-400 transition-all opacity-0 group-hover:opacity-100">
                                            <ChevronRight className="w-4 h-4" />
                                        </button>
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
