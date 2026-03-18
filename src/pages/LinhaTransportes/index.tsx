import { useState, useEffect, useMemo } from 'react';
import { RefreshCcw, Navigation2, AlertCircle, Clock, MapPin, Truck as TruckIcon, Activity } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import { CartrackService } from '../../services/cartrack';
import type { CartrackVehicle } from '../../services/cartrack';
import MetroLine from '../../components/TransportLine/MetroLine';
import type { VehicleMarker } from '../../components/TransportLine/MetroLine';
import { calculateRouteProgress } from '../../utils/geoUtils';
import type { RouteStop } from '../../utils/geoUtils';

// MOCK ROUTE
const MOCK_ROUTE: RouteStop[] = [
  { id: '1', name: 'Aeroporto Faro', coord: { lat: 37.0182, lng: -7.9696 } },
  { id: '2', name: 'Hotel Vilamoura', coord: { lat: 37.0784, lng: -8.1147 } },
  { id: '3', name: 'Albufeira Centro', coord: { lat: 37.0891, lng: -8.2503 } },
  { id: '4', name: 'Portimão Arena', coord: { lat: 37.1420, lng: -8.5376 } },
  { id: '5', name: 'Lagos Marina', coord: { lat: 37.1089, lng: -8.6757 } }
];

export default function LinhaTransportes() {
  const [vehicles, setVehicles] = useState<CartrackVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  
  // Stops for the route
  const [stops] = useState<RouteStop[]>(MOCK_ROUTE);

  const fetchVehicles = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await CartrackService.getVehicles();
      
      // Filter out vehicles that don't have GPS data or are not relevant if needed
      const activeVehicles = (data || []).filter(v => v.latitude && v.longitude);
      setVehicles(activeVehicles);
      setLastUpdate(new Date());
    } catch (err) {
      console.error('Error fetching Cartrack vehicles in Component:', err);
      setError('Aviso: Falha ao obter dados reais Cartrack.');
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
    return vehicles.map(v => {
      const progress = calculateRouteProgress({ lat: v.latitude, lng: v.longitude }, stops);
      return {
        id: v.id,
        label: v.registration || v.label,
        currentSegmentIndex: progress.currentSegmentIndex,
        progressInSegment: progress.progressInSegment,
        status: v.status
      } as VehicleMarker;
    });
  }, [vehicles, stops]);

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
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 overflow-hidden">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Activity className="w-5 h-5 text-blue-500" />
                <h3 className="text-lg font-bold text-white">Monitorização em Tempo Real</h3>
              </div>
              <div className="flex items-center gap-4">
                <p className="text-xs text-slate-500 flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${loading ? 'bg-blue-500 animate-pulse' : 'bg-green-500'}`} />
                  Última att: {lastUpdate.toLocaleTimeString()}
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

          {/* Vehicles Status Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {vehicles.map((v) => {
              const progress = calculateRouteProgress({ lat: v.latitude, lng: v.longitude }, stops);
              const nextStop = stops[progress.currentSegmentIndex + 1]?.name || 'Destino Final';
              const lastStop = stops[progress.currentSegmentIndex]?.name || 'Origem';
              
              return (
                <div key={v.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${v.status === 'moving' ? 'bg-blue-500/10 text-blue-500' : 'bg-slate-800 text-slate-400'}`}>
                        <TruckIcon className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-white leading-none">{v.label || v.registration}</h4>
                        <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider">{v.status || 'Desconhecido'}</p>
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
                </div>
              );
            })}
          </div>

          {vehicles.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center py-12 bg-slate-900 border border-slate-800 rounded-2xl text-slate-500">
               <TruckIcon className="w-12 h-12 mb-4 opacity-20" />
               <p>Nenhuma viatura Cartrack ativa no momento.</p>
            </div>
          )}
          
        </div>
      )}
    </div>
  );
}
