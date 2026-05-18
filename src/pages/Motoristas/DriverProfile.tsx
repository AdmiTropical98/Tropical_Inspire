import { useState } from 'react';
import { X, Calendar, AlertTriangle, FileText, Clock, Plus, Trash2, MapPin, Euro, CheckCircle, Fuel } from 'lucide-react';
import { useWorkshop } from '../../contexts/WorkshopContext';
import type { Motorista, Acidente, Multa, Ausencia } from '../../types';

interface DriverProfileProps {
    motorista: Motorista;
    onClose: () => void;
}

export default function DriverProfile({ motorista: initialMotorista, onClose }: DriverProfileProps) {
    const { motoristas, updateMotorista, fuelTransactions, viaturas } = useWorkshop();
    const [activeTab, setActiveTab] = useState<'details' | 'acidentes' | 'multas' | 'ausencias' | 'abastecimentos'>('details');

    // Get live data to ensure updates are reflected
    const motorista = motoristas.find(m => m.id === initialMotorista.id) || initialMotorista;
    const tipoUtilizador = motorista.tipoUtilizador || (motorista as any).tipo_utilizador || 'motorista';

    // Temp state for folgas confirmation
    const [tempFolgas, setTempFolgas] = useState<string[]>(motorista.folgas || []);

    const [isAddingAccident, setIsAddingAccident] = useState(false);
    const [isAddingFine, setIsAddingFine] = useState(false);
    const [isAddingAbsence, setIsAddingAbsence] = useState(false);

    // Form States
    const [newAccident, setNewAccident] = useState<Partial<Acidente>>({ status: 'em_analise', pagamentoStatus: 'pendente' });
    const [newFine, setNewFine] = useState<Partial<Multa>>({ pago: false });
    const [newAbsence, setNewAbsence] = useState<Partial<Ausencia>>({ tipo: 'ferias', aprovado: true });

    const handleAddAccident = (e: React.FormEvent) => {
        e.preventDefault();
        const acidente: Acidente = {
            id: crypto.randomUUID(),
            data: newAccident.data || new Date().toISOString().split('T')[0],
            descricao: newAccident.descricao || '',
            custo: newAccident.custo || 0,
            status: newAccident.status as any,
            pagamentoStatus: newAccident.pagamentoStatus as any
        };

        const updated = {
            ...motorista,
            acidentes: [...(motorista.acidentes || []), acidente]
        };
        updateMotorista(updated);
        setIsAddingAccident(false);
        setNewAccident({ status: 'em_analise', pagamentoStatus: 'pendente' });
    };

    const handleAddFine = (e: React.FormEvent) => {
        e.preventDefault();
        const multa: Multa = {
            id: crypto.randomUUID(),
            data: newFine.data || new Date().toISOString().split('T')[0],
            valor: newFine.valor || 0,
            motivo: newFine.motivo || '',
            local: newFine.local || '',
            pago: newFine.pago || false
        };

        const updated = {
            ...motorista,
            multas: [...(motorista.multas || []), multa]
        };
        updateMotorista(updated);
        setIsAddingFine(false);
        setNewFine({ pago: false });
    };

    const handleAddAbsence = (e: React.FormEvent) => {
        e.preventDefault();
        const ausencia: Ausencia = {
            id: crypto.randomUUID(),
            inicio: newAbsence.inicio || new Date().toISOString().split('T')[0],
            fim: newAbsence.fim || new Date().toISOString().split('T')[0],
            tipo: newAbsence.tipo as any,
            motivo: newAbsence.motivo || '',
            aprovado: newAbsence.aprovado ?? true
        };

        const updated = {
            ...motorista,
            ausencias: [...(motorista.ausencias || []), ausencia]
        };
        updateMotorista(updated);
        setIsAddingAbsence(false);
        setNewAbsence({ tipo: 'ferias', aprovado: true });
    };

    const driverFuelTransactions = (fuelTransactions || [])
        .filter(t => t.driverId === motorista.id)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const getVehiclePlate = (vId: string) => {
        const v = viaturas.find(v => v.id === vId);
        return v ? v.matricula : 'N/A';
    };

    const calculateConsumption = (currentTx: typeof driverFuelTransactions[0]) => {
        // Find the previous transaction *for the same vehicle*
        // We need to look ahead in the sorted array (which is descending by date)
        // taking into account only transactions for this vehicle
        const sameVehicleTransactions = driverFuelTransactions.filter(t => t.vehicleId === currentTx.vehicleId);
        const currentInVehicleListIndex = sameVehicleTransactions.findIndex(t => t.id === currentTx.id);
        const previousTx = sameVehicleTransactions[currentInVehicleListIndex + 1];

        if (!previousTx) return null;

        const kmDelta = currentTx.km - previousTx.km;
        if (kmDelta <= 0) return null;

        const consumption = (currentTx.liters / kmDelta) * 100;
        return consumption.toFixed(1);
    };

    const handleDeleteItem = (id: string, type: 'acidentes' | 'multas' | 'ausencias') => {
        if (!confirm('Tem a certeza que deseja eliminar este registo?')) return;

        const updated = { ...motorista };
        if (type === 'acidentes') {
            updated.acidentes = motorista.acidentes?.filter(a => a.id !== id);
        } else if (type === 'multas') {
            updated.multas = motorista.multas?.filter(m => m.id !== id);
        } else {
            updated.ausencias = motorista.ausencias?.filter(a => a.id !== id);
        }
        updateMotorista(updated);
    };

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-2xl bg-white/90 border-l border-slate-200 shadow-2xl h-full flex flex-col animate-in slide-in-from-right duration-300">

                {/* Header with Photo */}
                <div className="p-6 border-b border-slate-200 bg-gradient-to-br from-slate-950 to-slate-900">
                    <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-4">
                            <div className="w-20 h-20 rounded-full bg-slate-100 border-2 border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                                {motorista.foto ? (
                                    <img src={motorista.foto} alt={motorista.nome} className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-blue-400 font-bold text-3xl">{motorista.nome.charAt(0)}</span>
                                )}
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-slate-900 mb-1">{motorista.nome}</h2>
                                <div className="flex items-center gap-4 text-sm text-slate-400">
                                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> {tipoUtilizador.charAt(0).toUpperCase() + tipoUtilizador.slice(1)} Ativo</span>
                                    <span>|</span>
                                    <span>{motorista.contacto}</span>
                                </div>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-900 transition-colors">
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    {/* Quick Stats */}
                    <div className="grid grid-cols-3 gap-3 mt-4">
                        <div className="bg-slate-100 rounded-xl p-3 border border-slate-200/50">
                            <div className="flex items-center gap-2 mb-1">
                                <AlertTriangle className="w-4 h-4 text-amber-400" />
                                <span className="text-xs text-slate-400 uppercase font-bold">Acidentes</span>
                            </div>
                            <p className="text-2xl font-bold text-slate-900">{motorista.acidentes?.length || 0}</p>
                        </div>
                        <div className="bg-slate-100 rounded-xl p-3 border border-slate-200/50">
                            <div className="flex items-center gap-2 mb-1">
                                <Euro className="w-4 h-4 text-red-400" />
                                <span className="text-xs text-slate-400 uppercase font-bold">Multas</span>
                            </div>
                            <p className="text-2xl font-bold text-slate-900">{motorista.multas?.length || 0}</p>
                        </div>
                        <div className="bg-slate-100 rounded-xl p-3 border border-slate-200/50">
                            <div className="flex items-center gap-2 mb-1">
                                <Calendar className="w-4 h-4 text-purple-400" />
                                <span className="text-xs text-slate-400 uppercase font-bold">Ausências</span>
                            </div>
                            <p className="text-2xl font-bold text-slate-900">{motorista.ausencias?.length || 0}</p>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-200 px-6 bg-white/90">
                    {[
                        { id: 'details', label: 'Detalhes', icon: FileText },
                        { id: 'acidentes', label: 'Acidentes', icon: AlertTriangle },
                        { id: 'multas', label: 'Multas', icon: Euro },
                        { id: 'ausencias', label: 'Ausências', icon: Calendar },
                        { id: 'abastecimentos', label: 'Abastecimentos', icon: Fuel },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex items-center gap-2 px-4 py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.id
                                ? 'border-blue-500 text-blue-400'
                                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-200'
                                }`}
                        >
                            <tab.icon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 bg-white/90 custom-scrollbar">

                    {activeTab === 'details' && (
                        <div className="space-y-6">
                            {/* Salary & Rate */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-white/90 p-4 rounded-xl border border-slate-200">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Vencimento Base</label>
                                    <p className="text-lg font-bold text-[#1f2957] mt-1">
                                        {motorista.vencimentoBase ? `${motorista.vencimentoBase.toFixed(2)}€` : 'N/A'}
                                    </p>
                                </div>
                                <div className="bg-white/90 p-4 rounded-xl border border-slate-200">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Valor Hora Extra</label>
                                    <p className="text-lg font-bold text-[#1f2957] mt-1">
                                        {motorista.valorHora ? `${motorista.valorHora.toFixed(2)}€` : 'N/A'}
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-slate-100 rounded-xl border border-slate-200/50">
                                    <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Função</h4>
                                    <select
                                        className="bg-white/90 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 text-sm w-full outline-none focus:border-blue-500"
                                        value={tipoUtilizador}
                                        onChange={e => updateMotorista({ ...motorista, tipoUtilizador: e.target.value as Motorista['tipoUtilizador'] })}
                                    >
                                        <option value="motorista">Motorista</option>
                                        <option value="supervisor">Supervisor</option>
                                        <option value="oficina">Oficina</option>
                                    </select>
                                </div>
                                <div className="p-4 bg-slate-100 rounded-xl border border-slate-200/50">
                                    <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Carta de Condução</h4>
                                    <p className="text-slate-900 font-mono">{motorista.cartaConducao || 'Não registada'}</p>
                                </div>
                                <div className="p-4 bg-slate-100 rounded-xl border border-slate-200/50">
                                    <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">PIN de Acesso</h4>
                                    <p className="text-emerald-400 font-mono font-bold tracking-widest">{motorista.pin || '---'}</p>
                                </div>
                                <div className="p-4 bg-slate-100 rounded-xl border border-slate-200/50">
                                    <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Chave Cartrack</h4>
                                    <input
                                        type="text"
                                        placeholder="A000000..."
                                        className="bg-white/90 border border-slate-200 rounded-lg px-3 py-1 text-slate-900 text-sm w-full font-mono outline-none focus:border-blue-500"
                                        value={motorista.cartrackKey || ''}
                                        onChange={e => updateMotorista({ ...motorista, cartrackKey: e.target.value })}
                                    />
                                </div>
                                <div className="col-span-2 p-4 bg-slate-100 rounded-xl border border-slate-200/50">
                                    <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Email</h4>
                                    <p className="text-slate-900">{motorista.email || 'Não registado'}</p>
                                </div>
                                <div className="col-span-2 p-4 bg-slate-100 rounded-xl border border-slate-200/50">
                                    <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Observações</h4>
                                    <p className="text-slate-300 text-sm leading-relaxed">{motorista.obs || 'Sem notas adicionais'}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'acidentes' && (
                        <div className="space-y-6">
                            <div className="flex justify-between items-center">
                                <h3 className="text-lg font-bold text-[#1f2957]">Histórico de Acidentes</h3>
                                <button onClick={() => setIsAddingAccident(!isAddingAccident)} className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors">
                                    <Plus className="w-4 h-4" /> Registar
                                </button>
                            </div>

                            {isAddingAccident && (
                                <form onSubmit={handleAddAccident} className="bg-slate-100 p-4 rounded-xl border border-slate-200 space-y-4 animate-in slide-in-from-top-2">
                                    <div className="grid grid-cols-2 gap-4">
                                        <input type="date" required className="bg-white/90 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 text-sm" value={newAccident.data} onChange={e => setNewAccident({ ...newAccident, data: e.target.value })} />
                                        <select className="bg-white/90 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 text-sm" value={newAccident.status} onChange={e => setNewAccident({ ...newAccident, status: e.target.value as any })}>
                                            <option value="pendente">Pendente</option>
                                            <option value="em_analise">Em Análise</option>
                                            <option value="resolvido">Resolvido</option>
                                        </select>
                                    </div>
                                    <input type="text" placeholder="Descrição do incidente" required className="w-full bg-white/90 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 text-sm" value={newAccident.descricao} onChange={e => setNewAccident({ ...newAccident, descricao: e.target.value })} />
                                    <div className="grid grid-cols-2 gap-4">
                                        <input type="number" placeholder="Custo Estimado (€)" className="bg-white/90 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 text-sm" value={newAccident.custo || ''} onChange={e => setNewAccident({ ...newAccident, custo: parseFloat(e.target.value) })} />
                                        <select className="bg-white/90 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 text-sm" value={newAccident.pagamentoStatus} onChange={e => setNewAccident({ ...newAccident, pagamentoStatus: e.target.value as any })}>
                                            <option value="pendente">Pagamento Pendente</option>
                                            <option value="pago">Pago</option>
                                            <option value="nao_aplicavel">Não Aplicável</option>
                                        </select>
                                    </div>
                                    <div className="flex justify-end gap-2 pt-2">
                                        <button type="button" onClick={() => setIsAddingAccident(false)} className="text-slate-400 text-sm hover:text-slate-900 px-3 py-1">Cancelar</button>
                                        <button type="submit" className="bg-emerald-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium">Salvar</button>
                                    </div>
                                </form>
                            )}

                            <div className="space-y-3">
                                {motorista.acidentes?.map(acidente => (
                                    <div key={acidente.id} className="bg-slate-50 p-4 rounded-xl border border-slate-200/50 flex flex-col gap-2 relative group">
                                        <button onClick={() => handleDeleteItem(acidente.id, 'acidentes')} className="absolute top-3 right-3 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-4 h-4" /></button>
                                        <div className="flex items-center justify-between pr-8">
                                            <span className="text-slate-400 text-xs font-mono">{acidente.data}</span>
                                            <span className={`text-xs px-2 py-0.5 rounded-full border ${acidente.status === 'resolvido' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                                acidente.status === 'pendente' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                                    'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                                                }`}>
                                                {acidente.status.replace('_', ' ').toUpperCase()}
                                            </span>
                                        </div>
                                        <p className="text-slate-900 font-medium text-sm">{acidente.descricao}</p>
                                        <div className="flex items-center gap-4 text-xs mt-1">
                                            {acidente.custo ? <span className="text-slate-400">Custo: <span className="text-slate-900 font-mono">{acidente.custo}€</span></span> : null}
                                            <span className="text-slate-500">Pagamento: {acidente.pagamentoStatus}</span>
                                        </div>
                                    </div>
                                ))}
                                {(!motorista.acidentes || motorista.acidentes.length === 0) && (
                                    <p className="text-center text-slate-500 py-8 text-sm">Sem registo de acidentes.</p>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'multas' && (
                        <div className="space-y-6">
                            <div className="flex justify-between items-center">
                                <h3 className="text-lg font-bold text-[#1f2957]">Registo de Multas</h3>
                                <button onClick={() => setIsAddingFine(!isAddingFine)} className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors">
                                    <Plus className="w-4 h-4" /> Registar
                                </button>
                            </div>

                            {isAddingFine && (
                                <form onSubmit={handleAddFine} className="bg-slate-100 p-4 rounded-xl border border-slate-200 space-y-4 animate-in slide-in-from-top-2">
                                    <div className="grid grid-cols-2 gap-4">
                                        <input type="date" required className="bg-white/90 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 text-sm" value={newFine.data} onChange={e => setNewFine({ ...newFine, data: e.target.value })} />
                                        <input type="number" placeholder="Valor (€)" required className="bg-white/90 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 text-sm" value={newFine.valor || ''} onChange={e => setNewFine({ ...newFine, valor: parseFloat(e.target.value) })} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <input type="text" placeholder="Motivo (ex: Excesso Velocidade)" required className="bg-white/90 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 text-sm" value={newFine.motivo} onChange={e => setNewFine({ ...newFine, motivo: e.target.value })} />
                                        <input type="text" placeholder="Local" className="bg-white/90 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 text-sm" value={newFine.local} onChange={e => setNewFine({ ...newFine, local: e.target.value })} />
                                    </div>
                                    <label className="flex items-center gap-2 text-slate-300 text-sm cursor-pointer">
                                        <input type="checkbox" checked={newFine.pago} onChange={e => setNewFine({ ...newFine, pago: e.target.checked })} className="rounded bg-white/90 border-slate-200" />
                                        Multa já liquidada?
                                    </label>
                                    <div className="flex justify-end gap-2 pt-2">
                                        <button type="button" onClick={() => setIsAddingFine(false)} className="text-slate-400 text-sm hover:text-slate-900 px-3 py-1">Cancelar</button>
                                        <button type="submit" className="bg-emerald-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium">Salvar</button>
                                    </div>
                                </form>
                            )}

                            <div className="space-y-3">
                                {motorista.multas?.map(multa => (
                                    <div key={multa.id} className="bg-slate-50 p-4 rounded-xl border border-slate-200/50 flex flex-col gap-2 relative group">
                                        <button onClick={() => handleDeleteItem(multa.id, 'multas')} className="absolute top-3 right-3 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-4 h-4" /></button>
                                        <div className="flex items-center justify-between pr-8">
                                            <span className="text-slate-400 text-xs font-mono">{multa.data}</span>
                                            <span className={`text-xs px-2 py-0.5 rounded-full border ${multa.pago ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'
                                                }`}>
                                                {multa.pago ? 'PAGO' : 'POR PAGAR'}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <p className="text-slate-900 font-medium text-sm">{multa.motivo}</p>
                                            <span className="text-slate-900 font-mono font-bold">{multa.valor}€</span>
                                        </div>
                                        {multa.local && <div className="flex items-center gap-1 text-xs text-slate-500"><MapPin className="w-3 h-3" /> {multa.local}</div>}
                                    </div>
                                ))}
                                {(!motorista.multas || motorista.multas.length === 0) && (
                                    <p className="text-center text-slate-500 py-8 text-sm">Sem multas registadas.</p>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'ausencias' && (
                        <div className="space-y-6">
                            <div className="bg-slate-100 p-4 rounded-xl border border-slate-200/50 mb-6">
                                <div className="flex justify-between items-center mb-3">
                                    <h4 className="text-sm font-bold text-slate-400 uppercase">Folgas Semanais (Máx: 2)</h4>
                                    <button
                                        onClick={() => updateMotorista({ ...motorista, folgas: tempFolgas })}
                                        className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1 rounded-lg font-medium transition-colors"
                                    >
                                        Guardar Alterações
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'].map(day => {
                                        const isSelected = tempFolgas.includes(day);
                                        return (
                                            <button
                                                key={day}
                                                onClick={() => {
                                                    if (isSelected) {
                                                        setTempFolgas(prev => prev.filter(d => d !== day));
                                                    } else {
                                                        if (tempFolgas.length >= 2) return;
                                                        setTempFolgas(prev => [...prev, day]);
                                                    }
                                                }}
                                                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${isSelected
                                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25 border border-blue-500'
                                                    : 'bg-white/90 border border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-300'
                                                    }`}
                                            >
                                                {day}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="flex justify-between items-center">
                                <h3 className="text-lg font-bold text-[#1f2957]">Histórico de Ausências</h3>
                                <button onClick={() => setIsAddingAbsence(!isAddingAbsence)} className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors">
                                    <Plus className="w-4 h-4" /> Registar
                                </button>
                            </div>

                            {isAddingAbsence && (
                                <form onSubmit={handleAddAbsence} className="bg-slate-100 p-4 rounded-xl border border-slate-200 space-y-4 animate-in slide-in-from-top-2">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs text-slate-500 uppercase mb-1 block">Início</label>
                                            <input type="date" required className="w-full bg-white/90 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 text-sm" value={newAbsence.inicio} onChange={e => setNewAbsence({ ...newAbsence, inicio: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="text-xs text-slate-500 uppercase mb-1 block">Fim</label>
                                            <input type="date" required className="w-full bg-white/90 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 text-sm" value={newAbsence.fim} onChange={e => setNewAbsence({ ...newAbsence, fim: e.target.value })} />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <select className="bg-white/90 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 text-sm" value={newAbsence.tipo} onChange={e => setNewAbsence({ ...newAbsence, tipo: e.target.value as any })}>
                                            <option value="ferias">Férias</option>
                                            <option value="baixa">Baixa Médica</option>
                                            <option value="outros">Outros</option>
                                        </select>
                                        <div className="flex items-center gap-2">
                                            <label className="text-slate-400 text-sm">Aprovado?</label>
                                            <input type="checkbox" checked={newAbsence.aprovado} onChange={e => setNewAbsence({ ...newAbsence, aprovado: e.target.checked })} className="rounded bg-white/90 border-slate-200" />
                                        </div>
                                    </div>
                                    <input type="text" placeholder="Motivo / Obs (Opcional)" className="w-full bg-white/90 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 text-sm" value={newAbsence.motivo} onChange={e => setNewAbsence({ ...newAbsence, motivo: e.target.value })} />

                                    <div className="flex justify-end gap-2 pt-2">
                                        <button type="button" onClick={() => setIsAddingAbsence(false)} className="text-slate-400 text-sm hover:text-slate-900 px-3 py-1">Cancelar</button>
                                        <button type="submit" className="bg-emerald-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium">Salvar</button>
                                    </div>
                                </form>
                            )}

                            <div className="space-y-3">
                                {motorista.ausencias?.map(ausencia => (
                                    <div key={ausencia.id} className="bg-slate-50 p-4 rounded-xl border border-slate-200/50 flex flex-col gap-2 relative group">
                                        <button onClick={() => handleDeleteItem(ausencia.id, 'ausencias')} className="absolute top-3 right-3 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-4 h-4" /></button>
                                        <div className="flex items-center justify-between pr-8">
                                            <div className="flex items-center gap-2 text-slate-900 font-medium text-sm">
                                                <Calendar className="w-4 h-4 text-slate-500" />
                                                <span>{ausencia.inicio}</span>
                                                <span className="text-slate-600">→</span>
                                                <span>{ausencia.fim}</span>
                                            </div>
                                            <span className={`text-xs px-2 py-0.5 rounded-full border ${ausencia.tipo === 'ferias' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                                                ausencia.tipo === 'baixa' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                                    'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                                }`}>
                                                {ausencia.tipo.toUpperCase()}
                                            </span>
                                        </div>
                                        {ausencia.motivo && <p className="text-slate-400 text-sm mt-1">{ausencia.motivo}</p>}
                                        <div className="flex items-center gap-2 mt-1">
                                            {ausencia.aprovado ? (
                                                <span className="flex items-center gap-1 text-[10px] text-emerald-400 uppercase tracking-wide font-bold"><CheckCircle className="w-3 h-3" /> Aprovado</span>
                                            ) : (
                                                <span className="flex items-center gap-1 text-[10px] text-yellow-400 uppercase tracking-wide font-bold"><Clock className="w-3 h-3" /> Pendente</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {(!motorista.ausencias || motorista.ausencias.length === 0) && (
                                    <p className="text-center text-slate-500 py-8 text-sm">Sem registo de ausências.</p>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'abastecimentos' && (
                        <div className="space-y-6">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-bold text-[#1f2957]">Histórico de Abastecimentos</h3>
                                <div className="bg-slate-100 px-3 py-1 rounded-lg border border-slate-200">
                                    <span className="text-xs text-slate-400 uppercase font-bold mr-2">Total Gasto</span>
                                    <span className="text-emerald-400 font-mono font-bold">
                                        {driverFuelTransactions.reduce((acc, curr) => acc + (curr.totalCost || 0), 0).toFixed(2)}€
                                    </span>
                                </div>
                            </div>

                            <div className="overflow-x-auto rounded-xl border border-slate-200/50">
                                <table className="w-full text-sm text-left" style={{ minWidth: '500px' }}>
                                    <thead className="bg-slate-100 text-slate-400 font-medium uppercase text-xs">
                                        <tr>
                                            <th className="px-4 py-3">Data</th>
                                            <th className="px-4 py-3">Viatura</th>
                                            <th className="px-4 py-3 text-right">Litros</th>
                                            <th className="px-4 py-3 text-right">Valor</th>
                                            <th className="px-4 py-3 text-right">KM</th>
                                            <th className="px-4 py-3 text-right">Consumo</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800 bg-slate-50">
                                        {driverFuelTransactions.length > 0 ? (
                                            driverFuelTransactions.map((tx) => {
                                                const consumption = calculateConsumption(tx);
                                                return (
                                                    <tr key={tx.id} className="hover:bg-slate-100 transition-colors">
                                                        <td className="px-4 py-3 text-slate-300">
                                                            <div className="flex flex-col">
                                                                <span className="font-mono">{new Date(tx.timestamp).toLocaleDateString()}</span>
                                                                <span className="text-xs text-slate-500">{new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <span className="bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-xs text-blue-400 font-mono">
                                                                {getVehiclePlate(tx.vehicleId)}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-right font-mono text-slate-300">
                                                            {tx.liters.toFixed(2)} L
                                                        </td>
                                                        <td className="px-4 py-3 text-right font-mono text-emerald-400">
                                                            {tx.totalCost ? `${tx.totalCost.toFixed(2)}€` : '-'}
                                                        </td>
                                                        <td className="px-4 py-3 text-right font-mono text-slate-400">
                                                            {tx.km}
                                                        </td>
                                                        <td className="px-4 py-3 text-right">
                                                            {consumption ? (
                                                                <span className={`font-mono font-bold ${parseFloat(consumption) > 10 ? 'text-amber-400' : 'text-blue-400'}`}>
                                                                    {consumption} <span className="text-[10px] opacity-70">L/100</span>
                                                                </span>
                                                            ) : (
                                                                <span className="text-slate-600">-</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        ) : (
                                            <tr>
                                                <td colSpan={6} className="px-4 py-8 text-center text-slate-500 italic">
                                                    Sem registos de abastecimento para este motorista.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
