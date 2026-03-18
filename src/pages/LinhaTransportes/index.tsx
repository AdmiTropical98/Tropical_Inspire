import { useState, useEffect } from 'react';
import { RefreshCcw, Navigation2, AlertCircle } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import { CartrackService } from '../../services/cartrack';
import type { CartrackVehicle } from '../../services/cartrack';
import MetroLine from '../../components/TransportLine/MetroLine';
import { calculateRouteProgress } from '../../utils/geoUtils';
import type { RouteStop, GeoCoord } from '../../utils/geoUtils';

// Temporary mock route for demonstration until a route builder is implemented
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
  
  // Selected vehicle to track on the line
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  
  // Default to our hardcoded route for now
  const [stops] = useState<RouteStop[]>(MOCK_ROUTE);

  const fetchVehicles = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await CartrackService.getVehicles();
      setVehicles(data || []);
      
      // Auto-select first vehicle if none selected
      if (!selectedVehicleId && data && data.length > 0) {
        setSelectedVehicleId(data[0].registration || data[0].label);
      }
      
      setLastUpdate(new Date());
    } catch (err) {
      console.error('Error fetching Cartrack vehicles in Component:', err);
      // We don't necessarily set error blocking state if we have fallback data
      setError('Aviso: Falha ao obter dados reais Cartrack, a usar dados locais.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVehicles();
    
    // Polling interval (e.g., every 30 seconds)
    const interval = setInterval(() => {
      fetchVehicles();
    }, 30000);

    return () => clearInterval(interval);
  }, []); // Run on mount

  // Find the currently tracked vehicle's position
  const selectedVehicle = vehicles.find(v => (v.registration || v.label) === selectedVehicleId);
  
  let currentSegmentIndex = 0;
  let progressInSegment = 0;
  let currentPos: GeoCoord | null = null;
  
  if (selectedVehicle && selectedVehicle.latitude && selectedVehicle.longitude) {
    currentPos = { 
      lat: selectedVehicle.latitude, 
      lng: selectedVehicle.longitude 
    };
    
    const progress = calculateRouteProgress(currentPos, stops);
    currentSegmentIndex = progress.currentSegmentIndex;
    progressInSegment = progress.progressInSegment;
  }

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
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* Controls Sidebar */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-white">Configuração</h3>
                <button 
                  onClick={fetchVehicles}
                  disabled={loading}
                  className={`p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors ${loading ? 'animate-pulse' : ''}`}
                  title="Atualizar agora"
                >
                  <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">
                    Viatura a Monitorizar
                  </label>
                  <select
                    value={selectedVehicleId}
                    onChange={(e) => setSelectedVehicleId(e.target.value)}
                    className="w-full bg-slate-800 border-slate-700 text-white rounded-xl focus:ring-blue-500"
                  >
                    <option value="">Selecione uma viatura...</option>
                    {vehicles.map(v => {
                      const id = v.registration || v.label;
                      return (
                        <option key={id} value={id}>
                          {v.label || v.registration}
                        </option>
                      );
                    })}
                  </select>
                </div>
                
                <div className="pt-4 border-t border-slate-800">
                  <p className="text-xs text-slate-500 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    Última att: {lastUpdate.toLocaleTimeString()}
                  </p>
                </div>
              </div>
            </div>
            
            {/* Info Card - Current Status */}
            {selectedVehicle && currentPos && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                 <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Estado Atual</h3>
                 
                 <div className="space-y-3 relative before:absolute before:inset-y-0 before:left-2 before:w-0.5 before:bg-slate-800">
                    <div className="relative pl-6">
                      <div className="absolute left-[3px] top-1.5 w-2 h-2 rounded-full bg-blue-500 ring-4 ring-slate-900" />
                      <p className="text-xs text-slate-500">Próxima Paragem</p>
                      <p className="text-lg font-medium text-white">
                        {stops[currentSegmentIndex + 1]?.name || 'Destino Fina'}
                      </p>
                    </div>
                    
                    <div className="relative pl-6">
                      <div className="absolute left-[3px] top-1.5 w-2 h-2 rounded-full bg-slate-700 ring-4 ring-slate-900" />
                      <p className="text-xs text-slate-500">Última Paragem</p>
                      <p className="text-sm text-slate-300">
                        {stops[currentSegmentIndex]?.name || 'Origem'}
                      </p>
                    </div>
                 </div>
              </div>
            )}
          </div>

          {/* Visualization Area */}
          <div className="lg:col-span-3">
             <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 h-full flex flex-col">
               <h3 className="text-lg font-bold text-white mb-6">Visualização da Rota</h3>
               
               {!selectedVehicleId ? (
                  <div className="flex-1 flex items-center justify-center text-slate-500">
                    Selecione uma viatura para começar.
                  </div>
               ) : (
                 <div className="flex-1 flex flex-col justify-center">
                    <MetroLine 
                      stops={stops}
                      currentSegmentIndex={currentSegmentIndex}
                      progressInSegment={progressInSegment}
                    />
                    
                    {selectedVehicle && (
                      <div className="mt-8 text-center text-sm text-slate-400">
                        Veículo: <strong className="text-white">{selectedVehicle.label || selectedVehicle.registration}</strong> | 
                        Posição Bússola/GPS: <span className="text-slate-300">{selectedVehicle.latitude?.toFixed(4)}, {selectedVehicle.longitude?.toFixed(4)}</span>
                      </div>
                    )}
                 </div>
               )}
             </div>
          </div>
          
        </div>
      )}
    </div>
  );
}
