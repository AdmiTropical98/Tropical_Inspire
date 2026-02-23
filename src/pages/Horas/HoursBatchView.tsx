import { useState } from 'react';
import { useWorkshop } from '../../contexts/WorkshopContext';
import { useAuth } from '../../contexts/AuthContext';
import { Calendar, Users, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

export default function HoursBatchView() {
    const { motoristas, addManualHourRecord, manualHours, deleteManualHourRecord } = useWorkshop();
    const { currentUser } = useAuth();

    // Form State
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [startTime, setStartTime] = useState('09:00');
    const [endTime, setEndTime] = useState('18:00');
    const [breakDuration, setBreakDuration] = useState(60);
    const [obs, setObs] = useState('Lançamento em Massa');

    // Weekdays (0=Sun, 1=Mon... 6=Sat)
    // Default: Mon-Fri selected
    const [selectedWeekdays, setSelectedWeekdays] = useState<Set<number>>(new Set([1, 2, 3, 4, 5]));

    // Drivers
    const [selectedDrivers, setSelectedDrivers] = useState<Set<string>>(new Set());

    // Status
    const [isProcessing, setIsProcessing] = useState(false);
    const [result, setResult] = useState<{ created: number, overwritten: number, errors: string[] } | null>(null);

    // Helpers
    const toggleWeekday = (day: number) => {
        const newSet = new Set(selectedWeekdays);
        if (newSet.has(day)) newSet.delete(day);
        else newSet.add(day);
        setSelectedWeekdays(newSet);
    };

    const toggleDriver = (id: string) => {
        const newSet = new Set(selectedDrivers);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedDrivers(newSet);
    };

    const toggleAllDrivers = () => {
        if (selectedDrivers.size === motoristas.length) setSelectedDrivers(new Set());
        else setSelectedDrivers(new Set(motoristas.map(m => m.id)));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!startDate || !endDate || selectedDrivers.size === 0) return;

        setIsProcessing(true);
        setResult(null);

        let createdCount = 0;
        let overwrittenCount = 0;
        const errors: string[] = [];
        const start = new Date(startDate);
        const end = new Date(endDate);

        try {
            // Iterate Dates
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                const dayOfWeek = d.getDay(); // 0-6
                const dateStr = d.toISOString().split('T')[0];

                if (!selectedWeekdays.has(dayOfWeek)) continue;

                // Iterate Drivers
                for (const driverId of selectedDrivers) {
                    try {
                        // Check existing
                        const existing = manualHours.find(h => h.motoristaId === driverId && h.date === dateStr);
                        if (existing) {
                            await deleteManualHourRecord(existing.id);
                            overwrittenCount++;
                        }

                        await addManualHourRecord({
                            id: crypto.randomUUID(),
                            adminId: currentUser?.id,
                            motoristaId: driverId,
                            date: dateStr,
                            startTime,
                            endTime,
                            breakDuration,
                            obs
                        });
                        createdCount++;
                    } catch (err: any) {
                        errors.push(`Erro em ${dateStr} (Driver ${driverId}): ${err.message}`);
                    }
                }
            }
            setResult({ created: createdCount, overwritten: overwrittenCount, errors });
        } catch (err: any) {
            console.error(err);
            errors.push('Erro crítico: ' + err.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const weekDaysMap = [
        { id: 1, label: 'Seg' },
        { id: 2, label: 'Ter' },
        { id: 3, label: 'Qua' },
        { id: 4, label: 'Qui' },
        { id: 5, label: 'Sex' },
        { id: 6, label: 'Sáb' },
        { id: 0, label: 'Dom' },
    ];

    return (
        <div className="w-full space-y-6">
            <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700">
                <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-blue-400" />
                    Lançamento em Massa
                </h2>

                <form onSubmit={handleSubmit} className="space-y-8">
                    {/* 1. Time Range */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-slate-900/50 rounded-xl border border-slate-800">
                        <div>
                            <label className="block text-xs uppercase text-slate-500 font-bold mb-2">Período</label>
                            <div className="flex gap-4">
                                <input
                                    type="date"
                                    required
                                    className="bg-slate-800 border-slate-600 rounded-lg p-2 text-white w-full"
                                    value={startDate}
                                    onChange={e => setStartDate(e.target.value)}
                                />
                                <span className="text-slate-500 self-center">até</span>
                                <input
                                    type="date"
                                    required
                                    className="bg-slate-800 border-slate-600 rounded-lg p-2 text-white w-full"
                                    value={endDate}
                                    onChange={e => setEndDate(e.target.value)}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs uppercase text-slate-500 font-bold mb-2">Dias da Semana</label>
                            <div className="flex gap-2">
                                {weekDaysMap.map(day => (
                                    <button
                                        key={day.id}
                                        type="button"
                                        onClick={() => toggleWeekday(day.id)}
                                        className={`w-10 h-10 rounded-lg text-sm font-bold transition-all ${selectedWeekdays.has(day.id) ? 'bg-blue-600 text-white shadow-lg scale-105' : 'bg-slate-800 text-slate-500 hover:bg-slate-700'}`}
                                    >
                                        {day.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* 2. Drivers */}
                    <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-800">
                        <div className="flex justify-between items-center mb-4">
                            <label className="block text-xs uppercase text-slate-500 font-bold flex items-center gap-2">
                                <Users className="w-4 h-4" />
                                Motoristas ({selectedDrivers.size})
                            </label>
                            <button
                                type="button"
                                onClick={toggleAllDrivers}
                                className="text-xs text-blue-400 hover:text-blue-300 font-medium"
                            >
                                {selectedDrivers.size === motoristas.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
                            </button>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-60 overflow-y-auto custom-scrollbar pr-2">
                            {motoristas.map(m => (
                                <label key={m.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${selectedDrivers.has(m.id) ? 'bg-blue-900/20 border-blue-500/50' : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'}`}>
                                    <input
                                        type="checkbox"
                                        checked={selectedDrivers.has(m.id)}
                                        onChange={() => toggleDriver(m.id)}
                                        className="rounded bg-slate-700 border-slate-600 text-blue-500 focus:ring-offset-slate-900"
                                    />
                                    <span className={`text-sm ${selectedDrivers.has(m.id) ? 'text-white font-medium' : 'text-slate-400'}`}>
                                        {m.nome}
                                    </span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* 3. Time Data */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 p-4 bg-slate-900/50 rounded-xl border border-slate-800">
                        <div>
                            <label className="block text-xs uppercase text-slate-500 font-bold mb-2">Entrada</label>
                            <input
                                type="time"
                                required
                                className="bg-slate-800 border-slate-600 rounded-lg p-2 text-white w-full"
                                value={startTime}
                                onChange={e => setStartTime(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-xs uppercase text-slate-500 font-bold mb-2">Saída</label>
                            <input
                                type="time"
                                required
                                className="bg-slate-800 border-slate-600 rounded-lg p-2 text-white w-full"
                                value={endTime}
                                onChange={e => setEndTime(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-xs uppercase text-slate-500 font-bold mb-2">Pausa (min)</label>
                            <input
                                type="number"
                                required
                                className="bg-slate-800 border-slate-600 rounded-lg p-2 text-white w-full"
                                value={breakDuration}
                                onChange={e => setBreakDuration(Number(e.target.value))}
                            />
                        </div>
                        <div>
                            <label className="block text-xs uppercase text-slate-500 font-bold mb-2">Obs</label>
                            <input
                                type="text"
                                className="bg-slate-800 border-slate-600 rounded-lg p-2 text-white w-full"
                                value={obs}
                                onChange={e => setObs(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Submit */}
                    <div className="pt-4 border-t border-slate-700 flex justify-end">
                        <button
                            type="submit"
                            disabled={isProcessing || !startDate || !endDate || selectedDrivers.size === 0}
                            className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white px-8 py-3 rounded-lg font-bold shadow-lg flex items-center gap-2 transition-all"
                        >
                            {isProcessing ? (
                                <><Loader2 className="w-5 h-5 animate-spin" /> Processando...</>
                            ) : (
                                <><CheckCircle className="w-5 h-5" /> Processar Lançamento</>
                            )}
                        </button>
                    </div>
                </form>

                {/* Results */}
                {result && (
                    <div className={`mt-6 p-4 rounded-xl border ${result.errors.length > 0 ? 'bg-amber-900/20 border-amber-500/30' : 'bg-emerald-900/20 border-emerald-500/30'}`}>
                        <div className="flex items-start gap-3">
                            {result.errors.length > 0 ? <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" /> : <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />}
                            <div>
                                <h4 className={`font-bold ${result.errors.length > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                                    Processamento Concluído
                                </h4>
                                <p className="text-slate-300 text-sm mt-1">
                                    {result.created} registos criados ({result.overwritten} substituídos).
                                </p>
                                {result.errors.length > 0 && (
                                    <ul className="mt-2 space-y-1 text-amber-400/80 text-xs font-mono max-h-40 overflow-y-auto">
                                        {result.errors.map((e, i) => <li key={i}>{e}</li>)}
                                    </ul>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
