import { useState, useEffect } from 'react';
import {
    Search, User,
    Clock, Database, Eye, Download
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface AuditLog {
    id: string;
    user_id: string;
    action: string;
    module: string;
    reference_id?: string;
    details?: any;
    created_at: string;
    user_email?: string;
}

export default function AuditLogs() {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchLogs();
    }, []);

    const fetchLogs = async () => {
        try {
            const { data, error } = await supabase
                .from('audit_logs')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(100);

            if (error) throw error;
            setLogs(data || []);
        } catch (err) {
            console.error('Error fetching audit logs:', err);
        }
    };

    const filteredLogs = logs.filter(log =>
        log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.module.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.user_id?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="relative flex-1 max-w-md group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
                    <input
                        type="text"
                        placeholder="Pesquisar por ação, módulo ou ID..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-white/90 border border-slate-200/60 rounded-2xl py-3 pl-12 pr-4 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40 transition-all font-medium"
                    />
                </div>
                <button className="flex items-center gap-2 px-6 py-3 bg-slate-100 hover:bg-slate-700 text-slate-900 rounded-2xl transition-all font-black text-xs uppercase tracking-widest border border-slate-200/60 shadow-lg">
                    <Download className="w-4 h-4" /> Exportar Logs
                </button>
            </div>

            <div className="bg-white/90 border border-slate-200/60 rounded-3xl overflow-hidden backdrop-blur-md">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-200/60 bg-slate-50">
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Timestamp</th>
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-500">User ID</th>
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Ação</th>
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Módulo</th>
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Detalhes</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/40 text-sm">
                            {filteredLogs.map((log) => (
                                <tr key={log.id} className="hover:bg-slate-50 transition-colors group">
                                    <td className="p-4 whitespace-nowrap">
                                        <div className="flex items-center gap-2 text-slate-400 font-bold">
                                            <Clock className="w-3.5 h-3.5" />
                                            {new Date(log.created_at).toLocaleString()}
                                        </div>
                                    </td>
                                    <td className="p-4 whitespace-nowrap">
                                        <div className="flex items-center gap-2 text-slate-300 font-black">
                                            <User className="w-3.5 h-3.5 text-blue-500" />
                                            <span className="truncate max-w-[120px]" title={log.user_id}>{log.user_id?.split('-')[0]}...</span>
                                        </div>
                                    </td>
                                    <td className="p-4 whitespace-nowrap">
                                        <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 text-[10px] font-black uppercase tracking-tighter border border-blue-500/20">
                                            {log.action}
                                        </span>
                                    </td>
                                    <td className="p-4 whitespace-nowrap font-bold text-slate-400">
                                        <div className="flex items-center gap-2">
                                            <Database className="w-3.5 h-3.5" />
                                            {log.module}
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <button className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-700 text-slate-200 rounded-lg transition-all text-xs font-bold border border-slate-200/40">
                                            <Eye className="w-3.5 h-3.5" /> Ver JSON
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
