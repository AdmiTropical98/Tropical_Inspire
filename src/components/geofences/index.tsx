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
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 h-full bg-slate-950/20 p-2 rounded-[40px]">
                    {/* Sidebar / List Section */}
                    <div className="xl:col-span-3 space-y-6 flex flex-col">
                        {/* Compact Stats Grid */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-gradient-to-br from-slate-900 to-slate-950 p-5 rounded-3xl border border-white/5 shadow-2xl relative overflow-hidden group hover:border-blue-500/30 transition-all duration-500">
                                <div className="absolute -right-2 -top-2 w-16 h-16 bg-blue-500/10 blur-2xl rounded-full group-hover:bg-blue-500/20 transition-all"></div>
                                <div className="flex justify-between items-center relative z-10">
                                    <div className="text-slate-500 text-[9px] uppercase font-black tracking-[0.2em]">Frota</div>
                                    <Car className="w-3.5 h-3.5 text-blue-500" />
                                </div>
                                <div className="text-3xl font-black text-white mt-1 font-mono tracking-tighter">{vehicles.length}</div>
                            </div>

                            <div className="bg-gradient-to-br from-slate-900 to-slate-950 p-5 rounded-3xl border border-white/5 shadow-2xl relative overflow-hidden group hover:border-green-500/30 transition-all duration-500">
                                <div className="absolute -right-2 -top-2 w-16 h-16 bg-green-500/10 blur-2xl rounded-full group-hover:bg-green-500/20 transition-all"></div>
                                <div className="flex justify-between items-center relative z-10">
                                    <div className="text-slate-500 text-[9px] uppercase font-black tracking-[0.2em]">Online</div>
                                    <RefreshCw className="w-3.5 h-3.5 text-green-500 animate-spin-slow" />
                                </div>
                                <div className="text-3xl font-black text-green-500 mt-1 font-mono tracking-tighter">
                                    {vehicles.filter(v => v.status === 'moving').length}
                                </div>
                            </div>
                        </div>

                        {/* Vehicles List */}
                        <div className="bg-slate-900/40 backdrop-blur-xl border border-white/5 rounded-[32px] p-6 flex-1 h-[600px] overflow-hidden flex flex-col shadow-2xl">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-sm font-black text-white/90 flex items-center gap-2 uppercase tracking-widest">
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
                                    Transmissão Live
                                </h3>
                                <div className="flex items-center gap-1.5 bg-slate-950/50 px-2 py-0.5 rounded-full border border-white/5">
                                    <div className="w-1 h-1 rounded-full bg-green-500 animate-pulse"></div>
                                    <span className="text-[9px] font-black text-slate-400">ACTIVE</span>
                                </div>
                            </div>

                            <div className="space-y-2.5 overflow-y-auto pr-2 custom-scrollbar flex-1">
                                {vehicles.sort((a, b) => a.registration.localeCompare(b.registration)).map(vehicle => (
                                    <div key={vehicle.id} className="p-4 bg-slate-950/40 rounded-2xl border border-white/5 hover:border-blue-500/30 hover:bg-slate-900/60 transition-all duration-300 cursor-pointer group relative overflow-hidden">
                                        <div className="flex justify-between items-center">
                                            <div className="space-y-0.5">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono font-black text-lg text-white tracking-tighter group-hover:text-blue-400 transition-colors uppercase">{vehicle.registration}</span>
                                                </div>
                                                <p className="text-[10px] text-slate-500 font-bold uppercase truncate max-w-[140px] tracking-tight">{vehicle.driverName || 'Sem Motorista'}</p>
                                            </div>
                                            <div className="flex flex-col items-end gap-1.5">
                                                <div className={`text-[8px] font-black px-2 py-0.5 rounded-md ${vehicle.status === 'moving' ? 'bg-green-500/10 text-green-500' :
                                                        vehicle.status === 'idle' ? 'bg-orange-500/10 text-orange-500' :
                                                            'bg-slate-800 text-slate-500'
                                                    }`}>
                                                    {vehicle.status === 'moving' ? 'MOVING' : vehicle.status === 'idle' ? 'IDLE' : 'STOPPED'}
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <span className="text-xs font-black text-white font-mono">{Math.round(vehicle.speed)}</span>
                                                    <span className="text-[8px] font-bold text-slate-600">KM/H</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Map Section */}
                    <div className="xl:col-span-9 flex flex-col gap-6">
                        <div className="bg-slate-900 border border-white/10 rounded-[40px] p-2 shadow-2xl relative overflow-hidden group">
                            <div className="absolute bottom-6 left-6 z-10">
                                <div className="px-4 py-2 bg-slate-950/90 backdrop-blur-xl rounded-2xl border border-white/10 text-[10px] font-black text-white flex items-center gap-3 shadow-2xl">
                                    <div className="flex gap-1">
                                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                                        <div className="w-1.5 h-1.5 rounded-full bg-green-500/50 animate-pulse delay-75"></div>
                                    </div>
                                    TRACKING SIGNAL OPTIMIZED
                                </div>
                            </div>
                            <GeofenceMap geofences={geofences} vehicles={vehicles} />
                        </div>

                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                            {[
                                { label: 'Geofences', value: geofences.length, color: 'text-purple-400' },
                                { label: 'Uptime', value: '99.9%', color: 'text-emerald-400' },
                                { label: 'Latency', value: '14ms', color: 'text-blue-400' },
                                { label: 'Satellites', value: 'Active', color: 'text-amber-400' }
                            ].map((stat, i) => (
                                <div key={i} className="bg-slate-900/40 backdrop-blur-md p-6 rounded-3xl border border-white/5 hover:border-white/10 transition-all">
                                    <div className="text-slate-500 text-[9px] font-black uppercase tracking-[.25em]">{stat.label}</div>
                                    <div className={`text-2xl font-black mt-2 font-mono tracking-tighter ${stat.color}`}>{stat.value}</div>
                                </div>
                            ))}
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
