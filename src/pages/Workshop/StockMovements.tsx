import { useState } from 'react';
import {
    History, ArrowUpRight, ArrowDownLeft,
    Search, Calendar, Download,
    Box, FileText, ClipboardList, User, Info
} from 'lucide-react';
import { useWorkshop } from '../../contexts/WorkshopContext';
import { formatCurrency } from '../../utils/format';

export default function StockMovements() {
    const { stockMovements, workshopItems, refreshInventoryData } = useWorkshop();
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState<'all' | 'entry' | 'exit' | 'adjustment'>('all');

    const filteredMovements = stockMovements.filter(mov => {
        const item = workshopItems.find(i => i.id === mov.item_id);
        const itemName = item?.name.toLowerCase() || '';
        const matchesSearch = itemName.includes(searchTerm.toLowerCase()) ||
            (mov.notes && mov.notes.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchesType = typeFilter === 'all' || mov.movement_type === typeFilter;

        return matchesSearch && matchesType;
    }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const getMovementIcon = (type: string) => {
        switch (type) {
            case 'entry': return <ArrowUpRight className="w-4 h-4 text-green-400" />;
            case 'exit': return <ArrowDownLeft className="w-4 h-4 text-red-400" />;
            case 'adjustment': return <Info className="w-4 h-4 text-blue-400" />;
            default: return null;
        }
    };

    const getSourceIcon = (source?: string) => {
        switch (source) {
            case 'invoice': return <FileText className="w-3.5 h-3.5" />;
            case 'requisition': return <ClipboardList className="w-3.5 h-3.5" />;
            default: return <User className="w-3.5 h-3.5" />;
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                        <div className="p-2 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-600/20">
                            <History className="w-6 h-6 text-white" />
                        </div>
                        Movimentos de Stock
                    </h1>
                    <p className="text-slate-400 mt-1 flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Histórico completo de entradas, saídas e ajustes
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={refreshInventoryData}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-5 py-2.5 rounded-xl font-bold border border-slate-700 transition-all flex items-center gap-2"
                    >
                        <Download className="w-5 h-5" />
                        Exportar CSV
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800/60 p-4 rounded-2xl flex flex-col md:flex-row gap-4 items-center">
                <div className="relative flex-1 group w-full">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-indigo-500 transition-colors" />
                    <input
                        type="text"
                        placeholder="Procurar por item ou observações..."
                        className="w-full bg-slate-950/50 border border-slate-800 rounded-xl pl-12 pr-4 py-3 text-slate-200 outline-none focus:ring-2 focus:ring-indigo-600/40 focus:border-indigo-600/50 transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
                    {(['all', 'entry', 'exit', 'adjustment'] as const).map((type) => (
                        <button
                            key={type}
                            onClick={() => setTypeFilter(type)}
                            className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all border ${typeFilter === type
                                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20'
                                    : 'bg-slate-800/50 border-slate-700 text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                                }`}
                        >
                            {type === 'all' ? 'Todos' :
                                type === 'entry' ? 'Entradas' :
                                    type === 'exit' ? 'Saídas' : 'Ajustes'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Movements Table */}
            <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800/60 rounded-3xl overflow-hidden">
                <div className="overflow-x-auto overflow-y-auto max-h-[60vh] custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-950/50">
                                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-800">Data</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-800">Tipo</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-800">Item</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-800 text-right">Qtd</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-800 text-right">Cuto Médio</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-800">Origem</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-800">Notas</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                            {filteredMovements.map((mov) => {
                                const item = workshopItems.find(i => i.id === mov.item_id);
                                return (
                                    <tr key={mov.id} className="hover:bg-slate-800/30 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-slate-200">
                                                    {new Date(mov.created_at).toLocaleDateString('pt-PT')}
                                                </span>
                                                <span className="text-[10px] text-slate-500 font-medium tracking-tighter">
                                                    {new Date(mov.created_at).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className={`p-1.5 rounded-lg ${mov.movement_type === 'entry' ? 'bg-green-500/10' :
                                                        mov.movement_type === 'exit' ? 'bg-red-500/10' : 'bg-blue-500/10'
                                                    }`}>
                                                    {getMovementIcon(mov.movement_type)}
                                                </div>
                                                <span className="text-xs font-black uppercase tracking-widest text-slate-300">
                                                    {mov.movement_type === 'entry' ? 'Entrada' :
                                                        mov.movement_type === 'exit' ? 'Saída' : 'Ajuste'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-500">
                                                    <Box className="w-4 h-4" />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors">
                                                        {item?.name || 'Item Removido'}
                                                    </span>
                                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                                        {item?.sku || '---'}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className={`text-sm font-black ${mov.movement_type === 'entry' ? 'text-green-400' :
                                                    mov.movement_type === 'exit' ? 'text-red-400' : 'text-blue-400'
                                                }`}>
                                                {mov.movement_type === 'exit' ? '-' : '+'}{mov.quantity}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="text-sm font-bold text-slate-300">
                                                {mov.average_cost_at_time ? formatCurrency(mov.average_cost_at_time) : '---'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2 px-2 py-1 bg-slate-800/50 rounded-lg border border-slate-700/50 w-fit">
                                                <div className="text-slate-500">
                                                    {getSourceIcon(mov.source_document)}
                                                </div>
                                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                    {mov.source_document === 'invoice' ? 'Fatura' :
                                                        mov.source_document === 'requisition' ? 'Requisição' : 'Manual'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="text-xs text-slate-500 italic max-w-xs truncate">
                                                {mov.notes || '---'}
                                            </p>
                                        </td>
                                    </tr>
                                );
                            })}

                            {filteredMovements.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center justify-center text-slate-600">
                                            <History className="w-12 h-12 opacity-10 mb-4" />
                                            <p className="text-sm font-black uppercase tracking-widest">Sem movimentos registados</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
