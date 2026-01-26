import { useState } from 'react';
import { useWorkshop } from '../../contexts/WorkshopContext';
import { useAuth } from '../../contexts/AuthContext';
import { Upload, Trash2, Plus } from 'lucide-react';
import { parseCartrackD103 } from '../../utils/pdfParser';
import { calculateWorkHoursFromTrips } from './ImportLogic';

interface HoursDailyViewProps {
    selectedDate: string;
}

export default function HoursDailyView({ selectedDate }: HoursDailyViewProps) {
    const { motoristas, manualHours, addManualHourRecord, deleteManualHourRecord } = useWorkshop();
    const { currentUser } = useAuth();

    const [selectedDrivers, setSelectedDrivers] = useState<Set<string>>(new Set());

    // Toggle Selection
    const toggleDriver = (id: string) => {
        const newSet = new Set(selectedDrivers);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedDrivers(newSet);
    };

    const toggleAll = () => {
        if (selectedDrivers.size === motoristas.length) {
            setSelectedDrivers(new Set());
        } else {
            setSelectedDrivers(new Set(motoristas.map(m => m.id)));
        }
    };

    // Bulk Action: Quick Register 09-18
    const handleBulkQuickRegister = async () => {
        if (selectedDrivers.size === 0) return;
        setIsImporting(true); // Reuse loading state
        let count = 0;

        try {
            for (const driverId of selectedDrivers) {
                // Remove existing
                const existing = manualHours.find(r => r.motoristaId === driverId && r.date === selectedDate);
                if (existing) await deleteManualHourRecord(existing.id);

                // Add New
                await addManualHourRecord({
                    id: crypto.randomUUID(),
                    adminId: currentUser?.id,
                    motoristaId: driverId,
                    date: selectedDate,
                    startTime: '09:00',
                    endTime: '18:00',
                    breakDuration: 60,
                    obs: 'Registo Rápido (Bulk)'
                });
                count++;
            }
            setSelectedDrivers(new Set()); // Clear selection
            setImportStats({ processed: count, updated: count, errors: [] });
        } catch (e: any) {
            console.error(e);
        } finally {
            setIsImporting(false);
        }
    };

    const [isImporting, setIsImporting] = useState(false);
    const [importStats, setImportStats] = useState<{ processed: number, updated: number, errors: string[] } | null>(null);

    // Filter Manual Hours for Date
    const dailyRecords = manualHours.filter(h => h.date === selectedDate);

    // Quick Add Modal (same as before but inline logic maybe?)
    const [showAddModal, setShowAddModal] = useState(false);
    const [newData, setNewData] = useState({ motoristaId: '', startTime: '09:00', endTime: '18:00', breakDuration: 60, obs: '' });

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsImporting(true);
        setImportStats(null);
        const errors: string[] = [];
        let updatedCount = 0;

        try {
            // 1. Parse PDF
            const trips = await parseCartrackD103(file);
            if (trips.length === 0) {
                errors.push("Nenhuma viagem encontrada no PDF. Verifique se é um relatório D103 válido.");
            }

            // 2. Calculate Suggestions (Logic B+C)
            const suggestions = calculateWorkHoursFromTrips(trips);

            // 3. Apply to Drivers matching the Plate
            for (const sugg of suggestions) {
                // Determine Driver
                // Normalize Plate
                const plateClean = sugg.plate.replace(/[^A-Z0-9]/g, '');

                const driver = motoristas.find(m =>
                    (m.currentVehicle && m.currentVehicle.replace(/[^a-zA-Z0-9]/g, '') === plateClean)
                    // Could also check cartrack link if we had vehicle list with plates here, 
                    // but usually currentVehicle is the association source of truth for "Assignment".
                    // OR: Cartrack ID. But PDF only gives Plate.
                );

                if (driver) {
                    // Update or Create Record
                    // Delete existing for this day first? Or overwrite locally?
                    // Let's Find existing
                    const existing = dailyRecords.find(r => r.motoristaId === driver.id);
                    if (existing) {
                        await deleteManualHourRecord(existing.id);
                    }

                    // Add New
                    await addManualHourRecord({
                        id: crypto.randomUUID(),
                        adminId: currentUser?.id,
                        motoristaId: driver.id,
                        date: sugg.date, // Careful: PDF might have multiple dates. 
                        // If view is "Daily", we should only import for selectedDate?
                        // USER REQUEST: "IMPORTAR ESTES RELATÓRIOS ... E NOS DIAS QUE ELES ANDARAM"
                        // This implies the PDF might cover a MONTH.
                        // So we should NOT filter by 'selectedDate' strictly, 
                        // but maybe we should confirm if this View is just for VIEWING a single day.
                        // Actually `addManualHourRecord` works for any date.
                        startTime: sugg.startTime,
                        endTime: sugg.endTime,
                        breakDuration: sugg.breakDuration,
                        obs: `Importado PDF (${sugg.plate}) - ${sugg.log.length > 0 ? sugg.log.length + ' pausas detetadas' : 'Sem pausas longas'}`
                    });
                    updatedCount++;
                } else {
                    // Driver not found for plate
                    // Maybe we can log this?
                    // errors.push(`Matrícula ${sugg.plate} não associada a nenhum motorista.`);
                }
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
            console.error(err);
            errors.push(`Erro ao processar ficheiro: ${err.message}`);
        } finally {
            setIsImporting(false);
            setImportStats({ processed: 0, updated: updatedCount, errors });
            e.target.value = ''; // Reset input
        }
    };

    const handleManualSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await addManualHourRecord({
            id: crypto.randomUUID(),
            adminId: currentUser?.id,
            ...newData,
            date: selectedDate,
            createdAt: new Date().toISOString()
        });
        setShowAddModal(false);
        setNewData(prev => ({ ...prev, motoristaId: '' }));
    };

    return (
        <div className="space-y-6">
            {/* Toolbar */}
            <div className="flex justify-between items-center bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                <div className="flex items-center gap-4">
                    <h2 className="text-white font-bold">Registos do Dia</h2>
                    <span className="text-slate-400 text-sm font-mono bg-slate-900 px-2 py-1 rounded">{selectedDate}</span>
                </div>

                <div className="flex items-center gap-3">
                    {/* Import Button */}
                    <div className="relative">
                        <input
                            type="file"
                            accept=".pdf"
                            onChange={handleImport}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            disabled={isImporting}
                        />
                        <button className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${isImporting ? 'bg-slate-700 text-slate-400' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}>
                            {isImporting ? (
                                <>A processar...</>
                            ) : (
                                <>
                                    <Upload className="w-4 h-4" />
                                    Importar PDF D103
                                </>
                            )}
                        </button>
                    </div>

                    <button
                        onClick={() => setShowAddModal(true)}
                        className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        Novo Registo
                    </button>
                </div>
            </div>

            {/* Bulk Actions Bar */}
            {selectedDrivers.size > 0 && (
                <div className="bg-blue-900/30 border border-blue-500/50 p-3 rounded-lg flex items-center justify-between">
                    <span className="text-blue-200 text-sm font-medium">{selectedDrivers.size} motoristas selecionados</span>
                    <button
                        onClick={handleBulkQuickRegister}
                        disabled={isImporting}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded-lg text-sm font-bold shadow-lg transition-all"
                    >
                        {isImporting ? 'A processar...' : 'Definir 09:00 - 18:00 (Rápido)'}
                    </button>
                </div>
            )}

            {/* Import Stats */}
            {importStats && (
                <div className={`p-4 rounded-lg border ${importStats.errors.length > 0 ? 'bg-amber-900/20 border-amber-500/30' : 'bg-emerald-900/20 border-emerald-500/30'}`}>
                    <p className="text-white font-medium">Resultados:</p>
                    <p className="text-slate-300 text-sm">{importStats.updated} registos criados/atualizados.</p>
                    {importStats.errors.length > 0 && (
                        <ul className="mt-2 text-amber-400 text-xs list-disc list-inside">
                            {importStats.errors.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
                            {importStats.errors.length > 5 && <li>...e mais {importStats.errors.length - 5} erros.</li>}
                        </ul>
                    )}
                </div>
            )}

            {/* List */}
            <div className="bg-[#1e293b]/50 border border-slate-700/50 rounded-2xl overflow-hidden shadow-xl">
                <table className="w-full text-left text-sm text-slate-300">
                    <thead className="bg-[#0f172a]/80 text-slate-400 uppercase text-xs tracking-wider">
                        <tr>
                            <th className="p-4 w-4">
                                <input
                                    type="checkbox"
                                    className="rounded bg-slate-800 border-slate-600"
                                    checked={selectedDrivers.size === motoristas.length && motoristas.length > 0}
                                    onChange={toggleAll}
                                />
                            </th>
                            <th className="p-4 font-bold border-b border-slate-700">Motorista</th>
                            <th className="p-4 font-bold border-b border-slate-700">Entrada</th>
                            <th className="p-4 font-bold border-b border-slate-700">Saída</th>
                            <th className="p-4 font-bold border-b border-slate-700">Pausa (min)</th>
                            <th className="p-4 font-bold border-b border-slate-700">Total</th>
                            <th className="p-4 font-bold border-b border-slate-700">Obs</th>
                            <th className="p-4 font-bold border-b border-slate-700 text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                        {motoristas.length === 0 ? (
                            <tr><td colSpan={8} className="p-8 text-center text-slate-500">Sem motoristas registados.</td></tr>
                        ) : (
                            // Iterate MOTORISTAS instead of records to show missing ones too?
                            // User request: "REGISTAR RAPIDO" usually implies checking off list.
                            // Better: Show ALL drivers. If record exists, show it. If not, show empty/button.
                            motoristas.map(driver => {
                                const record = dailyRecords.find(r => r.motoristaId === driver.id);
                                const isSelected = selectedDrivers.has(driver.id);

                                let durationDisplay = '-';
                                let rowClass = 'hover:bg-slate-800/30';

                                if (record) {
                                    const [h1, m1] = record.startTime.split(':').map(Number);
                                    const [h2, m2] = record.endTime.split(':').map(Number);
                                    const diffMin = (h2 * 60 + m2) - (h1 * 60 + m1) - record.breakDuration;
                                    const h = Math.floor(diffMin / 60);
                                    const m = diffMin % 60;
                                    durationDisplay = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
                                    rowClass = 'bg-emerald-900/10 hover:bg-emerald-900/20'; // Highlight present
                                }

                                return (
                                    <tr key={driver.id} className={rowClass}>
                                        <td className="p-4 text-center">
                                            <input
                                                type="checkbox"
                                                className="rounded bg-slate-800 border-slate-600"
                                                checked={isSelected}
                                                onChange={() => toggleDriver(driver.id)}
                                            />
                                        </td>
                                        <td className="p-4 font-medium text-white flex items-center gap-3">
                                            {/* Avatar or Initials could go here */}
                                            {driver.nome}
                                        </td>
                                        <td className="p-4 font-mono">{record?.startTime || '-'}</td>
                                        <td className="p-4 font-mono">{record?.endTime || '-'}</td>
                                        <td className="p-4 font-mono text-center">{record?.breakDuration || '-'}</td>
                                        <td className={`p-4 font-mono font-bold ${record ? 'text-emerald-400' : 'text-slate-600'}`}>
                                            {durationDisplay}
                                        </td>
                                        <td className="p-4 text-xs text-slate-500 max-w-xs truncate">
                                            {record?.obs || '-'}
                                        </td>
                                        <td className="p-4 text-right">
                                            {record && (
                                                <button
                                                    onClick={() => deleteManualHourRecord(record.id)}
                                                    className="p-2 hover:bg-red-500/10 text-slate-400 hover:text-red-400 rounded transition-colors"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Manual Add Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-[#1e293b] w-full max-w-md rounded-2xl border border-slate-700 shadow-2xl p-6">
                        <h3 className="text-xl font-bold text-white mb-4">Novo Registo Manual</h3>
                        <form onSubmit={handleManualSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs uppercase text-slate-500 font-bold mb-1">Motorista</label>
                                <select
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-blue-500"
                                    required
                                    value={newData.motoristaId}
                                    onChange={e => setNewData({ ...newData, motoristaId: e.target.value })}
                                >
                                    <option value="">Selecione...</option>
                                    {motoristas.map(m => (
                                        <option key={m.id} value={m.id}>{m.nome}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs uppercase text-slate-500 font-bold mb-1">Início</label>
                                    <input
                                        type="time"
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white"
                                        value={newData.startTime}
                                        onChange={e => setNewData({ ...newData, startTime: e.target.value })}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs uppercase text-slate-500 font-bold mb-1">Fim</label>
                                    <input
                                        type="time"
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white"
                                        value={newData.endTime}
                                        onChange={e => setNewData({ ...newData, endTime: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs uppercase text-slate-500 font-bold mb-1">Pausa (min)</label>
                                <input
                                    type="number"
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white"
                                    value={newData.breakDuration}
                                    onChange={e => setNewData({ ...newData, breakDuration: Number(e.target.value) })}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs uppercase text-slate-500 font-bold mb-1">Observações</label>
                                <textarea
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white h-20"
                                    value={newData.obs}
                                    onChange={e => setNewData({ ...newData, obs: e.target.value })}
                                />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white p-3 rounded-lg">Cancelar</button>
                                <button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white p-3 rounded-lg font-bold">Guardar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
