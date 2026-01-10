import { MapPin, RefreshCw, AlertCircle, Car, Layers } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';
import GeofenceMap from './GeofenceMap';
import { CartrackService, type CartrackGeofence, type CartrackVehicle } from '../../services/cartrack';
import { useAuth } from '../../contexts/AuthContext';

export default function Geofences() {
    const { userRole } = useAuth();
    console.log('Geofences mounted, userRole:', userRole);

    const [geofences, setGeofences] = useState<CartrackGeofence[]>([]);
    const [vehicles, setVehicles] = useState<CartrackVehicle[]>([]);

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const refreshInterval = useRef<ReturnType<typeof setInterval> | null>(null);

    const fetchData = async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);

        setError(null);
        try {
            // Fetch both in parallel
            const [geoData, vehiclesData] = await Promise.allSettled([
                CartrackService.getGeofences(),
                CartrackService.getVehicles()
            ]);

            // Handle Geofences
            if (geoData.status === 'fulfilled') {
                setGeofences(geoData.value);
            } else {
                console.error('Geofences error:', geoData.reason);
                // Don't block UI if only one fails, but maybe show warning?
                // For now, only hard fail if both fail or let vehicles show even if geofences fail
            }

            // Handle Vehicles
            if (vehiclesData.status === 'fulfilled') {
                setVehicles(vehiclesData.value);
            } else {
                console.error('Vehicles error:', vehiclesData.reason);
            }

            if (geoData.status === 'rejected' && vehiclesData.status === 'rejected') {
                throw new Error('Falha ao conectar à Cartrack (Geofences e Viaturas). Verifique a ligação ou credenciais.');
            }

        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : 'Falha desconhecida ao comunicar com a Cartrack.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchData();

        // Auto-refresh vehicles every 30 seconds
        refreshInterval.current = setInterval(() => {
            // We can optimize this to only fetch vehicles if needed, but fetching all ensures sync
            fetchData(true);
        }, 30000);

        return () => {
            if (refreshInterval.current) clearInterval(refreshInterval.current);
        };
    }, []);

    // Manual refresh handler
    const handleRefresh = () => {
        if (refreshInterval.current) clearInterval(refreshInterval.current);
        fetchData(true);
        // Restart interval
        refreshInterval.current = setInterval(() => fetchData(true), 30000);
    };

    return (
        <div className="p-8 max-w-[1600px] mx-auto space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <MapPin className="w-8 h-8 text-blue-500" />
                        Frota em Tempo Real
                    </h1>
                    <p className="text-slate-400 mt-1">Monitorização de viaturas e geofences via Cartrack.</p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 px-3 py-1 bg-slate-800/50 rounded-lg border border-slate-700/50 text-xs text-slate-400">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                        Atualização automática (30s)
                    </div>
                    <button
                        onClick={handleRefresh}
                        disabled={loading || refreshing}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors shadow-lg shadow-blue-900/20 disabled:opacity-50"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading || refreshing ? 'animate-spin' : ''}`} />
                        <span>{loading || refreshing ? 'A atualizar...' : 'Atualizar Agora'}</span>
                    </button>
                </div>
            </div>

            {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-500">
                    <AlertCircle className="w-5 h-5" />
                    <p>{error}</p>
                </div>
            )}

            {/* Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Map Section - Wider now */}
                <div className="lg:col-span-3 space-y-4">
                    <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-2xl p-4">
                        <GeofenceMap geofences={geofences} vehicles={vehicles} />
                    </div>

                    {/* Compact Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
                            <div className="text-slate-400 text-xs uppercase font-bold">Total Viaturas</div>
                            <div className="text-2xl font-bold text-white mt-1">{vehicles.length}</div>
                        </div>
                        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
                            <div className="text-slate-400 text-xs uppercase font-bold">Em Movimento</div>
                            <div className="text-2xl font-bold text-green-500 mt-1">
                                {vehicles.filter(v => v.status === 'moving').length}
                            </div>
                        </div>
                        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
                            <div className="text-slate-400 text-xs uppercase font-bold">Geofences</div>
                            <div className="text-2xl font-bold text-blue-500 mt-1">{geofences.length}</div>
                        </div>
                    </div>
                </div>

                {/* Sidebar / List Section */}
                <div className="lg:col-span-1 space-y-6">
                    {/* Vehicles List */}
                    <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-2xl p-6 h-[400px] overflow-y-auto custom-scrollbar">
                        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <Car className="w-5 h-5 text-blue-400" />
                            Viaturas
                        </h3>
                        <div className="space-y-3">
                            {vehicles.map(vehicle => (
                                <div key={vehicle.id} className="p-3 bg-slate-800/50 rounded-xl border border-slate-700/50 hover:border-blue-500/50 transition-colors cursor-pointer group">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <span className="font-bold text-slate-200 group-hover:text-white transition-colors">{vehicle.registration}</span>
                                            <p className="text-xs text-slate-400 mt-1">{vehicle.name}</p>
                                        </div>
                                        <div className={`flex flex-col items-end`}>
                                            <span className={`w-2 h-2 rounded-full ${vehicle.status === 'moving' ? 'bg-green-500' : 'bg-slate-500'}`}></span>
                                            <span className="text-[10px] text-slate-500 mt-1">{vehicle.speed} km/h</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {vehicles.length === 0 && !loading && <p className="text-slate-500 text-center py-4">Sem viaturas.</p>}
                        </div>
                    </div>

                    {/* Geofences List */}
                    <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-2xl p-6 h-[300px] overflow-y-auto custom-scrollbar">
                        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <Layers className="w-5 h-5 text-purple-400" />
                            Geofences
                        </h3>
                        <div className="space-y-3">
                            {geofences.map(geo => (
                                <div key={geo.id} className="p-3 bg-slate-800/50 rounded-xl border border-slate-700/50 hover:border-purple-500/50 transition-colors cursor-pointer">
                                    <div className="flex justify-between items-center">
                                        <span className="font-medium text-slate-300 text-sm truncate">{geo.name}</span>
                                        <span className={`w-2 h-2 rounded-full`} style={{ backgroundColor: geo.color || 'blue' }}></span>
                                    </div>
                                </div>
                            ))}
                            {geofences.length === 0 && !loading && <p className="text-slate-500 text-center py-4">Sem geofences.</p>}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
