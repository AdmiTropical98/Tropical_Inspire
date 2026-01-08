import { useState, useMemo } from 'react';
import { X, Search, Filter, CheckSquare, Square } from 'lucide-react';
import type { Viatura } from '../../types';

interface VehicleSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    viaturas: Viatura[];
    selectedIds: string[];
    onConfirm: (ids: string[]) => void;
}

export default function VehicleSelectionModal({ isOpen, onClose, viaturas, selectedIds, onConfirm }: VehicleSelectionModalProps) {
    const [localSelected, setLocalSelected] = useState<string[]>(selectedIds);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('all'); // all, disponivel, ocupado...

    // Sync when opening (optional, usually handled by parent passing selectedIds, but local state makes cancelling easier)
    // For simplicity, we initialize localSelected with selectedIds when the component mounts or props change can be tricky.
    // Better to use a useEffect or just let the user start fresh/modified. 
    // Let's assume we want to preserve selection passed in.

    useMemo(() => {
        if (isOpen) setLocalSelected(selectedIds);
    }, [isOpen]);

    const filteredVehicles = viaturas.filter(v => {
        const matchesSearch =
            v.matricula.toLowerCase().includes(searchTerm.toLowerCase()) ||
            v.marca.toLowerCase().includes(searchTerm.toLowerCase()) ||
            v.modelo.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesStatus = filterStatus === 'all' || v.estado === filterStatus || (!v.estado && filterStatus === 'disponivel'); // default to available if undefined

        return matchesSearch && matchesStatus;
    });

    const toggleSelect = (id: string) => {
        setLocalSelected(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const toggleSelectAll = () => {
        const allFilteredIds = filteredVehicles.map(v => v.id);
        const allSelected = allFilteredIds.every(id => localSelected.includes(id));

        if (allSelected) {
            // Deselect all visible
            setLocalSelected(prev => prev.filter(id => !allFilteredIds.includes(id)));
        } else {
            // Select all visible
            const newSelected = [...localSelected];
            allFilteredIds.forEach(id => {
                if (!newSelected.includes(id)) newSelected.push(id);
            });
            setLocalSelected(newSelected);
        }
    };

    const countSelectedVisible = filteredVehicles.filter(v => localSelected.includes(v.id)).length;
    const isAllVisibleSelected = filteredVehicles.length > 0 && countSelectedVisible === filteredVehicles.length;

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-slate-900 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-slate-700 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-800/50 rounded-t-2xl">
                    <div>
                        <h2 className="text-xl font-bold text-white">Seleção de Viaturas em Massa</h2>
                        <p className="text-sm text-slate-400">Selecione as viaturas para o aluguer</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-2 hover:bg-slate-700 rounded-lg">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Filters */}
                <div className="p-4 border-b border-slate-800 flex flex-col md:flex-row gap-4 bg-slate-900/50">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Pesquisar por matrícula, marca ou modelo..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 font-medium"
                        />
                    </div>
                    <div className="relative w-full md:w-48">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 font-medium appearance-none"
                        >
                            <option value="all">Todos os Estados</option>
                            <option value="disponivel">Disponível</option>
                            <option value="em_uso">Em Uso</option>
                            <option value="em_manutencao">Manutenção</option>
                        </select>
                    </div>
                </div>

                {/* Grid Header / Select All */}
                <div className="px-6 py-3 bg-slate-800/30 flex items-center justify-between border-b border-slate-800">
                    <button
                        onClick={toggleSelectAll}
                        className="flex items-center gap-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
                    >
                        {isAllVisibleSelected ? <CheckSquare className="w-5 h-5 text-blue-500" /> : <Square className="w-5 h-5 text-slate-500" />}
                        {isAllVisibleSelected ? 'Deselecionar Todos' : 'Selecionar Todos Visíveis'}
                    </button>
                    <span className="text-sm font-medium text-blue-400 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">
                        {localSelected.length} viaturas selecionadas
                    </span>
                </div>

                {/* Content Grid */}
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-slate-950/30">
                    {filteredVehicles.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {filteredVehicles.map(v => {
                                const isSelected = localSelected.includes(v.id);
                                return (
                                    <div
                                        key={v.id}
                                        onClick={() => toggleSelect(v.id)}
                                        className={`
                                            relative p-4 rounded-xl border cursor-pointer transition-all group select-none
                                            ${isSelected
                                                ? 'bg-blue-600/10 border-blue-500 ring-1 ring-blue-500/50'
                                                : 'bg-slate-800/40 border-slate-700 hover:bg-slate-800 hover:border-slate-600'
                                            }
                                        `}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <h3 className={`font-bold ${isSelected ? 'text-blue-400' : 'text-white'}`}>{v.matricula}</h3>
                                                <p className="text-xs text-slate-400">{v.marca} {v.modelo}</p>
                                            </div>
                                            <div className={`
                                                w-5 h-5 rounded flex items-center justify-center border transition-colors
                                                ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-slate-600 bg-slate-900 group-hover:border-slate-500'}
                                            `}>
                                                {isSelected && <X className="w-3 h-3 text-white rotate-45 transform" style={{ transform: 'rotate(0deg)' }}><path d="M20 6L9 17l-5-5" /></X>}
                                                {/* Lucide X is not Check, let's fix icon or just use CSS */}
                                                {isSelected && <CheckSquare className="w-5 h-5 text-white" />}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 mt-2">
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full border ${v.estado === 'em_uso' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                                                v.estado === 'em_manutencao' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                                                    'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                                                }`}>
                                                {v.estado ? v.estado.replace('_', ' ').toUpperCase() : 'DISPONÍVEL'}
                                            </span>
                                            {v.precoDiario && (
                                                <span className="text-xs font-mono text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded ml-auto">
                                                    {v.precoDiario}€/dia
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-48 text-slate-500">
                            <Search className="w-12 h-12 mb-4 opacity-20" />
                            <p>Nenhuma viatura encontrada com os filtros atuais.</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-800 bg-slate-900 flex justify-end gap-3 rounded-b-2xl">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 font-medium transition-all"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={() => onConfirm(localSelected)}
                        className="px-8 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-lg shadow-blue-900/20 transition-all transform active:scale-95"
                    >
                        Confirmar Seleção ({localSelected.length})
                    </button>
                </div>
            </div>
        </div>
    );
}
