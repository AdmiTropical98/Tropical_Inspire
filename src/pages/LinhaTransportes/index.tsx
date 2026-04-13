import type { Servico } from '../../types';
function getActiveService(services: Servico[]) {
  const now = new Date();

  const validServices = services
    .map(s => {
      if (!s.hora) return null;

      const [h, m] = s.hora.split(':').map(Number);

      const serviceTime = new Date();
      serviceTime.setHours(h, m, 0, 0);

      const diff = (now.getTime() - serviceTime.getTime()) / 60000;

      return {
        service: s,
        diff
      };
    })
    .filter(item => item && item.diff >= -120 && item.diff <= 180) as {
      service: Servico;
      diff: number;
    }[];

  if (validServices.length === 0) return null;

  // 👉 escolher o MAIS próximo da hora atual
  validServices.sort((a, b) => Math.abs(a.diff) - Math.abs(b.diff));

  return validServices[0].service;
}
import { useState, useEffect, useMemo } from 'react';
import { RefreshCcw, Navigation, MapPin, Truck as TruckIcon, Activity } from 'lucide-react';
import { CartrackService, cleanTagId } from '../../services/cartrack';
import type { CartrackGeofence, CartrackVehicle } from '../../services/cartrack';
import MetroLine from '../../components/TransportLine/MetroLine';
import type { VehicleMarker } from '../../components/TransportLine/MetroLine';
import { calculateDistance, calculateRouteProgress } from '../../utils/geoUtils';
import type { RouteStop } from '../../utils/geoUtils';
import { useWorkshop } from '../../contexts/WorkshopContext';

// MOCK ROUTE (Fallback)
const DEMO_ROUTE: RouteStop[] = [
  { id: 'd1', name: 'Oficina Central', coord: { lat: 37.0175, lng: -7.9308 }, timeToNext: '15min' },
  { id: 'd2', name: 'Paragem Norte', coord: { lat: 37.0250, lng: -7.9400 }, timeToNext: '10min' },
  { id: 'd3', name: 'Zona Industrial', coord: { lat: 37.0300, lng: -7.9600 }, timeToNext: '12min' },
  { id: 'd4', name: 'Aeroporto', coord: { lat: 37.0150, lng: -7.9700 }, timeToNext: '20min' },
  { id: 'd5', name: 'Terminal Sul', coord: { lat: 37.0050, lng: -7.9500 } },
];

type TrackedVehicle = CartrackVehicle & {
  viatura?: any;
  driver?: any;
  activeService?: Servico | null;
  allServices?: Servico[];
};

interface LinhaTransportesProps {
  colaboradorParagem?: string;
  colaboradorNome?: string;
  colaboradorId?: string;
  escala?: {
    origem?: string;
    destino?: string;
    hora?: string;
    data?: string;
    passageiro?: string;
  } | null;
  compact?: boolean;
}

const normalizeStopName = (value?: string | null) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const extractStopTokens = (value?: string | null) =>
  normalizeStopName(value)
    .split(' ')
    .filter(Boolean)
    .filter(token => !['de', 'da', 'do', 'das', 'dos'].includes(token));

const stopMatches = (source?: string | null, target?: string | null) => {
  const left = normalizeStopName(source);
  const right = normalizeStopName(target);

  if (!left || !right) return false;
  if (left === right || left.includes(right) || right.includes(left)) return true;

  const leftTokens = extractStopTokens(source);
  const rightTokens = extractStopTokens(target);
  if (leftTokens.length === 0 || rightTokens.length === 0) return false;

  const commonTokens = leftTokens.filter(token => rightTokens.includes(token));
  return commonTokens.length >= Math.min(leftTokens.length, rightTokens.length);
};

const resolveBestGeofence = (stopName: string, geofences: CartrackGeofence[]) => {
  const normalizedStop = normalizeStopName(stopName);
  if (!normalizedStop) return null;

  const scoreGeofence = (geofenceName: string) => {
    const normalizedGeofence = normalizeStopName(geofenceName);
    const normalizedBase = normalizeStopName(geofenceName.split(' (')[0]);

    if (normalizedGeofence === normalizedStop) return 4;
    if (normalizedBase === normalizedStop) return 3;
    if (normalizedGeofence.includes(normalizedStop) || normalizedStop.includes(normalizedBase)) return 2;
    return stopMatches(geofenceName, stopName) ? 1 : 0;
  };

  return geofences
    .filter((geofence) => Boolean(geofence?.name) && stopMatches(geofence.name, stopName))
    .sort((a, b) => scoreGeofence(b.name) - scoreGeofence(a.name))[0] ?? null;
};

const normalizePlate = (value?: string | null) =>
  String(value ?? '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase();

const hasNamedVehicleOccupant = (value?: string | null, tagId?: string | null) => {
  const label = String(value ?? '').trim();
  if (!label) return false;

  const upper = label.toUpperCase();
  if (upper === 'N/A' || upper === 'SEM MOTORISTA') return false;
  if (upper.startsWith('TAG ') || upper.includes('(TAG ')) return false;

  const cleanedTag = cleanTagId(tagId ?? undefined);
  const cleanedLabel = cleanTagId(label);
  return !cleanedTag || cleanedLabel !== cleanedTag;
};

const getVehicleOccupantLabel = (
  vehicle?: Pick<CartrackVehicle, 'driverName' | 'tagId'> | null,
  fallbackDriverName?: string | null
) => {
  if (hasNamedVehicleOccupant(vehicle?.driverName, vehicle?.tagId)) {
    return String(vehicle?.driverName).trim();
  }

  const cleanedTag = cleanTagId(vehicle?.tagId);
  if (cleanedTag) return `Tag ${cleanedTag}`;

  if (fallbackDriverName?.trim()) return fallbackDriverName.trim();

  return 'Motorista em rota';
};

const buildNearbyGeofenceStops = (
  vehicle: Pick<CartrackVehicle, 'id' | 'latitude' | 'longitude'>,
  geofences: CartrackGeofence[]
): RouteStop[] => {
  if (!vehicle?.latitude || !vehicle?.longitude) return [];

  return geofences
    .filter((g) => Boolean(g.latitude && g.longitude && g.name))
    .map((g) => ({
      geofence: g,
      distance: calculateDistance(
        { lat: vehicle.latitude, lng: vehicle.longitude },
        { lat: g.latitude!, lng: g.longitude! }
      )
    }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 5)
    .map(({ geofence }) => ({
      id: geofence.id,
      name: geofence.name,
      coord: { lat: geofence.latitude!, lng: geofence.longitude! }
    }));
};

const parseDurationToMinutes = (value?: string) => {
  if (!value) return null;

  const hoursMatch = value.match(/(\d+)\s*h/i);
  const minutesMatch = value.match(/(\d+)\s*(?:m|min)/i);
  const hours = hoursMatch ? Number(hoursMatch[1]) : 0;
  const minutes = minutesMatch ? Number(minutesMatch[1]) : 0;
  const total = hours * 60 + minutes;

  return Number.isFinite(total) && total > 0 ? total : null;
};

const formatEtaFromMinutes = (minutes?: number | null) => {
  if (minutes == null) return 'Em cálculo';
  if (minutes <= 1) return 'A chegar';
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
  return `${Math.round(minutes)} min`;
};

const buildServiceDateTime = (service: any) => {
  const dateValue = String(service?.data || new Date().toISOString().split('T')[0]);
  const hourValue = String(service?.hora || '23:59').slice(0, 5);
  const parsed = new Date(`${dateValue}T${hourValue}:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const parseServiceHourToDistance = (service: any) => {
  const serviceDate = buildServiceDateTime(service);
  if (!serviceDate) return Number.POSITIVE_INFINITY;
  return Math.abs(serviceDate.getTime() - Date.now());
};

const serviceMatchesEscala = (service: any, escala?: { origem?: string; destino?: string; hora?: string; data?: string } | null) => {
  if (!escala) return false;

  const sameOrigin = stopMatches(service?.origem, escala.origem);
  const sameDestination = stopMatches(service?.destino, escala.destino);
  const sameDate = !escala.data || !service?.data || String(service.data) === String(escala.data);

  if (!sameOrigin || !sameDestination || !sameDate) return false;

  if (!escala.hora || !service?.hora) return true;

  const [serviceHour, serviceMinute] = String(service.hora).split(':').map(Number);
  const [escalaHour, escalaMinute] = String(escala.hora).split(':').map(Number);
  if (![serviceHour, serviceMinute, escalaHour, escalaMinute].every(Number.isFinite)) return true;

  const diffMinutes = Math.abs((serviceHour * 60 + serviceMinute) - (escalaHour * 60 + escalaMinute));
  return diffMinutes <= 90;
};

export default function LinhaTransportes({ colaboradorParagem, colaboradorNome, colaboradorId, escala = null, compact = false }: LinhaTransportesProps) {
  const { geofences: contextGeofences, servicos, viaturas, motoristas, cartrackVehicles } = useWorkshop();
  const [vehicles, setVehicles] = useState<TrackedVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [demoProgress, setDemoProgress] = useState(0);
  const [stops, setStops] = useState<RouteStop[]>([]);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const todayServices = useMemo(() => (servicos || []).filter(s => s.data === todayStr), [servicos, todayStr]);

  const collaboratorServices = useMemo(() => {
    const normalizedColaboradorName = normalizeStopName(colaboradorNome);
    const servicePool = (servicos || []).filter((s: any) => !s?.concluido);

    return servicePool
      .filter((s: any) => {
        if (colaboradorId && s.colaboradorId && String(s.colaboradorId) === String(colaboradorId)) return true;
        if (normalizedColaboradorName && normalizeStopName(s.passageiro) === normalizedColaboradorName) return true;
        if (serviceMatchesEscala(s, escala)) return true;
        if (colaboradorParagem && (stopMatches(s.origem, colaboradorParagem) || stopMatches(s.destino, colaboradorParagem))) return true;
        return false;
      })
      .sort((a: any, b: any) => {
        const aEscalaMatch = serviceMatchesEscala(a, escala) ? 0 : 1;
        const bEscalaMatch = serviceMatchesEscala(b, escala) ? 0 : 1;
        if (aEscalaMatch !== bEscalaMatch) return aEscalaMatch - bEscalaMatch;
        return parseServiceHourToDistance(a) - parseServiceHourToDistance(b);
      });
  }, [servicos, colaboradorId, colaboradorNome, colaboradorParagem, escala]);

  const collaboratorService = collaboratorServices[0] ?? null;
  const collaboratorDriver = useMemo(
    () => collaboratorService?.motoristaId ? motoristas.find(m => m.id === collaboratorService.motoristaId) ?? null : null,
    [collaboratorService, motoristas]
  );

  const collaboratorAssignedVehicleRegistration = useMemo(() => {
    const serviceVehicle = collaboratorService?.vehicleId
      ? viaturas.find(v => String(v.id) === String(collaboratorService.vehicleId))?.matricula
      : undefined;

    const driverPersistedVehicle = collaboratorDriver?.viaturaId
      ? viaturas.find(v => String(v.id) === String(collaboratorDriver.viaturaId))?.matricula
      : undefined;

    return serviceVehicle || driverPersistedVehicle || collaboratorDriver?.currentVehicle || undefined;
  }, [collaboratorDriver, collaboratorService, viaturas]);

  const fetchVehicles = async () => {
    try {
      setLoading(true);
      const vData = cartrackVehicles.length > 0 ? cartrackVehicles : await CartrackService.getVehicles();
      const mappedVehicles = (vData || []).map(v => {
        if (!v.latitude || !v.longitude) return null;

        const vehiclePlate = normalizePlate(v.registration || v.label);
        const driver = motoristas?.find(m => 
          (m.cartrackKey && v.tagId && cleanTagId(m.cartrackKey) === cleanTagId(v.tagId)) ||
          (m.cartrackId && v.driverId && String(m.cartrackId) === String(v.driverId)) ||
          (m.nome && v.driverName && normalizeStopName(m.nome) === normalizeStopName(v.driverName)) ||
          (m.viaturaId && viaturas?.some(vi => String(vi.id) === String(m.viaturaId) && normalizePlate(vi.matricula) === vehiclePlate)) ||
          (m.currentVehicle && normalizePlate(m.currentVehicle) === vehiclePlate)
        );

        const viatura = viaturas?.find(vi =>
          (driver?.viaturaId && String(vi.id) === String(driver.viaturaId)) ||
          normalizePlate(vi.matricula) === vehiclePlate ||
          (driver?.currentVehicle && normalizePlate(vi.matricula) === normalizePlate(driver.currentVehicle))
        ) ?? null;

        const driverServices = driver 
          ? todayServices.filter(s => s.motoristaId === driver.id)
          : [];
        
        const vehicleServices = todayServices.filter((s: any) => viatura ? s.vehicleId === viatura.id : false);
        
        // Combine services from both driver and vehicle
        const allRelevantServices = [...new Set([...driverServices, ...vehicleServices])]
          .sort((a, b) => (a.hora || '').localeCompare(b.hora || ''));

        const activeService = getActiveService(allRelevantServices);

        return {
          ...v,
          viatura,
          driver,
          activeService,
          allServices: allRelevantServices
        };
      }).filter((v): v is any => v !== null);

      setVehicles(mappedVehicles);

      const geofenceSource = contextGeofences.length > 0 ? contextGeofences : await CartrackService.getGeofences();

      if (geofenceSource && geofenceSource.length > 0) {
        let finalStops: RouteStop[] = [];
        const matchedVehicleForColaborador = !selectedVehicleId
          ? mappedVehicles.find(v =>
              (v.allServices || []).some((s: Servico) =>
                serviceMatchesEscala(s, escala) ||
                stopMatches(s.origem, colaboradorParagem) ||
                stopMatches(s.destino, colaboradorParagem)
              )
            )
          : null;

        const vehicleToTrack = selectedVehicleId
          ? mappedVehicles.find(v => v.id === selectedVehicleId) ?? null
          : matchedVehicleForColaborador ?? null;

        if (vehicleToTrack) {
          const vehicleServices = vehicleToTrack.allServices || [];
          const nearbyStops = buildNearbyGeofenceStops(vehicleToTrack, geofenceSource);
          const stopNamesWithTime: { name: string; time: string; geofence: CartrackGeofence | null }[] = [];

          const pushResolvedStop = (rawName?: string, time?: string) => {
            if (!rawName) return;

            const geofence = resolveBestGeofence(rawName, geofenceSource);
            const displayName = geofence?.name || rawName;
            const stopKey = geofence?.id || normalizeStopName(displayName);

            if (!stopNamesWithTime.find(item => (item.geofence?.id || normalizeStopName(item.name)) === stopKey)) {
              stopNamesWithTime.push({ name: displayName, time: time || '', geofence });
            }
          };

          vehicleServices.forEach((s: Servico) => {
            pushResolvedStop(s.origem, s.hora);
            pushResolvedStop(s.destino, s.hora);
          });

          finalStops = stopNamesWithTime.map((item, idx) => {
            const gf = item.geofence;
            let timeToNext: string | undefined;
            if (idx < stopNamesWithTime.length - 1) {
              const [h1, m1] = item.time.split(':').map(Number);
              const [h2, m2] = stopNamesWithTime[idx + 1].time.split(':').map(Number);
              const diff = (h2 * 60 + m2) - (h1 * 60 + m1);
              if (diff > 0) timeToNext = diff >= 60 ? `${Math.floor(diff / 60)}h ${diff % 60}m` : `${diff}min`;
            }
            return {
              id: gf?.id || `vstop-${idx}`,
              name: gf?.name || item.name,
              coord: { lat: gf?.latitude || 0, lng: gf?.longitude || 0 },
              timeToNext
            };
          }).filter(s => s.coord.lat !== 0);

          if (selectedVehicleId) {
            const closestRouteStopDistance = finalStops.length > 0
              ? Math.min(...finalStops.map(stop => calculateDistance(
                  { lat: vehicleToTrack.latitude, lng: vehicleToTrack.longitude },
                  stop.coord
                )))
              : Number.POSITIVE_INFINITY;

            if (finalStops.length < 2 || closestRouteStopDistance > 1500) {
              finalStops = nearbyStops;
            }
          }
        } else {
          const activeStopNames = new Set<string>();
          todayServices.forEach(s => {
            if (s.origem) activeStopNames.add(s.origem);
            if (s.destino) activeStopNames.add(s.destino);
          });

          const matchedGeofences = [...geofenceSource]
            .filter(g =>
              g.latitude &&
              g.longitude &&
              (activeStopNames.size === 0 || [...activeStopNames].some(stopName => stopMatches(g.name, stopName)))
            )
            .sort((a, b) => (b.longitude || 0) - (a.longitude || 0))
            .map(g => ({ id: g.id, name: g.name, coord: { lat: g.latitude!, lng: g.longitude! } }));

          finalStops = matchedGeofences;
        }

        if (finalStops.length > 0) {
          setStops(finalStops);
        } else {
          const allGeofenceStops = [...geofenceSource]
            .filter(g => g.latitude && g.longitude)
            .sort((a, b) => (b.longitude || 0) - (a.longitude || 0))
            .map(g => ({ id: g.id, name: g.name, coord: { lat: g.latitude!, lng: g.longitude! } }));

          setStops(allGeofenceStops.length > 0 ? allGeofenceStops : (isDemoMode ? DEMO_ROUTE : []));
        }
      } else {
        setStops(isDemoMode ? DEMO_ROUTE : []);
      }
      setLastUpdate(new Date());
    } catch (err) {
      console.warn('Aviso: Falha ao sincronizar com Cartrack.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVehicles();
    const interval = setInterval(() => fetchVehicles(), 10000);
    return () => clearInterval(interval);
  }, [selectedVehicleId, todayServices, colaboradorParagem, cartrackVehicles, isDemoMode]);

  useEffect(() => {
    if (!isDemoMode) { setDemoProgress(0); return; }
    const interval = setInterval(() => {
      setDemoProgress(prev => {
        const totalSegments = Math.max(1, stops.length - 1);
        const next = prev + 0.015;
        if (next >= totalSegments) return 0;
        return next;
      });
    }, 100);
    return () => clearInterval(interval);
  }, [isDemoMode, stops.length]);

  const collaboratorVehicle = useMemo(() => {
    const byAssignedVehicle = collaboratorAssignedVehicleRegistration
      ? vehicles.find(v => normalizePlate(v.registration || v.label) === normalizePlate(collaboratorAssignedVehicleRegistration)) ?? null
      : null;

    if (byAssignedVehicle) return byAssignedVehicle;

    const byAssignedDriver = collaboratorDriver
      ? vehicles.find(v =>
          (collaboratorDriver.cartrackKey && v.tagId && cleanTagId(collaboratorDriver.cartrackKey) === cleanTagId(v.tagId)) ||
          (collaboratorDriver.cartrackId && v.driverId && String(collaboratorDriver.cartrackId) === String(v.driverId)) ||
          (collaboratorDriver.nome && v.driverName && normalizeStopName(collaboratorDriver.nome) === normalizeStopName(v.driverName))
        ) ?? null
      : null;

    if (byAssignedDriver) return byAssignedDriver;

    if (!colaboradorParagem) return null;
    return vehicles.find(v =>
      (v.allServices || []).some((s: Servico) =>
        stopMatches(s.origem, colaboradorParagem) || stopMatches(s.destino, colaboradorParagem)
      )
    ) || null;
  }, [vehicles, colaboradorParagem, collaboratorDriver, collaboratorAssignedVehicleRegistration]);

  const trackedVehicleId = selectedVehicleId || (compact ? collaboratorVehicle?.id ?? null : (colaboradorParagem ? collaboratorVehicle?.id ?? null : null));

  const vehicleMarkers = useMemo(() => {
    const list: VehicleMarker[] = [];
    const realDisplayList = trackedVehicleId
      ? vehicles.filter(v => v.id === trackedVehicleId)
      : compact && colaboradorParagem
        ? []
        : vehicles;

    realDisplayList.forEach(v => {
      const progress = calculateRouteProgress({ lat: v.latitude, lng: v.longitude }, stops);
      list.push({ id: v.id, label: v.registration || v.label, currentSegmentIndex: progress.currentSegmentIndex, progressInSegment: progress.progressInSegment, status: v.status });
    });
    if (isDemoMode && !compact) {
      const currentIndex = Math.floor(demoProgress);
      list.push({ id: 'demo-vehicle', label: 'DEMO-01', currentSegmentIndex: currentIndex, progressInSegment: demoProgress - currentIndex, status: 'moving' });
    }
    return list;
  }, [vehicles, stops, trackedVehicleId, isDemoMode, demoProgress, compact, colaboradorParagem]);

  const selectedVehicle = useMemo(
    () => (trackedVehicleId ? vehicles.find(v => v.id === trackedVehicleId) ?? null : null),
    [vehicles, trackedVehicleId]
  );

  const collaboratorStatus = useMemo(() => {
    if (!colaboradorParagem) return null;

    if (!selectedVehicle) {
      return {
        eta: collaboratorDriver ? 'Sem GPS' : 'A aguardar',
        detail: collaboratorDriver
          ? 'O motorista e a viatura já estão atribuídos, mas a posição GPS ainda não está disponível.'
          : 'Ainda não existe uma viatura ativa associada à sua paragem.',
        nextStop: collaboratorService?.destino || 'Por atribuir',
        motorista: collaboratorDriver?.nome || 'Por atribuir',
        viatura: collaboratorAssignedVehicleRegistration || 'Sem viatura'
      };
    }

    const motorista = getVehicleOccupantLabel(selectedVehicle, collaboratorDriver?.nome || selectedVehicle.driver?.nome);
    const viatura = collaboratorAssignedVehicleRegistration || selectedVehicle.registration || selectedVehicle.label || 'Sem matrícula';
    const targetIndex = stops.findIndex(stop => stopMatches(stop.name, colaboradorParagem));

    if (targetIndex === -1) {
      return {
        eta: 'Sem rota',
        detail: 'A sua paragem ainda não foi encontrada na rota ativa do motorista.',
        nextStop: stops[0]?.name || 'Por definir',
        motorista,
        viatura
      };
    }

    const progress = calculateRouteProgress({ lat: selectedVehicle.latitude, lng: selectedVehicle.longitude }, stops);
    const nextStop = stops[progress.currentSegmentIndex + 1]?.name || stops[targetIndex]?.name || 'Destino final';

    if (targetIndex <= progress.currentSegmentIndex && progress.progressInSegment > 0.15) {
      return {
        eta: 'Na zona',
        detail: 'O motorista está na sua paragem ou acabou de passar por ela.',
        nextStop,
        motorista,
        viatura
      };
    }

    let remainingMinutes = 0;
    let hasMinuteEstimate = false;
    for (let i = progress.currentSegmentIndex; i < targetIndex; i++) {
      const segmentMinutes = parseDurationToMinutes(stops[i]?.timeToNext);
      if (segmentMinutes != null) {
        hasMinuteEstimate = true;
        remainingMinutes += i === progress.currentSegmentIndex
          ? Math.max(1, segmentMinutes * (1 - progress.progressInSegment))
          : segmentMinutes;
      }
    }

    const remainingStops = Math.max(0, targetIndex - progress.currentSegmentIndex);
    const eta = hasMinuteEstimate ? formatEtaFromMinutes(remainingMinutes) : `${remainingStops} paragens`;

    return {
      eta,
      detail: hasMinuteEstimate
        ? `O motorista está aproximadamente a ${eta.toLowerCase()} da sua paragem.`
        : `O motorista está a ${remainingStops} paragens da sua paragem.`,
      nextStop,
      motorista,
      viatura
    };
  }, [colaboradorParagem, selectedVehicle, stops, collaboratorDriver, collaboratorService, collaboratorAssignedVehicleRegistration]);

  return (
    <div className={compact ? 'w-full animate-in fade-in duration-500' : 'min-h-screen bg-[#F5F7FA] p-4 sm:p-6 lg:p-8 animate-in fade-in duration-700'}>
      <div className={compact ? 'space-y-5' : 'max-w-[1600px] mx-auto space-y-8'}>
        
        {compact ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_8px_18px_-12px_rgba(15,23,42,0.22)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-blue-50 p-3 text-blue-600 border border-blue-100">
                  <Navigation className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900">Linha do Transporte</h2>
                  <p className="text-xs text-slate-600">Acompanhe o motorista até à sua paragem.</p>
                </div>
              </div>
              <button onClick={fetchVehicles} disabled={loading} className="inline-flex items-center gap-2 rounded-xl bg-white border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 hover:border-blue-400">
                <RefreshCcw size={14} className={loading ? 'animate-spin' : ''} />
                Atualizar
              </button>
            </div>

            {colaboradorParagem ? (
              <div className="mt-4 grid gap-3 md:grid-cols-[1.2fr_0.8fr]">
                <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-blue-700">Sua paragem</p>
                  <h3 className="mt-2 text-2xl font-black text-slate-900">{colaboradorParagem}</h3>
                  <p className="mt-2 text-sm text-slate-700">{collaboratorStatus?.detail || 'A sincronizar o trajeto do motorista...'}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3 md:grid-cols-1">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">ETA</p>
                    <p className="mt-2 text-xl font-black text-slate-900">{collaboratorStatus?.eta || 'Em cálculo'}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Próxima paragem</p>
                    <p className="mt-2 text-sm font-bold text-slate-900">{collaboratorStatus?.nextStop || 'Por definir'}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Motorista / Viatura</p>
                    <p className="mt-2 text-sm font-bold text-slate-900">{collaboratorStatus?.motorista || 'Por atribuir'}</p>
                    <p className="text-xs text-slate-500 mt-1">{collaboratorStatus?.viatura || 'Sem viatura'}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                Ainda não tem uma paragem registada. Defina a sua paragem para acompanhar o motorista em tempo real.
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 bg-white p-6 rounded-3xl border border-slate-200 shadow-[0_8px_18px_-12px_rgba(15,23,42,0.22)] relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-50/70 to-transparent pointer-events-none" />
            <div className="flex items-center gap-5 relative z-10">
              <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100 group-hover:scale-110 transition-transform duration-500">
                <Navigation className="w-7 h-7 text-blue-600 animate-pulse" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tighter uppercase">
                  LINHA DE TRANSPORTES
                </h1>
                <p className="text-slate-600 text-xs sm:text-sm font-medium tracking-wide uppercase">
                  Monitorização Global • Tempo Real
                </p>
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-3 relative z-10">
              <div className="h-10 px-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Live System</span>
              </div>
            </div>
          </div>
        )}

        {/* Global Monitor Section */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-[0_8px_18px_-12px_rgba(15,23,42,0.22)] overflow-hidden relative">
          <div className="p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-10">
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-lg bg-blue-50">
                  <Activity className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">
                    {selectedVehicle ? `Acompanhamento: ${selectedVehicle.label || selectedVehicle.registration}` : 'Monitorização de Tráfego'}
                  </h3>
                  {selectedVehicleId && (
                    <button onClick={() => setSelectedVehicleId(null)} className="text-[10px] font-bold text-blue-400 hover:text-blue-300 uppercase tracking-widest">
                      Voltar para visão global
                    </button>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 sm:justify-end">
                <div className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${loading ? 'bg-blue-400 animate-pulse' : 'bg-green-500'}`} />
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    {loading ? 'Sincronizando...' : lastUpdate.toLocaleTimeString()}
                  </span>
                </div>
                
                <div className="flex items-center gap-2">
                  {!compact && (
                    <button 
                      onClick={() => setIsDemoMode(!isDemoMode)}
                      className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
                        isDemoMode ? 'bg-blue-600 text-white shadow-sm' : 'bg-white border border-slate-300 text-slate-600 hover:border-blue-400 hover:text-slate-900'
                      }`}
                    >
                      <Activity size={14} className={isDemoMode ? 'animate-pulse' : ''} />
                      {isDemoMode ? 'Parar Demo' : 'Modo Demo'}
                    </button>
                  )}
                  <button onClick={fetchVehicles} disabled={loading} className="p-2 rounded-xl bg-white border border-slate-300 text-slate-600 hover:text-slate-900 transition-colors">
                    <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
                  </button>
                </div>
              </div>
            </div>

            <MetroLine stops={stops} vehicles={vehicleMarkers} />

            {!compact && (
              <>
                {/* Legend Section */}
                <div className="mt-12 pt-8 border-t border-slate-200 flex flex-wrap gap-8 items-center justify-center sm:justify-start">
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[.2em]">Concluído</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[.2em]">Pendente</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[.2em]">Live</span>
                  </div>
                </div>
              </>
            )}
          </div>

          {!compact && (
            <div className="p-8 border-t border-slate-200 bg-slate-50/70 backdrop-blur-xl">
              <div className="flex items-center gap-3 mb-10">
                <div className="w-1 h-6 bg-blue-500 rounded-full" />
                <h2 className="text-sm font-black text-slate-900 uppercase tracking-[.3em]">Catálogo de Frota</h2>
              </div>
              
              {vehicles.length === 0 && !isDemoMode ? (
                <div className="p-20 text-center border-2 border-dashed border-slate-200 rounded-[2rem] bg-white">
                  <TruckIcon className="w-16 h-16 text-slate-800 mx-auto mb-6 opacity-20" />
                  <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Aguardando sinal GPS das viaturas...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {vehicles.map((v) => {
                    const progress = calculateRouteProgress({ lat: v.latitude, lng: v.longitude }, stops);
                    const nextStop = stops[progress.currentSegmentIndex + 1]?.name || 'Destino';
                    const isSelected = trackedVehicleId === v.id;

                    return (
                      <button
                        key={v.id}
                        onClick={() => setSelectedVehicleId(isSelected ? null : v.id)}
                        className={`group relative text-left p-6 rounded-[2rem] border transition-all duration-500 ${
                          isSelected 
                            ? 'bg-blue-50 border-blue-300 shadow-md' 
                            : 'bg-white border-slate-200 hover:border-blue-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-6">
                          <div className={`p-3 rounded-2xl ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors border border-slate-200'}`}>
                            <TruckIcon size={20} />
                          </div>
                          <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                            v.status === 'moving' ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {v.status === 'moving' ? 'Em Rota' : 'Standby'}
                          </div>
                        </div>
                        
                        <h4 className="text-xl font-black text-slate-900 mb-2 tracking-tighter truncate">
                          {v.registration || v.label}
                        </h4>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-6">
                          Frota Logistica
                        </p>

                        <div className="space-y-4">
                          <div className="flex items-center justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            <span className="flex items-center gap-2 font-medium italic"><MapPin size={10} className="text-blue-500" /> Próxima</span>
                            <span className="text-blue-400 truncate max-w-[100px]">{nextStop}</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 transition-all duration-1000 shadow-[0_0_15px_rgba(59,130,246,0.5)]" style={{ width: `${(progress.currentSegmentIndex / (stops.length - 1)) * 100}%` }} />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
