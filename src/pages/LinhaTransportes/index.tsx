import LinhaAnimada from "../../components/TransportLine/LinhaAnimada";
import { useState, useEffect } from 'react';
import { RefreshCcw, Navigation2, AlertCircle } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import { CartrackService } from '../../services/cartrack';
import type { CartrackVehicle } from '../../services/cartrack';
import MetroLine from '../../components/TransportLine/MetroLine';
import { calculateRouteProgress } from '../../utils/geoUtils';
import type { RouteStop, GeoCoord } from '../../utils/geoUtils';

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
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [stops] = useState<RouteStop[]>(MOCK_ROUTE);

  const fetchVehicles = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await CartrackService.getVehicles();

      console.log("🚗 VEÍCULOS RECEBIDOS:", data);

      if (!data || data.length === 0) {
        setError("⚠️ Nenhum veículo retornado pela API.");
        setVehicles([]);
        return;
      }

      setVehicles(data);

      // Selecionar automaticamente o primeiro
      if (!selectedVehicleId) {
        setSelectedVehicleId(data[0].id);
      }

      setLastUpdate(new Date());

    } catch (err) {
      console.error('🔥 ERRO AO BUSCAR VEÍCULOS:', err);
      setError('Erro ao obter dados da Cartrack.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVehicles();

    const interval = setInterval(fetchVehicles, 30000);
    return () => clearInterval(interval);
  }, []);

  // 🔥 SELEÇÃO CORRIGIDA (POR ID)
  const selectedVehicle = vehicles.find(v => v.id === selectedVehicleId);

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

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5" />
          <p>{error}</p>
          <button
            onClick={fetchVehicles}
            className="ml-auto px-4 py-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-sm"
          >
            Tentar Novamente
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

        {/* SIDEBAR */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <div className="flex justify-between mb-4">
              <h3 className="text-white font-bold">Configuração</h3>
              <button onClick={fetchVehicles}>
                <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <select
              value={selectedVehicleId}
              onChange={(e) => setSelectedVehicleId(e.target.value)}
              className="w-full bg-slate-800 text-white p-2 rounded"
            >
              <option value="">Selecionar...</option>
              {vehicles.map(v => (
                <option key={v.id} value={v.id}>
                  {v.label || v.registration}
                </option>
              ))}
            </select>

            <p className="text-xs text-slate-400 mt-2">
              Última atualização: {lastUpdate.toLocaleTimeString()}
            </p>
          </div>
        </div>

        {/* MAP / LINE */}
        <div className="lg:col-span-3 bg-slate-900 p-6 rounded-2xl">
          {!selectedVehicle ? (
            <p className="text-slate-400">Seleciona uma viatura</p>
          ) : (
            <>
              <MetroLine
                stops={stops}
                currentSegmentIndex={currentSegmentIndex}
                progressInSegment={progressInSegment}
              />

              <div className="text-center mt-6 text-sm text-slate-400">
                Veículo: <b>{selectedVehicle.label}</b> | 
                GPS: {selectedVehicle.latitude?.toFixed(4)}, {selectedVehicle.longitude?.toFixed(4)}
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
