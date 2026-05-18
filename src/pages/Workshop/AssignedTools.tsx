import { useState } from 'react';
import {
    UserPlus, Search,
    ShieldCheck, ArrowLeftRight,
    Wrench, Info, ExternalLink,
    ChevronRight, Calendar
} from 'lucide-react';
import { useWorkshop } from '../../contexts/WorkshopContext';

export default function AssignedTools() {
    const { workshopAssets, motoristas, assignWorkshopAsset } = useWorkshop();
    const [searchTerm, setSearchTerm] = useState('');

    const assignedAssets = workshopAssets.filter(asset => asset.status === 'assigned');

    const filteredAssets = assignedAssets.filter(asset => {
        const technician = motoristas.find(m => m.id === asset.assigned_technician_id);
        const matchesSearch = asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (technician && technician.nome.toLowerCase().includes(searchTerm.toLowerCase()));

        return matchesSearch;
    });

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header Panel */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <div className="p-2 bg-blue-600 rounded-xl shadow-lg shadow-blue-600/20">
                            <UserPlus className="w-6 h-6 text-slate-900" />
                        </div>
                        Ferramentas Atribuídas
                    </h1>
                    <p className="text-slate-400 mt-1 flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4" />
                        Vigilância de responsabilidades e posse de ativos
                    </p>
                </div>
            </div>

            {/* Search Bar */}
            <div className="bg-white/90 backdrop-blur-xl border border-slate-200/60 p-4 rounded-2xl">
                <div className="relative group max-w-2xl">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
                    <input
                        type="text"
                        placeholder="Procurar por ferramenta ou técnico..."
                        className="w-full bg-white/90 border border-slate-200 rounded-xl pl-12 pr-4 py-3 text-slate-200 outline-none focus:ring-2 focus:ring-blue-600/40 transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Grid Display */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredAssets.map(asset => {
                    const technician = motoristas.find(m => m.id === asset.assigned_technician_id);

                    return (
                        <div key={asset.id} className="group bg-slate-50/60 hover:bg-white/90 border border-slate-200/50 hover:border-blue-600/30 rounded-3xl overflow-hidden transition-all duration-500 flex flex-col">
                            <div className="p-6">
                                <div className="flex items-start justify-between mb-6">
                                    <div className="flex flex-col">
                                        <h3 className="text-xl font-black text-slate-900 group-hover:text-blue-400 transition-colors">
                                            {asset.name}
                                        </h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded">
                                                SN: {asset.serial_number || '---'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="p-3 bg-blue-600/10 text-blue-400 rounded-2xl group-hover:rotate-12 transition-transform">
                                        <Wrench className="w-5 h-5" />
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    {/* Technician Info */}
                                    <div className="flex items-center gap-4 bg-white/60 p-4 rounded-2xl border border-slate-200/40 relative group/tech">
                                        <div className="w-12 h-12 rounded-full bg-blue-600/20 flex items-center justify-center text-blue-400 text-lg font-black shrink-0">
                                            {technician ? technician.nome.charAt(0) : '?'}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Responsável</p>
                                            <p className="text-sm font-bold text-slate-900 truncate">{technician?.nome || 'Desconhecido'}</p>
                                            <p className="text-xs text-slate-500 font-medium">Oficina Central</p>
                                        </div>
                                        <ChevronRight className="w-5 h-5 text-slate-700 group-hover/tech:text-blue-500 transition-colors shrink-0" />
                                    </div>

                                    {/* Date/Info */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/50">
                                            <div className="flex items-center gap-2 text-slate-500 mb-1">
                                                <Calendar className="w-3 h-3 text-blue-500" />
                                                <span className="text-[8px] font-black uppercase tracking-widest">Atribuído em</span>
                                            </div>
                                            <p className="text-xs font-bold text-slate-200">
                                                {asset.updated_at ? new Date(asset.updated_at).toLocaleDateString('pt-PT') : '---'}
                                            </p>
                                        </div>
                                        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/50">
                                            <div className="flex items-center gap-2 text-slate-500 mb-1">
                                                <Info className="w-3 h-3 text-blue-500" />
                                                <span className="text-[8px] font-black uppercase tracking-widest">Estado</span>
                                            </div>
                                            <p className="text-xs font-bold text-blue-400 uppercase tracking-tighter">Em Uso</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Action Bar */}
                            <div className="mt-auto p-4 bg-white/20 border-t border-slate-200/50 flex items-center gap-2">
                                <button
                                    onClick={() => assignWorkshopAsset(asset.id, null)}
                                    className="flex-1 bg-slate-100 hover:bg-slate-700 text-slate-300 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-200 transition-all flex items-center justify-center gap-2"
                                >
                                    <ArrowLeftRight className="w-4 h-4" />
                                    Devolver
                                </button>
                                <button className="p-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl transition-all shadow-lg shadow-blue-600/20">
                                    <ExternalLink className="w-4 h-4 text-slate-900" />
                                </button>
                            </div>
                        </div>
                    );
                })}

                {filteredAssets.length === 0 && (
                    <div className="col-span-full py-20 bg-white/90/20 border border-slate-200/50 rounded-3xl flex flex-col items-center justify-center">
                        <ShieldCheck className="w-12 h-12 text-slate-700 mb-4 opacity-20" />
                        <p className="text-sm font-black text-slate-500 uppercase tracking-widest italic">Nenhuma ferramenta atribuída</p>
                    </div>
                )}
            </div>
        </div>
    );
}
