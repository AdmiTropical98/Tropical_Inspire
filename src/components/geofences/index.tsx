import { MapPin, RefreshCw, AlertCircle, Car, Layers, History, Search } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';
import GeofenceMap from './GeofenceMap';
import { useWorkshop } from '../../contexts/WorkshopContext';
import { CartrackService } from '../../services/cartrack';

export default function Geofences() {
    const { geofenceVisits, refreshData, motoristas } = useWorkshop();

    const [geofences, setGeofences] = useState<any[]>([]);
    const [vehicles, setVehicles] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<'map' | 'history'>('map');
    const [selectedVehicle, setSelectedVehicle] = useState<any>(null);

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const refreshInterval = useRef<ReturnType<typeof setInterval> | null>(null);

    const fetchData = async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);

        setError(null);
        const normalizePlate = (p?: string | null) => p?.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() || '';
        try {
            const [geoData, vehiclesData] = await Promise.allSettled([
                CartrackService.getGeofences(),
                CartrackService.getVehicles()
            ]);

            if (geoData.status === 'fulfilled') {
                setGeofences(geoData.value);
            }

            if (vehiclesData.status === 'fulfilled') {
                const cDrivers = (await CartrackService.getDrivers()) || [];
                const rawVehicles = vehiclesData.value;
                const enriched = rawVehicles.map((v: any) => {
                    let resolvedName = v.driverName;

                    const isProperName = (name?: string | null) => {
                        if (!name || name === 'N/A' || name === 'Sem Motorista') return false;
                        return normalizePlate(name) !== normalizePlate(v.registration);
                    };

                    if (!isProperName(resolvedName) && (v.driverId || v.tagId)) {
                        const cd = cDrivers.find(d =>
                            (v.driverId && String(d.id) === String(v.driverId)) ||
                            (v.tagId && d.tagId === v.tagId)
                        );
                        if (cd) {
                            resolvedName = cd.fullName;
                        }
                    }

                    const localM = motoristas.find(m =>
                        (m.cartrackId && String(m.cartrackId) === String(v.driverId)) ||
                        (m.cartrackKey && v.tagId && m.cartrackKey === v.tagId) ||
                        (m.currentVehicle && normalizePlate(m.currentVehicle) === normalizePlate(v.registration))
                    );

                    let displayName = 'Sem Motorista';
                    if (localM) {
                        displayName = localM.nome;
                    } else if (isProperName(resolvedName)) {
                        displayName = resolvedName!;
                    } else if (v.tagId) {
                        displayName = `Tag: ${v.tagId}`;
                    } else if (v.driverId && String(v.driverId).length > 5) {
                        displayName = `ID: ${v.driverId}`;
                    }

                    return { ...v, driverName: displayName };
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
        refreshInterval.current = setInterval(() => fetchData(true), 30000);
        return () => {
            if (refreshInterval.current) clearInterval(refreshInterval.current);
        };
    }, []);

    const handleRefresh = async () => {
        setRefreshing(true);
        setSelectedVehicle(null);
        await Promise.all([fetchData(true), refreshData()]);
        setRefreshing(false);
    };

    const filteredVisits = geofenceVisits.filter(visit =>
        visit.registration.toLowerCase().includes(searchTerm.toLowerCase()) ||
        visit.geofenceName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const enrichedVisits = filteredVisits.map(visit => {
        const matchingVehicle = vehicles.find(v => v.registration === visit.registration);
        return {
            ...visit,
            driverName: matchingVehicle?.driverName || 'N/A'
        };
    });

    return (
        <div className="p-4 md:p-8 w-full mx-auto space-y-6 min-h-screen bg-[#0a0a0f]">
            {/* Header - Stretches with screen */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 px-4">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-600 rounded-2xl shadow-[0_0_30px_rgba(37,99,235,0.4)]">
                        <MapPin className="w-8 h-8 text-white" />
                    </div>
                    <div>
                        <h1 className="text-4xl font-black text-white tracking-tighter leading-none">
                            FROTA LIVE
                        </h1>
                        <p className="text-blue-500/60 font-black mt-2 text-[10px] uppercase tracking-[0.3em] font-mono">Control System v4.0</p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex bg-[#161625] p-1.5 rounded-2xl border border-white/5 shadow-2xl">
                        <button
                            onClick={() => setActiveTab('map')}
                            className={`px-8 py-3 rounded-xl text-xs font-black transition-all flex items-center gap-2 uppercase tracking-widest ${activeTab === 'map' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
                        >
                            <Layers className="w-4 h-4" />
                            Mapa Principal
                        </button>
                        <button
                            onClick={() => setActiveTab('history')}
                            className={`px-8 py-3 rounded-xl text-xs font-black transition-all flex items-center gap-2 uppercase tracking-widest ${activeTab === 'history' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
                        >
                            <History className="w-4 h-4" />
                            Histórico
                        </button>
                    </div>

                    <button
                        onClick={handleRefresh}
                        disabled={loading || refreshing}
                        className="flex items-center gap-3 px-8 py-4 bg-white text-black rounded-2xl hover:bg-white/90 transition-all disabled:opacity-50 font-black text-xs uppercase tracking-widest shadow-2xl"
                    >
                        <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                        <span>{refreshing ? '...' : 'Sincronizar'}</span>
                    </button>
                </div>
            </div>

            {error && (
                <div className="mx-4 p-5 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-4 text-red-500">
                    <AlertCircle className="w-6 h-6" />
                    <p className="font-black text-xs uppercase tracking-widest">{error}</p>
                </div>
            )}

            {activeTab === 'map' ? (
                <div className="flex flex-col xl:flex-row gap-6 px-4 h-[calc(100vh-220px)] min-h-[750px] w-full items-stretch">
                    {/* SIDEBAR - DEFINITIVE WIDTH & SCROLL */}
                    <div className="w-full xl:w-[320px] bg-[#161625] rounded-[32px] border border-white/5 shadow-2xl flex flex-col overflow-hidden">
                        <div className="p-6 border-b border-white/5 flex items-center justify-between">
                            <h3 className="text-[10px] font-black text-white/50 uppercase tracking-[0.25em] flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                Lista de Viaturas
                            </h3>
                            <span className="text-[10px] font-mono text-blue-500 font-bold">{vehicles.length} UNIT</span>
                        </div>

                        {/* THE SCROLLABLE LIST - FORCED CUSTOM SCROLLBAR */}
                        <div className="flex-1 overflow-y-scroll p-4 space-y-2 bg-[#0a0a0f] custom-scrollbar-forced">
                            {vehicles.sort((a, b) => a.registration.localeCompare(b.registration)).map(vehicle => (
                                <div
                                    key={vehicle.id}
                                    onClick={() => setSelectedVehicle(vehicle)}
                                    className={`p-4 rounded-2xl border transition-all cursor-pointer group hover:bg-[#1a1a2e] ${selectedVehicle?.id === vehicle.id
                                        ? 'bg-blue-600/20 border-blue-500'
                                        : 'bg-[#161625] border-white/5 hover:border-blue-500/30'
                                        }`}
                                >
                                    <div className="flex justify-between items-center">
                                        <div className="min-w-0">
                                            <div className="font-mono font-black text-xl text-white group-hover:text-blue-400 transition-colors uppercase leading-none tracking-tighter">{vehicle.registration}</div>
                                            <div className="flex items-center gap-1.5 mt-2">
                                                <div className="p-1 bg-slate-800 rounded text-slate-400 group-hover:text-blue-400 transition-colors">
                                                    <Car className="w-2.5 h-2.5" />
                                                </div>
                                                <p className="text-[10px] text-white font-black uppercase truncate tracking-widest">{vehicle.driverName || 'Sem Motorista'}</p>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-2">
                                            <div className={`text-[8px] font-black px-2 py-0.5 rounded-md ${vehicle.status === 'moving' ? 'bg-green-500/10 text-green-400' :
                                                vehicle.status === 'idle' ? 'bg-orange-500/10 text-orange-400' :
                                                    'bg-white/5 text-slate-600'
                                                }`}>
                                                {vehicle.status === 'moving' ? 'ANDAR' : vehicle.status === 'idle' ? 'RELANTI' : 'STOP'}
                                            </div>
                                            <div className="font-mono font-black text-[10px] text-white/80">
                                                {Math.round(vehicle.speed)}<span className="text-[8px] text-slate-700 ml-0.5 uppercase">km/h</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* MAP SECTION - FULL WIDTH STRETCH */}
                    <div className="flex-1 bg-[#161625] rounded-[40px] border border-white/5 p-2 shadow-2xl relative overflow-hidden group">
                        <GeofenceMap geofences={geofences} vehicles={vehicles} selectedVehicle={selectedVehicle} />

                        {/* Floating Status */}
                        <div className="absolute top-6 right-6 z-[1000] flex gap-3">
                            <div className="px-6 py-3 bg-black/80 backdrop-blur-xl rounded-2xl border border-white/10 flex items-center gap-4 shadow-2xl">
                                <div className="flex flex-col">
                                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Status do Sinal</span>
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                                        <span className="text-white font-mono font-black text-xs">ENCRIPTADO / SEGURO</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="px-4 space-y-6">
                    <div className="bg-[#161625] rounded-[40px] border border-white/5 p-10 shadow-2xl">
                        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 mb-12">
                            <div>
                                <h3 className="text-4xl font-black text-white flex items-center gap-4 tracking-tighter">
                                    <History className="w-10 h-10 text-blue-500" />
                                    REGISTO DE LOGÍSTICA
                                </h3>
                                <p className="text-slate-500 text-xs font-black mt-3 uppercase tracking-[0.4em]">Monitorização de passagens em Geofences (24h)</p>
                            </div>
                            <div className="relative w-full lg:w-[500px]">
                                <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-600" />
                                <input
                                    type="text"
                                    placeholder="FILTRAR MATRÍCULA OU LOCAL..."
                                    className="w-full bg-black/40 border border-white/10 rounded-2xl pl-16 pr-8 py-5 text-sm text-white focus:ring-4 focus:ring-blue-500/20 transition-all outline-none font-bold placeholder:text-slate-800 uppercase tracking-widest"
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-separate border-spacing-y-3">
                                <thead>
                                    <tr>
                                        <th className="px-8 py-4 text-slate-700 font-black text-[9px] uppercase tracking-[0.3em]">Viatura</th>
                                        <th className="px-8 py-4 text-slate-700 font-black text-[9px] uppercase tracking-[0.3em]">Motorista</th>
                                        <th className="px-8 py-4 text-slate-700 font-black text-[9px] uppercase tracking-[0.3em]">Zona / Geofence</th>
                                        <th className="px-8 py-4 text-slate-700 font-black text-[9px] uppercase tracking-[0.3em]">Entrada</th>
                                        <th className="px-8 py-4 text-slate-700 font-black text-[9px] uppercase tracking-[0.3em]">Saída</th>
                                        <th className="px-8 py-4 text-slate-700 font-black text-[9px] uppercase tracking-[0.3em]">Tempo de Permanência</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {enrichedVisits.map(visit => (
                                        <tr key={visit.id} className="group transition-all">
                                            <td className="px-8 py-6 bg-black/30 rounded-l-3xl border-y border-l border-white/5 group-hover:bg-blue-600/10 transition-colors">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 rounded-2xl bg-blue-600/10 flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform">
                                                        <Car className="w-6 h-6" />
                                                    </div>
                                                    <span className="font-mono font-black text-white text-xl uppercase tracking-tighter">{visit.registration}</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 bg-black/30 border-y border-white/5 group-hover:bg-blue-600/10 transition-colors">
                                                <span className="text-white font-black text-xs uppercase tracking-widest">{visit.driverName}</span>
                                            </td>
                                            <td className="px-8 py-6 bg-black/30 border-y border-white/5 group-hover:bg-blue-600/10 transition-colors">
                                                <div className="flex items-center gap-3 text-white font-bold">
                                                    <MapPin className="w-4 h-4 text-blue-500" />
                                                    <span className="uppercase text-sm tracking-tight">{visit.geofenceName}</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 bg-black/30 border-y border-white/5 group-hover:bg-blue-600/10 transition-colors">
                                                <div className="flex flex-col">
                                                    <span className="text-emerald-400 font-mono text-base font-black">{visit.enterTimestamp.split(' ')[1]}</span>
                                                    <span className="text-[9px] text-slate-700 font-bold uppercase mt-1">{visit.enterTimestamp.split(' ')[0]}</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 bg-black/30 border-y border-white/5 group-hover:bg-blue-600/10 transition-colors">
                                                {visit.exitTimestamp ? (
                                                    <div className="flex flex-col opacity-40">
                                                        <span className="text-slate-400 font-mono text-base font-black">{visit.exitTimestamp.split(' ')[1]}</span>
                                                        <span className="text-[9px] text-slate-800 font-bold uppercase mt-1">{visit.exitTimestamp.split(' ')[0]}</span>
                                                    </div>
                                                ) : (
                                                    <span className="px-3 py-1 bg-blue-600 text-white text-[9px] font-black rounded-lg uppercase tracking-widest shadow-[0_0_15px_rgba(37,99,235,0.4)]">No Local</span>
                                                )}
                                            </td>
                                            <td className="px-8 py-6 bg-black/30 rounded-r-3xl border-y border-r border-white/5 group-hover:bg-blue-600/10 transition-colors">
                                                <span className="text-white/60 font-black text-sm tracking-tighter font-mono">
                                                    {visit.durationSeconds ? `${Math.floor(visit.durationSeconds / 60)}m ${visit.durationSeconds % 60}s` : '--'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                /* HEAVILY FORCED SCROLLBAR */
                .custom-scrollbar-forced::-webkit-scrollbar {
                    width: 14px !important;
                    display: block !important;
                }
                .custom-scrollbar-forced::-webkit-scrollbar-track {
                    background: #0a0a0f !important;
                    border-left: 1px solid rgba(255,255,255,0.05);
                }
                .custom-scrollbar-forced::-webkit-scrollbar-thumb {
                    background: #3b82f6 !important;
                    border: 3px solid #0a0a0f !important;
                    border-radius: 10px;
                    min-height: 80px;
                }
                .custom-scrollbar-forced::-webkit-scrollbar-thumb:hover {
                    background: #60a5fa !important;
                    box-shadow: 0 0 15px rgba(59,130,246,0.5);
                }
                
                /* Layout Stretch Fix */
                .flex-1 { flex: 1 1 0% !important; }
            `}</style>
        </div>
    );
}
