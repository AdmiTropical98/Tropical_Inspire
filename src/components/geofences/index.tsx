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
                    const isPlateName = !resolvedName || normalizePlate(resolvedName) === normalizePlate(v.registration);

                    if (isPlateName && (v.driverId || v.tagId)) {
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
                    } else if (!isPlateName && resolvedName) {
                        displayName = resolvedName;
                    } else if (v.tagId) {
                        displayName = `Tag: ${v.tagId}`;
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
        await Promise.all([fetchData(true), refreshData()]);
        setRefreshing(false);
    };

    const filteredVisits = geofenceVisits.filter(visit =>
        visit.registration.toLowerCase().includes(searchTerm.toLowerCase()) ||
        visit.geofenceName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="p-8 max-w-[1700px] mx-auto space-y-8 min-h-screen">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-white flex items-center gap-3 tracking-tight">
                        <div className="p-2 bg-blue-600 rounded-2xl shadow-[0_0_20px_rgba(37,99,235,0.4)]">
                            <MapPin className="w-6 h-6 text-white" />
                        </div>
                        Frota em Tempo Real
                    </h1>
                    <p className="text-slate-500 font-bold mt-1 text-sm uppercase tracking-widest">Controlo Logístico Integrado</p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex bg-[#1e1e2d] p-1.5 rounded-2xl border border-white/5 shadow-2xl">
                        <button
                            onClick={() => setActiveTab('map')}
                            className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 uppercase tracking-widest ${activeTab === 'map' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
                        >
                            <Layers className="w-4 h-4" />
                            Mapa
                        </button>
                        <button
                            onClick={() => setActiveTab('history')}
                            className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 uppercase tracking-widest ${activeTab === 'history' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
                        >
                            <History className="w-4 h-4" />
                            Histórico
                        </button>
                    </div>

                    <button
                        onClick={handleRefresh}
                        disabled={loading || refreshing}
                        className="flex items-center gap-2 px-6 py-3 bg-[#1e1e2d] text-white rounded-2xl hover:bg-slate-800 transition-all border border-white/10 disabled:opacity-50 font-black text-xs uppercase tracking-widest shadow-xl"
                    >
                        <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                        <span>{refreshing ? 'Sincronizar...' : 'Atualizar'}</span>
                    </button>
                </div>
            </div>

            {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-500 animate-pulse">
                    <AlertCircle className="w-5 h-5" />
                    <p className="font-bold text-sm tracking-tight">{error}</p>
                </div>
            )}

            {activeTab === 'map' ? (
                <div className="flex flex-col xl:flex-row gap-8 items-start">
                    {/* SIDEBAR - DEFINITIVE SCROLL FIX */}
                    <div className="w-full xl:w-[400px] h-[700px] bg-[#1e1e2d] rounded-[32px] border border-white/10 shadow-2xl flex flex-col overflow-hidden">
                        <div className="p-6 border-b border-white/5 bg-slate-900/40 flex items-center justify-between">
                            <h3 className="text-[11px] font-black text-white/80 uppercase tracking-[0.2em] flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                                Transmissão em Direto
                            </h3>
                            <div className="px-2 py-0.5 bg-blue-500/10 rounded-md text-[8px] font-black text-blue-400 border border-blue-500/20 uppercase">Live</div>
                        </div>

                        {/* THE SCROLLABLE LIST */}
                        <div className="flex-1 overflow-y-scroll p-4 space-y-3 bg-[#161625] custom-visible-scrollbar">
                            {vehicles.sort((a, b) => a.registration.localeCompare(b.registration)).map(vehicle => (
                                <div key={vehicle.id} className="p-4 bg-[#1e1e2d] rounded-2xl border border-white/5 hover:border-blue-500/40 transition-all cursor-pointer group shadow-lg">
                                    <div className="flex justify-between items-start">
                                        <div className="min-w-0">
                                            <div className="font-mono font-black text-xl text-white group-hover:text-blue-400 transition-colors uppercase leading-none">{vehicle.registration}</div>
                                            <p className="text-[10px] text-slate-500 font-bold uppercase truncate mt-1.5 tracking-tight group-hover:text-slate-400">{vehicle.driverName || 'Sem Motorista'}</p>
                                        </div>
                                        <div className="flex flex-col items-end gap-2">
                                            <div className={`text-[9px] font-black px-2 py-0.5 rounded-md ${vehicle.status === 'moving' ? 'bg-green-500/10 text-green-400' :
                                                    vehicle.status === 'idle' ? 'bg-orange-500/10 text-orange-400' :
                                                        'bg-white/5 text-slate-500'
                                                }`}>
                                                {vehicle.status === 'moving' ? 'ANDAR' : vehicle.status === 'idle' ? 'IDLE' : 'PARADO'}
                                            </div>
                                            <div className="font-mono font-black text-xs text-white">
                                                {Math.round(vehicle.speed)} <span className="text-[8px] text-slate-600 ml-0.5 uppercase">km/h</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* MAP SECTION - DEFINITIVE LANDSCAPE */}
                    <div className="flex-1 w-full h-[700px] bg-[#1e1e2d] rounded-[40px] border border-white/10 p-2 shadow-2xl relative overflow-hidden group">
                        <GeofenceMap geofences={geofences} vehicles={vehicles} />
                        <div className="absolute bottom-6 left-6 z-[1000] pointer-events-none">
                            <div className="px-4 py-2 bg-slate-900/90 backdrop-blur-xl rounded-2xl border border-white/10 text-[9px] font-black text-white flex items-center gap-3 shadow-2xl opacity-0 group-hover:opacity-100 transition-all duration-500 transform translate-y-2 group-hover:translate-y-0">
                                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                                <span className="uppercase tracking-widest text-slate-400">Sinal:</span>
                                <span className="text-white text-[11px] font-mono">EXCELLENT</span>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="space-y-6 animate-in fade-in duration-500 slide-in-from-bottom-4">
                    <div className="bg-[#1e1e2d] backdrop-blur-sm border border-white/10 rounded-[32px] p-8 shadow-2xl">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
                            <div>
                                <h3 className="text-2xl font-black text-white flex items-center gap-3 tracking-tight uppercase">
                                    <History className="w-6 h-6 text-blue-500" />
                                    Histórico de Atividade
                                </h3>
                                <p className="text-slate-500 text-sm font-bold mt-1 uppercase tracking-tight">Registo detalhado das últimas 24 horas</p>
                            </div>
                            <div className="relative w-full md:w-96 group">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
                                <input
                                    type="text"
                                    placeholder="Procurar matrícula ou local..."
                                    className="w-full bg-[#161625] border border-white/5 rounded-2xl pl-12 pr-4 py-3 text-sm text-white focus:ring-2 focus:ring-blue-500/50 transition-all outline-none font-bold placeholder:text-slate-700"
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-white/5">
                                        <th className="px-6 py-5 text-slate-500 font-black text-[10px] uppercase tracking-[0.2em]">Viatura</th>
                                        <th className="px-6 py-5 text-slate-500 font-black text-[10px] uppercase tracking-[0.2em]">Localização</th>
                                        <th className="px-6 py-5 text-slate-500 font-black text-[10px] uppercase tracking-[0.2em]">Check-In</th>
                                        <th className="px-6 py-5 text-slate-500 font-black text-[10px] uppercase tracking-[0.2em]">Check-Out</th>
                                        <th className="px-6 py-5 text-slate-500 font-black text-[10px] uppercase tracking-[0.2em]">Duração</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {filteredVisits.map(visit => (
                                        <tr key={visit.id} className="hover:bg-blue-500/[0.02] transition-colors group">
                                            <td className="px-6 py-5">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm">
                                                        <Car className="w-5 h-5" />
                                                    </div>
                                                    <span className="font-black text-white uppercase tracking-tighter text-lg">{visit.registration}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5 uppercase">
                                                <div className="flex items-center gap-2.5 text-slate-300">
                                                    <MapPin className="w-4 h-4 text-slate-600" />
                                                    <span className="font-bold tracking-tight text-sm">{visit.geofenceName}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="flex items-center gap-2.5 text-emerald-400 font-mono text-sm font-black">
                                                    <Clock className="w-4 h-4 opacity-50" />
                                                    {visit.enterTimestamp.split(' ')[1]}
                                                    <span className="text-[10px] text-slate-600 ml-1 font-bold">{visit.enterTimestamp.split(' ')[0]}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                {visit.exitTimestamp ? (
                                                    <div className="flex items-center gap-2.5 text-slate-500 font-mono text-sm font-black">
                                                        <ArrowRight className="w-4 h-4 opacity-30" />
                                                        {visit.exitTimestamp.split(' ')[1]}
                                                        <span className="text-[10px] text-slate-700 ml-1 font-bold">{visit.exitTimestamp.split(' ')[0]}</span>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>
                                                        <span className="px-2.5 py-1 bg-blue-500/10 text-blue-400 text-[10px] font-black rounded-lg border border-blue-500/20 uppercase tracking-widest">Ativo</span>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-5">
                                                <span className="text-slate-400 text-sm font-black tracking-tighter">
                                                    {visit.durationSeconds ? `${Math.floor(visit.durationSeconds / 60)}m ${visit.durationSeconds % 60}s` : '--'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredVisits.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-20 text-center">
                                                <div className="flex flex-col items-center gap-3">
                                                    <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center text-slate-700">
                                                        <History className="w-8 h-8" />
                                                    </div>
                                                    <span className="text-slate-600 font-black text-xs uppercase tracking-widest">Sem registos encontrados nas últimas 24h</span>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                /* DEFINITIVE HIGH-CONTRAST SCROLLBAR */
                .custom-visible-scrollbar::-webkit-scrollbar {
                    width: 14px !important;
                    display: block !important;
                }
                .custom-visible-scrollbar::-webkit-scrollbar-track {
                    background: #161625 !important;
                    border-left: 1px solid rgba(255,255,255,0.05);
                }
                .custom-visible-scrollbar::-webkit-scrollbar-thumb {
                    background: #3b82f6 !important;
                    border: 3px solid #161625 !important;
                    border-radius: 10px;
                    min-height: 50px !important;
                    box-shadow: inset 0 0 10px rgba(0,0,0,0.5);
                }
                .custom-visible-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #60a5fa !important;
                }
                
                @keyframes spin-slow {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .animate-spin-slow {
                    animation: spin-slow 12s linear infinite;
                }
            `}</style>
        </div>
    );
}
