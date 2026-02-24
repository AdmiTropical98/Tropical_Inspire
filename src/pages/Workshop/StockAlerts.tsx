import {
    BellRing, AlertTriangle, Package,
    ShoppingCart, ArrowRight,
    ShieldAlert, Box, Info, Phone, Mail
} from 'lucide-react';
import { useWorkshop } from '../../contexts/WorkshopContext';
import { formatCurrency } from '../../utils/format';

export default function StockAlerts() {
    const { workshopItems } = useWorkshop();

    const lowStockItems = workshopItems.filter(item => item.stock_quantity <= item.minimum_stock);
    const criticalItems = lowStockItems.filter(item => item.stock_quantity === 0);
    const warningItems = lowStockItems.filter(item => item.stock_quantity > 0);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                        <div className="p-2 bg-orange-600 rounded-xl shadow-lg shadow-orange-600/20">
                            <BellRing className="w-6 h-6 text-white" />
                        </div>
                        Alertas de Stock
                    </h1>
                    <p className="text-slate-400 mt-1 flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4" />
                        Vigilância ativa sobre níveis críticos de inventário
                    </p>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-red-500/10 border border-red-500/20 p-6 rounded-3xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-red-500/10 transition-all" />
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 bg-red-500 text-white rounded-2xl shadow-lg shadow-red-500/20">
                            <AlertTriangle className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-red-400 text-xs font-black uppercase tracking-widest">Stock Esgotado</p>
                            <p className="text-2xl font-black text-white">{criticalItems.length}</p>
                        </div>
                    </div>
                    <p className="text-red-400/60 text-xs font-medium leading-relaxed">
                        Itens com quantidade ZERO. Reposição imediata necessária para evitar interrupções.
                    </p>
                </div>

                <div className="bg-orange-500/10 border border-orange-500/20 p-6 rounded-3xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-orange-500/10 transition-all" />
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 bg-orange-500 text-white rounded-2xl shadow-lg shadow-orange-500/20">
                            <Package className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-orange-400 text-xs font-black uppercase tracking-widest">Aviso de Nível</p>
                            <p className="text-2xl font-black text-white">{warningItems.length}</p>
                        </div>
                    </div>
                    <p className="text-orange-400/60 text-xs font-medium leading-relaxed">
                        Itens abaixo do stock mínimo de segurança. Planeie a próxima aquisição.
                    </p>
                </div>

                <div className="bg-blue-500/10 border border-blue-500/20 p-6 rounded-3xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-blue-500/10 transition-all" />
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 bg-blue-500 text-white rounded-2xl shadow-lg shadow-blue-500/20">
                            <ShoppingCart className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-blue-400 text-xs font-black uppercase tracking-widest">Valor de Reposição</p>
                            <p className="text-2xl font-black text-white">
                                {formatCurrency(lowStockItems.reduce((acc, i) => acc + (i.minimum_stock * 2 * i.average_cost), 0))}
                            </p>
                        </div>
                    </div>
                    <p className="text-blue-400/60 text-xs font-medium leading-relaxed">
                        Estimativa de custo para basear o stock no dobro do nível mínimo.
                    </p>
                </div>
            </div>

            {/* Item List */}
            <div className="space-y-4">
                {lowStockItems.length === 0 ? (
                    <div className="bg-slate-900/40 border border-slate-800/60 p-20 rounded-3xl flex flex-col items-center justify-center text-center">
                        <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mb-6">
                            <ShieldAlert className="w-10 h-10 text-green-500 opacity-50" />
                        </div>
                        <h3 className="text-xl font-black text-white uppercase tracking-tight">Stock Seguro</h3>
                        <p className="text-slate-500 mt-2 max-w-sm">
                            Não existem alertas de stock ativos neste momento. Todos os itens estão acima do nível mínimo definido.
                        </p>
                    </div>
                ) : (
                    lowStockItems.map(item => (
                        <div
                            key={item.id}
                            className="group bg-slate-900/40 hover:bg-slate-900/60 border border-slate-800/60 p-6 rounded-3xl transition-all duration-300 flex flex-col md:flex-row md:items-center gap-6"
                        >
                            <div className={`p-4 rounded-2xl flex-shrink-0 ${item.stock_quantity === 0 ? 'bg-red-500/20 text-red-500' : 'bg-orange-500/20 text-orange-500'
                                }`}>
                                <Box className="w-8 h-8" />
                            </div>

                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-3 mb-1">
                                    <h3 className="text-lg font-black text-white truncate">{item.name}</h3>
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${item.stock_quantity === 0
                                            ? 'bg-red-500/10 border-red-500/30 text-red-500'
                                            : 'bg-orange-500/10 border-orange-500/30 text-orange-500'
                                        }`}>
                                        {item.stock_quantity === 0 ? 'Crítico' : 'Baixo'}
                                    </span>
                                </div>
                                <div className="flex flex-wrap items-center gap-4">
                                    <span className="text-xs text-slate-500 font-bold uppercase tracking-tighter flex items-center gap-1.5">
                                        <Info className="w-3.5 h-3.5" />
                                        SKU: {item.sku || 'N/A'}
                                    </span>
                                    <span className="text-xs text-slate-500 font-bold uppercase tracking-tighter flex items-center gap-1.5">
                                        <Package className="w-3.5 h-3.5 text-blue-500" />
                                        Categoria: {item.category || 'N/A'}
                                    </span>
                                </div>
                            </div>

                            <div className="flex flex-col md:items-end gap-1 px-6 border-l border-slate-800">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Stock / Mínimo</p>
                                <div className="flex items-baseline gap-1">
                                    <span className={`text-2xl font-black ${item.stock_quantity === 0 ? 'text-red-500' : 'text-orange-500'
                                        }`}>{item.stock_quantity}</span>
                                    <span className="text-slate-500 text-sm font-bold">/ {item.minimum_stock} un</span>
                                </div>
                            </div>

                            <div className="flex flex-col gap-2 min-w-[200px]">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 group-hover:text-blue-400 transition-colors">Fornecedor Preferencial</p>
                                <div className="flex flex-col gap-1.5">
                                    <p className="text-sm font-bold text-slate-200 truncate">
                                        {item.supplier?.nome || 'Não definido'}
                                    </p>
                                    {item.supplier && (
                                        <div className="flex items-center gap-2">
                                            <button className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 transition-all border border-slate-700">
                                                <Phone className="w-3 h-3" />
                                            </button>
                                            <button className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 transition-all border border-slate-700">
                                                <Mail className="w-3 h-3" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <button className="p-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl shadow-lg shadow-blue-600/20 transition-all">
                                    <ShoppingCart className="w-5 h-5" />
                                </button>
                                <button className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-2xl border border-slate-700 transition-all">
                                    <ArrowRight className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Helpful Tips Section */}
            <div className="bg-indigo-600/5 border border-indigo-600/10 p-6 rounded-3xl mt-8">
                <div className="flex items-start gap-4">
                    <div className="p-2 bg-indigo-600/20 rounded-xl text-indigo-400">
                        <Info className="w-5 h-5" />
                    </div>
                    <div>
                        <h4 className="text-sm font-black text-white uppercase tracking-widest mb-1">Como funcionam os alertas?</h4>
                        <p className="text-xs text-slate-500 leading-relaxed font-medium">
                            Os alertas são gerados automaticamente sempre que a quantidade em stock é igual ou inferior ao <span className="text-indigo-400 font-bold">Stock Mínimo</span> definido na ficha do item.
                            Para itens críticos (quantidade zero), o sistema prioriza o destaque visual. Recomendamos a revisão semanal deste painel.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
