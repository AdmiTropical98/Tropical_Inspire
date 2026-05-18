import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Filter,
  MapPin,
} from 'lucide-react';
import { useWorkshop } from '../../contexts/WorkshopContext';
import {
  buildServiceTimeline,
  fetchEmployeeMonthlyStats,
  fetchHotelMonthlyStats,
  getOperationalServiceState,
  upsertServicePrimaryPassenger,
  type EmployeeMonthlyStats,
  type HotelMonthlyStats,
} from '../../services/operationalCenterService';
import type { Servico } from '../../types';
import { coerceServiceStatus, toDispatchStageLabel, updateServiceStatus } from '../../services/serviceStatus';

const monthStartIso = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
};

type CounterFilter = 'all' | 'next60' | 'noDriver' | 'noVehicle' | 'delayed' | 'conflicts';
type Severity = 'low' | 'medium' | 'high';

type ConflictItem = {
  id: string;
  type: 'driver_overlap' | 'vehicle_double' | 'capacity_overflow' | 'late_departure';
  severity: Severity;
  serviceId: string;
  title: string;
  description: string;
  suggestion: string;
};

type AlertItem = {
  id: string;
  category: 'operations' | 'vehicles' | 'drivers' | 'gps' | 'conflicts';
  severity: Severity;
  timestamp: string;
  serviceId?: string;
  title: string;
  description: string;
  actionLabel: string;
  action: () => void;
};

type DriverStatus = 'available' | 'on_trip' | 'off_shift' | 'without_vehicle' | 'near_pickup';

const severityClass: Record<Severity, string> = {
  low: 'bg-blue-100 text-blue-700 border-blue-200',
  medium: 'bg-amber-100 text-amber-700 border-amber-200',
  high: 'bg-red-100 text-red-700 border-red-200',
};

const parseServiceDateTime = (service: Servico) => {
  const datePart = service.data || new Date().toISOString().split('T')[0];
  const timePart = service.hora || '00:00';
  const dt = new Date(`${datePart}T${timePart}:00`);
  return Number.isNaN(dt.getTime()) ? null : dt;
};

const minuteDiff = (from: Date, to: Date) => Math.round((to.getTime() - from.getTime()) / 60000);

const stateIndicator: Record<string, string> = {
  Scheduled: 'Scheduled',
  Active: 'Ativo',
  Completed: 'Concluído',
  Delayed: 'Atrasado',
};

export default function CommandCenter() {
  const {
    servicos,
    notifications,
    motoristas,
    cartrackVehicles,
    viaturas,
    refreshData,
    updateServico,
  } = useWorkshop();

  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [counterFilter, setCounterFilter] = useState<CounterFilter>('all');
  const [timelineDriverFilter, setTimelineDriverFilter] = useState('all');
  const [timelineVehicleFilter, setTimelineVehicleFilter] = useState('all');
  const [timelineServiceFilter, setTimelineServiceFilter] = useState('all');
  const [mapOnlyActive, setMapOnlyActive] = useState(false);
  const [mapOnlyDelayed, setMapOnlyDelayed] = useState(false);
  const [mapOnlyIdleDrivers, setMapOnlyIdleDrivers] = useState(false);
  const [hotelStats, setHotelStats] = useState<HotelMonthlyStats[]>([]);
  const [employeeStats, setEmployeeStats] = useState<EmployeeMonthlyStats[]>([]);

  const driversById = useMemo(() => new Map(motoristas.map(m => [m.id, m])), [motoristas]);
  const vehiclesById = useMemo(() => new Map(viaturas.map(v => [v.id, v])), [viaturas]);

  const now = new Date();

  const servicesToday = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return (servicos as Servico[])
      .filter(s => !s.data || s.data === today)
      .map(s => ({
        service: s,
        state: getOperationalServiceState(s),
        dateTime: parseServiceDateTime(s),
      }))
      .sort((a, b) => String(a.service.hora || '').localeCompare(String(b.service.hora || '')));
  }, [servicos]);

  const selectedService = useMemo(() => {
    if (!selectedServiceId) return servicesToday[0]?.service || null;
    return servicesToday.find(i => i.service.id === selectedServiceId)?.service || null;
  }, [selectedServiceId, servicesToday]);

  const conflicts = useMemo<ConflictItem[]>(() => {
    const items: ConflictItem[] = [];

    const byDriver: Record<string, Servico[]> = {};
    const byVehicle: Record<string, Servico[]> = {};

    for (const row of servicesToday) {
      const s = row.service;
      if (s.motoristaId) {
        byDriver[s.motoristaId] = byDriver[s.motoristaId] || [];
        byDriver[s.motoristaId].push(s);
      }
      if (s.vehicleId) {
        byVehicle[s.vehicleId] = byVehicle[s.vehicleId] || [];
        byVehicle[s.vehicleId].push(s);
      }

      const vehicle = s.vehicleId ? vehiclesById.get(s.vehicleId) : null;
      const capacity = Number(vehicle?.vehicleCapacity || 8);
      const passengers = Number(s.passengerCount || 1);
      if (passengers > capacity) {
        items.push({
          id: `capacity-${s.id}`,
          type: 'capacity_overflow',
          severity: 'high',
          serviceId: s.id,
          title: 'Capacity overflow',
          description: `Serviço ${s.hora}: ${passengers} passageiros para capacidade ${capacity}.`,
          suggestion: 'Atribuir viatura com maior capacidade ou dividir serviço.',
        });
      }

      const dt = parseServiceDateTime(s);
      const persisted = coerceServiceStatus(s.status) || updateServiceStatus(s);
      const isLate = dt && minuteDiff(dt, now) > 15 && persisted !== 'COMPLETED' && persisted !== 'EN_ROUTE_ORIGIN' && persisted !== 'EN_ROUTE_DESTINATION';
      if (isLate) {
        items.push({
          id: `late-${s.id}`,
          type: 'late_departure',
          severity: 'medium',
          serviceId: s.id,
          title: 'Partida atrasada',
          description: `Serviço ${s.hora} ainda não iniciado (${minuteDiff(dt as Date, now)} min de atraso).`,
          suggestion: 'Reatribuir motorista/viatura ou contactar equipa no terreno.',
        });
      }
    }

    Object.entries(byDriver).forEach(([driverId, driverServices]) => {
      const sorted = [...driverServices].sort((a, b) => String(a.hora || '').localeCompare(String(b.hora || '')));
      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1];
        const curr = sorted[i];
        const prevDt = parseServiceDateTime(prev);
        const currDt = parseServiceDateTime(curr);
        if (!prevDt || !currDt) continue;
        if (Math.abs(minuteDiff(prevDt, currDt)) < 45) {
          items.push({
            id: `driver-overlap-${driverId}-${curr.id}`,
            type: 'driver_overlap',
            severity: 'high',
            serviceId: curr.id,
            title: 'Conflito de agenda do motorista',
            description: `${driversById.get(driverId)?.nome || 'Motorista'} com serviços sobrepostos (${prev.hora} e ${curr.hora}).`,
            suggestion: 'Reatribuir um dos serviços para outro motorista.',
          });
        }
      }
    });

    Object.entries(byVehicle).forEach(([vehicleId, vehicleServices]) => {
      const sorted = [...vehicleServices].sort((a, b) => String(a.hora || '').localeCompare(String(b.hora || '')));
      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1];
        const curr = sorted[i];
        const prevDt = parseServiceDateTime(prev);
        const currDt = parseServiceDateTime(curr);
        if (!prevDt || !currDt) continue;
        if (Math.abs(minuteDiff(prevDt, currDt)) < 45) {
          items.push({
            id: `vehicle-double-${vehicleId}-${curr.id}`,
            type: 'vehicle_double',
            severity: 'high',
            serviceId: curr.id,
            title: 'Viatura com dupla atribuição',
            description: `${vehiclesById.get(vehicleId)?.matricula || 'Viatura'} com conflito em ${prev.hora} e ${curr.hora}.`,
            suggestion: 'Trocar viatura de um dos serviços.',
          });
        }
      }
    });

    return items;
  }, [servicesToday, driversById, vehiclesById, now]);

  const countByWindow = (predicate: (s: Servico) => boolean, startMin: number, endMin: number) => {
    return servicesToday.filter(({ service, dateTime }) => {
      if (!dateTime) return false;
      const delta = minuteDiff(now, dateTime);
      return delta >= startMin && delta < endMin && predicate(service);
    }).length;
  };

  const counters = useMemo(() => {
    const next60 = countByWindow(() => true, 0, 60);
    const prev60 = countByWindow(() => true, -60, 0);

    const noDriverNow = servicesToday.filter(({ service }) => !service.motoristaId).length;
    const noDriverPrev = countByWindow(s => !s.motoristaId, -60, 0);

    const noVehicleNow = servicesToday.filter(({ service }) => !service.vehicleId).length;
    const noVehiclePrev = countByWindow(s => !s.vehicleId, -60, 0);

    const delayedNow = servicesToday.filter(({ state }) => state === 'Delayed').length;
    const delayedPrev = countByWindow(s => getOperationalServiceState(s) === 'Delayed', -60, 0);

    const conflictNow = conflicts.length;
    const conflictPrev = Math.max(0, conflicts.filter(c => c.type === 'late_departure').length - 1);

    return {
      next60: { label: 'Início < 60 min', value: next60, previous: prev60, severity: next60 > 8 ? 'high' : next60 > 4 ? 'medium' : 'low' as Severity, filter: 'next60' as CounterFilter },
      noDriver: { label: 'Sem motorista', value: noDriverNow, previous: noDriverPrev, severity: noDriverNow > 0 ? 'high' : 'low' as Severity, filter: 'noDriver' as CounterFilter },
      noVehicle: { label: 'Sem viatura', value: noVehicleNow, previous: noVehiclePrev, severity: noVehicleNow > 0 ? 'high' : 'low' as Severity, filter: 'noVehicle' as CounterFilter },
      delayed: { label: 'Serviços atrasados', value: delayedNow, previous: delayedPrev, severity: delayedNow > 0 ? 'high' : 'low' as Severity, filter: 'delayed' as CounterFilter },
      conflicts: { label: 'Conflitos detectados', value: conflictNow, previous: conflictPrev, severity: conflictNow > 0 ? 'high' : 'low' as Severity, filter: 'conflicts' as CounterFilter },
    };
  }, [servicesToday, conflicts]);

  const filteredServices = useMemo(() => {
    switch (counterFilter) {
      case 'next60':
        return servicesToday.filter(({ dateTime }) => dateTime && minuteDiff(now, dateTime) >= 0 && minuteDiff(now, dateTime) < 60);
      case 'noDriver':
        return servicesToday.filter(({ service }) => !service.motoristaId);
      case 'noVehicle':
        return servicesToday.filter(({ service }) => !service.vehicleId);
      case 'delayed':
        return servicesToday.filter(({ state }) => state === 'Delayed');
      case 'conflicts': {
        const ids = new Set(conflicts.map(c => c.serviceId));
        return servicesToday.filter(({ service }) => ids.has(service.id));
      }
      default:
        return servicesToday;
    }
  }, [counterFilter, servicesToday, conflicts, now]);

  const upcomingServices = useMemo(() => {
    return servicesToday
      .filter(({ dateTime }) => dateTime && minuteDiff(now, dateTime) >= 0 && minuteDiff(now, dateTime) <= 120)
      .sort((a, b) => String(a.service.hora || '').localeCompare(String(b.service.hora || '')));
  }, [servicesToday, now]);

  const activityStream = useMemo(() => {
    const eventRows = servicesToday.flatMap(({ service }) => {
      const events = buildServiceTimeline(service.serviceEvents || []);
      return events.map(evt => ({
        id: `${service.id}-${evt.id}`,
        timestamp: evt.timestamp,
        driverId: service.motoristaId || '',
        vehicleId: service.vehicleId || '',
        serviceId: service.id,
        description: `${evt.description} • ${service.hora} • ${service.origem} → ${service.destino}`,
      }));
    });

    return eventRows
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 120);
  }, [servicesToday]);

  const timelineFiltered = useMemo(() => {
    return activityStream.filter(item => {
      if (timelineDriverFilter !== 'all' && item.driverId !== timelineDriverFilter) return false;
      if (timelineVehicleFilter !== 'all' && item.vehicleId !== timelineVehicleFilter) return false;
      if (timelineServiceFilter !== 'all' && item.serviceId !== timelineServiceFilter) return false;
      return true;
    });
  }, [activityStream, timelineDriverFilter, timelineVehicleFilter, timelineServiceFilter]);

  const vehicleLiveRows = useMemo(() => {
    return cartrackVehicles
      .filter(v => Number.isFinite(v.latitude) && Number.isFinite(v.longitude))
      .map(v => {
        const plate = String(v.registration || v.label || '').trim();
        const linkedVehicle = viaturas.find(item => item.matricula === plate);
        const linkedService = linkedVehicle ? servicesToday.find(({ service }) => service.vehicleId === linkedVehicle.id) : undefined;
        const linkedDriver = linkedService?.service.motoristaId ? driversById.get(linkedService.service.motoristaId) : undefined;
        const state = linkedService?.state || 'Scheduled';

        return {
          id: v.id,
          plate,
          driverName: linkedDriver?.nome || v.driverName || 'Sem motorista',
          state,
          service: linkedService?.service,
          lat: Number(v.latitude),
          lng: Number(v.longitude),
        };
      })
      .filter(row => {
        if (mapOnlyActive && row.state !== 'Active') return false;
        if (mapOnlyDelayed && row.state !== 'Delayed') return false;
        if (mapOnlyIdleDrivers && row.state !== 'Scheduled') return false;
        return true;
      });
  }, [cartrackVehicles, servicesToday, driversById, viaturas, mapOnlyActive, mapOnlyDelayed, mapOnlyIdleDrivers]);

  const driverStatusRows = useMemo(() => {
    return motoristas.map(driver => {
      const assignedService = servicesToday.find(({ service }) => service.motoristaId === driver.id && !service.concluido);
      const hasVehicle = Boolean(driver.viaturaId || driver.currentVehicle || assignedService?.service.vehicleId);
      const normalizedStatus = String(driver.status || '').toLowerCase();
      const serviceDt = assignedService?.dateTime || null;
      const isNearPickup = Boolean(serviceDt && minuteDiff(now, serviceDt) >= 0 && minuteDiff(now, serviceDt) <= 20 && assignedService?.state === 'Scheduled');

      let status: DriverStatus = 'available';
      if (normalizedStatus === 'ferias' || normalizedStatus === 'indisponivel') status = 'off_shift';
      else if (!hasVehicle) status = 'without_vehicle';
      else if (assignedService && assignedService.state === 'Active') status = 'on_trip';
      else if (isNearPickup) status = 'near_pickup';

      return { driver, assignedService: assignedService?.service, status };
    });
  }, [motoristas, servicesToday, now]);

  const performance = useMemo(() => {
    const completed = servicesToday.filter(({ state }) => state === 'Completed').length;
    const delayRate = servicesToday.length ? (servicesToday.filter(({ state }) => state === 'Delayed').length / servicesToday.length) * 100 : 0;
    const avgOccupancy = servicesToday.length
      ? servicesToday.reduce((sum, { service }) => {
          const vehicle = service.vehicleId ? vehiclesById.get(service.vehicleId) : null;
          const capacity = Number(vehicle?.vehicleCapacity || 8);
          const passengers = Number(service.passengerCount || 1);
          return sum + (passengers / Math.max(capacity, 1)) * 100;
        }, 0) / servicesToday.length
      : 0;

    const onTrip = driverStatusRows.filter(row => row.status === 'on_trip').length;
    const driverUtil = motoristas.length ? (onTrip / motoristas.length) * 100 : 0;

    const activeVehicleIds = new Set(servicesToday.filter(({ state }) => state === 'Active' || state === 'Delayed').map(({ service }) => service.vehicleId).filter(Boolean));
    const fleetUtil = viaturas.length ? (activeVehicleIds.size / viaturas.length) * 100 : 0;

    const prevCompleted = countByWindow(s => getOperationalServiceState(s) === 'Completed', -60, 0);
    const prevDelayRateBase = Math.max(1, countByWindow(() => true, -60, 0));
    const prevDelayRate = (countByWindow(s => getOperationalServiceState(s) === 'Delayed', -60, 0) / prevDelayRateBase) * 100;

    return {
      completed,
      delayRate,
      avgOccupancy,
      driverUtil,
      fleetUtil,
      trendCompleted: completed - prevCompleted,
      trendDelay: delayRate - prevDelayRate,
    };
  }, [servicesToday, driverStatusRows, motoristas.length, viaturas.length, vehiclesById]);

  const groupedAlerts = useMemo<Record<AlertItem['category'], AlertItem[]>>(() => {
    const out: Record<AlertItem['category'], AlertItem[]> = {
      operations: [],
      vehicles: [],
      drivers: [],
      gps: [],
      conflicts: [],
    };

    upcomingServices
      .filter(({ dateTime }) => (dateTime ? minuteDiff(now, dateTime) <= 15 : false))
      .forEach(({ service, dateTime }) => {
        out.operations.push({
          id: `ops-${service.id}`,
          category: 'operations',
          severity: 'medium',
          timestamp: new Date().toISOString(),
          serviceId: service.id,
          title: 'Serviço a iniciar em breve',
          description: `${service.hora} • ${service.origem} → ${service.destino} (${minuteDiff(now, dateTime as Date)} min).`,
          actionLabel: 'Abrir serviço',
          action: () => setSelectedServiceId(service.id),
        });
      });

    servicesToday.filter(({ service }) => !service.vehicleId).forEach(({ service }) => {
      out.vehicles.push({
        id: `veh-${service.id}`,
        category: 'vehicles',
        severity: 'high',
        timestamp: new Date().toISOString(),
        serviceId: service.id,
        title: 'Serviço sem viatura',
        description: `${service.hora} • ${service.origem} → ${service.destino}`,
        actionLabel: 'Atribuir viatura',
        action: () => setSelectedServiceId(service.id),
      });
    });

    servicesToday.filter(({ service }) => !service.motoristaId).forEach(({ service }) => {
      out.drivers.push({
        id: `drv-${service.id}`,
        category: 'drivers',
        severity: 'high',
        timestamp: new Date().toISOString(),
        serviceId: service.id,
        title: 'Serviço sem motorista',
        description: `${service.hora} • ${service.origem} → ${service.destino}`,
        actionLabel: 'Reassign driver',
        action: () => setSelectedServiceId(service.id),
      });
    });

    vehicleLiveRows.filter(v => !Number.isFinite(v.lat) || !Number.isFinite(v.lng)).forEach(v => {
      out.gps.push({
        id: `gps-${v.id}`,
        category: 'gps',
        severity: 'medium',
        timestamp: new Date().toISOString(),
        title: `GPS instável: ${v.plate || 'Sem matrícula'}`,
        description: 'Sem coordenadas válidas nas últimas leituras.',
        actionLabel: 'Open vehicle location',
        action: () => setMapOnlyActive(false),
      });
    });

    conflicts.forEach(conflict => {
      out.conflicts.push({
        id: `c-${conflict.id}`,
        category: 'conflicts',
        severity: conflict.severity,
        timestamp: new Date().toISOString(),
        serviceId: conflict.serviceId,
        title: conflict.title,
        description: conflict.description,
        actionLabel: 'resolve conflict',
        action: () => setSelectedServiceId(conflict.serviceId),
      });
    });

    notifications
      .filter(n => n.type === 'system_alert')
      .slice(0, 6)
      .forEach(n => {
        out.operations.push({
          id: n.id,
          category: 'operations',
          severity: (n.data?.priority === 'high' ? 'high' : 'medium') as Severity,
          timestamp: n.timestamp,
          title: String(n.data?.title || 'Alerta do sistema'),
          description: String(n.data?.message || ''),
          actionLabel: 'Abrir serviço',
          action: () => undefined,
        });
      });

    return out;
  }, [upcomingServices, servicesToday, vehicleLiveRows, conflicts, notifications, now]);

  const nextServicesGrouped = useMemo(() => {
    const map = new Map<string, typeof upcomingServices>();
    upcomingServices.forEach(item => {
      const key = item.service.hora || 'Sem hora';
      const arr = map.get(key) || [];
      arr.push(item);
      map.set(key, arr);
    });
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [upcomingServices]);

  useEffect(() => {
    const sync = async () => {
      const today = new Date().toISOString().split('T')[0];
      const todayServices = (servicos as Servico[]).filter(service => !service.data || service.data === today);
      await upsertServicePrimaryPassenger(todayServices);
      const [h, e] = await Promise.all([fetchHotelMonthlyStats(monthStartIso()), fetchEmployeeMonthlyStats(monthStartIso())]);
      setHotelStats(h.slice(0, 4));
      setEmployeeStats(e.slice(0, 4));
    };

    void sync();
    const id = setInterval(() => void sync(), 180000);
    return () => clearInterval(id);
  }, [servicos]);

  useEffect(() => {
    refreshData();
    return () => undefined;
  }, [refreshData]);

  useEffect(() => {
    if (!selectedServiceId && servicesToday[0]?.service.id) {
      setSelectedServiceId(servicesToday[0].service.id);
    }
  }, [selectedServiceId, servicesToday]);

  const onAssignDriver = async (service: Servico, driverId: string) => {
    await updateServico({ ...service, motoristaId: driverId || undefined });
    await refreshData();
  };

  const onAssignVehicle = async (service: Servico, vehicleId: string) => {
    const vehicle = vehiclesById.get(vehicleId);
    const capacity = Number(vehicle?.vehicleCapacity || 8);
    const passengers = Number(service.passengerCount || 1);
    const occupancyRate = Number(((passengers / Math.max(capacity, 1)) * 100).toFixed(2));
    await updateServico({ ...service, vehicleId: vehicleId || undefined, occupancyRate, passengerCount: passengers });
    await refreshData();
  };

  const onMarkStarted = async (service: Servico) => {
    await updateServico({ ...service, status: 'EN_ROUTE_ORIGIN', concluido: false });
    await refreshData();
  };

  const onMarkCompleted = async (service: Servico) => {
    await updateServico({ ...service, status: 'COMPLETED', concluido: true });
    await refreshData();
  };

  const onOpenRoute = (service: Servico) => {
    const url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(service.origem || '')}&destination=${encodeURIComponent(service.destino || '')}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const onQuickReassignFromDriver = async (driverId: string) => {
    if (!selectedService || selectedService.motoristaId === driverId) return;
    await onAssignDriver(selectedService, driverId);
  };

  return (
    <div className="space-y-6">
      <header className="surface-card p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-black text-slate-900">Centro Operacional</h1>
            <p className="mt-1 text-sm text-slate-600">Centro de despacho em tempo real para frota, serviços e conflitos operacionais.</p>
          </div>

          <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
            {Object.values(counters).map(counter => (
              <button
                key={counter.filter}
                onClick={() => setCounterFilter(counter.filter)}
                className={`rounded-xl border px-3 py-2 text-left transition-colors ${counterFilter === counter.filter ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
              >
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{counter.label}</p>
                <div className="mt-1 flex items-center justify-between">
                  <p className="text-2xl font-black text-slate-900">{counter.value}</p>
                  <span className={`inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${severityClass[counter.severity]}`}>
                    {counter.value >= counter.previous ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                    {Math.abs(counter.value - counter.previous)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
        <PerfCard label="Serviços concluídos hoje" value={`${performance.completed}`} trend={performance.trendCompleted} />
        <PerfCard label="Delay rate" value={`${performance.delayRate.toFixed(1)}%`} trend={-performance.trendDelay} />
        <PerfCard label="Ocupação média" value={`${performance.avgOccupancy.toFixed(1)}%`} trend={0} />
        <PerfCard label="Driver utilization" value={`${performance.driverUtil.toFixed(1)}%`} trend={0} />
        <PerfCard label="Fleet utilization" value={`${performance.fleetUtil.toFixed(1)}%`} trend={0} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <section className="surface-card p-5 xl:col-span-7">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-black text-slate-900">Serviços do dia</h2>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">Filtro: {counterFilter}</span>
          </div>

          <div className="grid max-h-[30rem] grid-cols-1 gap-3 overflow-y-auto pr-1 custom-scrollbar">
            {filteredServices.map(({ service, state, dateTime }) => {
              const driver = service.motoristaId ? driversById.get(service.motoristaId) : undefined;
              const vehicle = service.vehicleId ? vehiclesById.get(service.vehicleId) : undefined;
              const passengerCount = Number(service.passengerCount || 1);
              const capacity = Number(vehicle?.vehicleCapacity || 8);
              const occupancy = Number(((passengerCount / Math.max(capacity, 1)) * 100).toFixed(1));
              const minutesToStart = dateTime ? minuteDiff(now, dateTime) : null;
              const stage = toDispatchStageLabel(coerceServiceStatus(service.status) || updateServiceStatus(service));
              const urgent = Boolean(service.isUrgent) || state === 'Delayed';

              return (
                <article
                  key={service.id}
                  className={`rounded-2xl border p-4 transition-all ${selectedServiceId === service.id ? 'border-blue-300 bg-blue-50/70' : 'border-slate-200 bg-white'} ${urgent ? 'ring-1 ring-red-300' : ''}`}
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <button className="text-left" onClick={() => setSelectedServiceId(service.id)}>
                      <p className="text-sm font-black text-slate-900">{service.hora} • {service.origem} → {service.destino}</p>
                      <p className="text-xs text-slate-600">{driver?.nome || 'Sem motorista'} • {vehicle?.matricula || 'Sem viatura'}</p>
                    </button>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${urgent ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'}`}>{stateIndicator[state] || state}</span>
                  </div>

                  <div className="grid grid-cols-1 gap-2 text-xs text-slate-600 md:grid-cols-3">
                    <p>Passageiros: <span className="font-semibold text-slate-900">{passengerCount}/{capacity}</span></p>
                    <p>Ocupação: <span className="font-semibold text-slate-900">{occupancy}%</span></p>
                    <p>Início: <span className="font-semibold text-slate-900">{minutesToStart === null ? '--' : minutesToStart < 0 ? `há ${Math.abs(minutesToStart)} min` : `${minutesToStart} min`}</span></p>
                  </div>

                  <p className="mt-1 text-[11px] text-slate-500">Status: {stage}</p>

                  <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-5">
                    <select
                      value={service.motoristaId || ''}
                      onChange={(e) => void onAssignDriver(service, e.target.value)}
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700"
                    >
                      <option value="">assign driver</option>
                      {motoristas.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                    </select>

                    <select
                      value={service.vehicleId || ''}
                      onChange={(e) => void onAssignVehicle(service, e.target.value)}
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700"
                    >
                      <option value="">assign vehicle</option>
                      {viaturas.map(v => <option key={v.id} value={v.id}>{v.matricula}</option>)}
                    </select>

                    <button onClick={() => onOpenRoute(service)} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">open route</button>
                    <button onClick={() => void onMarkStarted(service)} className="rounded-lg border border-blue-200 bg-blue-50 px-2 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100">mark as started</button>
                    <button onClick={() => void onMarkCompleted(service)} className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100">mark as completed</button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="surface-card p-5 xl:col-span-5">
          <h2 className="mb-3 text-lg font-black text-slate-900">Real-time Alert Center</h2>
          <div className="space-y-3 max-h-[30rem] overflow-y-auto pr-1 custom-scrollbar">
            {(Object.entries(groupedAlerts) as Array<[AlertItem['category'], AlertItem[]]>).map(([category, items]) => (
              <div key={category} className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">{category}</p>
                <div className="space-y-2">
                  {items.length === 0 && <p className="text-xs text-slate-400">Sem alertas.</p>}
                  {items.slice(0, 6).map(alert => (
                    <div key={alert.id} className={`rounded-lg border p-2 ${severityClass[alert.severity]}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-bold">{alert.title}</p>
                          <p className="text-[11px] mt-0.5">{alert.description}</p>
                          <p className="text-[10px] mt-1 opacity-80">{new Date(alert.timestamp).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                        <button onClick={alert.action} className="rounded-md border border-current/20 px-2 py-1 text-[10px] font-bold uppercase">
                          {alert.actionLabel}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <section className="surface-card p-5 xl:col-span-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-black text-slate-900">Timeline operacional</h2>
            <Filter className="h-4 w-4 text-slate-400" />
          </div>

          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            <select value={timelineDriverFilter} onChange={(e) => setTimelineDriverFilter(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700">
              <option value="all">Driver</option>
              {motoristas.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
            </select>
            <select value={timelineVehicleFilter} onChange={(e) => setTimelineVehicleFilter(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700">
              <option value="all">Vehicle</option>
              {viaturas.map(v => <option key={v.id} value={v.id}>{v.matricula}</option>)}
            </select>
            <select value={timelineServiceFilter} onChange={(e) => setTimelineServiceFilter(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700">
              <option value="all">Service</option>
              {servicesToday.map(({ service }) => <option key={service.id} value={service.id}>{service.hora} {service.origem}</option>)}
            </select>
          </div>

          <div className="mt-3 max-h-[22rem] overflow-y-auto space-y-2 custom-scrollbar pr-1">
            {timelineFiltered.length === 0 && <p className="text-sm text-slate-500">Sem eventos para os filtros selecionados.</p>}
            {timelineFiltered.slice(0, 60).map(item => (
              <div key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{new Date(item.timestamp).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}</p>
                <p className="text-xs text-slate-700 mt-0.5">{item.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="surface-card p-5 xl:col-span-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-black text-slate-900">Mapa operacional</h2>
            <MapPin className="h-4 w-4 text-slate-400" />
          </div>

          <div className="mb-3 flex flex-wrap gap-2">
            <button onClick={() => setMapOnlyActive(prev => !prev)} className={`rounded-lg border px-2 py-1 text-xs font-semibold ${mapOnlyActive ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600'}`}>show only active services</button>
            <button onClick={() => setMapOnlyDelayed(prev => !prev)} className={`rounded-lg border px-2 py-1 text-xs font-semibold ${mapOnlyDelayed ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-slate-200 bg-white text-slate-600'}`}>show only delayed vehicles</button>
            <button onClick={() => setMapOnlyIdleDrivers(prev => !prev)} className={`rounded-lg border px-2 py-1 text-xs font-semibold ${mapOnlyIdleDrivers ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-600'}`}>show only idle drivers</button>
          </div>

          <div className="max-h-[22rem] overflow-y-auto space-y-2 custom-scrollbar pr-1">
            {vehicleLiveRows.length === 0 && <p className="text-sm text-slate-500">Sem viaturas para os filtros ativos.</p>}
            {vehicleLiveRows.map(vehicle => (
              <button key={vehicle.id} onClick={() => vehicle.service && setSelectedServiceId(vehicle.service.id)} className="w-full rounded-lg border border-slate-200 bg-white p-3 text-left hover:bg-slate-50">
                <p className="text-sm font-bold text-slate-900">{vehicle.plate || 'Sem matrícula'} • {vehicle.driverName}</p>
                <p className="text-xs text-slate-600">{vehicle.state} • {vehicle.lat.toFixed(5)}, {vehicle.lng.toFixed(5)}</p>
                {vehicle.service && <p className="text-[11px] text-slate-500 mt-1">{vehicle.service.hora} • {vehicle.service.origem} → {vehicle.service.destino}</p>}
              </button>
            ))}
          </div>
        </section>

        <section className="surface-card p-5 xl:col-span-4">
          <h2 className="text-lg font-black text-slate-900 mb-3">Estado dos Motoristas</h2>
          <div className="grid grid-cols-2 gap-2 text-xs mb-3">
            <StatusPill label="available" value={driverStatusRows.filter(d => d.status === 'available').length} className="bg-blue-100 text-blue-700" />
            <StatusPill label="on trip" value={driverStatusRows.filter(d => d.status === 'on_trip').length} className="bg-emerald-100 text-emerald-700" />
            <StatusPill label="off shift" value={driverStatusRows.filter(d => d.status === 'off_shift').length} className="bg-slate-100 text-slate-700" />
            <StatusPill label="without vehicle" value={driverStatusRows.filter(d => d.status === 'without_vehicle').length} className="bg-red-100 text-red-700" />
            <StatusPill label="near pickup" value={driverStatusRows.filter(d => d.status === 'near_pickup').length} className="bg-amber-100 text-amber-700" />
          </div>

          <div className="max-h-[22rem] overflow-y-auto space-y-2 custom-scrollbar pr-1">
            {driverStatusRows.map(row => (
              <div key={row.driver.id} className="rounded-lg border border-slate-200 bg-white p-2.5">
                <p className="text-sm font-bold text-slate-900">{row.driver.nome}</p>
                <p className="text-xs text-slate-600">{row.status.replace('_', ' ')}</p>
                {selectedService && row.status !== 'off_shift' && (
                  <button onClick={() => void onQuickReassignFromDriver(row.driver.id)} className="mt-2 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-700">
                    Quick reassign
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <section className="surface-card p-5 xl:col-span-6">
          <h2 className="text-lg font-black text-slate-900 mb-3">Próximos Serviços (Próximas 2 horas)</h2>
          <div className="space-y-3 max-h-[18rem] overflow-y-auto custom-scrollbar pr-1">
            {nextServicesGrouped.length === 0 && <p className="text-sm text-slate-500">Sem serviços nas próximas 2 horas.</p>}
            {nextServicesGrouped.map(([time, rows]) => (
              <div key={time} className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{time}</p>
                <div className="mt-2 space-y-1.5">
                  {rows.map(({ service, state }) => {
                    const risk = Boolean(service.isUrgent) || state === 'Delayed' || !service.motoristaId || !service.vehicleId;
                    return (
                      <button key={service.id} onClick={() => setSelectedServiceId(service.id)} className={`w-full rounded-lg border px-2.5 py-2 text-left ${risk ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-slate-50'}`}>
                        <p className="text-xs font-semibold text-slate-800">{service.origem} → {service.destino}</p>
                        <p className="text-[11px] text-slate-600">{driversById.get(String(service.motoristaId || ''))?.nome || 'Sem motorista'} • {vehiclesById.get(String(service.vehicleId || ''))?.matricula || 'Sem viatura'}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="surface-card p-5 xl:col-span-6">
          <h2 className="text-lg font-black text-slate-900 mb-3">Service Conflict Detection</h2>
          <div className="space-y-2 max-h-[18rem] overflow-y-auto custom-scrollbar pr-1">
            {conflicts.length === 0 && <p className="text-sm text-emerald-700">Sem conflitos críticos detectados.</p>}
            {conflicts.map(conflict => (
              <div key={conflict.id} className={`rounded-xl border p-3 ${severityClass[conflict.severity]}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold">{conflict.title}</p>
                    <p className="text-xs mt-1">{conflict.description}</p>
                    <p className="text-[11px] mt-1 font-semibold">Sugestão: {conflict.suggestion}</p>
                  </div>
                  <button onClick={() => setSelectedServiceId(conflict.serviceId)} className="rounded-md border border-current/30 px-2 py-1 text-[10px] font-bold uppercase">resolve conflict</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section className="surface-card p-5">
          <h2 className="text-lg font-black text-slate-900 mb-3">Resumo Mensal (Hotéis)</h2>
          <div className="space-y-2">
            {hotelStats.map(h => (
              <p key={`${h.month}-${h.hotel}`} className="text-sm text-slate-700">{h.hotel}: <span className="font-semibold">{h.totalTransportes}</span> transportes, <span className="font-semibold">{h.funcionariosTransportados}</span> funcionários</p>
            ))}
            {hotelStats.length === 0 && <p className="text-sm text-slate-500">Sem dados mensais.</p>}
          </div>
        </section>

        <section className="surface-card p-5">
          <h2 className="text-lg font-black text-slate-900 mb-3">Resumo Mensal (Funcionários)</h2>
          <div className="space-y-2">
            {employeeStats.map(e => (
              <p key={`${e.month}-${e.employeeId}`} className="text-sm text-slate-700">{e.employeeName}: <span className="font-semibold">{e.transportDays}</span> dias, <span className="font-semibold">{new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(e.totalCost)}</span></p>
            ))}
            {employeeStats.length === 0 && <p className="text-sm text-slate-500">Sem dados mensais.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}

function PerfCard({ label, value, trend }: { label: string; value: string; trend: number }) {
  const positive = trend >= 0;
  return (
    <div className="surface-card p-4">
      <p className="text-[11px] uppercase tracking-wide font-bold text-slate-500">{label}</p>
      <div className="mt-1 flex items-center justify-between">
        <p className="text-2xl font-black text-slate-900">{value}</p>
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${positive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
          {positive ? <ArrowUp className="mr-0.5 h-3 w-3" /> : <ArrowDown className="mr-0.5 h-3 w-3" />}
          {Math.abs(trend).toFixed(1)}
        </span>
      </div>
    </div>
  );
}

function StatusPill({ label, value, className }: { label: string; value: number; className: string }) {
  return (
    <div className={`rounded-lg px-2 py-1.5 font-semibold ${className}`}>
      {label}: {value}
    </div>
  );
}
