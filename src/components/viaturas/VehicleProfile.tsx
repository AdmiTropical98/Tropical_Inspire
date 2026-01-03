import React, { useState } from 'react';
import { X, Save, FileText, Calendar, Plus, Trash2, Shield, Wrench } from 'lucide-react';
import { useWorkshop } from '../../contexts/WorkshopContext';
import type { Viatura, Manutencao, Multa, Seguro } from '../../types';

interface VehicleProfileProps {
    viatura: Viatura;
    onClose: () => void;
}

export default function VehicleProfile({ viatura: initialViatura, onClose }: VehicleProfileProps) {
    const { updateViatura, viaturas, requisicoes } = useWorkshop();

    // Live data from context to handle updates
    const viatura = viaturas.find(v => v.id === initialViatura.id) || initialViatura;

    const [activeTab, setActiveTab] = useState<'detalhes' | 'multas' | 'manutencao' | 'requisicoes'>('detalhes');

    // --- State for Forms ---
    const [showFineForm, setShowFineForm] = useState(false);
    const [newFine, setNewFine] = useState<Partial<Multa>>({
        data: new Date().toISOString().split('T')[0],
        valor: 0,
        motivo: '',
        pago: false
    });

    const [showMaintenanceForm, setShowMaintenanceForm] = useState(false);
    const [newMaintenance, setNewMaintenance] = useState<Partial<Manutencao>>({
        data: new Date().toISOString().split('T')[0],
        tipo: 'preventiva',
        km: 0,
        oficina: '',
        custo: 0,
        descricao: ''
    });

    // Insurance State (editing directly on details tab)
    const [isEditingInsurance, setIsEditingInsurance] = useState(false);
    const [insuranceData, setInsuranceData] = useState<Partial<Seguro>>(viatura.seguro || {
        apolice: '',
        validade: '',
        companhia: ''
    });

    // Filter requisitions for this vehicle
    const vehicleRequisitions = requisicoes.filter(r => r.viaturaId === viatura.id || (r.tipo === 'Viatura' && r.viaturaId === viatura.id));

    // --- Handlers ---

    const handleUpdateInsurance = () => {
        const updatedViatura = {
            ...viatura,
            seguro: insuranceData as Seguro
        };
        updateViatura(updatedViatura);
        setIsEditingInsurance(false);
    };

    const handleAddFine = (e: React.FormEvent) => {
        e.preventDefault();
        const fine: Multa = {
            id: crypto.randomUUID(),
            data: newFine.data!,
            valor: Number(newFine.valor),
            motivo: newFine.motivo!,
            pago: newFine.pago || false,
            obs: newFine.obs
        };

        const updatedViatura = {
            ...viatura,
            multas: [...(viatura.multas || []), fine]
        };

        updateViatura(updatedViatura);
        setShowFineForm(false);
        setNewFine({ data: new Date().toISOString().split('T')[0], valor: 0, motivo: '', pago: false });
    };

    const handleDeleteFine = (fineId: string) => {
        if (!confirm('Tem a certeza que deseja eliminar esta multa?')) return;
        const updatedViatura = {
            ...viatura,
            multas: viatura.multas?.filter(m => m.id !== fineId)
        };
        updateViatura(updatedViatura);
    };

    const handleAddMaintenance = (e: React.FormEvent) => {
        e.preventDefault();
        const maintenance: Manutencao = {
            id: crypto.randomUUID(),
            data: newMaintenance.data!,
            tipo: newMaintenance.tipo as any,
            km: Number(newMaintenance.km),
            oficina: newMaintenance.oficina!,
            custo: Number(newMaintenance.custo),
            descricao: newMaintenance.descricao!
        };

        const updatedViatura = {
            ...viatura,
            manutencoes: [...(viatura.manutencoes || []), maintenance]
        };

        updateViatura(updatedViatura);
        setShowMaintenanceForm(false);
        setNewMaintenance({ data: new Date().toISOString().split('T')[0], tipo: 'preventiva', km: 0, oficina: '', custo: 0, descricao: '' });
    };

    const handleDeleteMaintenance = (mId: string) => {
        if (!confirm('Eliminar registo de manutenção?')) return;
        const updatedViatura = {
            ...viatura,
            manutencoes: viatura.manutencoes?.filter(m => m.id !== mId)
        };
        updateViatura(updatedViatura);
    };

    return (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm transition-all" onClick={onClose}>
            <div
                className="w-full max-w-2xl bg-[#0f172a] border-l border-slate-700 h-full shadow-2xl flex flex-col animate-slide-in-right"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-[#1e293b]">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                            <span className="text-blue-400 font-bold text-lg">{viatura.marca.charAt(0)}</span>
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">{viatura.marca} {viatura.modelo}</h2>
                            <div className="flex items-center gap-2 text-slate-400 text-sm">
                                <span className="bg-slate-800 px-2 py-0.5 rounded border border-slate-700 font-mono text-xs">{viatura.matricula}</span>
                                <span>• {viatura.ano}</span>
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-800 bg-[#1e293b]/50">
                    <button
                        onClick={() => setActiveTab('detalhes')}
                        className={`flex-1 py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'detalhes' ? 'border-blue-500 text-blue-400 bg-blue-500/5' : 'border-transparent text-slate-400 hover:text-white hover:bg-slate-800/50'}`}
                    >
                        Detalhes & Seguro
                    </button>
                    <button
                        onClick={() => setActiveTab('multas')}
                        className={`flex-1 py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'multas' ? 'border-blue-500 text-blue-400 bg-blue-500/5' : 'border-transparent text-slate-400 hover:text-white hover:bg-slate-800/50'}`}
                    >
                        Multas
                    </button>
                    <button
                        onClick={() => setActiveTab('manutencao')}
                        className={`flex-1 py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'manutencao' ? 'border-blue-500 text-blue-400 bg-blue-500/5' : 'border-transparent text-slate-400 hover:text-white hover:bg-slate-800/50'}`}
                    >
                        Manutenções
                    </button>
                    <button
                        onClick={() => setActiveTab('requisicoes')}
                        className={`flex-1 py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'requisicoes' ? 'border-blue-500 text-blue-400 bg-blue-500/5' : 'border-transparent text-slate-400 hover:text-white hover:bg-slate-800/50'}`}
                    >
                        Requisições
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-[#0f172a]">

                    {/* --- DETAILS & INSURANCE --- */}
                    {activeTab === 'detalhes' && (
                        <div className="space-y-8">
                            {/* Insurance Section */}
                            <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-5">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-white font-bold flex items-center gap-2">
                                        <Shield className="w-5 h-5 text-emerald-400" />
                                        Seguro da Viatura
                                    </h3>
                                    {!isEditingInsurance ? (
                                        <button
                                            onClick={() => { setInsuranceData(viatura.seguro || {}); setIsEditingInsurance(true); }}
                                            className="text-xs text-blue-400 hover:text-blue-300 font-medium"
                                        >
                                            Editar
                                        </button>
                                    ) : (
                                        <div className="flex gap-2">
                                            <button onClick={() => setIsEditingInsurance(false)} className="text-xs text-slate-400 hover:text-white">Cancelar</button>
                                            <button onClick={handleUpdateInsurance} className="text-xs text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1">
                                                <Save className="w-3 h-3" /> Guardar
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {isEditingInsurance ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs text-slate-500 font-bold uppercase">Companhia</label>
                                            <input
                                                type="text"
                                                value={insuranceData.companhia || ''}
                                                onChange={e => setInsuranceData({ ...insuranceData, companhia: e.target.value })}
                                                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white mt-1"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-slate-500 font-bold uppercase">Apólice nº</label>
                                            <input
                                                type="text"
                                                value={insuranceData.apolice || ''}
                                                onChange={e => setInsuranceData({ ...insuranceData, apolice: e.target.value })}
                                                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white mt-1"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-slate-500 font-bold uppercase">Validade</label>
                                            <input
                                                type="date"
                                                value={insuranceData.validade || ''}
                                                onChange={e => setInsuranceData({ ...insuranceData, validade: e.target.value })}
                                                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white mt-1"
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    viatura.seguro ? (
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                            <div>
                                                <p className="text-xs text-slate-500 uppercase font-bold">Companhia</p>
                                                <p className="text-white">{viatura.seguro.companhia}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500 uppercase font-bold">Apólice</p>
                                                <p className="text-white font-mono">{viatura.seguro.apolice}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500 uppercase font-bold">Validade</p>
                                                <p className={`font-medium ${new Date(viatura.seguro.validade) < new Date() ? 'text-red-400' : 'text-white'}`}>
                                                    {viatura.seguro.validade}
                                                </p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-center py-4 text-slate-500 text-sm border border-dashed border-slate-700 rounded-lg">
                                            Sem dados de seguro registados.
                                        </div>
                                    )
                                )}
                            </div>

                            {/* Documents Placeholder */}
                            <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-5">
                                <h3 className="text-white font-bold flex items-center gap-2 mb-4">
                                    <FileText className="w-5 h-5 text-blue-400" />
                                    Documentos
                                </h3>
                                <div className="text-center py-6 text-slate-500 text-sm border border-dashed border-slate-700 rounded-lg">
                                    Gestão de documentos digitais (PDF) brevemente...
                                </div>
                            </div>
                        </div>
                    )}

                    {/* --- FINES TAB --- */}
                    {activeTab === 'multas' && (
                        <div className="space-y-6">
                            <div className="flex justify-between items-center">
                                <h3 className="text-white font-bold text-lg">Registo de Multas</h3>
                                <button
                                    onClick={() => setShowFineForm(!showFineForm)}
                                    className="bg-red-500/10 text-red-400 hover:bg-red-500/20 px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 border border-red-500/20"
                                >
                                    <Plus className="w-4 h-4" /> Nova Multa
                                </button>
                            </div>

                            {showFineForm && (
                                <form onSubmit={handleAddFine} className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 space-y-4 animate-fade-in-down">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs text-slate-500 font-bold uppercase">Data</label>
                                            <input type="date" required value={newFine.data} onChange={e => setNewFine({ ...newFine, data: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white" />
                                        </div>
                                        <div>
                                            <label className="text-xs text-slate-500 font-bold uppercase">Valor (€)</label>
                                            <input type="number" required value={newFine.valor} onChange={e => setNewFine({ ...newFine, valor: parseFloat(e.target.value) })} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs text-slate-500 font-bold uppercase">Motivo</label>
                                        <input type="text" required value={newFine.motivo} onChange={e => setNewFine({ ...newFine, motivo: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white" placeholder="Ex: Excesso de velocidade" />
                                    </div>
                                    <button type="submit" className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-2 rounded-lg">Registar Multa</button>
                                </form>
                            )}

                            <div className="space-y-3">
                                {viatura.multas && viatura.multas.length > 0 ? (
                                    viatura.multas.map(multa => (
                                        <div key={multa.id} className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4 flex justify-between items-center group">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-white font-bold">{multa.motivo}</span>
                                                    <span className="text-red-400 bg-red-400/10 px-2 py-0.5 rounded text-xs font-bold border border-red-400/20">
                                                        {multa.valor.toFixed(2)}€
                                                    </span>
                                                </div>
                                                <p className="text-slate-400 text-xs flex items-center gap-2">
                                                    <Calendar className="w-3 h-3" /> {multa.data}
                                                    {multa.pago ? <span className="text-emerald-400 ml-2">• Pago</span> : <span className="text-amber-400 ml-2">• Pendente</span>}
                                                </p>
                                            </div>
                                            <button onClick={() => handleDeleteFine(multa.id)} className="text-slate-500 hover:text-red-400 p-2 opacity-0 group-hover:opacity-100 transition-all">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-8 text-slate-500 text-sm italic">Sem multas registadas</div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* --- MAINTENANCE TAB --- */}
                    {activeTab === 'manutencao' && (
                        <div className="space-y-6">
                            <div className="flex justify-between items-center">
                                <h3 className="text-white font-bold text-lg">Histórico de Manutenções</h3>
                                <button
                                    onClick={() => setShowMaintenanceForm(!showMaintenanceForm)}
                                    className="bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 border border-blue-500/20"
                                >
                                    <Plus className="w-4 h-4" /> Registar Manutenção
                                </button>
                            </div>

                            {showMaintenanceForm && (
                                <form onSubmit={handleAddMaintenance} className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 space-y-4 animate-fade-in-down">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs text-slate-500 font-bold uppercase">Data</label>
                                            <input type="date" required value={newMaintenance.data} onChange={e => setNewMaintenance({ ...newMaintenance, data: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white" />
                                        </div>
                                        <div>
                                            <label className="text-xs text-slate-500 font-bold uppercase">Tipo</label>
                                            <select value={newMaintenance.tipo} onChange={e => setNewMaintenance({ ...newMaintenance, tipo: e.target.value as any })} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white">
                                                <option value="preventiva">Preventiva</option>
                                                <option value="corretiva">Corretiva</option>
                                                <option value="inspecao">Inspeção</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs text-slate-500 font-bold uppercase">Oficina</label>
                                            <input type="text" required value={newMaintenance.oficina} onChange={e => setNewMaintenance({ ...newMaintenance, oficina: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white" placeholder="Norauto, Midas..." />
                                        </div>
                                        <div>
                                            <label className="text-xs text-slate-500 font-bold uppercase">Custo (€)</label>
                                            <input type="number" required value={newMaintenance.custo} onChange={e => setNewMaintenance({ ...newMaintenance, custo: parseFloat(e.target.value) })} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs text-slate-500 font-bold uppercase">KM Atuais</label>
                                        <input type="number" required value={newMaintenance.km} onChange={e => setNewMaintenance({ ...newMaintenance, km: parseInt(e.target.value) })} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white" />
                                    </div>
                                    <div>
                                        <label className="text-xs text-slate-500 font-bold uppercase">Descrição</label>
                                        <textarea required value={newMaintenance.descricao} onChange={e => setNewMaintenance({ ...newMaintenance, descricao: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white" rows={2} placeholder="Mudança de óleo e filtros..." />
                                    </div>
                                    <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 rounded-lg">Guardar Registo</button>
                                </form>
                            )}

                            <div className="space-y-3">
                                {viatura.manutencoes && viatura.manutencoes.length > 0 ? (
                                    viatura.manutencoes
                                        .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()) // Newest first
                                        .map(manutencao => (
                                            <div key={manutencao.id} className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4 flex justify-between items-start group">
                                                <div className="flex gap-4">
                                                    <div className="mt-1 bg-slate-800 p-2 rounded-lg text-slate-400">
                                                        <Wrench className="w-4 h-4" />
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="text-white font-bold capitalize">{manutencao.tipo}</span>
                                                            <span className="text-slate-500 text-xs px-1.5 border border-slate-700 rounded bg-slate-900">{manutencao.km} km</span>
                                                            <span className="text-emerald-400 text-xs font-bold">{manutencao.custo.toFixed(2)}€</span>
                                                        </div>
                                                        <p className="text-slate-300 text-sm mb-1">{manutencao.descricao}</p>
                                                        <p className="text-slate-500 text-xs flex items-center gap-2">
                                                            <Calendar className="w-3 h-3" /> {manutencao.data} • {manutencao.oficina}
                                                        </p>
                                                    </div>
                                                </div>
                                                <button onClick={() => handleDeleteMaintenance(manutencao.id)} className="text-slate-500 hover:text-red-400 p-2 opacity-0 group-hover:opacity-100 transition-all">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ))
                                ) : (
                                    <div className="text-center py-8 text-slate-500 text-sm italic">Sem registos de manutenção</div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* --- REQUISITIONS TAB --- */}
                    {activeTab === 'requisicoes' && (
                        <div className="space-y-6">
                            <h3 className="text-white font-bold text-lg">Requisições Associadas</h3>

                            <div className="space-y-3">
                                {vehicleRequisitions.length > 0 ? (
                                    vehicleRequisitions.map(req => (
                                        <div key={req.id} className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4">
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <span className="text-blue-400 font-mono text-xs font-bold">Req #{req.numero}</span>
                                                    <p className="text-slate-400 text-xs mt-0.5">{req.data}</p>
                                                </div>
                                                <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase border ${req.status === 'concluida' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                                                    {req.status || 'Pendente'}
                                                </span>
                                            </div>
                                            <div className="space-y-1 mb-3">
                                                {req.itens.map((item, idx) => (
                                                    <div key={idx} className="flex justify-between text-sm text-slate-300">
                                                        <span>{item.descricao}</span>
                                                        <span className="text-slate-500">x{item.quantidade}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-8 text-slate-500 text-sm italic">Sem requisições associadas a esta viatura.</div>
                                )}
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}
