import { useState } from 'react';
import {
    Wrench, Plus, Search,
    Settings, UserPlus,
    AlertCircle, ShieldCheck,
    History, MapPin, Tag,
    Info, ExternalLink, X
} from 'lucide-react';
import { useWorkshop } from '../../contexts/WorkshopContext';

export default function WorkshopAssets() {
    const { workshopAssets, refreshInventoryData, motoristas, addWorkshopAsset } = useWorkshop();
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [newAsset, setNewAsset] = useState({
        name: '',
        category: '',
        serial_number: '',
        purchase_date: '',
        purchase_value: 0,
        status: 'available' as const,
        location: '',
        notes: ''
    });

    const filteredAssets = workshopAssets.filter(asset => {
        const matchesSearch = asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (asset.serial_number && asset.serial_number.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchesStatus = statusFilter === 'all' || asset.status === statusFilter;

        return matchesSearch && matchesStatus;
    });

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'available': return 'bg-green-500/10 text-green-400 border-green-500/20';
            case 'assigned': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
            case 'maintenance': return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
            case 'retired': return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
            default: return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'available': return 'Disponível';
            case 'assigned': return 'Atribuído';
            case 'maintenance': return 'Manutenção';
            case 'retired': return 'Abatido';
            default: return status;
        }
    };

    const handleCreateAsset = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newAsset.name.trim()) return;

        setIsSaving(true);
        try {
            await addWorkshopAsset({
                name: newAsset.name.trim(),
                category: newAsset.category.trim() || undefined,
                serial_number: newAsset.serial_number.trim() || undefined,
                purchase_date: newAsset.purchase_date || undefined,
                purchase_value: Number(newAsset.purchase_value) > 0 ? Number(newAsset.purchase_value) : undefined,
                assigned_technician_id: null,
                status: newAsset.status,
                location: newAsset.location.trim() || undefined,
                notes: newAsset.notes.trim() || undefined
            });
            setShowCreateModal(false);
            setNewAsset({
                name: '',
                category: '',
                serial_number: '',
                purchase_date: '',
                purchase_value: 0,
                status: 'available',
                location: '',
                notes: ''
            });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header Panel */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                        <div className="p-2 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-600/20">
                            <Wrench className="w-6 h-6 text-white" />
                        </div>
                        Inventário de Oficina
                    </h1>
                    <p className="text-slate-400 mt-1 flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4" />
                        Gestão de ferramentas, equipamentos e ativos fixos
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={refreshInventoryData}
                        className="h-11 w-11 inline-flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all border border-slate-700"
                    >
                        <History className="w-5 h-5" />
                    </button>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="h-11 px-5 inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shadow-lg shadow-indigo-600/25 transition-all"
                    >
                        <Plus className="w-5 h-5" />
                        Novo Equipamento
                    </button>
                </div>
            </div>

            {/* Stats Summary */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                    { label: 'Total Ativos', val: workshopAssets.length, icon: Wrench, color: 'indigo' },
                    { label: 'Em Uso', val: workshopAssets.filter(a => a.status === 'assigned').length, icon: UserPlus, color: 'blue' },
                    { label: 'Disponíveis', val: workshopAssets.filter(a => a.status === 'available').length, icon: ShieldCheck, color: 'green' },
                    { label: 'Manutenção', val: workshopAssets.filter(a => a.status === 'maintenance').length, icon: AlertCircle, color: 'orange' },
                ].map((stat, i) => (
                    <div key={i} className="bg-slate-900/40 border border-slate-800/50 p-5 rounded-3xl group">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{stat.label}</p>
                                <p className="text-2xl font-black text-white mt-1">{stat.val}</p>
                            </div>
                            <div className={`p-2 rounded-xl bg-${stat.color}-600/10 text-${stat.color}-400 group-hover:scale-110 transition-transform`}>
                                <stat.icon className="w-5 h-5" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Search & Filter */}
            <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800/60 p-4 rounded-2xl flex flex-col md:flex-row gap-4">
                <div className="relative flex-1 group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-indigo-500 transition-colors" />
                    <input
                        type="text"
                        placeholder="Procurar por nome ou número de série..."
                        className="w-full bg-slate-950/50 border border-slate-800 rounded-xl pl-12 pr-4 py-3 text-slate-200 outline-none focus:ring-2 focus:ring-indigo-600/40 transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0">
                    {['all', 'available', 'assigned', 'maintenance', 'retired'].map(status => (
                        <button
                            key={status}
                            onClick={() => setStatusFilter(status)}
                            className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border whitespace-nowrap ${statusFilter === status
                                ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20'
                                : 'bg-slate-800/50 border-slate-700 text-slate-500 hover:text-slate-300'
                                }`}
                        >
                            {status === 'all' ? 'Todos' : getStatusLabel(status)}
                        </button>
                    ))}
                </div>
            </div>

            {/* Assets Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredAssets.map(asset => {
                    const technician = motoristas.find(m => m.id === asset.assigned_technician_id);

                    return (
                        <div key={asset.id} className="group bg-slate-900/30 hover:bg-slate-900/50 border border-slate-800/50 hover:border-indigo-600/30 rounded-3xl p-6 transition-all duration-500 relative flex flex-col">
                            <div className="flex items-start justify-between mb-4">
                                <div className={`p-3 rounded-2xl ${getStatusColor(asset.status)} transition-transform group-hover:scale-110`}>
                                    <Wrench className="w-6 h-6" />
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                    <div className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${getStatusColor(asset.status)}`}>
                                        {getStatusLabel(asset.status)}
                                    </div>
                                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-tighter">
                                        SN: {asset.serial_number || '---'}
                                    </span>
                                </div>
                            </div>

                            <h3 className="text-lg font-black text-white group-hover:text-indigo-400 transition-colors mb-2 line-clamp-1">
                                {asset.name}
                            </h3>

                            <div className="space-y-3 mb-6">
                                <div className="flex items-center gap-2 text-slate-500 px-2 py-1.5 bg-slate-800/30 rounded-lg border border-slate-800/50">
                                    <Tag className="w-3.5 h-3.5 text-indigo-500" />
                                    <span className="text-xs font-bold uppercase tracking-tighter">{asset.category || 'Geral'}</span>
                                </div>
                                <div className="flex items-center gap-2 text-slate-500 px-2 py-1.5 bg-slate-800/30 rounded-lg border border-slate-800/50">
                                    <MapPin className="w-3.5 h-3.5 text-indigo-500" />
                                    <span className="text-xs font-bold uppercase tracking-tighter">{asset.location || 'Oficina Geral'}</span>
                                </div>
                            </div>

                            <div className="mt-auto pt-4 border-t border-slate-800/50">
                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Responsável Atual</p>
                                <div className="flex items-center gap-3 bg-slate-950/40 p-2 rounded-2xl hover:bg-slate-950/60 transition-colors cursor-pointer border border-slate-800/30">
                                    <div className="w-8 h-8 rounded-xl bg-indigo-600/20 flex items-center justify-center text-indigo-400 font-black text-sm">
                                        {technician ? technician.nome.charAt(0) : '?'}
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <span className="text-xs font-bold text-slate-200 truncate">
                                            {technician ? technician.nome : 'Disponível'}
                                        </span>
                                        <span className="text-[9px] font-medium text-slate-500">
                                            {technician ? 'Técnico Oficina' : 'Sem atribuição'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Hover Actions */}
                            <div className="mt-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity translate-y-2 group-hover:translate-y-0">
                                <button className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest border border-slate-700 transition-all flex items-center justify-center gap-2">
                                    <Settings className="w-3.5 h-3.5" />
                                    Gerir
                                </button>
                                <button className="bg-indigo-600 hover:bg-indigo-500 p-2.5 rounded-xl transition-all shadow-lg shadow-indigo-600/20">
                                    <ExternalLink className="w-4 h-4 text-white" />
                                </button>
                            </div>
                        </div>
                    );
                })}

                {filteredAssets.length === 0 && (
                    <div className="col-span-full py-20 bg-slate-900/20 border border-slate-800/50 rounded-3xl flex flex-col items-center justify-center">
                        <Info className="w-12 h-12 text-slate-700 mb-4" />
                        <p className="text-sm font-black text-slate-500 uppercase tracking-widest">Nenhum ativo encontrado</p>
                    </div>
                )}
            </div>

            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                    <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl overflow-hidden">
                        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800">
                            <h3 className="text-xl font-black text-white">Novo Equipamento</h3>
                            <button
                                type="button"
                                onClick={() => setShowCreateModal(false)}
                                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateAsset} className="p-6 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5 md:col-span-2">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Nome</label>
                                    <input
                                        required
                                        value={newAsset.name}
                                        onChange={(e) => setNewAsset(prev => ({ ...prev, name: e.target.value }))}
                                        className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/40"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Categoria</label>
                                    <input
                                        value={newAsset.category}
                                        onChange={(e) => setNewAsset(prev => ({ ...prev, category: e.target.value }))}
                                        className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/40"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Nº Série</label>
                                    <input
                                        value={newAsset.serial_number}
                                        onChange={(e) => setNewAsset(prev => ({ ...prev, serial_number: e.target.value }))}
                                        className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/40"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Data Compra</label>
                                    <input
                                        type="date"
                                        value={newAsset.purchase_date}
                                        onChange={(e) => setNewAsset(prev => ({ ...prev, purchase_date: e.target.value }))}
                                        className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/40"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Valor Compra (€)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={newAsset.purchase_value}
                                        onChange={(e) => setNewAsset(prev => ({ ...prev, purchase_value: Number(e.target.value) || 0 }))}
                                        className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/40"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Localização</label>
                                    <input
                                        value={newAsset.location}
                                        onChange={(e) => setNewAsset(prev => ({ ...prev, location: e.target.value }))}
                                        className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/40"
                                    />
                                </div>

                                <div className="space-y-1.5 md:col-span-2">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Notas</label>
                                    <textarea
                                        value={newAsset.notes}
                                        onChange={(e) => setNewAsset(prev => ({ ...prev, notes: e.target.value }))}
                                        className="w-full px-4 py-3 h-24 resize-none bg-slate-950 border border-slate-700 rounded-xl text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/40"
                                    />
                                </div>
                            </div>

                            <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowCreateModal(false)}
                                    className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white rounded-xl font-bold transition-colors"
                                >
                                    {isSaving ? 'A guardar...' : 'Guardar equipamento'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
