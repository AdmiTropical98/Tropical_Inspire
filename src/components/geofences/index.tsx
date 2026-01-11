import { MapPin, RefreshCw, AlertCircle, Car, Layers, History, Clock, ArrowRight, Search } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';
import GeofenceMap from './GeofenceMap';
import { useWorkshop } from '../../contexts/WorkshopContext';
import { CartrackService } from '../../services/cartrack';

export default function Geofences() {
    const { geofenceVisits, refreshData, motoristas } = useWorkshop();

    const [geofences, setGeofences] = useState<any[]>([]);
    const [vehicles, setVehicles] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<'map' | 'history'>('map');

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const refreshInterval = useRef<ReturnType<typeof setInterval> | null>(null);

    const fetchData = async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);

        setError(null);
        const normalizePlate = (p: string) => p?.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() || '';
        try {
            // Fetch both in parallel
            const [geoData, vehiclesData] = await Promise.allSettled([
                CartrackService.getGeofences(),
                CartrackService.getVehicles()
            ]);

            // Handle Geofences
            if (geoData.status === 'fulfilled') {
                setGeofences(geoData.value);
            }

            // Handle Vehicles
            if (vehiclesData.status === 'fulfilled') {
                const cDrivers = (await CartrackService.getDrivers()) || [];
                const rawVehicles = vehiclesData.value;
                const enriched = rawVehicles.map((v: any) => {
                    // 1. Fallback to cDrivers list if name missing in status
                    let resolvedName = v.driverName;
                    const isPlateName = !resolvedName || normalizePlate(resolvedName) === normalizePlate(v.registration);

                    if (isPlateName && (v.driverId || v.tagId)) {
                        const cd = cDrivers.find(d =>
                            (v.driverId && String(d.id) === String(v.driverId)) ||
                            (v.tagId && d.tagId === v.tagId)
                        );
                        if (cd) {
                            console.log(`Geofences: Found driver match for ${v.registration}: ${cd.fullName}`);
                            resolvedName = cd.fullName;
                        }
                    }

                    // 2. Try to find matching motorista from context (enriched in refreshData)
                    const localM = motoristas.find(m =>
                        (m.cartrackId && String(m.cartrackId) === String(v.driverId)) ||
                        (m.cartrackKey && v.tagId && m.cartrackKey === v.tagId) ||
                        (m.currentVehicle && normalizePlate(m.currentVehicle) === normalizePlate(v.registration))
                    );

                    let displayName = 'Sem Motorista';
                    if (localM) {
                        displayName = localM.nome;
                    } else if (!isPlateName && resolvedName) {
                        displayName = resolvedName;
                    } else if (v.tagId) {
                        displayName = `Tag: ${v.tagId}`;
                    }

                    if (v.registration.includes('ZZ')) {
                        console.log('Geofences Debug ZZ:', { reg: v.registration, driverId: v.driverId, tagId: v.tagId, resolvedName, displayName });
                    }

                    return {
                        ...v,
                        driverName: displayName
                    };
                });
                setVehicles(enriched);
            }

            if (geoData.status === 'rejected' && vehiclesData.status === 'rejected') {
                throw new Error('Falha ao conectar à Cartrack. Verifique a ligação.');
            }

        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : 'Falha ao comunicar com a Cartrack.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchData();
        // Auto-refresh vehicles every 30 seconds
        refreshInterval.current = setInterval(() => fetchData(true), 30000);
        return () => {
            if (refreshInterval.current) clearInterval(refreshInterval.current);
        };
    }, []);

    const handleRefresh = async () => {
        setRefreshing(true);
        await Promise.all([fetchData(true), refreshData()]);
        setRefreshing(false);
    };

    const filteredVisits = geofenceVisits.filter(visit =>
        visit.registration.toLowerCase().includes(searchTerm.toLowerCase()) ||
        visit.geofenceName.toLowerCase().includes(searchTerm.toLowerCase())
    );

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
                    <div className="flex bg-slate-800/50 p-1 rounded-xl border border-slate-700/50 mr-2">
                        <button
                            onClick={() => setActiveTab('map')}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'map' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                        >
                            <Layers className="w-4 h-4" />
                            Mapa
                        </button>
                        <button
                            onClick={() => setActiveTab('history')}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'history' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                        >
                            <History className="w-4 h-4" />
                            Histórico
                        </button>
                    </div>

                    <button
                        onClick={handleRefresh}
                        disabled={loading || refreshing}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors border border-slate-700 disabled:opacity-50"
                    >
                        <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                        <span>{refreshing ? 'A atualizar...' : 'Atualizar'}</span>
                    </button>
                </div>
            </div>

            {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-500">
                    <AlertCircle className="w-5 h-5" />
                    <p>{error}</p>
                </div>
            )}

            {/* Content Display */}
            {activeTab === 'map' ? (
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 h-full">
                    {/* Sidebar / List Section */}
                    <div className="xl:col-span-3 space-y-6 flex flex-col">
                        {/* Compact Stats */}
                        <div className="grid grid-cols-1 gap-4">
                            <div className="bg-slate-900/40 backdrop-blur-md p-5 rounded-2xl border border-slate-800/50 shadow-xl group hover:border-blue-500/30 transition-all">
                                <div className="flex justify-between items-center">
                                    <div className="text-slate-400 text-[10px] uppercase font-black tracking-[0.2em]">Frota Total</div>
                                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                                        <Car className="w-4 h-4 text-blue-500" />
                                    </div>
                                </div>
                                <div className="text-3xl font-black text-white mt-2 font-mono">{vehicles.length}</div>
                            </div>

                            <div className="bg-slate-900/40 backdrop-blur-md p-5 rounded-2xl border border-slate-800/50 shadow-xl group hover:border-green-500/30 transition-all">
                                <div className="flex justify-between items-center">
                                    <div className="text-slate-400 text-[10px] uppercase font-black tracking-[0.2em]">Em Movimento</div>
                                    <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                                        <RefreshCw className="w-4 h-4 text-green-500 animate-spin-slow" />
                                    </div>
                                </div>
                                <div className="text-3xl font-black text-green-500 mt-2 font-mono">
                                    {vehicles.filter(v => v.status === 'moving').length}
                                </div>
                            </div>
                        </div>

                        {/* Vehicles List */}
                        <div className="bg-slate-950/50 backdrop-blur-md border border-slate-800/50 rounded-3xl p-6 flex-1 h-[600px] overflow-hidden flex flex-col shadow-2xl">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-lg font-black text-white flex items-center gap-2">
                                    <Layers className="w-5 h-5 text-blue-500" />
                                    Estado da Frota
                                </h3>
                                <span className="text-[10px] font-bold bg-slate-800 text-slate-400 px-2 py-1 rounded">LIVE</span>
                            </div>

                            <div className="space-y-3 overflow-y-auto pr-2 custom-scrollbar flex-1">
                                {vehicles.sort((a, b) => a.registration.localeCompare(b.registration)).map(vehicle => (
                                    <div key={vehicle.id} className="p-4 bg-slate-900/80 rounded-2xl border border-slate-800/50 hover:border-blue-500/50 hover:bg-slate-800/80 transition-all cursor-pointer group relative overflow-hidden">
                                        {vehicle.status === 'moving' && (
                                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-green-500/50 shadow-[0_0_10px_rgba(34,197,94,0.3)]"></div>
                                        )}
                                        <div className="flex justify-between items-start">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono font-black text-xl text-white tracking-tighter">{vehicle.registration}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <div className={`w-1.5 h-1.5 rounded-full ${vehicle.status === 'moving' ? 'bg-green-500' : vehicle.status === 'idle' ? 'bg-orange-500' : 'bg-slate-600'}`}></div>
                                                    <p className="text-[11px] text-slate-400 font-bold uppercase truncate max-w-[140px]">{vehicle.driverName || 'Sem Motorista'}</p>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end gap-1">
                                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${vehicle.status === 'moving' ? 'bg-green-500/10 text-green-500' :
                                                    vehicle.status === 'idle' ? 'bg-orange-500/10 text-orange-500' :
                                                        'bg-slate-800 text-slate-500'
                                                    }`}>
                                                    {vehicle.status === 'moving' ? 'RUN' : vehicle.status === 'idle' ? 'IDLE' : 'STOP'}
                                                </span>
                                                <span className="text-xs font-black text-blue-400/80 font-mono tracking-tighter">{Math.round(vehicle.speed)} KM/H</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Map Section */}
                    <div className="xl:col-span-9 flex flex-col gap-6">
                        <div className="bg-slate-950/20 backdrop-blur-sm border border-slate-800/50 rounded-3xl p-1.5 shadow-2xl relative overflow-hidden group">
                            <div className="absolute top-4 right-4 z-10 flex gap-2">
                                <div className="px-3 py-1.5 bg-slate-950/80 backdrop-blur-md rounded-xl border border-slate-700/50 text-[10px] font-black text-white flex items-center gap-2 shadow-2xl">
                                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                                    REAL-TIME OVERVIEW
                                </div>
                            </div>
                            <GeofenceMap geofences={geofences} vehicles={vehicles} />
                        </div>

                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                            <div className="bg-slate-900/40 backdrop-blur-md p-6 rounded-3xl border border-slate-800/50">
                                <div className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Geofences Ativas</div>
                                <div className="text-3xl font-black text-purple-500 mt-2 font-mono">{geofences.length}</div>
                            </div>
                            <div className="bg-slate-900/40 backdrop-blur-md p-6 rounded-3xl border border-slate-800/50">
                                <div className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Tempo de Uptime</div>
                                <div className="text-3xl font-black text-white mt-2 font-mono">99.8%</div>
                            </div>
                            <div className="bg-slate-900/40 backdrop-blur-md p-6 rounded-3xl border border-slate-800/50">
                                <div className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Sinal de Rede</div>
                                <div className="text-3xl font-black text-blue-500 mt-2 font-mono">EXCELLENT</div>
                            </div>
                            <div className="bg-slate-900/40 backdrop-blur-md p-6 rounded-3xl border border-slate-800/50">
                                <div className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Última Escala</div>
                                <div className="text-3xl font-black text-white mt-2 font-mono">--</div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-3xl p-6">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                            <div>
                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                    <History className="w-6 h-6 text-blue-500" />
                                    Histórico de Passagens (Últimas 24h)
                                </h3>
                                <p className="text-slate-400 text-sm mt-1">Registos de entrada e saída em áreas monitorizadas.</p>
                            </div>
                            <div className="relative w-full md:w-80">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input
                                    type="text"
                                    placeholder="Procurar matrícula ou local..."
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-slate-800">
                                        <th className="px-4 py-4 text-slate-500 font-bold text-xs uppercase tracking-wider">Viatura</th>
                                        <th className="px-4 py-4 text-slate-500 font-bold text-xs uppercase tracking-wider">Local (Geofence)</th>
                                        <th className="px-4 py-4 text-slate-500 font-bold text-xs uppercase tracking-wider">Entrada</th>
                                        <th className="px-4 py-4 text-slate-500 font-bold text-xs uppercase tracking-wider">Saída</th>
                                        <th className="px-4 py-4 text-slate-500 font-bold text-xs uppercase tracking-wider">Duração</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/50">
                                    {filteredVisits.map(visit => (
                                        <tr key={visit.id} className="hover:bg-slate-800/30 transition-colors">
                                            <td className="px-4 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500 shrink-0">
                                                        <Car className="w-4 h-4" />
                                                    </div>
                                                    <span className="font-bold text-slate-200 uppercase">{visit.registration}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 uppercase">
                                                <div className="flex items-center gap-2 text-slate-300">
                                                    <MapPin className="w-3.5 h-3.5 text-slate-500" />
                                                    <span className="font-medium">{visit.geofenceName}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4">
                                                <div className="flex items-center gap-2 text-emerald-400 font-mono text-sm">
                                                    <Clock className="w-3.5 h-3.5" />
                                                    {visit.enterTimestamp.split(' ')[1]}
                                                    <span className="text-[10px] text-slate-500 ml-1">{visit.enterTimestamp.split(' ')[0]}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4">
                                                {visit.exitTimestamp ? (
                                                    <div className="flex items-center gap-2 text-slate-400 font-mono text-sm">
                                                        <ArrowRight className="w-3.5 h-3.5" />
                                                        {visit.exitTimestamp.split(' ')[1]}
                                                        <span className="text-[10px] text-slate-600 ml-1">{visit.exitTimestamp.split(' ')[0]}</span>
                                                    </div>
                                                ) : (
                                                    <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 text-[10px] font-bold rounded-md border border-blue-500/20">NO LOCAL</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-4">
                                                <span className="text-slate-400 text-sm font-medium">
                                                    {visit.durationSeconds ? `${Math.floor(visit.durationSeconds / 60)} min` : '--'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredVisits.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="px-4 py-12 text-center text-slate-500">
                                                Nenhum registo de passagem encontrado nas últimas 24h.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
