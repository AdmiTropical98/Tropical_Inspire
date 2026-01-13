import { useState, useMemo } from 'react';
import {
  Bus,
  Plus,
  Calendar,
  Euro,
  TrendingUp,
  Receipt,
  AlertTriangle,
  CheckCircle,
  X,
  Check
} from 'lucide-react';

import { useWorkshop } from '../../contexts/WorkshopContext';
import { useAuth } from '../../contexts/AuthContext';
import type { EvaTransport, EvaDailyUsage } from '../../types';

export default function TransportesEva() {
    const { evaTransports, addEvaTransport, deleteEvaTransport } = useWorkshop();
    const { currentUser } = useAuth();

    // Local State for Form
    const [formData, setFormData] = useState({
        route: '',
        amount: '',
        notes: ''
    });

    const [usageDays, setUsageDays] = useState<EvaDailyUsage[]>([]);
    const [tempDate, setTempDate] = useState(new Date().toISOString().split('T')[0]);

    // Incident State for the day being added
    const [tempIncident, setTempIncident] = useState(false);
    const [tempIncidentType, setTempIncidentType] = useState('delay');
    const [tempIncidentDesc, setTempIncidentDesc] = useState('');

    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM

    // Add a day to the list
    const handleAddDay = () => {
        if (usageDays.some(d => d.date === tempDate)) return; // Prevent duplicates

        const newDay: EvaDailyUsage = {
            id: crypto.randomUUID(),
            date: tempDate,
            hasIssue: tempIncident,
            issueType: tempIncident ? tempIncidentType as any : undefined,
            issueDescription: tempIncident ? tempIncidentDesc : undefined,
            issueSeverity: tempIncident ? 'medium' : undefined
        };

        setUsageDays(prev => [...prev, newDay].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));

        // Reset temp incident fields
        setTempIncident(false);
        setTempIncidentDesc('');
    };

    const handleRemoveDay = (id: string) => {
        setUsageDays(prev => prev.filter(d => d.id !== id));
    };

    // Derived State
    const filteredTransports = useMemo(() => {
        return evaTransports
            .filter(t => t.referenceDate.startsWith(selectedMonth))
            .sort((a, b) => new Date(b.referenceDate).getTime() - new Date(a.referenceDate).getTime());
    }, [evaTransports, selectedMonth]);

    const totalMonth = useMemo(() => {
        return filteredTransports.reduce((sum, t) => sum + t.amount, 0);
    }, [filteredTransports]);

    const totalTrips = useMemo(() => {
        return filteredTransports.reduce((sum, t) => sum + (t.days?.length || 0), 0);
    }, [filteredTransports]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.amount || !formData.route || usageDays.length === 0) {
            alert('Preencha todos os campos e adicione pelo menos um dia de utilização.');
            return;
        }

        const newTransport: EvaTransport = {
            id: crypto.randomUUID(),
            referenceDate: usageDays[0].date, // Use first day as ref
            route: formData.route,
            amount: parseFloat(formData.amount),
            notes: formData.notes,
            loggedBy: currentUser?.nome || 'Utilizador',
            createdAt: new Date().toISOString(),
            days: usageDays
        };

        addEvaTransport(newTransport);

        // Reset form
        setFormData({
            route: '',
            amount: '',
            notes: ''
        });
        setUsageDays([]);
    };

    const handleDelete = (id: string) => {
        if (confirm('Tem a certeza que deseja eliminar este registo?')) {
            deleteEvaTransport(id);
        }
    };

    return (
        <div className="h-full flex flex-col bg-[#0f172a] text-slate-100 p-4 md:p-8 overflow-y-auto custom-scrollbar font-sans">
            {/* Header Content */}
            <div className="flex flex-col md:flex-row border-b border-slate-800/60 pb-8 mb-8 justify-between items-start md:items-end bg-gradient-to-r from-transparent via-transparent to-transparent gap-4">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-3 bg-yellow-500/10 rounded-2xl border border-yellow-500/20 shadow-[0_0_15px_rgba(234,179,8,0.1)]">
                            <Bus className="w-8 h-8 text-yellow-500" />
                        </div>
                        <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
                            Transportes EVA
                        </h1>
                    </div>
                    <p className="text-slate-400 font-medium ml-1 text-sm md:text-base">
                        Controlo detalhado de utilização e ocorrências
                    </p>
                </div>

                <div className="flex items-center gap-4 bg-[#1e293b]/80 p-1.5 pr-4 rounded-xl border border-slate-700/50 shadow-sm backdrop-blur-sm w-full md:w-auto">
                    <div className="p-2 bg-slate-800 rounded-lg text-slate-400">
                        <Calendar className="w-5 h-5" />
                    </div>
                    <div className="flex flex-col flex-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider leading-none mb-0.5">Mês Selecionado</label>
                        <input
                            type="month"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="bg-transparent border-none p-0 text-white focus:ring-0 font-bold text-sm outline-none h-5 w-full"
                        />
                    </div>
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-8 shrink-0">
                {/* Monthly Total */}
                <div className="group relative bg-gradient-to-br from-[#1e293b]/80 to-[#0f172a]/80 backdrop-blur-md border border-yellow-500/20 rounded-2xl p-6 overflow-hidden transition-all hover:border-yellow-500/30">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110 duration-500">
                        <Euro className="w-32 h-32 text-yellow-500" />
                    </div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2.5 bg-yellow-500/10 rounded-xl text-yellow-500 border border-yellow-500/20 shadow-sm">
                                <TrendingUp className="w-5 h-5" />
                            </div>
                            <h3 className="text-slate-400 text-sm font-bold uppercase tracking-wider">Despesa Mensal</h3>
                        </div>
                        <div className="flex items-baseline gap-1">
                            <span className="text-4xl font-bold text-white tracking-tight">{totalMonth.toFixed(2)}</span>
                            <span className="text-xl font-medium text-yellow-500">€</span>
                        </div>
                        <div className="mt-2 flex items-center gap-2 text-xs font-medium text-slate-500 bg-slate-900/40 w-fit px-2 py-1 rounded-lg border border-slate-800">
                            <span>{new Date(selectedMonth).toLocaleString('pt-PT', { month: 'long', year: 'numeric' })}</span>
                        </div>
                    </div>
                </div>

                {/* Total Days */}
                <div className="group relative bg-gradient-to-br from-[#1e293b]/80 to-[#0f172a]/80 backdrop-blur-md border border-green-500/20 rounded-2xl p-6 overflow-hidden transition-all hover:border-green-500/30">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110 duration-500">
                        <Calendar className="w-32 h-32 text-green-500" />
                    </div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2.5 bg-green-500/10 rounded-xl text-green-500 border border-green-500/20 shadow-sm">
                                <Receipt className="w-5 h-5" />
                            </div>
                            <h3 className="text-slate-400 text-sm font-bold uppercase tracking-wider">Dias Utilizados</h3>
                        </div>
                        <div className="flex items-baseline gap-1">
                            <span className="text-4xl font-bold text-white tracking-tight">{totalTrips}</span>
                            <span className="text-xl font-medium text-green-500">dias</span>
                        </div>
                        <div className="mt-2 flex items-center gap-2 text-xs font-medium text-slate-500 bg-slate-900/40 w-fit px-2 py-1 rounded-lg border border-slate-800">
                            <span>Total de utilização</span>
                        </div>
                    </div>
                </div>

                {/* Incidents (Calculated from filteredTransports) */}
                <div className="group relative bg-gradient-to-br from-[#1e293b]/80 to-[#0f172a]/80 backdrop-blur-md border border-red-500/20 rounded-2xl p-6 overflow-hidden transition-all hover:border-red-500/30">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110 duration-500">
                        <AlertTriangle className="w-32 h-32 text-red-500" />
                    </div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2.5 bg-red-500/10 rounded-xl text-red-500 border border-red-500/20 shadow-sm">
                                <AlertTriangle className="w-5 h-5" />
                            </div>
                            <h3 className="text-slate-400 text-sm font-bold uppercase tracking-wider">Ocorrências</h3>
                        </div>
                        <div className="text-4xl font-bold text-white tracking-tight">
                            {filteredTransports.reduce((acc, t) => acc + (t.days?.filter(d => d.hasIssue).length || 0), 0)}
                        </div>
                        <div className="mt-2 flex items-center gap-2 text-xs font-medium text-slate-500 bg-slate-900/40 w-fit px-2 py-1 rounded-lg border border-slate-800">
                            <span>Atrasos ou Problemas</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex-1 flex flex-col lg:flex-row gap-8 min-h-0 overflow-hidden">
                {/* Form Panel */}
                <div className="w-full lg:w-[450px] flex flex-col bg-[#1e293b]/40 border border-slate-700/50 rounded-2xl shadow-xl backdrop-blur-sm lg:sticky lg:top-0 h-fit max-h-[50vh] lg:max-h-full overflow-hidden shrink-0">
                    <div className="flex-none p-6 border-b border-slate-700/50 bg-slate-800/30 rounded-t-2xl">
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            <div className="bg-blue-500 p-1.5 rounded-lg">
                                <Plus className="w-4 h-4 text-white" />
                            </div>
                            Novo Registo
                        </h2>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wide ml-1">Rota / Autocarro</label>
                            <input
                                type="text"
                                required
                                placeholder="Ex: Faro - Lisboa (Bus 45)"
                                value={formData.route}
                                onChange={e => setFormData({ ...formData, route: e.target.value })}
                                className="w-full bg-slate-950/50 border border-slate-700/70 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none"
                            />
                        </div>

                        {/* Usage Days Section */}
                        <div className="bg-slate-900/30 rounded-xl p-4 border border-slate-800">
                            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-blue-500" />
                                Dias de Utilização
                            </h3>

                            <div className="flex gap-2 items-end mb-4">
                                <div className="flex-1">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Data</label>
                                    <input
                                        type="date"
                                        value={tempDate}
                                        onChange={e => setTempDate(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 outline-none mt-1"
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={handleAddDay}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-bold transition-all h-[38px]"
                                >
                                    Adicionar
                                </button>
                            </div>

                            {/* Optional Incident Report per Day */}
                            <div className="mb-4 pt-4 border-t border-slate-800">
                                <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer w-fit p-1">
                                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${tempIncident ? 'bg-red-500 border-red-500' : 'border-slate-600'}`}>
                                        <input type="checkbox" checked={tempIncident} onChange={e => setTempIncident(e.target.checked)} className="hidden" />
                                        {tempIncident && <Check className="w-3 h-3 text-white" />}
                                    </div>
                                    <span className={tempIncident ? 'text-red-400 font-bold' : ''}>Houve algum problema neste dia?</span>
                                </label>

                                {tempIncident && (
                                    <div className="mt-3 space-y-3 pl-6 border-l-2 border-red-500/20 ml-2">
                                        <select
                                            value={tempIncidentType}
                                            onChange={e => setTempIncidentType(e.target.value)}
                                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm outline-none"
                                        >
                                            <option value="delay">Atraso</option>
                                            <option value="mechanical">Problema Mecânico</option>
                                            <option value="accident">Acidente</option>
                                            <option value="other">Outro</option>
                                        </select>
                                        <input
                                            type="text"
                                            placeholder="Descreva o problema..."
                                            value={tempIncidentDesc}
                                            onChange={e => setTempIncidentDesc(e.target.value)}
                                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm outline-none"
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Added Days List */}
                            <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                                {usageDays.length === 0 && (
                                    <p className="text-xs text-slate-500 text-center py-2 italic">Nenhum dia adicionado</p>
                                )}
                                {usageDays.map(day => (
                                    <div key={day.id} className="flex items-center justify-between bg-slate-800/50 p-2 rounded-lg border border-slate-700/50">
                                        <div className="flex items-center gap-3">
                                            <span className="text-sm font-mono text-slate-300">{day.date}</span>
                                            {day.hasIssue && (
                                                <div className="flex items-center gap-1 text-[10px] font-bold text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20">
                                                    <AlertTriangle className="w-3 h-3" />
                                                    {day.issueType === 'delay' ? 'ATRASO' : 'PROBLEMA'}
                                                </div>
                                            )}
                                        </div>
                                        <button onClick={() => handleRemoveDay(day.id)} className="text-slate-500 hover:text-red-400">
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wide ml-1">Valor Total</label>
                            <div className="relative">
                                <input
                                    type="number"
                                    required
                                    step="0.01"
                                    min="0"
                                    placeholder="0.00"
                                    value={formData.amount}
                                    onChange={e => setFormData({ ...formData, amount: e.target.value })}
                                    className="w-full bg-slate-950/50 border border-slate-700/70 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none font-mono text-lg"
                                />
                                <div className="absolute left-4 top-3.5 text-slate-500 font-bold text-sm pointer-events-none">€</div>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wide ml-1">Notas Gerais</label>
                            <textarea
                                value={formData.notes}
                                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                className="w-full bg-slate-950/50 border border-slate-700/70 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none resize-none h-20 text-sm"
                                placeholder="Observações..."
                            />
                        </div>
                    </div>

                    <div className="flex-none p-6 pt-2">
                        <button
                            type="submit"
                            onClick={handleSubmit}
                            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center gap-2 transform hover:scale-[1.02] active:scale-[0.98]"
                        >
                            <Plus className="w-5 h-5" />
                            Registar Despesa
                        </button>
                    </div>
                </div>

                {/* History List */}
                <div className="flex-1 bg-[#1e293b]/40 border border-slate-700/50 rounded-2xl shadow-xl backdrop-blur-sm flex flex-col overflow-hidden h-[50vh] lg:h-auto">
                    <div className="p-6 border-b border-slate-700/50 bg-slate-800/30 flex justify-between items-center rounded-t-2xl">
                        <div>
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                <Receipt className="w-5 h-5 text-slate-400" />
                                Histórico
                            </h2>
                            <p className="text-xs text-slate-400 mt-1">Registos do mês</p>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-900/20 p-4 space-y-4">
                        {filteredTransports.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-slate-500">
                                <p>Sem registos</p>
                            </div>
                        ) : (
                            filteredTransports.map(t => (
                                <div key={t.id} className="bg-slate-800/40 border border-slate-700/50 rounded-xl overflow-hidden hover:bg-slate-800/60 transition-all group">
                                    {/* Card Header */}
                                    <div className="p-4 flex items-center justify-between border-b border-slate-700/30">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-slate-900 rounded-lg flex flex-col items-center justify-center border border-slate-800">
                                                <span className="text-[10px] uppercase font-bold text-slate-500">
                                                    {new Date(t.referenceDate).toLocaleString('pt-PT', { month: 'short' })}
                                                </span>
                                                <span className="text-lg font-bold text-white">
                                                    {new Date(t.referenceDate).getDate()}
                                                </span>
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-white text-lg">{t.route}</h3>
                                                <div className="text-xs text-slate-400">
                                                    {t.days?.length || 0} dias de utilização
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xl font-bold text-yellow-400 font-mono">{t.amount.toFixed(2)}€</div>
                                            <button onClick={() => handleDelete(t.id)} className="text-xs text-red-400 hover:text-red-300 underline mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                Eliminar
                                            </button>
                                        </div>
                                    </div>

                                    {/* Card Body - Days Grid */}
                                    <div className="p-4 bg-slate-900/30">
                                        <div className="flex flex-wrap gap-2">
                                            {t.days?.map(day => (
                                                <div key={day.id}
                                                    className={`
                                                        px-3 py-1.5 rounded-lg border text-sm flex items-center gap-2
                                                        ${day.hasIssue
                                                            ? 'bg-red-500/10 border-red-500/30 text-red-200'
                                                            : 'bg-green-500/10 border-green-500/30 text-green-200'}
                                                    `}
                                                    title={day.hasIssue ? `${day.issueType}: ${day.issueDescription}` : 'Sem problemas'}
                                                >
                                                    <span className="font-mono text-xs opacity-70">{new Date(day.date).getDate()}</span>
                                                    {day.hasIssue ? <AlertTriangle className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5" />}
                                                </div>
                                            ))}
                                        </div>
                                        {t.notes && (
                                            <div className="mt-3 text-sm text-slate-500 italic border-t border-slate-700/30 pt-2">
                                                "{t.notes}"
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}


