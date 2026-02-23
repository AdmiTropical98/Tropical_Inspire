import { useState, useEffect } from 'react';
import {
    Clock, MapPin, User, Plus, Trash2,
    ShieldAlert, Save, AlertCircle, Info,
    CheckCircle2, XCircle
} from 'lucide-react';
import { useWorkshop } from '../../contexts/WorkshopContext';
import type { Motorista, Shift, BlockedPeriod } from '../../types';

export default function DriverAvailability() {
    const { motoristas, updateMotorista } = useWorkshop();
    const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
    const selectedDriver = motoristas.find(m => m.id === selectedDriverId);
    const [localDriver, setLocalDriver] = useState<Motorista | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // ONLY sync local state when the selected ID changes or for the first time
    // This prevents the "revert" when refreshData runs and the DB doesn't have the columns yet
    useEffect(() => {
        if (selectedDriver) {
            setLocalDriver(selectedDriver);
        } else {
            setLocalDriver(null);
        }
    }, [selectedDriverId]); // Removed 'motoristas' from dependencies to prevent auto-revert

    const handleSave = async (updated: Motorista) => {
        setLocalDriver(updated);
        setIsSaving(true);

        try {
            await updateMotorista(updated);
        } catch (error) {
            console.error('Error saving driver availability:', error);
            // We keep the local state so the user can see what they tried to save
        } finally {
            setIsSaving(false);
        }
    };

    const addShift = (driver: Motorista) => {
        const newShift: Shift = {
            id: crypto.randomUUID(),
            inicio: '09:00',
            fim: '18:00',
            label: 'Novo Turno'
        };
        handleSave({
            ...driver,
            shifts: [...(driver.shifts || []), newShift]
        });
    };

    const removeShift = (driver: Motorista, shiftId: string) => {
        handleSave({
            ...driver,
            shifts: (driver.shifts || []).filter(s => s.id !== shiftId)
        });
    };

    const updateShift = (driver: Motorista, shiftId: string, updates: Partial<Shift>) => {
        handleSave({
            ...driver,
            shifts: (driver.shifts || []).map(s => s.id === shiftId ? { ...s, ...updates } : s)
        });
    };

    const addBlockedPeriod = (driver: Motorista) => {
        const newBlock: BlockedPeriod = {
            id: crypto.randomUUID(),
            inicio: '13:00',
            fim: '14:00',
            reason: 'Pausa Almoço'
        };
        handleSave({
            ...driver,
            blockedPeriods: [...(driver.blockedPeriods || []), newBlock]
        });
    };

    const removeBlockedPeriod = (driver: Motorista, blockId: string) => {
        handleSave({
            ...driver,
            blockedPeriods: (driver.blockedPeriods || []).filter(b => b.id !== blockId)
        });
    };

    const updateBlockedPeriod = (driver: Motorista, blockId: string, updates: Partial<BlockedPeriod>) => {
        handleSave({
            ...driver,
            blockedPeriods: (driver.blockedPeriods || []).map(b => b.id === blockId ? { ...b, ...updates } : b)
        });
    };

    const toggleZone = (driver: Motorista, zone: 'albufeira' | 'quarteira') => {
        const currentZones = driver.zones || ['albufeira', 'quarteira'];
        const newZones = currentZones.includes(zone)
            ? currentZones.filter(z => z !== zone)
            : [...currentZones, zone];

        handleSave({ ...driver, zones: newZones });
    };

    return (
        <div className="flex flex-col md:flex-row h-full w-full bg-[#0f172a] overflow-hidden">
            {/* Sidebar: Driver List */}
            <div className="w-full md:w-80 border-r border-white/5 flex flex-col bg-[#0b1120]/50 h-full">
                <div className="p-6 border-b border-white/5">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <User className="w-5 h-5 text-blue-400" />
                        Motoristas
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">Selecione para gerir disponibilidade</p>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                    {motoristas.map(driver => (
                        <button
                            key={driver.id}
                            onClick={() => setSelectedDriverId(driver.id)}
                            className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${selectedDriverId === driver.id
                                ? 'bg-blue-600/20 border border-blue-500/50 shadow-[0_0_20px_rgba(59,130,246,0.1)]'
                                : 'hover:bg-white/5 border border-transparent text-slate-400 hover:text-slate-200'
                                }`}
                        >
                            <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center border border-white/10 shrink-0">
                                {driver.foto ? (
                                    <img src={driver.foto} alt={driver.nome} className="w-full h-full rounded-full object-cover" />
                                ) : (
                                    <User className="w-5 h-5" />
                                )}
                            </div>
                            <div className="flex flex-col items-start overflow-hidden">
                                <span className="text-sm font-bold truncate w-full">{driver.nome}</span>
                                <span className="text-[10px] uppercase opacity-60">
                                    {driver.shifts?.length || 0} Turnos • {driver.zones?.length || 0} Zonas
                                </span>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Main Section: Availability Config */}
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                {localDriver ? (
                    <div className="w-full min-w-0 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* Driver Header */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg">
                                    <User className="w-8 h-8 text-white" />
                                </div>
                                <div>
                                    <h1 className="text-2xl font-bold text-white">{localDriver.nome}</h1>
                                    <div className="flex items-center gap-4 mt-1">
                                        <span className="text-sm text-slate-400 flex items-center gap-1.5">
                                            <ShieldAlert className="w-4 h-4 text-amber-500" />
                                            Regras Ativas
                                        </span>
                                        {isSaving && (
                                            <span className="text-xs text-blue-400 animate-pulse flex items-center gap-1">
                                                <Save className="w-3 h-3 animate-spin" />
                                                A guardar...
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* 1. Turnos de Trabalho */}
                            <div className="bg-[#1e293b]/50 border border-white/10 rounded-2xl overflow-hidden shadow-xl">
                                <div className="p-4 border-b border-white/10 bg-white/5 flex items-center justify-between">
                                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                        <Clock className="w-4 h-4 text-blue-400" />
                                        Turnos de Trabalho
                                    </h3>
                                    <button
                                        onClick={() => addShift(localDriver)}
                                        className="p-1.5 hover:bg-blue-600/20 text-blue-400 rounded-lg transition-colors"
                                    >
                                        <Plus className="w-4 h-4" />
                                    </button>
                                </div>
                                <div className="p-4 space-y-3">
                                    {(!localDriver.shifts || localDriver.shifts.length === 0) ? (
                                        <div className="text-center py-6 text-slate-500 text-xs italic">
                                            Nenhum turno definido. Adicione um para ativar restrições.
                                        </div>
                                    ) : (
                                        localDriver.shifts.map(shift => (
                                            <div key={shift.id} className="group flex items-center gap-3 p-3 bg-[#0f172a] rounded-xl border border-white/5 hover:border-blue-500/30 transition-all">
                                                <div className="flex-1 grid grid-cols-2 gap-2">
                                                    <div>
                                                        <label className="block text-[10px] uppercase text-slate-500 font-bold mb-1">Início</label>
                                                        <input
                                                            type="time"
                                                            value={shift.inicio}
                                                            onChange={e => updateShift(localDriver, shift.id, { inicio: e.target.value })}
                                                            className="w-full bg-slate-900 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] uppercase text-slate-500 font-bold mb-1">Fim</label>
                                                        <input
                                                            type="time"
                                                            value={shift.fim}
                                                            onChange={e => updateShift(localDriver, shift.id, { fim: e.target.value })}
                                                            className="w-full bg-slate-900 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white"
                                                        />
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => removeShift(localDriver, shift.id)}
                                                    className="p-2 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* 2. Zonas Permitidas */}
                            <div className="bg-[#1e293b]/50 border border-white/10 rounded-2xl overflow-hidden shadow-xl">
                                <div className="p-4 border-b border-white/10 bg-white/5">
                                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                        <MapPin className="w-4 h-4 text-emerald-400" />
                                        Zonas Operacionais
                                    </h3>
                                </div>
                                <div className="p-6">
                                    <div className="grid grid-cols-2 gap-4">
                                        <button
                                            onClick={() => toggleZone(localDriver, 'albufeira')}
                                            className={`p-4 rounded-2xl border transition-all flex flex-col items-center gap-3 ${(localDriver.zones || ['albufeira', 'quarteira']).includes('albufeira')
                                                ? 'bg-emerald-600/20 border-emerald-500/50 text-emerald-400 shadow-[0_0_20_rgba(16,185,129,0.05)]'
                                                : 'bg-[#0f172a] border-white/5 text-slate-500 grayscale'
                                                }`}
                                        >
                                            <div className="p-3 bg-white/5 rounded-xl">
                                                <MapPin className="w-6 h-6" />
                                            </div>
                                            <span className="text-sm font-bold">ALBUFEIRA</span>
                                            {(localDriver.zones || ['albufeira', 'quarteira']).includes('albufeira') ? (
                                                <CheckCircle2 className="w-4 h-4" />
                                            ) : (
                                                <XCircle className="w-4 h-4 opacity-30" />
                                            )}
                                        </button>

                                        <button
                                            onClick={() => toggleZone(localDriver, 'quarteira')}
                                            className={`p-4 rounded-2xl border transition-all flex flex-col items-center gap-3 ${(localDriver.zones || ['albufeira', 'quarteira']).includes('quarteira')
                                                ? 'bg-emerald-600/20 border-emerald-500/50 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.05)]'
                                                : 'bg-[#0f172a] border-white/5 text-slate-500 grayscale'
                                                }`}
                                        >
                                            <div className="p-3 bg-white/5 rounded-xl">
                                                <MapPin className="w-6 h-6" />
                                            </div>
                                            <span className="text-sm font-bold">QUARTEIRA</span>
                                            {(localDriver.zones || ['albufeira', 'quarteira']).includes('quarteira') ? (
                                                <CheckCircle2 className="w-4 h-4" />
                                            ) : (
                                                <XCircle className="w-4 h-4 opacity-30" />
                                            )}
                                        </button>
                                    </div>
                                    <p className="mt-4 text-[10px] text-slate-500 text-center leading-relaxed">
                                        O motorista será sugerido automaticamente apenas para serviços nestas zonas.
                                    </p>
                                </div>
                            </div>

                            {/* 3. Períodos Bloqueados */}
                            <div className="bg-[#1e293b]/50 border border-white/10 rounded-2xl overflow-hidden shadow-xl">
                                <div className="p-4 border-b border-white/10 bg-white/5 flex items-center justify-between">
                                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                        <AlertCircle className="w-4 h-4 text-red-400" />
                                        Períodos Bloqueados
                                    </h3>
                                    <button
                                        onClick={() => addBlockedPeriod(localDriver)}
                                        className="p-1.5 hover:bg-red-600/20 text-red-400 rounded-lg transition-colors"
                                    >
                                        <Plus className="w-4 h-4" />
                                    </button>
                                </div>
                                <div className="p-4 space-y-3">
                                    {(!localDriver.blockedPeriods || localDriver.blockedPeriods.length === 0) ? (
                                        <div className="text-center py-6 text-slate-500 text-xs italic">
                                            Nenhum bloqueio temporal (ex: condução de autocarro).
                                        </div>
                                    ) : (
                                        localDriver.blockedPeriods.map(block => (
                                            <div key={block.id} className="group flex flex-col gap-2 p-3 bg-[#0f172a] rounded-xl border border-red-500/10 hover:border-red-500/30 transition-all">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex-1 grid grid-cols-2 gap-2">
                                                        <input
                                                            type="time"
                                                            value={block.inicio}
                                                            onChange={e => updateBlockedPeriod(localDriver, block.id, { inicio: e.target.value })}
                                                            className="bg-slate-900 border border-white/10 rounded-lg px-2 py-1 text-xs text-white"
                                                        />
                                                        <input
                                                            type="time"
                                                            value={block.fim}
                                                            onChange={e => updateBlockedPeriod(localDriver, block.id, { fim: e.target.value })}
                                                            className="bg-slate-900 border border-white/10 rounded-lg px-2 py-1 text-xs text-white"
                                                        />
                                                    </div>
                                                    <button
                                                        onClick={() => removeBlockedPeriod(localDriver, block.id)}
                                                        className="text-red-500 hover:bg-red-500/10 p-1 rounded transition-colors"
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                    </button>
                                                </div>
                                                <input
                                                    type="text"
                                                    placeholder="Motivo (ex: Condução Autocarro)"
                                                    value={block.reason}
                                                    onChange={e => updateBlockedPeriod(localDriver, block.id, { reason: e.target.value })}
                                                    className="w-full bg-transparent border-none text-[10px] text-red-400 focus:ring-0 placeholder:text-red-900"
                                                />
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* 4. Restrições e Carga */}
                            <div className="bg-[#1e293b]/50 border border-white/10 rounded-2xl overflow-hidden shadow-xl">
                                <div className="p-4 border-b border-white/10 bg-white/5">
                                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                        <Info className="w-4 h-4 text-blue-400" />
                                        Restrições de Carga
                                    </h3>
                                </div>
                                <div className="p-6 space-y-6">
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <label className="text-xs font-bold text-slate-400 uppercase">Apoio Máximo Diário</label>
                                            <span className="text-xs font-mono text-blue-400 font-bold">
                                                {localDriver.maxDailyServices ? `${localDriver.maxDailyServices} serviços` : '∞ serviços'}
                                            </span>
                                        </div>
                                        <input
                                            type="range"
                                            min="0"
                                            max="30"
                                            step="1"
                                            value={localDriver.maxDailyServices || 0}
                                            onChange={e => {
                                                const val = parseInt(e.target.value);
                                                handleSave({ ...localDriver, maxDailyServices: val === 0 ? undefined : val });
                                            }}
                                            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                        />
                                    </div>

                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <label className="text-xs font-bold text-slate-400 uppercase">Intervalo Mínimo</label>
                                            <span className="text-xs font-mono text-blue-400 font-bold">{localDriver.minIntervalMinutes || 30} min</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {[15, 30, 45, 60].map(val => (
                                                <button
                                                    key={val}
                                                    onClick={() => handleSave({ ...localDriver, minIntervalMinutes: val })}
                                                    className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all ${(localDriver.minIntervalMinutes || 30) === val
                                                        ? 'bg-blue-600 border-blue-500 text-white shadow-lg'
                                                        : 'bg-slate-900 border-white/5 text-slate-500 hover:text-slate-300'
                                                        }`}
                                                >
                                                    {val}m
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-4">
                        <div className="w-20 h-20 rounded-full bg-slate-800/50 flex items-center justify-center border border-white/5 animate-pulse">
                            <User className="w-10 h-10 opacity-20" />
                        </div>
                        <p className="text-sm font-medium">Selecione um motorista para configurar a disponibilidade operacional.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
