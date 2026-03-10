import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { AlertTriangle, Clock3, MapPin, Route, Truck, Users } from 'lucide-react';
import { useWorkshop } from '../../contexts/WorkshopContext';
import { buildServiceTimeline, fetchEmployeeMonthlyStats, fetchHotelMonthlyStats, formatStopDuration, getOperationalAlerts, getOperationalServiceState, upsertServicePrimaryPassenger, type EmployeeMonthlyStats, type HotelMonthlyStats, type OperationalServiceState } from '../../services/operationalCenterService';
import type { Servico } from '../../types';
import { coerceServiceStatus, toDispatchStageLabel, updateServiceStatus } from '../../services/serviceStatus';

const monthStartIso = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
};

const stateIndicator: Record<OperationalServiceState, string> = {
  Scheduled: '⚪ Scheduled', Active: '🟡 Active', Completed: '🟢 Completed', Delayed: '🔴 Delayed'
};

export default function CommandCenter() {
  const { servicos, notifications, motoristas, cartrackVehicles, viaturas, refreshData } = useWorkshop();
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [hotelStats, setHotelStats] = useState<HotelMonthlyStats[]>([]);
  const [employeeStats, setEmployeeStats] = useState<EmployeeMonthlyStats[]>([]);

  const servicesToday = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return (servicos as Servico[])
      .filter(s => !s.data || s.data === today)
      .map(s => ({ service: s, state: getOperationalServiceState(s) }))
      .sort((a, b) => String(a.service.hora || '').localeCompare(String(b.service.hora || '')));
  }, [servicos]);

  const selectedService = useMemo(() => {
    if (!selectedServiceId) return servicesToday[0]?.service || null;
    return servicesToday.find(i => i.service.id === selectedServiceId)?.service || null;
  }, [selectedServiceId, servicesToday]);

  const timeline = useMemo(() => buildServiceTimeline(selectedService?.serviceEvents || []), [selectedService]);
  const alerts = useMemo(() => getOperationalAlerts(notifications).slice(0, 6), [notifications]);
  const drivers = useMemo(() => new Map(motoristas.map(m => [m.id, m.nome])), [motoristas]);
  const vehicles = useMemo(() => new Map(viaturas.map(v => [v.id, v])), [viaturas]);

  const counters = useMemo(() => servicesToday.reduce((acc, item) => {
    acc.total += 1;
    if (item.state === 'Completed') acc.completed += 1;
    if (item.state === 'Active') acc.active += 1;
    if (item.state === 'Delayed') acc.delayed += 1;
    if (item.state === 'Scheduled') acc.scheduled += 1;
    return acc;
  }, { total: 0, scheduled: 0, active: 0, completed: 0, delayed: 0 }), [servicesToday]);

  const activeVehicles = useMemo(() => cartrackVehicles.filter(v => Number.isFinite(v.latitude) && Number.isFinite(v.longitude)).length, [cartrackVehicles]);

  useEffect(() => {
    const sync = async () => {
      const today = new Date().toISOString().split('T')[0];
      const todayServices = (servicos as Servico[]).filter((service) => !service.data || service.data === today);
      await upsertServicePrimaryPassenger(todayServices);
      const [h, e] = await Promise.all([fetchHotelMonthlyStats(monthStartIso()), fetchEmployeeMonthlyStats(monthStartIso())]);
      setHotelStats(h.slice(0, 4));
      setEmployeeStats(e.slice(0, 4));
    };
    sync();
    const id = setInterval(sync, 180000);
    return () => clearInterval(id);
  }, [servicos]);

  useEffect(() => {
    refreshData();
    return () => undefined;
  }, [refreshData]);

  useEffect(() => {
    if (!selectedServiceId && servicesToday[0]?.service.id) setSelectedServiceId(servicesToday[0].service.id);
  }, [selectedServiceId, servicesToday]);

  return <div className="space-y-6">
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
      <h1 className="text-3xl font-black text-white">Centro Operacional</h1>
      <p className="mt-2 text-sm text-slate-400">Monitorização automática de serviços com GPS, geofences, alertas e estatísticas.</p>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-6">
        <Metric icon={<Route className="h-4 w-4" />} label="Serviços" value={counters.total} />
        <Metric icon={<Clock3 className="h-4 w-4" />} label="Scheduled" value={counters.scheduled} />
        <Metric icon={<Truck className="h-4 w-4" />} label="Active" value={counters.active} />
        <Metric icon={<Users className="h-4 w-4" />} label="Completed" value={counters.completed} />
        <Metric icon={<AlertTriangle className="h-4 w-4" />} label="Delayed" value={counters.delayed} />
        <Metric icon={<MapPin className="h-4 w-4" />} label="Viaturas GPS" value={activeVehicles} />
      </div>
    </div>

    <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
      <section className="xl:col-span-2 rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
        <h2 className="mb-3 text-lg font-bold text-white">Serviços do dia</h2>
        <div className="max-h-[28rem] overflow-auto rounded-xl border border-slate-800">
          {servicesToday.map(({ service, state }) => <button key={service.id} onClick={() => setSelectedServiceId(service.id)} className="block w-full border-b border-slate-800 px-3 py-2 text-left hover:bg-slate-800/40">
            {(() => {
              const vehicle = service.vehicleId ? vehicles.get(service.vehicleId) : undefined;
              const capacity = Number(vehicle?.vehicleCapacity || 8);
              const passengers = Number(service.passengerCount || 1);
              const dispatchStage = toDispatchStageLabel(coerceServiceStatus(service.status) || updateServiceStatus(service));
              const occupancy = service.occupancyRate !== null && service.occupancyRate !== undefined
                ? Number(service.occupancyRate)
                : Number(((passengers / Math.max(capacity, 1)) * 100).toFixed(2));

              return (
                <>
            <p className="text-sm text-white">{drivers.get(String(service.motoristaId || '')) || 'Sem motorista'} • {service.hora} • {service.origem} → {service.destino}</p>
            <p className="text-xs text-slate-300">{stateIndicator[state]} • Etapa: {dispatchStage} • Passageiros: {passengers} • Capacidade: {capacity} • Ocupação: {occupancy.toFixed(0)}% • Tempo parado origem: {formatStopDuration(service.originStopDurationSeconds)}</p>
                </>
              );
            })()}
          </button>)}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
        <h2 className="mb-3 text-lg font-bold text-white">Alertas</h2>
        <div className="space-y-2">{alerts.length === 0 ? <p className="text-sm text-slate-400">Sem alertas ativos.</p> : alerts.map(a => <div key={a.id} className="rounded-lg border border-slate-700 bg-slate-800/40 p-3"><p className="text-sm text-white">{a.data?.title}</p><p className="text-xs text-slate-300">{a.data?.message}</p></div>)}</div>
      </section>
    </div>

    <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5"><h2 className="mb-3 text-lg font-bold text-white">Timeline</h2>{timeline.length === 0 ? <p className="text-sm text-slate-400">Sem eventos registados.</p> : timeline.map(t => <div key={t.id} className="mb-2 rounded-lg border border-slate-700 bg-slate-800/40 p-3"><p className="text-xs text-slate-400">{new Date(t.timestamp).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}</p><p className="text-sm text-white">{t.description}</p></div>)}</section>
      <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5"><h2 className="mb-3 text-lg font-bold text-white">Mapa operacional</h2>{servicesToday.filter(s => s.state === 'Active' || s.state === 'Delayed').slice(0, 5).map(({ service }) => <p key={service.id} className="mb-2 text-xs text-slate-200">{service.origem} → {service.destino} • Origem {service.originConfirmed ? 'confirmada' : 'pendente'} • Destino {service.destinationConfirmed ? 'confirmado' : 'pendente'}</p>)}</section>
      <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5"><h2 className="mb-3 text-lg font-bold text-white">Estatísticas mensais</h2><p className="text-xs text-slate-400">Hotel</p>{hotelStats.map(h => <p key={`${h.month}-${h.hotel}`} className="text-xs text-slate-200">{h.hotel}: {h.totalTransportes} transportes, {h.funcionariosTransportados} funcionários</p>)}<p className="mt-2 text-xs text-slate-400">Funcionário</p>{employeeStats.map(e => <p key={`${e.month}-${e.employeeId}`} className="text-xs text-slate-200">{e.employeeName}: {e.transportDays} dias, {new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(e.totalCost)}</p>)}</section>
    </div>
  </div>;
}

function Metric({ label, value, icon }: { label: string; value: number; icon: ReactNode }) {
  return <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-2"><div className="flex items-center gap-2 text-[11px] uppercase text-slate-400">{icon}{label}</div><div className="text-xl font-black text-white">{value}</div></div>;
}