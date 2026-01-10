import { MapPin, RefreshCw, AlertCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import GeofenceMap from './GeofenceMap';
import { CartrackService, type CartrackGeofence } from '../../services/cartrack';
import { useAuth } from '../../contexts/AuthContext';

export default function Geofences() {
    const { userRole } = useAuth();
    console.log('Geofences mounted, userRole:', userRole);
    const [geofences, setGeofences] = useState<CartrackGeofence[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchGeofences = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await CartrackService.getGeofences();
            setGeofences(data);
        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : 'Falha ao carregar geofences da Cartrack. Verifique a consola para mais detalhes.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchGeofences();
    }, []);

    return (
        <div className="p-8 max-w-[1600px] mx-auto space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <MapPin className="w-8 h-8 text-blue-500" />
                        Geofences / Cartrack
                    </h1>
                    <p className="text-slate-400 mt-1">Visualize e gira as suas geofences sincronizadas com a Cartrack.</p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={fetchGeofences}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors border border-slate-700 disabled:opacity-50"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        <span>{loading ? 'Sincronizando...' : 'Sincronizar'}</span>
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
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Map Section */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-2xl p-4">
                        <GeofenceMap geofences={geofences} />
                    </div>
                </div>

                {/* Sidebar / List Section */}
                <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-2xl p-6 h-fit max-h-[600px] overflow-y-auto custom-scrollbar">
                    <h3 className="text-lg font-bold text-white mb-4">Minhas Geofences ({geofences.length})</h3>
                    <div className="space-y-3">
                        {geofences.length === 0 && !loading ? (
                            <div className="text-center py-8 text-slate-500">
                                <MapPin className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                <p>Nenhuma geofence encontrada.</p>
                                <p className="text-xs mt-2">Clique em sincronizar para importar da Cartrack.</p>
                            </div>
                        ) : (
                            geofences.map(geo => (
                                <div key={geo.id} className="p-3 bg-slate-800/50 rounded-xl border border-slate-700/50 hover:border-blue-500/50 transition-colors cursor-pointer group">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <span className="font-bold text-slate-200 group-hover:text-white transition-colors">{geo.name}</span>
                                            <p className="text-xs text-slate-400 mt-1 capitalize">{geo.type.toLowerCase()}</p>
                                        </div>
                                        <span className={`w-2 h-2 rounded-full mt-2`} style={{ backgroundColor: geo.color || 'blue' }}></span>
                                    </div>
                                </div>
                            ))
                        )}

                        {loading && (
                            <div className="text-center text-slate-500 py-4">Carregando...</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
