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
import { RefreshCcw, Navigation, Clock, MapPin, Truck as TruckIcon, Activity, AlertCircle } from 'lucide-react';
import { CartrackService, cleanTagId } from '../../services/cartrack';
import type { CartrackVehicle } from '../../services/cartrack';
import MetroLine from '../../components/TransportLine/MetroLine';
import type { VehicleMarker } from '../../components/TransportLine/MetroLine';
import { calculateRouteProgress } from '../../utils/geoUtils';
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

export default function LinhaTransportes() {
  const { geofences: contextGeofences, servicos, viaturas, motoristas } = useWorkshop();
  const [vehicles, setVehicles] = useState<CartrackVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [demoProgress, setDemoProgress] = useState(0);
  const [stops, setStops] = useState<RouteStop[]>(DEMO_ROUTE);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const todayServices = useMemo(() => (servicos || []).filter(s => s.data === todayStr), [servicos, todayStr]);

  const fetchVehicles = async () => {
    try {
      setLoading(true);
      setError(null);
      const vData = await CartrackService.getVehicles();
      const mappedVehicles = (vData || []).map(v => {
        if (!v.latitude || !v.longitude) return null;
        
        const normalize = (p?: string) => (p || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        const viatura = viaturas?.find(vi => normalize(vi.matricula) === normalize(v.registration));
        if (!viatura) return null;

        const driver = motoristas?.find(m => 
          (m.cartrackKey && v.tagId && cleanTagId(m.cartrackKey) === cleanTagId(v.tagId)) ||
          (m.cartrackId && v.driverId && String(m.cartrackId) === String(v.driverId)) ||
          (m.nome && v.driverName && m.nome.toLowerCase() === v.driverName.toLowerCase()) ||
          (m.currentVehicle && normalize(m.currentVehicle) === normalize(viatura.matricula))
        );

        if (!driver) return null;

        const driverServices = todayServices
          .filter(s => s.motoristaId === driver.id)
          .sort((a, b) => (a.hora || '').localeCompare(b.hora || ''));

        const activeService = getActiveService(driverServices);
        if (!activeService) return null;

        return {
          ...v,
          viatura,
          driver,
          activeService
        };
      }).filter((v): v is any => v !== null);

      setVehicles(mappedVehicles);

      const geofenceSource = contextGeofences.length > 0 ? contextGeofences : await CartrackService.getGeofences();

      if (geofenceSource && geofenceSource.length > 0) {
        let finalStops: RouteStop[] = [];
        if (selectedVehicleId) {
          const v = mappedVehicles.find(v => v.id === selectedVehicleId);
          const viatura = viaturas?.find(vi => v && vi.matricula.replace(/[^a-zA-Z0-9]/g, '') === v.registration.replace(/[^a-zA-Z0-9]/g, ''));
          const vehicleServices = todayServices.filter(s => s.vehicleId === viatura?.id).sort((a, b) => (a.hora || '').localeCompare(b.hora || ''));
          const stopNamesWithTime: { name: string, time: string }[] = [];
          vehicleServices.forEach(s => {
            if (!stopNamesWithTime.find(item => item.name === s.origem)) stopNamesWithTime.push({ name: s.origem, time: s.hora });
            if (!stopNamesWithTime.find(item => item.name === s.destino)) stopNamesWithTime.push({ name: s.destino, time: s.hora });
          });

          finalStops = stopNamesWithTime.map((item, idx) => {
            const gf = geofenceSource.find(g => g.name.toLowerCase().includes(item.name.toLowerCase()));
            let timeToNext: string | undefined;
            if (idx < stopNamesWithTime.length - 1) {
              const [h1, m1] = item.time.split(':').map(Number);
              const [h2, m2] = stopNamesWithTime[idx+1].time.split(':').map(Number);
              const diff = (h2 * 60 + m2) - (h1 * 60 + m1);
              if (diff > 0) timeToNext = diff >= 60 ? `${Math.floor(diff/60)}h ${diff%60}m` : `${diff}min`;
            }
            return { id: gf?.id || `vstop-${idx}`, name: item.name, coord: { lat: gf?.latitude || 0, lng: gf?.longitude || 0 }, timeToNext };
          }).filter(s => s.coord.lat !== 0);
        } else {
          const activeStopNames = new Set<string>();
          todayServices.forEach(s => { activeStopNames.add(s.origem); activeStopNames.add(s.destino); });
          finalStops = [...geofenceSource]
            .filter(g => g.latitude && g.longitude && (activeStopNames.has(g.name) || activeStopNames.has(g.name.split(' (')[0])))
            .sort((a, b) => (b.longitude || 0) - (a.longitude || 0))
            .map(g => ({ id: g.id, name: g.name, coord: { lat: g.latitude!, lng: g.longitude! } }));
        }
        setStops(finalStops.length > 0 ? finalStops : DEMO_ROUTE);
      }
      setLastUpdate(new Date());
    } catch (err) {
      setError('Aviso: Falha ao sincronizar com Cartrack.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVehicles();
    const interval = setInterval(() => fetchVehicles(), 10000);
    return () => clearInterval(interval);
  }, [selectedVehicleId, todayServices]);

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

  const vehicleMarkers = useMemo(() => {
    const list: VehicleMarker[] = [];
    const realDisplayList = selectedVehicleId ? vehicles.filter(v => v.id === selectedVehicleId) : vehicles;
    realDisplayList.forEach(v => {
      const progress = calculateRouteProgress({ lat: v.latitude, lng: v.longitude }, stops);
      list.push({ id: v.id, label: v.registration || v.label, currentSegmentIndex: progress.currentSegmentIndex, progressInSegment: progress.progressInSegment, status: v.status });
    });
    if (isDemoMode) {
      const currentIndex = Math.floor(demoProgress);
      list.push({ id: 'demo-vehicle', label: 'DEMO-01', currentSegmentIndex: currentIndex, progressInSegment: demoProgress - currentIndex, status: 'moving' });
    }
    return list;
  }, [vehicles, stops, selectedVehicleId, isDemoMode, demoProgress]);

  const selectedVehicle = useMemo(() => vehicles.find(v => v.id === selectedVehicleId), [vehicles, selectedVehicleId]);

  return (
    <div className="min-h-screen bg-[#010409] p-4 sm:p-6 lg:p-8 animate-in fade-in duration-700">
      <div className="max-w-[1600px] mx-auto space-y-8">
        
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 bg-[#0a0f1d] p-6 rounded-3xl border border-white/5 shadow-2xl relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-transparent pointer-events-none" />
          <div className="flex items-center gap-5 relative z-10">
            <div className="p-4 rounded-2xl bg-blue-600/10 border border-blue-500/20 group-hover:scale-110 transition-transform duration-500">
              <Navigation className="w-7 h-7 text-blue-400 animate-pulse" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tighter uppercase">
                LINHA DE TRANSPORTES
              </h1>
              <p className="text-slate-400 text-xs sm:text-sm font-medium tracking-wide uppercase">
                Monitorização Global • Tempo Real
              </p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 relative z-10">
            <div className="h-10 px-4 rounded-xl bg-slate-900/50 border border-white/5 flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Live System</span>
            </div>
          </div>
        </div>

        {/* Global Monitor Section */}
        <div className="bg-[#0a0f1d] rounded-3xl border border-white/5 shadow-2xl overflow-hidden relative">
          <div className="p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-10">
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Activity className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white uppercase tracking-tight">
                    {selectedVehicle ? `Acompanhamento: ${selectedVehicle.label || selectedVehicle.registration}` : 'Monitorização de Tráfego'}
                  </h3>
                  {selectedVehicle && (
                    <button onClick={() => setSelectedVehicleId(null)} className="text-[10px] font-bold text-blue-400 hover:text-blue-300 uppercase tracking-widest">
                      Voltar para visão global
                    </button>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 sm:justify-end">
                <div className="px-3 py-1.5 rounded-lg bg-slate-900/50 border border-white/5 flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${loading ? 'bg-blue-400 animate-pulse' : 'bg-green-500'}`} />
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    {loading ? 'Sincronizando...' : lastUpdate.toLocaleTimeString()}
                  </span>
                </div>
                
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setIsDemoMode(!isDemoMode)}
                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
                      isDemoMode ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-slate-900 border border-white/5 text-slate-400 hover:border-blue-500/30 hover:text-white'
                    }`}
                  >
                    <Activity size={14} className={isDemoMode ? 'animate-pulse' : ''} />
                    {isDemoMode ? 'Parar Demo' : 'Modo Demo'}
                  </button>
                  <button onClick={fetchVehicles} disabled={loading} className="p-2 rounded-xl bg-slate-900 border border-white/5 text-slate-400 hover:text-white transition-colors">
                    <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
                  </button>
                </div>
              </div>
            </div>

            <MetroLine stops={stops} vehicles={vehicleMarkers} />

            {/* Legend Section */}
            <div className="mt-12 pt-8 border-t border-white/5 flex flex-wrap gap-8 items-center justify-center sm:justify-start">
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[.2em]">Concluído</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-slate-800" />
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[.2em]">Pendente</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[.2em]">Live</span>
              </div>
            </div>
          </div>

          <div className="p-8 border-t border-white/5 bg-[#030712]/40 backdrop-blur-xl">
            <div className="flex items-center gap-3 mb-10">
              <div className="w-1 h-6 bg-blue-500 rounded-full" />
              <h2 className="text-sm font-black text-white uppercase tracking-[.3em]">Catálogo de Frota</h2>
            </div>
            
            {vehicles.length === 0 && !isDemoMode ? (
              <div className="p-20 text-center border-2 border-dashed border-white/5 rounded-[2rem]">
                <TruckIcon className="w-16 h-16 text-slate-800 mx-auto mb-6 opacity-20" />
                <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Aguardando sinal GPS das viaturas...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {vehicles.map((v) => {
                  const progress = calculateRouteProgress({ lat: v.latitude, lng: v.longitude }, stops);
                  const nextStop = stops[progress.currentSegmentIndex + 1]?.name || 'Destino';
                  const isSelected = selectedVehicleId === v.id;

                  return (
                    <button
                      key={v.id}
                      onClick={() => setSelectedVehicleId(isSelected ? null : v.id)}
                      className={`group relative text-left p-6 rounded-[2rem] border transition-all duration-500 ${
                        isSelected 
                          ? 'bg-blue-600/10 border-blue-500/50 shadow-2xl' 
                          : 'bg-slate-900/40 border-white/5 hover:border-blue-500/20 hover:bg-slate-900/60'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-6">
                        <div className={`p-3 rounded-2xl ${isSelected ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-400 group-hover:bg-blue-500/20 group-hover:text-blue-400 transition-colors'}`}>
                          <TruckIcon size={20} />
                        </div>
                        <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                          v.status === 'moving' ? 'bg-green-500/10 text-green-400' : 'bg-slate-800 text-slate-500'
                        }`}>
                          {v.status === 'moving' ? 'Em Rota' : 'Standby'}
                        </div>
                      </div>
                      
                      <h4 className="text-xl font-black text-white mb-2 tracking-tighter truncate">
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
        </div>
      </div>
    </div>
  );
}
