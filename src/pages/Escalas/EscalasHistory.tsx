
import React, { useMemo, useState } from 'react';
import { useWorkshop } from '../../contexts/WorkshopContext';
import { useAuth } from '../../contexts/AuthContext';
import { Calendar, Search, Filter, Shield, User, Clock, CheckCircle2, XCircle } from 'lucide-react';

export default function EscalasHistory() {
    const { scaleBatches, servicos } = useWorkshop();
    const { currentUser, userRole } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');
    const [filterDate, setFilterDate] = useState('');

    // Filter Batches based on Role and Search
    const filteredBatches = useMemo(() => {
        let batches = [...scaleBatches];

        // 1. Role Filtering
        const canViewAll = userRole === 'admin' || userRole === 'gestor';
        if (!canViewAll && currentUser) {
            // Filter by creator (assuming created_by stores ID or email matching user)
            // Note: scale_batches table structure from context has created_by, created_by_role
            // If created_by is the user Name, we match against currentUser.nome. 
            // Ideally we'd match ID. Let's start with Name as per context usage, or check if created_by matches user ID.
            // Based on previous analysis, created_by seems to be a name string in some contexts.
            // Let's match roughly. If created_by matches 'currentUser.email' or 'currentUser.id' or 'currentUser.nome'
            batches = batches.filter(batch =>
                batch.created_by === currentUser.email ||
                batch.created_by === currentUser.nome ||
                batch.created_by === currentUser.id
            );
        }

        // 2. Text Search
        if (searchTerm) {
            const lowerTerm = searchTerm.toLowerCase();
            batches = batches.filter(batch =>
                batch.name?.toLowerCase().includes(lowerTerm) ||
                batch.status?.toLowerCase().includes(lowerTerm) ||
                batch.created_by?.toLowerCase().includes(lowerTerm)
            );
        }

        // 3. Date Filter
        if (filterDate) {
            batches = batches.filter(batch => batch.created_at.startsWith(filterDate));
        }

        return batches.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }, [scaleBatches, userRole, currentUser, searchTerm, filterDate]);

    // Helper to get stats for a batch
    const getBatchStats = (batchId: string) => {
        const batchServices = servicos.filter(s => s.batchId === batchId);
        const total = batchServices.length;
        const assigned = batchServices.filter(s => s.motoristaId).length;
        const completed = batchServices.filter(s => s.concluido).length;
        const pending = total - assigned;

        return { total, assigned, completed, pending };
    };

    return (
        <div className="flex flex-col h-full bg-[#0f172a] p-6 space-y-6 overflow-y-auto custom-scrollbar">
            {/* Header / Filters */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="relative w-full md:w-96 group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                    <input
                        type="text"
                        placeholder="Pesquisar histórico..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full bg-[#1e293b] text-slate-200 pl-10 pr-4 py-2.5 rounded-xl border border-slate-700/50 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10 outline-none transition-all placeholder:text-slate-500 text-sm font-medium"
                    />
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative group flex-1 md:flex-none">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                        <input
                            type="date"
                            value={filterDate}
                            onChange={e => setFilterDate(e.target.value)}
                            className="w-full bg-[#1e293b] text-slate-200 pl-10 pr-4 py-2.5 rounded-xl border border-slate-700/50 focus:border-blue-500/50 outline-none transition-all text-sm font-medium"
                        />
                    </div>
                    {/* Add more filters if needed */}
                </div>
            </div>

            {/* List */}
            <div className="grid grid-cols-1 gap-4">
                {filteredBatches.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-500 border-2 border-dashed border-slate-800 rounded-3xl bg-slate-900/50">
                        <Calendar className="w-12 h-12 mb-4 opacity-20" />
                        <span className="text-lg font-medium">Nenhum histórico encontrado</span>
                    </div>
                ) : (
                    filteredBatches.map(batch => {
                        const stats = getBatchStats(batch.id);
                        return (
                            <div key={batch.id} className="bg-[#1e293b]/50 border border-slate-700/50 rounded-2xl p-5 hover:bg-[#1e293b] hover:border-blue-500/30 transition-all group shadow-lg shadow-black/20">
                                <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
                                    {/* Icon & ID */}
                                    <div className="flex items-center gap-4 min-w-[200px]">
                                        <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 border border-blue-500/20 group-hover:scale-110 transition-transform">
                                            <Calendar className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <h3 className="text-white font-bold text-lg">{batch.name || 'Sem Nome'}</h3>
                                            <span className="text-xs font-mono text-slate-500">{batch.id.slice(0, 8)}...</span>
                                        </div>
                                    </div>

                                    {/* Creator Info */}
                                    <div className="flex flex-col min-w-[150px]">
                                        <div className="flex items-center gap-2 text-slate-400 text-xs uppercase tracking-wider font-bold mb-1">
                                            <User className="w-3 h-3" /> Criado por
                                        </div>
                                        <span className="text-slate-200 font-medium text-sm">{batch.created_by || 'Desconhecido'}</span>
                                        <span className="text-xs text-slate-500 capitalize">{batch.created_by_role || 'N/A'}</span>
                                    </div>

                                    {/* Date */}
                                    <div className="flex flex-col min-w-[150px]">
                                        <div className="flex items-center gap-2 text-slate-400 text-xs uppercase tracking-wider font-bold mb-1">
                                            <Clock className="w-3 h-3" /> Data
                                        </div>
                                        <span className="text-slate-200 font-medium text-sm">
                                            {new Date(batch.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        </span>
                                        <span className="text-xs text-slate-500">
                                            {new Date(batch.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>

                                    {/* Stats */}
                                    <div className="flex-1 flex gap-4 justify-end w-full">
                                        <div className="flex flex-col items-center p-2 bg-slate-900/50 rounded-lg border border-slate-800 min-w-[80px]">
                                            <span className="text-xs text-slate-500 font-bold uppercase">Total</span>
                                            <span className="text-xl font-black text-white">{stats.total}</span>
                                        </div>
                                        <div className="flex flex-col items-center p-2 bg-slate-900/50 rounded-lg border border-slate-800 min-w-[80px]">
                                            <span className="text-xs text-slate-500 font-bold uppercase text-emerald-500">Atrib.</span>
                                            <span className="text-xl font-black text-emerald-400">{stats.assigned}</span>
                                        </div>
                                        <div className="flex flex-col items-center p-2 bg-slate-900/50 rounded-lg border border-slate-800 min-w-[80px]">
                                            <span className="text-xs text-slate-500 font-bold uppercase text-amber-500">Pend.</span>
                                            <span className="text-xl font-black text-amber-400">{stats.pending}</span>
                                        </div>
                                    </div>

                                    {/* Status Badge */}
                                    <div className="mt-4 md:mt-0">
                                        {batch.status === 'completed' ? (
                                            <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-xs font-bold uppercase shadow-sm">
                                                <CheckCircle2 className="w-3.5 h-3.5" /> Concluído
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1.5 px-3 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full text-xs font-bold uppercase shadow-sm">
                                                <Clock className="w-3.5 h-3.5" /> Em Progresso
                                            </span>
                                        )}
                                    </div>

                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
