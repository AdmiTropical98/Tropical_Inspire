import { useState } from 'react';
import {
    Plus, Search, AlertTriangle, Box,
    ArrowUpRight, MoreHorizontal,
    Settings, History, Package,
    Tag, DollarSign, Layers, X
} from 'lucide-react';
import { useWorkshop } from '../../contexts/WorkshopContext';
import { formatCurrency } from '../../utils/format';

export default function StockParts() {
    const { stockItems, refreshInventoryData, addStockItem } = useWorkshop();
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [showLowStockOnly, setShowLowStockOnly] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [newPart, setNewPart] = useState({
        name: '',
        sku: '',
        category: '',
        stock_quantity: 0,
        minimum_stock: 0,
        average_cost: 0,
        location: ''
    });

    const categories = Array.from(new Set(stockItems.map(item => item.category).filter(Boolean)));

    const filteredItems = stockItems.filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (item.sku && item.sku.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
        const matchesLowStock = !showLowStockOnly || item.stock_quantity <= item.minimum_stock;

        return matchesSearch && matchesCategory && matchesLowStock;
    });

    const handleCreatePart = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newPart.name.trim()) return;

        setIsSaving(true);
        try {
            await addStockItem({
                name: newPart.name.trim(),
                sku: newPart.sku.trim() || undefined,
                category: newPart.category.trim() || undefined,
                stock_quantity: Math.max(0, Number(newPart.stock_quantity) || 0),
                minimum_stock: Math.max(0, Number(newPart.minimum_stock) || 0),
                average_cost: Math.max(0, Number(newPart.average_cost) || 0),
                location: newPart.location.trim() || undefined,
                supplier_id: undefined
            });
            setShowCreateModal(false);
            setNewPart({
                name: '',
                sku: '',
                category: '',
                stock_quantity: 0,
                minimum_stock: 0,
                average_cost: 0,
                location: ''
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
                        <div className="p-2 bg-blue-600 rounded-xl shadow-lg shadow-blue-600/20">
                            <Box className="w-6 h-6 text-white" />
                        </div>
                        Stock de Peças
                    </h1>
                    <p className="text-slate-400 mt-1 flex items-center gap-2">
                        <Layers className="w-4 h-4" />
                        Peças consumíveis e consumos de oficina
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
                        className="h-11 px-5 inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold shadow-lg shadow-blue-600/25 transition-all"
                    >
                        <Plus className="w-5 h-5" />
                        Nova Peça
                    </button>
                </div>
            </div>

            {/* Stats Quick View */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                    {
                        label: 'Total de Peças',
                        count: stockItems.length,
                        icon: Package,
                        color: 'blue'
                    },
                    {
                        label: 'Valor em Stock',
                        count: formatCurrency(stockItems.reduce((acc, i) => acc + (i.stock_quantity * i.average_cost), 0)),
                        icon: DollarSign,
                        color: 'green'
                    },
                    {
                        label: 'Stock Crítico',
                        count: stockItems.filter(i => i.stock_quantity <= i.minimum_stock).length,
                        icon: AlertTriangle,
                        color: 'orange'
                    },
                    {
                        label: 'Categorias',
                        count: categories.length,
                        icon: Tag,
                        color: 'indigo'
                    }
                ].map((stat, idx) => (
                    <div key={idx} className="bg-slate-900/50 backdrop-blur-md border border-slate-800/50 p-5 rounded-2xl relative overflow-hidden group">
                        <div className={`absolute -right-4 -top-4 w-24 h-24 bg-${stat.color}-600/10 rounded-full blur-2xl group-hover:bg-${stat.color}-600/20 transition-all`} />
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">{stat.label}</p>
                                <p className="text-2xl font-black text-white mt-1">{stat.count}</p>
                            </div>
                            <div className={`p-2 bg-${stat.color}-600/10 rounded-lg text-${stat.color}-400`}>
                                <stat.icon className="w-5 h-5" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Search & Filter Bar */}
            <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800/60 p-4 rounded-2xl flex flex-col md:flex-row gap-4 items-center">
                <div className="relative flex-1 group w-full">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
                    <input
                        type="text"
                        placeholder="Procurar por nome, SKU ou categoria..."
                        className="w-full bg-slate-950/50 border border-slate-800 rounded-xl pl-12 pr-4 py-3 text-slate-200 outline-none focus:ring-2 focus:ring-blue-600/40 focus:border-blue-600/50 transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <select
                        className="bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-slate-300 outline-none focus:ring-2 focus:ring-blue-600/40 min-w-[160px]"
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                    >
                        <option value="all">Todas as Categorias</option>
                        {categories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                        ))}
                    </select>

                    <button
                        onClick={() => setShowLowStockOnly(!showLowStockOnly)}
                        className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold transition-all border ${showLowStockOnly
                            ? 'bg-orange-500/20 border-orange-500/50 text-orange-400'
                            : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-slate-800'
                            }`}
                    >
                        <AlertTriangle className="w-4 h-4" />
                        Stock Baixo
                    </button>
                </div>
            </div>

            {/* Grid Display */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredItems.map(item => (
                    <div
                        key={item.id}
                        className="group bg-slate-900/40 hover:bg-slate-900/60 border border-slate-800/50 hover:border-blue-600/30 rounded-3xl p-6 transition-all duration-300 relative overflow-hidden"
                    >
                        {/* Visual Accents */}
                        <div className={`absolute top-0 right-0 w-2 h-full ${item.stock_quantity <= item.minimum_stock ? 'bg-orange-600' : 'bg-blue-600/20'
                            } opacity-50`} />

                        <div className="flex flex-col h-full">
                            <div className="flex items-start justify-between mb-4">
                                <div className="p-3 bg-slate-800/80 rounded-2xl text-blue-400 group-hover:scale-110 transition-transform">
                                    <Box className="w-6 h-6" />
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-800/50 px-2 py-1 rounded-md">
                                        {item.sku || 'Sem SKU'}
                                    </span>
                                    <button className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-500 transition-colors">
                                        <MoreHorizontal className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            <h3 className="text-lg font-bold text-white mb-1 group-hover:text-blue-400 transition-colors line-clamp-1">
                                {item.name}
                            </h3>
                            <p className="text-slate-500 text-xs flex items-center gap-1.5 mb-6 uppercase font-bold tracking-tighter">
                                <Tag className="w-3 h-3 text-blue-500" />
                                {item.category || 'Indefinido'}
                            </p>

                            <div className="mt-auto space-y-4">
                                {/* Stock Level Indicator */}
                                <div className="space-y-1.5">
                                    <div className="flex justify-between items-end">
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Stock Atual</span>
                                        <span className={`text-sm font-black ${item.stock_quantity <= item.minimum_stock ? 'text-orange-500' : 'text-blue-400'
                                            }`}>
                                            {item.stock_quantity} un
                                        </span>
                                    </div>
                                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full transition-all duration-1000 ${item.stock_quantity <= item.minimum_stock ? 'bg-orange-500' : 'bg-blue-600'
                                                }`}
                                            style={{ width: `${Math.min((item.stock_quantity / (item.minimum_stock || 1)) * 50, 100)}%` }}
                                        />
                                    </div>
                                </div>

                                {/* Footer Info */}
                                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-800/50">
                                    <div>
                                        <p className="text-slate-500 text-[9px] font-black uppercase tracking-wider mb-1">Custo Médio</p>
                                        <p className="text-slate-200 text-sm font-bold">{formatCurrency(item.average_cost)}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-slate-500 text-[9px] font-black uppercase tracking-wider mb-1">Localização</p>
                                        <p className="text-slate-200 text-sm font-bold truncate">{item.location || '---'}</p>
                                    </div>
                                </div>

                                {/* Quick Actions Hidden by default, show on hover */}
                                <div className="flex items-center gap-2 pt-2 opacity-0 group-hover:opacity-100 transition-opacity translate-y-2 group-hover:translate-y-0 duration-300">
                                    <button className="flex-1 bg-slate-800 hover:bg-slate-700 text-xs font-bold py-2 rounded-xl border border-slate-700 transition-all flex items-center justify-center gap-2">
                                        <Settings className="w-3.5 h-3.5" />
                                        Editar
                                    </button>
                                    <button className="bg-blue-600 hover:bg-blue-500 p-2 rounded-xl transition-all shadow-lg shadow-blue-600/20">
                                        <ArrowUpRight className="w-4 h-4 text-white" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}

                {filteredItems.length === 0 && (
                    <div className="col-span-full py-20 flex flex-col items-center justify-center text-slate-500">
                        <div className="w-20 h-20 bg-slate-900 rounded-full flex items-center justify-center mb-4 border border-slate-800">
                            <Search className="w-10 h-10 opacity-20" />
                        </div>
                        <p className="font-bold uppercase tracking-widest text-xs">Nenhuma peça encontrada</p>
                        <p className="text-[10px] mt-2 brightness-75">Tente ajustar os seus filtros de pesquisa</p>
                    </div>
                )}
            </div>

            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                    <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl overflow-hidden">
                        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800">
                            <h3 className="text-xl font-black text-white">Nova Peça</h3>
                            <button
                                type="button"
                                onClick={() => setShowCreateModal(false)}
                                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleCreatePart} className="p-6 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5 md:col-span-2">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Nome</label>
                                    <input
                                        required
                                        value={newPart.name}
                                        onChange={(e) => setNewPart(prev => ({ ...prev, name: e.target.value }))}
                                        className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 outline-none focus:ring-2 focus:ring-blue-500/40"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">SKU</label>
                                    <input
                                        value={newPart.sku}
                                        onChange={(e) => setNewPart(prev => ({ ...prev, sku: e.target.value }))}
                                        className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 outline-none focus:ring-2 focus:ring-blue-500/40"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Categoria</label>
                                    <input
                                        value={newPart.category}
                                        onChange={(e) => setNewPart(prev => ({ ...prev, category: e.target.value }))}
                                        className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 outline-none focus:ring-2 focus:ring-blue-500/40"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Qtd Inicial</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={newPart.stock_quantity}
                                        onChange={(e) => setNewPart(prev => ({ ...prev, stock_quantity: Number(e.target.value) || 0 }))}
                                        className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 outline-none focus:ring-2 focus:ring-blue-500/40"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Stock Mínimo</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={newPart.minimum_stock}
                                        onChange={(e) => setNewPart(prev => ({ ...prev, minimum_stock: Number(e.target.value) || 0 }))}
                                        className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 outline-none focus:ring-2 focus:ring-blue-500/40"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Custo Médio (€)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={newPart.average_cost}
                                        onChange={(e) => setNewPart(prev => ({ ...prev, average_cost: Number(e.target.value) || 0 }))}
                                        className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 outline-none focus:ring-2 focus:ring-blue-500/40"
                                    />
                                </div>

                                <div className="space-y-1.5 md:col-span-2">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Localização</label>
                                    <input
                                        value={newPart.location}
                                        onChange={(e) => setNewPart(prev => ({ ...prev, location: e.target.value }))}
                                        className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 outline-none focus:ring-2 focus:ring-blue-500/40"
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
                                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white rounded-xl font-bold transition-colors"
                                >
                                    {isSaving ? 'A guardar...' : 'Guardar peça'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
}
