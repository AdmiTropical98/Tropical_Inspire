import { useState, useMemo } from 'react';
import { useWorkshop } from '../../contexts/WorkshopContext';
import { useAuth } from '../../contexts/AuthContext';
import { Upload, Trash2, Plus, FileSpreadsheet, FileDown, AlertCircle, CheckCircle2, Info, Moon, Star, Clock, Euro } from 'lucide-react';
import { parseCartrackD103 } from '../../utils/pdfParser';
import { calculateWorkHoursFromTrips } from './ImportLogic';
import { calculateShift } from './HoursCalculator';
import type { ManualHourRecord } from '../../types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

interface HoursDailyViewProps {
    selectedDate: string;
}

export default function HoursDailyView({ selectedDate }: HoursDailyViewProps) {
    const { motoristas, manualHours, addManualHourRecord, deleteManualHourRecord } = useWorkshop();
    const { currentUser } = useAuth();

    // Stats Calculation
    const dailyRecords = useMemo(() => manualHours.filter(h => h.date === selectedDate), [manualHours, selectedDate]);

    const stats = useMemo(() => {
        let totalMins = 0;
        let nightMins = 0;
        let extraMins = 0;
        let totalCost = 0;

        dailyRecords.forEach(rec => {
            const driver = motoristas.find(m => m.id === rec.motoristaId);
            const calc = calculateShift(rec.startTime, rec.endTime, rec.breakDuration);
            totalMins += calc.totalMinutes;
            nightMins += calc.nightMinutes;
            extraMins += calc.extraMinutes;
            if (driver?.valorHora) {
                totalCost += (calc.totalMinutes / 60) * driver.valorHora;
            }
        });

        const toH = (m: number) => `${Math.floor(m / 60)}h ${m % 60}m`;

        return {
            totalHours: toH(totalMins),
            nightHours: toH(nightMins),
            extraHours: toH(extraMins),
            totalCost: totalCost.toFixed(2) + ' €',
            count: dailyRecords.length
        };
    }, [dailyRecords, motoristas]);

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

    // Conflict Detection
    const getStatus = (record: ManualHourRecord, allDriverRecords: ManualHourRecord[]) => {
        if (!record.startTime || !record.endTime) return 'incomplete';

        // Find overlaps
        const start = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
        const s1 = start(record.startTime);
        const e1 = start(record.endTime) + (start(record.endTime) <= s1 ? 1440 : 0);

        const hasOverlap = allDriverRecords.some(r => {
            if (r.id === record.id) return false;
            const s2 = start(r.startTime);
            const e2 = start(r.endTime) + (start(r.endTime) <= s2 ? 1440 : 0);
            return (s1 < e2 && e1 > s2);
        });

        return hasOverlap ? 'conflict' : 'complete';
    };

    const handleBulkQuickRegister = async () => {
        if (selectedDrivers.size === 0) return;
        setIsImporting(true);
        try {
            for (const driverId of selectedDrivers) {
                const existing = manualHours.find(r => r.motoristaId === driverId && r.date === selectedDate);
                if (existing) await deleteManualHourRecord(existing.id);
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
            }
            setSelectedDrivers(new Set());
        } catch (e: unknown) { console.error(e); }
        finally { setIsImporting(false); }
    };

    const [isImporting, setIsImporting] = useState(false);

    const [showAddModal, setShowAddModal] = useState(false);
    const [newData, setNewData] = useState({ motoristaId: '', startTime: '09:00', endTime: '18:00', breakDuration: 60, obs: '' });

    const [showDriverSelectModal, setShowDriverSelectModal] = useState(false);
    const [pendingTrips, setPendingTrips] = useState<import('./ImportLogic').DailyWorkSuggestion[]>([]);
    const [targetDriverId, setTargetDriverId] = useState('');

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsImporting(true);
        try {
            const trips = await parseCartrackD103(file);
            const suggestions = calculateWorkHoursFromTrips(trips);
            setPendingTrips(suggestions);
            setTargetDriverId('');
            setShowDriverSelectModal(true);
        } catch (err: unknown) {
            console.error(err);
            setIsImporting(false);
        }
        e.target.value = '';
    };

    const confirmImportWithDriver = async () => {
        if (!targetDriverId) return;
        setIsImporting(true);
        try {
            for (const sugg of pendingTrips) {
                const conflict = manualHours.find(h => h.motoristaId === targetDriverId && h.date === sugg.date);
                if (conflict) await deleteManualHourRecord(conflict.id);
                await addManualHourRecord({
                    id: crypto.randomUUID(),
                    adminId: currentUser?.id,
                    motoristaId: targetDriverId,
                    date: sugg.date,
                    startTime: sugg.startTime,
                    endTime: sugg.endTime,
                    breakDuration: sugg.breakDuration,
                    obs: `Importação PDF - Cartrack`
                });
            }
        } catch (err: unknown) { console.error(err); }
        finally {
            setIsImporting(false);
            setShowDriverSelectModal(false);
            setPendingTrips([]);
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

    const generateDailyPDF = () => {
        const doc = new jsPDF('p', 'mm', 'a4');
        doc.setFontSize(18);
        doc.text(`Relatório de Horas - ${selectedDate}`, 14, 20);

        const tableColumn = ["Motorista", "Início", "Fim", "Pausa", "Total", "Noturnas", "Extra"];
        const tableRows = dailyRecords.map(rec => {
            const driver = motoristas.find(m => m.id === rec.motoristaId);
            const calc = calculateShift(rec.startTime, rec.endTime, rec.breakDuration);
            return [
                driver?.nome || 'N/A',
                rec.startTime,
                rec.endTime,
                rec.breakDuration + 'm',
                calc.totalHours,
                calc.nightHours,
                calc.extraHours
            ];
        });

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows as (string | number)[][],
            startY: 30,
            styles: { fontSize: 9 },
            headStyles: { fillColor: [16, 185, 129] }
        });
        doc.save(`Horas_Diarias_${selectedDate}.pdf`);
    };

    const generateDailyExcel = () => {
        const excelData = dailyRecords.map(rec => {
            const driver = motoristas.find(m => m.id === rec.motoristaId);
            const calc = calculateShift(rec.startTime, rec.endTime, rec.breakDuration);
            return {
                'Motorista': driver?.nome || 'N/A',
                'Data': rec.date,
                'Início': rec.startTime,
                'Fim': rec.endTime,
                'Pausa (min)': rec.breakDuration,
                'Total Horas': calc.totalHours,
                'Horas Noturnas': calc.nightHours,
                'Horas Extra': calc.extraHours
            };
        });
        const worksheet = XLSX.utils.json_to_sheet(excelData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Daily_Hours");
        XLSX.writeFile(workbook, `Horas_Diarias_${selectedDate}.xlsx`);
    };

    return (
        <div className="space-y-6">
            {/* Quick Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800 shadow-lg">
                    <div className="flex items-center gap-2 text-slate-500 mb-1">
                        <Clock className="w-4 h-4" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Total Horas</span>
                    </div>
                    <div className="text-xl font-black text-white">{stats.totalHours}</div>
                </div>
                <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800 shadow-lg">
                    <div className="flex items-center gap-2 text-purple-400 mb-1">
                        <Moon className="w-4 h-4" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Noturnas</span>
                    </div>
                    <div className="text-xl font-black text-purple-400">{stats.nightHours}</div>
                </div>
                <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800 shadow-lg">
                    <div className="flex items-center gap-2 text-amber-400 mb-1">
                        <Star className="w-4 h-4" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Extra</span>
                    </div>
                    <div className="text-xl font-black text-amber-400">{stats.extraHours}</div>
                </div>
                <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800 shadow-lg">
                    <div className="flex items-center gap-2 text-emerald-400 mb-1">
                        <Euro className="w-4 h-4" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Custo Est.</span>
                    </div>
                    <div className="text-xl font-black text-emerald-400">{stats.totalCost}</div>
                </div>
                <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800 shadow-lg col-span-2 md:col-span-1">
                    <div className="flex items-center gap-2 text-blue-400 mb-1">
                        <Info className="w-4 h-4" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Registos</span>
                    </div>
                    <div className="text-xl font-black text-blue-400">{stats.count} / {motoristas.length}</div>
                </div>
            </div>

            {/* Toolbar */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900/80 p-4 rounded-2xl border border-white/5 shadow-2xl backdrop-blur-sm">
                <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-emerald-500/10 rounded-xl">
                        <Clock className="w-5 h-5 text-emerald-500" />
                    </div>
                    <div>
                        <h2 className="text-white font-black uppercase tracking-tighter text-lg">Registos Diários</h2>
                        <p className="text-slate-500 text-xs font-mono">{selectedDate}</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                    <div className="relative group flex-1 md:flex-none">
                        <input type="file" accept=".pdf" onChange={handleImport} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" disabled={isImporting} />
                        <button className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-bold transition-all">
                            <Upload className="w-4 h-4 text-blue-400" />
                            Importar D103
                        </button>
                    </div>
                    <button onClick={() => setShowAddModal(true)} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-emerald-900/20">
                        <Plus className="w-4 h-4" />
                        Novo Registo
                    </button>
                    <div className="flex gap-2 w-full md:w-auto pt-2 md:pt-0 border-t md:border-t-0 md:pl-4 border-white/5">
                        <button onClick={generateDailyExcel} className="flex-1 md:flex-none p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition-all" title="Exportar Excel">
                            <FileSpreadsheet className="w-5 h-5" />
                        </button>
                        <button onClick={generateDailyPDF} className="flex-1 md:flex-none p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition-all" title="Exportar PDF">
                            <FileDown className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Bulk Actions Bar */}
            {selectedDrivers.size > 0 && (
                <div className="bg-blue-600/10 border border-blue-500/30 p-4 rounded-2xl flex items-center justify-between animate-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-black">
                            {selectedDrivers.size}
                        </div>
                        <span className="text-blue-200 text-sm font-bold">Motoristas Selecionados</span>
                    </div>
                    <button
                        onClick={handleBulkQuickRegister}
                        disabled={isImporting}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest shadow-xl transition-all active:scale-95"
                    >
                        {isImporting ? 'A PROCESSAR...' : 'Registar 09:00 - 18:00'}
                    </button>
                </div>
            )}

            {/* Main Content (Table on Desktop, Cards on Mobile) */}
            <div className="hidden md:block bg-slate-900/50 border border-white/5 rounded-3xl overflow-x-auto table-scroll shadow-2xl">
                <table className="w-full text-left text-sm border-collapse" style={{ minWidth: '1000px' }}>
                    <thead>
                        <tr className="bg-slate-950/50 text-slate-500 uppercase text-[10px] font-black tracking-widest border-b border-white/5">
                            <th className="p-5 w-12 text-center">
                                <input type="checkbox" className="rounded-md bg-slate-800 border-slate-700 w-4 h-4 checked:bg-blue-600" checked={selectedDrivers.size === motoristas.length && motoristas.length > 0} onChange={toggleAll} />
                            </th>
                            <th className="p-5">Motorista</th>
                            <th className="p-5">Período</th>
                            <th className="p-5 text-center">Pausa</th>
                            <th className="p-5 text-center">Trabalho</th>
                            <th className="p-5 text-center">Noturnas</th>
                            <th className="p-5 text-center">Extra</th>
                            <th className="p-5 text-right">Total €</th>
                            <th className="p-5 text-center">Estado</th>
                            <th className="p-5 text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {motoristas.length === 0 ? (
                            <tr><td colSpan={10} className="p-20 text-center text-slate-600 font-medium">Sem motoristas registados no sistema.</td></tr>
                        ) : (
                            motoristas.map(driver => {
                                const records = dailyRecords.filter(r => r.motoristaId === driver.id);
                                const isSelected = selectedDrivers.has(driver.id);

                                if (records.length === 0) {
                                    return (
                                        <tr key={driver.id} className="hover:bg-white/[0.02] bg-transparent transition-colors">
                                            <td className="p-5 text-center">
                                                <input type="checkbox" className="rounded-md bg-slate-800 border-slate-700 w-4 h-4" checked={isSelected} onChange={() => toggleDriver(driver.id)} />
                                            </td>
                                            <td className="p-5">
                                                <div className="flex flex-col">
                                                    <span className="text-slate-500 font-bold">{driver.nome}</span>
                                                    <span className="text-[10px] text-slate-600 uppercase font-bold tracking-tighter">Sem registo hoje</span>
                                                </div>
                                            </td>
                                            <td colSpan={6} className="p-5 text-center text-slate-700 italic text-xs">Aguardando lançamento...</td>
                                            <td className="p-5 text-center">
                                                <span className="px-2 py-1 bg-slate-800 text-slate-500 rounded-lg text-[10px] font-black uppercase">Vazio</span>
                                            </td>
                                            <td className="p-5 text-right">
                                                <button onClick={() => { setNewData(d => ({ ...d, motoristaId: driver.id })); setShowAddModal(true); }} className="p-2 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white rounded-lg transition-all" title="Lançar Horas">
                                                    <Plus className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                }

                                return records.map((record, index) => {
                                    const calc = calculateShift(record.startTime, record.endTime, record.breakDuration);
                                    const status = getStatus(record, records);
                                    const cost = driver.valorHora ? (calc.totalMinutes / 60) * driver.valorHora : 0;

                                    return (
                                        <tr key={record.id} className="hover:bg-emerald-500/[0.03] transition-colors group">
                                            {index === 0 ? (
                                                <>
                                                    <td className="p-5 text-center" rowSpan={records.length}>
                                                        <input type="checkbox" className="rounded-md bg-slate-800 border-slate-700 w-4 h-4" checked={isSelected} onChange={() => toggleDriver(driver.id)} />
                                                    </td>
                                                    <td className="p-5" rowSpan={records.length}>
                                                        <div className="flex flex-col">
                                                            <span className="text-white font-black uppercase tracking-tighter text-sm">{driver.nome}</span>
                                                            <span className="text-[10px] text-slate-500 font-mono">CC: {driver.centroCustoId || 'N/A'}</span>
                                                        </div>
                                                    </td>
                                                </>
                                            ) : null}
                                            <td className="p-5">
                                                <div className="flex items-center gap-2 font-mono text-sm">
                                                    <span className="text-emerald-400 font-black">{record.startTime}</span>
                                                    <span className="text-slate-600">→</span>
                                                    <span className="text-emerald-400 font-black">{record.endTime}</span>
                                                </div>
                                            </td>
                                            <td className="p-5 text-center font-mono text-slate-400">{record.breakDuration}m</td>
                                            <td className="p-5 text-center">
                                                <div className="font-mono font-black text-white bg-slate-800 px-2 py-0.5 rounded-lg inline-block">{calc.totalHours}</div>
                                            </td>
                                            <td className="p-5 text-center">
                                                <span className={`font-mono font-bold ${calc.nightMinutes > 0 ? 'text-purple-400' : 'text-slate-600'}`}>{calc.nightHours}</span>
                                            </td>
                                            <td className="p-5 text-center">
                                                <span className={`font-mono font-bold ${calc.extraMinutes > 0 ? 'text-amber-400' : 'text-slate-600'}`}>{calc.extraHours}</span>
                                            </td>
                                            <td className="p-5 text-right font-black text-emerald-400">{cost.toFixed(2)} €</td>
                                            <td className="p-5 text-center">
                                                {status === 'conflict' ? (
                                                    <div className="flex items-center justify-center gap-1.5 px-2 py-1 bg-red-500/10 text-red-500 rounded-lg border border-red-500/20 text-[10px] font-black uppercase animate-pulse">
                                                        <AlertCircle className="w-3 h-3" /> Conflito
                                                    </div>
                                                ) : status === 'complete' ? (
                                                    <div className="flex items-center justify-center gap-1.5 px-2 py-1 bg-emerald-500/10 text-emerald-500 rounded-lg border border-emerald-500/20 text-[10px] font-black uppercase">
                                                        <CheckCircle2 className="w-3 h-3" /> OK
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center justify-center gap-1.5 px-2 py-1 bg-orange-500/10 text-orange-500 rounded-lg border border-orange-500/20 text-[10px] font-black uppercase">
                                                        <Info className="w-3 h-3" /> Incomp.
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-5 text-right">
                                                <button onClick={() => deleteManualHourRecord(record.id)} className="p-2.5 text-slate-600 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                });
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Mobile View (Cards) */}
            <div className="md:hidden space-y-4">
                {motoristas.map(driver => {
                    const records = dailyRecords.filter(r => r.motoristaId === driver.id);
                    return (
                        <div key={driver.id} className={`bg-slate-900/50 rounded-2xl border ${records.length > 0 ? 'border-emerald-500/20 shadow-lg shadow-emerald-500/5' : 'border-white/5 opacity-70'} p-4`}>
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex flex-col">
                                    <h3 className="text-white font-black uppercase tracking-tighter text-base">{driver.nome}</h3>
                                    <span className="text-[10px] text-slate-500 font-mono">CC: {driver.centroCustoId || 'N/A'}</span>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => { setNewData(d => ({ ...d, motoristaId: driver.id })); setShowAddModal(true); }} className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg transition-all" title="Adicionar">
                                        <Plus className="w-4 h-4" />
                                    </button>
                                    <input type="checkbox" className="rounded-md bg-slate-800 border-slate-700 w-6 h-6" checked={selectedDrivers.has(driver.id)} onChange={() => toggleDriver(driver.id)} />
                                </div>
                            </div>

                            {records.length === 0 ? (
                                <p className="text-slate-600 text-xs italic text-center py-2 bg-slate-950/50 rounded-xl">Sem lançamentos para hoje</p>
                            ) : (
                                <div className="space-y-3">
                                    {records.map(record => {
                                        const calc = calculateShift(record.startTime, record.endTime, record.breakDuration);
                                        const status = getStatus(record, records);
                                        const cost = driver.valorHora ? (calc.totalMinutes / 60) * driver.valorHora : 0;
                                        return (
                                            <div key={record.id} className="bg-slate-950/50 p-3 rounded-xl border border-white/5 space-y-3">
                                                <div className="flex justify-between items-center">
                                                    <div className="flex items-center gap-2 font-mono text-xs">
                                                        <span className="text-emerald-400 font-black">{record.startTime}</span>
                                                        <span className="text-slate-600">→</span>
                                                        <span className="text-emerald-400 font-black">{record.endTime}</span>
                                                    </div>
                                                    <button onClick={() => deleteManualHourRecord(record.id)} className="text-slate-600 active:text-red-500 p-2">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                                <div className="grid grid-cols-3 gap-2">
                                                    <div className="bg-slate-900 p-2 rounded-lg text-center">
                                                        <div className="text-[8px] text-slate-500 uppercase font-black">Total</div>
                                                        <div className="text-sm font-black text-white">{calc.totalHours}</div>
                                                    </div>
                                                    <div className="bg-slate-900 p-2 rounded-lg text-center">
                                                        <div className="text-[8px] text-purple-500 uppercase font-black">Notur.</div>
                                                        <div className="text-sm font-black text-purple-400">{calc.nightHours}</div>
                                                    </div>
                                                    <div className="bg-slate-900 p-2 rounded-lg text-center">
                                                        <div className="text-[8px] text-amber-500 uppercase font-black">Extra</div>
                                                        <div className="text-sm font-black text-amber-400">{calc.extraHours}</div>
                                                    </div>
                                                </div>
                                                <div className="flex justify-between items-center text-xs pt-1">
                                                    <span className="text-emerald-400 font-black">{cost.toFixed(2)} €</span>
                                                    {status === 'conflict' ? (
                                                        <span className="text-red-500 font-black uppercase text-[10px]">Conflito de Horário!</span>
                                                    ) : (
                                                        <span className="text-slate-600 text-[10px] font-bold">Pausa: {record.breakDuration}m</span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
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
            {/* Driver Select Modal for PDF */}
            {showDriverSelectModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-[#1e293b] w-full max-w-sm rounded-2xl border border-slate-700 shadow-2xl p-6">
                        <h3 className="text-lg font-bold text-white mb-2">Selecione o Motorista</h3>
                        <p className="text-slate-400 text-sm mb-4">
                            O PDF contém {pendingTrips.length} dias de atividade.
                            A quem pertence este relatório?
                        </p>

                        <div className="mb-6">
                            <label className="block text-xs uppercase text-slate-500 font-bold mb-1">Motorista</label>
                            <select
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-blue-500"
                                value={targetDriverId}
                                onChange={e => setTargetDriverId(e.target.value)}
                            >
                                <option value="">Selecione...</option>
                                {motoristas.map(m => (
                                    <option key={m.id} value={m.id}>{m.nome}</option>
                                ))}
                            </select>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => { setShowDriverSelectModal(false); setIsImporting(false); setPendingTrips([]); }}
                                className="flex-1 bg-slate-800 hover:bg-slate-700 text-white p-3 rounded-lg"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmImportWithDriver}
                                disabled={!targetDriverId || isImporting}
                                className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white p-3 rounded-lg font-bold"
                            >
                                Confirmar Importação
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
