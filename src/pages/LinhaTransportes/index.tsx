import { useState, useEffect, useMemo } from 'react';
import { RefreshCcw, Navigation2, AlertCircle, Clock, MapPin, Truck as TruckIcon, Activity } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import { CartrackService } from '../../services/cartrack';
import type { CartrackVehicle } from '../../services/cartrack';
import MetroLine from '../../components/TransportLine/MetroLine';
import type { VehicleMarker } from '../../components/TransportLine/MetroLine';
import { calculateRouteProgress } from '../../utils/geoUtils';
import type { RouteStop } from '../../utils/geoUtils';

import { useWorkshop } from '../../contexts/WorkshopContext';

// MOCK ROUTE (Fallback for development only)
const FALLBACK_ROUTE: RouteStop[] = [
  { id: 'f1', name: 'A aguardar POIs reais...', coord: { lat: 37.0182, lng: -7.9696 } },
];

export default function LinhaTransportes() {
  const { geofences: contextGeofences } = useWorkshop();
  const [vehicles, setVehicles] = useState<CartrackVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  
  // Stops for the route
  const [stops, setStops] = useState<RouteStop[]>(FALLBACK_ROUTE);

  const fetchVehicles = async () => {
    try {
      setLoading(true);
      setError(null);
      const vData = await CartrackService.getVehicles();
      
      // Filter active vehicles
      const activeVehicles = (vData || []).filter(v => v.latitude && v.longitude);
      setVehicles(activeVehicles);

      // Use context geofences if available
      const geofenceSource = contextGeofences.length > 0 ? contextGeofences : await CartrackService.getGeofences();

      if (geofenceSource && geofenceSource.length > 0) {
        // Auto-sorting heuristic: East to West (Longitude descending) for Algarve region
        const sortedGeofences = [...geofenceSource]
          .filter(g => g.latitude && g.longitude)
          .sort((a, b) => (b.longitude || 0) - (a.longitude || 0));

        setStops(sortedGeofences.map(g => ({
          id: g.id,
          name: g.name,
          coord: { lat: g.latitude!, lng: g.longitude! }
        })));
      } else if (stops === FALLBACK_ROUTE) {
        // Fallback to a broader mock if absolutely no POIs are found
        setStops([
          { id: 'm1', name: 'Sem POIs no Cartrack', coord: { lat: 37.0175, lng: -7.9308 } },
          { id: 'm2', name: 'Verifique definições', coord: { lat: 37.0175, lng: -8.0000 } }
        ]);
      }

      setLastUpdate(new Date());
    } catch (err) {
      console.error('Error fetching Cartrack data in Component:', err);
      setError('Aviso: Falha ao sincronizar com Cartrack.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVehicles();
    
    // Polling interval (Every 10 seconds as requested)
    const interval = setInterval(() => {
      fetchVehicles();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  // Compute vehicle markers for the MetroLine
  const vehicleMarkers = useMemo(() => {
    // If a vehicle is selected, only show that one
    const displayList = selectedVehicleId 
      ? vehicles.filter(v => v.id === selectedVehicleId)
      : vehicles;

    return displayList.map(v => {
      const progress = calculateRouteProgress({ lat: v.latitude, lng: v.longitude }, stops);
      return {
        id: v.id,
        label: v.registration || v.label,
        currentSegmentIndex: progress.currentSegmentIndex,
        progressInSegment: progress.progressInSegment,
        status: v.status
      } as VehicleMarker;
    });
  }, [vehicles, stops, selectedVehicleId]);

  const selectedVehicle = useMemo(() => 
    vehicles.find(v => v.id === selectedVehicleId), 
  [vehicles, selectedVehicleId]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Linha de Transportes"
        subtitle="Acompanhamento em tempo real das viaturas nas paragens programadas."
        icon={Navigation2}
      />

      {error && vehicles.length === 0 ? (
        <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5" />
          <p>{error}</p>
          <button 
            onClick={fetchVehicles}
            className="ml-auto px-4 py-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-sm font-medium transition-colors"
          >
            Tentar Novamente
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          
          {/* Main Visualization */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 overflow-hidden relative">
            {loading && vehicles.length === 0 && (
              <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm z-10 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <RefreshCcw className="w-8 h-8 text-blue-500 animate-spin" />
                  <p className="text-slate-400 text-sm animate-pulse">A obter dados em tempo real...</p>
                </div>
              </div>
            )}

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <Activity className="w-5 h-5 text-blue-500" />
                <div>
                  <h3 className="text-lg font-bold text-white">
                    {selectedVehicle ? `Acompanhamento: ${selectedVehicle.label || selectedVehicle.registration}` : 'Monitorização Global'}
                  </h3>
                  {selectedVehicle && (
                    <button 
                      onClick={() => setSelectedVehicleId(null)}
                      className="text-xs text-blue-500 hover:underline"
                    >
                      Voltar para visão global
                    </button>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <p className="text-xs text-slate-500 flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${loading ? 'bg-blue-500 animate-pulse' : 'bg-green-500'}`} />
                  {loading ? 'A atualizar...' : `Última att: ${lastUpdate.toLocaleTimeString()}`}
                </p>
                <button 
                  onClick={fetchVehicles}
                  disabled={loading}
                  className={`p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors ${loading ? 'animate-pulse' : ''}`}
                >
                  <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            <MetroLine 
              stops={stops}
              vehicles={vehicleMarkers}
            />
          </div>

          {/* Selection Instruction if nothing selected and many vehicles */}
          {!selectedVehicleId && vehicles.length > 1 && (
            <div className="bg-blue-500/5 border border-blue-500/10 rounded-xl p-3 text-center">
              <p className="text-xs text-blue-400">Dica: Selecione uma viatura no catálogo abaixo para ver o seu percurso individual.</p>
            </div>
          )}

          {/* Vehicles Status Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {vehicles.map((v) => {
              const progress = calculateRouteProgress({ lat: v.latitude, lng: v.longitude }, stops);
              const nextStop = stops[progress.currentSegmentIndex + 1]?.name || 'Destino Final';
              const lastStop = stops[progress.currentSegmentIndex]?.name || 'Origem';
              const isSelected = selectedVehicleId === v.id;
              
              return (
                <div 
                  key={v.id} 
                  onClick={() => setSelectedVehicleId(isSelected ? null : v.id)}
                  className={`bg-slate-900 border ${isSelected ? 'border-blue-500 shadow-lg shadow-blue-500/10' : 'border-slate-800'} rounded-xl p-4 cursor-pointer hover:border-blue-500/50 transition-all`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${v.status === 'moving' ? (isSelected ? 'bg-blue-500 text-white' : 'bg-blue-500/10 text-blue-500') : 'bg-slate-800 text-slate-400'}`}>
                        <TruckIcon className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-white leading-none">{v.label || v.registration}</h4>
                        <p className={`text-[10px] ${isSelected ? 'text-blue-400' : 'text-slate-500'} mt-1 uppercase tracking-wider`}>{v.status || 'Desconhecido'}</p>
                      </div>
                    </div>
                    <span className={`w-2 h-2 rounded-full ${new Date(v.last_activity).getTime() > Date.now() - 300000 ? 'bg-green-500' : 'bg-red-500'}`} title={new Date(v.last_activity).toLocaleString()} />
                  </div>

                  <div className="space-y-3 pt-3 border-t border-slate-800/50">
                    <div className="flex items-center gap-2 text-xs">
                      <MapPin className="w-3 h-3 text-slate-500" />
                      <span className="text-slate-400">Próxima:</span>
                      <span className="text-white font-medium truncate">{nextStop}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <Clock className="w-3 h-3 text-slate-500" />
                      <span className="text-slate-400">Última:</span>
                      <span className="text-slate-400 truncate">{lastStop}</span>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <div className="bg-slate-950 rounded-lg p-2">
                      <p className="text-[9px] text-slate-500 uppercase">Velocidade</p>
                      <p className="text-xs font-bold text-white">{Math.round(v.speed)} km/h</p>
                    </div>
                    <div className="bg-slate-950 rounded-lg p-2">
                      <p className="text-[9px] text-slate-500 uppercase">GPS</p>
                      <p className="text-[10px] text-slate-400 truncate">{v.latitude.toFixed(4)}, {v.longitude.toFixed(4)}</p>
                    </div>
                  </div>

                  {isSelected && (
                    <div className="mt-3 flex items-center justify-center gap-1 text-blue-500 text-[10px] font-bold uppercase tracking-tighter">
                      <Activity size={10} className="animate-pulse" />
                      A monitorizar individualmente
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {vehicles.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center py-12 bg-slate-900 border border-slate-800 rounded-2xl text-slate-500">
               <TruckIcon className="w-12 h-12 mb-4 opacity-20" />
               <p>{error ? error : 'Nenhuma viatura Cartrack ativa no momento.'}</p>
            </div>
          )}
          
        </div>
      )}
    </div>
  );
}
