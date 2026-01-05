import React, { useState } from 'react';
import { useWorkshop } from '../../contexts/WorkshopContext';
import { Plus, Trash2, Building2, MapPin } from 'lucide-react';
import type { CentroCusto } from '../../types';

export default function CentrosCustos() {
    const { centrosCustos, addCentroCusto, deleteCentroCusto } = useWorkshop();
    const [showForm, setShowForm] = useState(false);

    // Form State
    const [nome, setNome] = useState('');
    const [localizacao, setLocalizacao] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!nome) return;

        const newCC: CentroCusto = {
            id: crypto.randomUUID(),
            nome,
            localizacao
        };

        addCentroCusto(newCC);
        setShowForm(false);
        setNome('');
        setLocalizacao('');
    };

    return (
        <div className="h-full overflow-y-auto custom-scrollbar p-6 space-y-8">
            {/* Header */}
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                        Centros de Custos
                    </h1>
                    <p className="text-slate-400 mt-1">Gerir escritórios e locais de trabalho para atribuição de despesas</p>
                </div>
                <button
                    onClick={() => setShowForm(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-all"
                >
                    <Plus className="w-4 h-4" />
                    Novo Centro de Custo
                </button>
            </div>

            {/* List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {centrosCustos.length === 0 ? (
                    <div className="col-span-full flex flex-col items-center justify-center p-12 bg-[#1e293b]/50 rounded-2xl border border-dashed border-slate-700">
                        <Building2 className="w-12 h-12 text-slate-500 mb-4" />
                        <p className="text-slate-400">Nenhum centro de custo registado</p>
                    </div>
                ) : (
                    centrosCustos.map(cc => (
                        <div key={cc.id} className="bg-[#1e293b] p-6 rounded-2xl border border-slate-700 relative group">
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-blue-500/10 rounded-xl">
                                        <Building2 className="w-6 h-6 text-blue-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-semibold text-white">{cc.nome}</h3>
                                        {cc.localizacao && (
                                            <div className="flex items-center gap-2 text-slate-400 mt-1 text-sm">
                                                <MapPin className="w-3 h-3" />
                                                <span>{cc.localizacao}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <button
                                    onClick={() => deleteCentroCusto(cc.id)}
                                    className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Modal */}
            {showForm && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-[#1e293b] w-full max-w-md rounded-2xl border border-slate-700 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-700">
                            <h2 className="text-xl font-bold text-white">Novo Centro de Custo</h2>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Nome / Escritório</label>
                                <input
                                    type="text"
                                    required
                                    value={nome}
                                    onChange={e => setNome(e.target.value)}
                                    className="w-full bg-[#0f172a] border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500"
                                    placeholder="Ex: Escritório Lisboa"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Localização (Opcional)</label>
                                <input
                                    type="text"
                                    value={localizacao}
                                    onChange={e => setLocalizacao(e.target.value)}
                                    className="w-full bg-[#0f172a] border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500"
                                    placeholder="Ex: Av. da Liberdade"
                                />
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setShowForm(false)}
                                    className="flex-1 px-4 py-2.5 text-slate-300 hover:bg-slate-700 rounded-lg transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors"
                                >
                                    Criar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
