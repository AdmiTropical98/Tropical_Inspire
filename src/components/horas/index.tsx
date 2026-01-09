import { Calendar, Clock, Euro, Plus, Trash2 } from 'lucide-react';
import { useWorkshop } from '../../contexts/WorkshopContext';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../contexts/PermissionsContext';
import type { Servico, ManualHourRecord } from '../../types';
import { useTranslation } from '../../hooks/useTranslation';
import { useState } from 'react';

export default function Horas() {
    const { motoristas, servicos, manualHours, addManualHourRecord, deleteManualHourRecord } = useWorkshop();
    const { userRole, currentUser } = useAuth();
    const { hasAccess } = usePermissions();
    const { t } = useTranslation();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState({
        motoristaId: '',
        date: new Date().toISOString().split('T')[0],
        startTime: '09:00',
        endTime: '18:00',
        breakDuration: 60,
        obs: ''
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await addManualHourRecord({
            id: crypto.randomUUID(),
            adminId: currentUser?.id,
            ...formData,
            createdAt: new Date().toISOString()
        });
        setIsModalOpen(false);
        setFormData(prev => ({ ...prev, motoristaId: '', obs: '' })); // Reset key fields
    };

    // Safety Check
    if (!servicos || !Array.isArray(servicos)) {
        return <div className="p-10 text-white">Carregando dados...</div>;
    }

    // Filter only assigned services
    const assigned = servicos.filter((s: Servico) => s.motoristaId);

    // Filter manual hours for TODAY (or selected date context if we add date picker later)
    // For now, let's assume the view is always "Today" based on the header date
    const today = new Date().toISOString().split('T')[0];
    const todaysManualHours = manualHours?.filter(h => h.date === today) || [];

    // Helper: Calculate Hours
    interface DriverHoursStats {
        start: string;
        end: string;
        total: string;
        effective: string;
        overtime: string;
        overtimeCost: number;
        hasOvertime: boolean;
        serviceCount: number;
        isManual: boolean;
        manualId?: string;
    }

    const calculateDriverHours = (driverServices: Servico[], driver: any): DriverHoursStats | null => {
        // Check for Manual Record First
        const manualRecord = todaysManualHours.find(h => h.motoristaId === driver.id);

        if (manualRecord) {
            // Helper to convert HH:MM to minutes
            const toMin = (t: string) => {
                const [h, m] = t.split(':').map(Number);
                return h * 60 + m;
            };

            const startMin = toMin(manualRecord.startTime);
            const endMin = toMin(manualRecord.endTime);
            const totalSpanMin = endMin - startMin;
            const lunchMin = manualRecord.breakDuration;
            const workMin = Math.max(0, totalSpanMin - lunchMin);
            const standardDayMin = 9 * 60; // 9h work day
            const overtimeMin = Math.max(0, workMin - standardDayMin);

            // Calculate Cost
            const overtimeHours = overtimeMin / 60;
            let cost = 0;
            if (driver.valorHora && overtimeHours > 0) {
                cost = overtimeHours * driver.valorHora;
            }

            const toStr = (m: number) => {
                const h = Math.floor(m / 60);
                const min = m % 60;
                return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
            };

            return {
                start: manualRecord.startTime,
                end: manualRecord.endTime,
                total: toStr(totalSpanMin),
                effective: toStr(workMin),
                overtime: toStr(overtimeMin),
                overtimeCost: cost,
                hasOvertime: overtimeMin > 0,
                serviceCount: driverServices.length, // Display service count even if manual
                isManual: true,
                manualId: manualRecord.id
            };
        }


        // Fallback to Service Calculation
        if (driverServices.length === 0) return null;

        const sorted = [...driverServices].sort((a, b) => a.hora.localeCompare(b.hora));
        const first = sorted[0];
        const last = sorted[sorted.length - 1];

        // Helper to convert HH:MM to minutes
        const toMin = (t: string) => {
            const [h, m] = t.split(':').map(Number);
            return h * 60 + m;
        };

        const startMin = toMin(first.hora);
        // Assume last service takes 60 mins -> End of Shift
        const endMin = toMin(last.hora) + 60;

        const totalSpanMin = endMin - startMin;
        const lunchMin = 60; // 1 hour fixed deduction

        // Work minutes = Total Span - Lunch
        // If total span is less than lunch, it's 0 (edge case)
        const workMin = Math.max(0, totalSpanMin - lunchMin);

        // Standard Day: 9 hours now (9 * 60 = 540 minutes)
        const standardDayMin = 9 * 60;
        const overtimeMin = Math.max(0, workMin - standardDayMin);

        // Calculate Cost
        const overtimeHours = overtimeMin / 60;
        let cost = 0;
        if (driver.valorHora && overtimeHours > 0) {
            cost = overtimeHours * driver.valorHora;
        }

        // Min to HH:MM string
        const toStr = (m: number) => {
            const h = Math.floor(m / 60);
            const min = m % 60;
            return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
        };

        return {
            start: first.hora,
            end: toStr(endMin), // Estimated end
            total: toStr(totalSpanMin),
            effective: toStr(workMin),
            overtime: toStr(overtimeMin),
            overtimeCost: cost,
            hasOvertime: overtimeMin > 0,
            serviceCount: driverServices.length,
            isManual: false
        };
    };

    return (
        <div className="h-full overflow-y-auto custom-scrollbar p-4 md:p-8 space-y-8 relative">
            {/* Header Toolbar */}
            <div className="h-16 border-b border-slate-800 flex items-center justify-between px-8 bg-[#0f172a]/95 backdrop-blur z-10 sticky top-0">
                <h1 className="text-xl font-bold text-white flex items-center gap-2">
                    <Clock className="w-5 h-5 text-emerald-500" />
                    Registo de Horas
                </h1>
                <div className="flex items-center gap-4">
                    {userRole === 'admin' && (
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            Registar Horas
                        </button>
                    )}
                    <div className="flex items-center gap-2 text-sm bg-slate-900/50 px-4 py-2 rounded-lg border border-slate-700/50">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        <span className="text-slate-300">{new Date().toLocaleDateString('pt-PT')}</span>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 p-8">
                <div className="max-w-7xl mx-auto">

                    {/* Stats Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        <div className="bg-[#1e293b]/50 border border-slate-700/50 rounded-2xl p-6">
                            <h3 className="text-slate-400 text-sm font-medium mb-2">{t('hours.card.active_drivers')}</h3>
                            <p className="text-3xl font-bold text-white">{motoristas.filter(m => assigned.some(s => s.motoristaId === m.id) || todaysManualHours.some(h => h.motoristaId === m.id)).length}</p>
                        </div>
                        <div className="bg-[#1e293b]/50 border border-slate-700/50 rounded-2xl p-6">
                            <h3 className="text-slate-400 text-sm font-medium mb-2">{t('hours.card.total_services')}</h3>
                            <p className="text-3xl font-bold text-white">{assigned.length}</p>
                        </div>
                        <div className="bg-[#1e293b]/50 border border-slate-700/50 rounded-2xl p-6">
                            <h3 className="text-slate-400 text-sm font-medium mb-2">{t('hours.card.extras_detected')}</h3>
                            <p className="text-3xl font-bold text-emerald-400">
                                {motoristas.filter(m => {
                                    const stats = calculateDriverHours(assigned.filter(s => s.motoristaId === m.id), m);
                                    return stats?.hasOvertime;
                                }).length}
                            </p>
                        </div>
                    </div>

                    {/* Calculate Total Daily Cost */}
                    {(() => {
                        const totalDailyCost = motoristas.reduce((acc, driver) => {
                            const driverServices = assigned.filter(s => s.motoristaId === driver.id);
                            const stats = calculateDriverHours(driverServices, driver);
                            return acc + (stats?.overtimeCost || 0);
                        }, 0);

                        return (
                            <div className="bg-[#1e293b]/50 border border-slate-700/50 rounded-2xl overflow-hidden shadow-xl mb-12">
                                <div className="p-6 border-b border-slate-700/50 flex justify-between items-center bg-slate-800/20">
                                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                        <Euro className="w-5 h-5 text-emerald-500" />
                                        {t('hours.table.title')}
                                    </h2>
                                    {hasAccess(userRole, 'hours_view_costs') && (
                                        <div className="text-sm font-mono font-bold text-emerald-400 bg-emerald-500/10 px-4 py-2 rounded-lg border border-emerald-500/20 flex items-center gap-2">
                                            <span>Total:</span>
                                            <span className="text-white">{totalDailyCost.toFixed(2)}€</span>
                                        </div>
                                    )}
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm text-slate-300">
                                        <thead className="bg-[#0f172a]/80 text-slate-400 uppercase text-xs tracking-wider">
                                            <tr>
                                                <th className="p-5 font-bold border-b border-slate-700">{t('hours.table.driver')}</th>
                                                <th className="p-5 font-bold border-b border-slate-700">{t('hours.table.entry')}</th>
                                                <th className="p-5 font-bold border-b border-slate-700">{t('hours.table.exit')}</th>
                                                <th className="p-5 font-bold border-b border-slate-700 text-center">{t('hours.table.amplitude')}</th>
                                                <th className="p-5 font-bold border-b border-slate-700 text-center">{t('hours.table.lunch')}</th>
                                                <th className="p-5 font-bold border-b border-slate-700 text-white bg-slate-800/30">{t('hours.table.real_hours')}</th>
                                                <th className="p-5 font-bold border-b border-slate-700 text-emerald-400 bg-emerald-950/10">{t('hours.table.extras')}</th>
                                                <th className="p-5 font-bold border-b border-slate-700 text-center">Origem</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-800/50">
                                            {motoristas.map(driver => {
                                                const driverServices = assigned.filter(s => s.motoristaId === driver.id);
                                                const stats = calculateDriverHours(driverServices, driver);

                                                if (!stats) return null;

                                                return (
                                                    <tr key={driver.id} className="hover:bg-slate-800/30 transition-colors group">
                                                        <td className="p-5">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-white text-xs font-bold border-2 border-slate-600 group-hover:border-slate-500 transition-colors">
                                                                    {driver.nome.substring(0, 2).toUpperCase()}
                                                                </div>
                                                                <div>
                                                                    <div className="font-bold text-white text-base">{driver.nome}</div>
                                                                    <div className="text-xs text-slate-500">{stats.serviceCount} serviços hoje</div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="p-5 font-mono text-base text-slate-300">{stats.start}</td>
                                                        <td className="p-5 font-mono text-base text-slate-400">{stats.end}</td>
                                                        <td className="p-5 font-mono text-center">{stats.total}</td>
                                                        <td className="p-5 text-slate-500 text-center">- 1h</td>
                                                        <td className="p-5 font-mono font-bold text-white text-lg bg-slate-800/30">
                                                            {stats.effective}
                                                        </td>
                                                        <td className="p-5 font-mono bg-emerald-950/10">
                                                            {stats.hasOvertime ? (
                                                                <div className="flex flex-col items-center">
                                                                    <span className="inline-flex items-center gap-1 text-emerald-400 font-bold bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                                                                        + {stats.overtime}
                                                                    </span>
                                                                    {hasAccess(userRole, 'hours_view_costs') && stats.overtimeCost > 0 && (
                                                                        <span className="text-[10px] text-slate-400 mt-1 font-mono">
                                                                            {stats.overtimeCost.toFixed(2)}€
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <span className="text-slate-600 flex justify-center">-</span>
                                                            )}
                                                        </td>
                                                        <td className="p-5 text-center">
                                                            {stats.isManual ? (
                                                                <div className="flex items-center justify-center gap-2">
                                                                    <span className="text-xs font-bold bg-blue-500/10 text-blue-400 px-2 py-1 rounded border border-blue-500/20">Manual</span>
                                                                    <button
                                                                        onClick={() => stats.manualId && deleteManualHourRecord(stats.manualId)}
                                                                        className="p-1 text-slate-400 hover:text-red-400 transition-colors"
                                                                        title="Apagar Registo Manual"
                                                                    >
                                                                        <Trash2 className="w-4 h-4" />
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <span className="text-xs font-bold bg-slate-700/50 text-slate-400 px-2 py-1 rounded">Auto</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )
                    })()}
                </div>
            </div>

            {/* Manual Entry Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-[#1e293b] w-full max-w-md rounded-2xl border border-slate-700 shadow-2xl overflow-hidden">
                        <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
                            <h2 className="text-xl font-bold text-white">Registo Manual de Horas</h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">x</button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Motorista</label>
                                <select
                                    className="w-full bg-slate-800 border-slate-700 text-white rounded-lg p-2.5"
                                    required
                                    value={formData.motoristaId}
                                    onChange={e => setFormData({ ...formData, motoristaId: e.target.value })}
                                >
                                    <option value="">Selecione um motorista...</option>
                                    {motoristas.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Data</label>
                                    <input
                                        type="date"
                                        className="w-full bg-slate-800 border-slate-700 text-white rounded-lg p-2.5"
                                        required
                                        value={formData.date}
                                        onChange={e => setFormData({ ...formData, date: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Pausa (min)</label>
                                    <input
                                        type="number"
                                        className="w-full bg-slate-800 border-slate-700 text-white rounded-lg p-2.5"
                                        required
                                        value={formData.breakDuration}
                                        onChange={e => setFormData({ ...formData, breakDuration: Number(e.target.value) })}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Hora Entrada</label>
                                    <input
                                        type="time"
                                        className="w-full bg-slate-800 border-slate-700 text-white rounded-lg p-2.5"
                                        required
                                        value={formData.startTime}
                                        onChange={e => setFormData({ ...formData, startTime: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Hora Saída</label>
                                    <input
                                        type="time"
                                        className="w-full bg-slate-800 border-slate-700 text-white rounded-lg p-2.5"
                                        required
                                        value={formData.endTime}
                                        onChange={e => setFormData({ ...formData, endTime: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Observações</label>
                                <textarea
                                    className="w-full bg-slate-800 border-slate-700 text-white rounded-lg p-2.5 h-20"
                                    value={formData.obs}
                                    onChange={e => setFormData({ ...formData, obs: e.target.value })}
                                    placeholder="Motivo da alteração manual..."
                                />
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-bold transition-colors"
                                >
                                    Guardar Registo
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
