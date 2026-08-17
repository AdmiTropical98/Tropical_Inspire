import { useState, useMemo } from 'react';
import { Bus, Plus, Calendar, Euro, TrendingUp, Receipt, AlertTriangle, CheckCircle, X } from 'lucide-react';
import { useWorkshop } from '../../contexts/WorkshopContext';
import { useAuth } from '../../contexts/AuthContext';
import type { EvaTransport, EvaDailyUsage } from '../../types';
import { FrotaPageHeader } from '../../components/ui/frota/FrotaPageHeader';
import { FrotaKPI } from '../../components/ui/frota/FrotaKPI';
export default function TransportesEva({
  isTab = false,
  selectedMonthProp,
  setSelectedMonthProp
}: {
  isTab?: boolean;
  selectedMonthProp?: string;
  setSelectedMonthProp?: (m: string) => void;
}) {
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

  const [selectedMonthLocal, setSelectedMonthLocal] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const selectedMonth = selectedMonthProp || selectedMonthLocal;
  const setSelectedMonth = setSelectedMonthProp || setSelectedMonthLocal;

  // Add a day to the list
  const handleAddDay = () => {
    if (usageDays.some(d => d.date === tempDate)) return; // Prevent duplicates

    const newDay: EvaDailyUsage = {
      id: crypto.randomUUID(),
      date: tempDate,
      hasIssue: tempIncident,
      issueType: tempIncident ? tempIncidentType as 'delay' | 'mechanical' | 'accident' | 'other' : undefined,
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
    <div className={isTab ? "flex flex-col space-y-6 pt-4" : "flex flex-col space-y-6 min-h-screen app-content-bg p-4 sm:p-6 lg:p-8"}>
      {/* Top Banner */}
      {!isTab && (
        <FrotaPageHeader
          title="Transportes EVA"
          subtitle="Controlo detalhado de utilização, despesas e ocorrências de autocarros contratados."
          icon={Bus}
          actions={
            <div className="flex items-center gap-3 bg-white p-2.5 rounded-xl border border-slate-200 shadow-sm relative z-10">
              <Calendar className="w-5 h-5 text-slate-400" />
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mês Selecionado</span>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="bg-transparent border-none p-0 text-slate-900 focus:ring-0 font-bold text-xs outline-none w-28 h-5"
                />
              </div>
            </div>
          }
        />
      )}

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 shrink-0">
        <FrotaKPI
          title="Despesa Mensal"
          value={`${totalMonth.toFixed(2)}`}
          unit="€"
          icon={TrendingUp}
          trend={{ value: new Date(selectedMonth).toLocaleString('pt-PT', { month: 'long', year: 'numeric' }), isPositive: true }}
          color="amber"
        />
        <FrotaKPI
          title="Dias Utilizados"
          value={totalTrips}
          unit="dias"
          icon={Receipt}
          trend={{ value: 'Total de utilização', isPositive: true }}
          color="emerald"
        />
        <FrotaKPI
          title="Ocorrências"
          value={filteredTransports.reduce((acc, t) => acc + (t.days?.filter(d => d.hasIssue).length || 0), 0)}
          icon={AlertTriangle}
          trend={{ value: 'Atrasos ou Problemas', isPositive: false }}
          color="rose"
        />
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-8 min-h-0">
        {/* Form Panel */}
        <div className="w-full lg:w-[450px] flex flex-col bg-white border border-slate-100 rounded-2xl shadow-sm lg:sticky lg:top-0 h-fit max-h-[50vh] lg:max-h-full overflow-hidden shrink-0">
          <div className="flex-none p-6 border-b border-slate-100 bg-slate-50 rounded-t-2xl">
            <h2 className="text-sm font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <div className="bg-[#d59d31]/10 p-1.5 rounded-lg text-[#d59d31] border border-[#d59d31]/20">
                <Plus className="w-4 h-4" />
              </div>
              Novo Registo EVA
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-5 text-slate-700">
            <div className="flex flex-col space-y-1">
              <label className="text-xs font-bold text-slate-500">Rota / Autocarro *</label>
              <input
                type="text"
                required
                placeholder="Ex: Faro - Lisboa (Bus 45)"
                value={formData.route}
                onChange={e => setFormData({ ...formData, route: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-[#d59d31]"
              />
            </div>

            {/* Usage Days Section */}
            <div className="bg-slate-50/60 rounded-xl p-4 border border-slate-200/65">
              <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-blue-500" />
                Dias de Utilização
              </h3>

              <div className="flex gap-2 items-end mb-4">
                <div className="flex-1 flex flex-col space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Data</span>
                  <input
                    type="date"
                    value={tempDate}
                    onChange={e => setTempDate(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddDay}
                  className="px-4 py-1.5 bg-[#d59d31] hover:bg-[#c28c27] text-white rounded-lg text-xs font-bold transition-all h-[34px]"
                >
                  Adicionar
                </button>
              </div>

              {/* Optional Incident Report per Day */}
              <div className="mb-4 pt-3 border-t border-slate-200">
                <label className="flex items-center gap-2 text-xs text-slate-600 font-bold cursor-pointer w-fit p-1 select-none">
                  <input
                    type="checkbox"
                    checked={tempIncident}
                    onChange={e => setTempIncident(e.target.checked)}
                    className="rounded border-slate-300 text-rose-600 focus:ring-rose-500 w-4 h-4"
                  />
                  <span className={tempIncident ? 'text-rose-600 font-bold' : ''}>Reportar ocorrência neste dia</span>
                </label>

                {tempIncident && (
                  <div className="mt-3 space-y-3 pl-4 border-l-2 border-rose-500/20 ml-2 text-slate-700">
                    <select
                      value={tempIncidentType}
                      onChange={e => setTempIncidentType(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs outline-none"
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
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs outline-none"
                    />
                  </div>
                )}
              </div>

              {/* Added Days List */}
              <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                {usageDays.length === 0 && (
                  <p className="text-xs text-slate-500 text-center py-2 italic">Nenhum dia adicionado</p>
                )}
                {usageDays.map(day => (
                  <div key={day.id} className="flex items-center justify-between bg-white p-2 rounded-lg border border-slate-200/50">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono font-bold text-slate-700">{day.date}</span>
                      {day.hasIssue && (
                        <div className="flex items-center gap-1 text-[9px] font-black text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200/50">
                          <AlertTriangle className="w-3 h-3 shrink-0" />
                          {day.issueType === 'delay' ? 'ATRASO' : 'PROBLEMA'}
                        </div>
                      )}
                    </div>
                    <button onClick={() => handleRemoveDay(day.id)} className="text-slate-400 hover:text-rose-600 p-0.5">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col space-y-1">
              <label className="text-xs font-bold text-slate-500">Valor Total (€) *</label>
              <input
                type="number"
                required
                step="0.01"
                min="0"
                placeholder="0.00"
                value={formData.amount}
                onChange={e => setFormData({ ...formData, amount: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-[#d59d31]"
              />
            </div>

            <div className="flex flex-col space-y-1">
              <label className="text-xs font-bold text-slate-500">Notas Gerais</label>
              <textarea
                value={formData.notes}
                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-900 focus:outline-none focus:border-[#d59d31] resize-none h-16"
                placeholder="Observações..."
              />
            </div>
          </div>

          <div className="flex-none p-6 pt-2">
            <button
              type="submit"
              onClick={handleSubmit}
              className="w-full bg-[#d59d31] hover:bg-[#c28c27] text-white font-bold py-3 rounded-xl shadow-lg shadow-amber-500/10 transition-all flex items-center justify-center gap-2 transform hover:scale-[1.01] active:scale-[0.99] text-xs"
            >
              <Plus className="w-4 h-4" />
              Registar Despesa
            </button>
          </div>
        </div>

        {/* History List */}
        <div className="flex-1 bg-white border border-slate-100 rounded-2xl shadow-sm flex flex-col overflow-hidden h-[50vh] lg:h-auto">
          <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center rounded-t-2xl">
            <div>
              <h2 className="text-sm font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <Receipt className="w-4 h-4 text-slate-400" />
                Histórico de Transportes EVA
              </h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">Registos do mês</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-4 text-slate-700">
            {filteredTransports.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 italic py-16 text-xs font-bold">
                Sem registos de transportes para este mês
              </div>
            ) : (
              filteredTransports.map(t => (
                <div key={t.id} className="bg-slate-50/50 border border-slate-100 rounded-xl overflow-hidden hover:bg-slate-50 transition-all group">
                  {/* Card Header */}
                  <div className="p-4 flex items-center justify-between border-b border-slate-100 bg-white/40">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white rounded-xl flex flex-col items-center justify-center border border-slate-200/60 shadow-sm shrink-0">
                        <span className="text-[9px] uppercase font-black text-slate-400">
                          {new Date(t.referenceDate).toLocaleString('pt-PT', { month: 'short' })}
                        </span>
                        <span className="text-base font-black text-[#0B2239] -mt-0.5">
                          {new Date(t.referenceDate).getDate()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-slate-900 text-sm truncate max-w-[200px] sm:max-w-[300px]" title={t.route}>{t.route}</h3>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                          {t.days?.length || 0} {t.days?.length === 1 ? 'dia' : 'dias'} de utilização
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end shrink-0">
                      <div className="text-base font-black text-slate-900 font-mono">{t.amount.toFixed(2)} €</div>
                      <button onClick={() => handleDelete(t.id)} className="text-[10px] text-rose-500 hover:text-rose-700 font-bold uppercase tracking-wider mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        Eliminar
                      </button>
                    </div>
                  </div>

                  {/* Card Body - Days Grid */}
                  <div className="p-4 bg-white/20">
                    <div className="flex flex-wrap gap-2">
                      {t.days?.map(day => (
                        <div key={day.id}
                          className={`
                            px-2.5 py-1 rounded-lg border text-xs flex items-center gap-1.5 font-semibold
                            ${day.hasIssue
                              ? 'bg-rose-50 border-rose-200/50 text-rose-700'
                              : 'bg-emerald-50 border-emerald-200/50 text-emerald-700'}
                          `}
                          title={day.hasIssue ? `${day.issueType === 'delay' ? 'Atraso' : 'Problema'}: ${day.issueDescription}` : 'Sem ocorrências'}
                        >
                          <span className="font-mono text-[10px] font-bold">{new Date(day.date).getDate()}</span>
                          {day.hasIssue ? <AlertTriangle className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5" />}
                        </div>
                      ))}
                    </div>
                    {t.notes && (
                      <div className="mt-3 text-xs text-slate-500 italic border-t border-slate-100 pt-2 font-medium">
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
