import { useState, useRef, useCallback, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import {
    MapPin, Search, Navigation,
    GripVertical, Trash2, ArrowRight,
    Save, RefreshCw, Car, CheckCircle2,
    Clock, Fuel, Euro, AlertCircle, History, X, Route
} from 'lucide-react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { useWorkshop } from '../../contexts/WorkshopContext';
import { useAuth } from '../../contexts/AuthContext';

// Fix Leaflet Icons
import details from 'leaflet/dist/images/marker-icon.png';
import shadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
    iconUrl: details,
    shadowUrl: shadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// Custom Numbered Icon
const createNumberedIcon = (number: number, isLast: boolean, isFirst: boolean) => {
    const bgColor = isFirst ? '#22c55e' : (isLast ? '#ef4444' : '#3b82f6');
    const border = isFirst ? '#16a34a' : (isLast ? '#dc2626' : '#2563eb');
    return L.divIcon({
        className: 'custom-div-icon',
        html: `<div style="
            background-color: ${bgColor};
            color: white;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 900;
            font-size: 13px;
            border: 3px solid ${border};
            box-shadow: 0 4px 14px rgba(0,0,0,0.25);
            transform: translate(-16px, -16px);
        ">${number}</div>`,
        iconSize: [0, 0],
        iconAnchor: [0, 0]
    });
};

// Sortable Item Component
function SortableItem(props: any) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: props.id });
    const style = { transform: CSS.Transform.toString(transform), transition };
    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="touch-none">
            {props.children}
        </div>
    );
}

// Map auto-fit component
function MapBounds({ points }: { points: { lat: number; lng: number }[] }) {
    const map = useMap();
    useEffect(() => {
        if (points.length > 0) {
            const bounds = L.latLngBounds(points.map(p => [p.lat, p.lng]));
            map.fitBounds(bounds, { padding: [60, 60] });
        }
    }, [points, map]);
    return null;
}

// Map resize fixer
function MapResizer() {
    const map = useMap();
    useEffect(() => {
        setTimeout(() => map.invalidateSize(), 100);
    }, [map]);
    return null;
}

interface RouteStop {
    id: string;
    name: string;
    lat: number;
    lng: number;
    type: string;
}

interface OSRMRoute {
    geometry: { coordinates: [number, number][] };
    distance: number; // meters
    duration: number; // seconds
    legs: { steps: any[] }[];
}

// Compute the centroid of a geofence, handling polygons and circle geofences
function getGeofenceCentroid(g: { latitude?: number; longitude?: number; points?: { lat: number; lng: number }[]; polygon_wkt?: string }): { lat: number; lng: number } | null {
    // Try direct coordinates — validate they look like real geographic coords
    const isValid = (lat: number, lng: number) => lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 && !(lat === 0 && lng === 0);
    const isReasonable = (lat: number, lng: number) => lat >= 25 && lat <= 72 && lng >= -30 && lng <= 45; // Europe + N.Africa

    if (g.latitude && g.longitude && isValid(g.latitude, g.longitude) && isReasonable(g.latitude, g.longitude)) {
        return { lat: g.latitude, lng: g.longitude };
    }

    // Try centroid from points array
    if (g.points && g.points.length > 0) {
        const avgLat = g.points.reduce((s, p) => s + p.lat, 0) / g.points.length;
        const avgLng = g.points.reduce((s, p) => s + p.lng, 0) / g.points.length;
        if (isValid(avgLat, avgLng) && isReasonable(avgLat, avgLng)) return { lat: avgLat, lng: avgLng };
        // Try swapped (some APIs return lng,lat order)
        const avgLatSwap = g.points.reduce((s, p) => s + p.lng, 0) / g.points.length;
        const avgLngSwap = g.points.reduce((s, p) => s + p.lat, 0) / g.points.length;
        if (isValid(avgLatSwap, avgLngSwap) && isReasonable(avgLatSwap, avgLngSwap)) return { lat: avgLatSwap, lng: avgLngSwap };
    }

    // Try parsing WKT: POLYGON((lng lat, lng lat, ...))
    if (g.polygon_wkt) {
        const matches = g.polygon_wkt.match(/[-\d.]+\s+[-\d.]+/g);
        if (matches && matches.length > 0) {
            const pairs = matches.map(m => { const [a, b] = m.trim().split(/\s+/); return [parseFloat(a), parseFloat(b)]; });
            // WKT is typically (longitude latitude)
            const avgLng = pairs.reduce((s, p) => s + p[0], 0) / pairs.length;
            const avgLat = pairs.reduce((s, p) => s + p[1], 0) / pairs.length;
            if (isValid(avgLat, avgLng) && isReasonable(avgLat, avgLng)) return { lat: avgLat, lng: avgLng };
            // Try reversed (latitude longitude)
            const avgLat2 = pairs.reduce((s, p) => s + p[0], 0) / pairs.length;
            const avgLng2 = pairs.reduce((s, p) => s + p[1], 0) / pairs.length;
            if (isValid(avgLat2, avgLng2) && isReasonable(avgLat2, avgLng2)) return { lat: avgLat2, lng: avgLng2 };
        }
    }

    return null;
}

export default function Roteirizacao() {
    const { locais, motoristas, viaturas, saveRoute, registerLog, rotasPlaneadas, updateRouteStatus, geofences } = useWorkshop();
    const { currentUser } = useAuth();

    const [selectedMotorista, setSelectedMotorista] = useState('');
    const [selectedViatura, setSelectedViatura] = useState('');
    const [routeStops, setRouteStops] = useState<RouteStop[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [geocodeResults, setGeocodeResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    const searchDebounceRef = useRef<any>(null);
    const [activeTab, setActiveTab] = useState<'locais' | 'ativas'>('locais');
    const [isSaving, setIsSaving] = useState(false);
    const [isRouting, setIsRouting] = useState(false);
    const [osrmRoute, setOsrmRoute] = useState<OSRMRoute | null>(null);
    const [routeError, setRouteError] = useState<string | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const defaultCenter: [number, number] = [38.7223, -9.1393];

    // OSRM real road routing
    const fetchOSRMRoute = useCallback(async (stops: RouteStop[]) => {
        if (stops.length < 2) { setOsrmRoute(null); return; }
        setIsRouting(true);
        setRouteError(null);
        try {
            const coords = stops.map(s => `${s.lng},${s.lat}`).join(';');
            const res = await fetch(
                `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=true`
            );
            const data = await res.json();
            if (data.code === 'Ok' && data.routes?.length > 0) {
                setOsrmRoute(data.routes[0]);
            } else {
                setRouteError('Não foi possível calcular a rota. Verifique os pontos selecionados.');
                setOsrmRoute(null);
            }
        } catch {
            setRouteError('Erro ao contactar o serviço de rotas.');
            setOsrmRoute(null);
        } finally {
            setIsRouting(false);
        }
    }, []);

    // Auto-calculate route when stops change
    useEffect(() => {
        if (routeStops.length >= 2) {
            const t = setTimeout(() => fetchOSRMRoute(routeStops), 600);
            return () => clearTimeout(t);
        } else {
            setOsrmRoute(null);
        }
    }, [routeStops, fetchOSRMRoute]);

    // Summary from OSRM real data
    const summary = osrmRoute ? {
        distance: osrmRoute.distance / 1000,
        time: osrmRoute.duration / 60,
        fuel: (osrmRoute.distance / 1000 / 100) * 8.5,
        cost: (osrmRoute.distance / 1000 / 100) * 8.5 * 1.62,
    } : { distance: 0, time: 0, fuel: 0, cost: 0 };

    // Route polyline from OSRM geometry
    const routePolyline: [number, number][] = osrmRoute
        ? osrmRoute.geometry.coordinates.map(([lng, lat]) => [lat, lng])
        : [];

    const handleAddStop = (item: any) => {
        if (!item.latitude || !item.longitude) return;
        const stop: RouteStop = {
            id: crypto.randomUUID(),
            name: item.nome || item.name,
            lat: item.latitude,
            lng: item.longitude,
            type: item.source === 'geofence' ? 'pesquisa' : 'local',
        };
        setRouteStops(prev => [...prev, stop]);
    };

    const handleAddGeocodedStop = (result: any) => {
        const stop: RouteStop = {
            id: `geo-${Date.now()}`,
            name: result.display_name.split(',').slice(0, 2).join(',').trim(),
            lat: parseFloat(result.lat),
            lng: parseFloat(result.lon),
            type: 'pesquisa',
        };
        setRouteStops(prev => [...prev, stop]);
        setSearchTerm('');
        setGeocodeResults([]);
        setShowDropdown(false);
    };

    const handleRemoveStop = (id: string) => setRouteStops(prev => prev.filter(s => s.id !== id));

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            setRouteStops(items => {
                const oldIndex = items.findIndex(i => i.id === active.id);
                const newIndex = items.findIndex(i => i.id === over.id);
                return arrayMove(items, oldIndex, newIndex);
            });
        }
    };

    const handleOptimize = () => {
        if (routeStops.length < 3) return;

        const haversine = (a: RouteStop, b: RouteStop) => {
            const R = 6371;
            const dLat = (b.lat - a.lat) * Math.PI / 180;
            const dLng = (b.lng - a.lng) * Math.PI / 180;
            const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
            return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
        };

        const routeDist = (order: RouteStop[]) => order.reduce((sum, s, i) => i === 0 ? 0 : sum + haversine(order[i - 1], s), 0);

        const first = routeStops[0];
        const last = routeStops[routeStops.length - 1];
        const middle = routeStops.slice(1, -1);

        if (middle.length === 0) return; // Only 2 stops, nothing to optimize

        // Brute-force permutations for ≤7 middle stops (≤5040 combos), nearest-neighbour for more
        const permute = (arr: RouteStop[]): RouteStop[][] => {
            if (arr.length <= 1) return [arr];
            return arr.flatMap((el, i) => permute([...arr.slice(0, i), ...arr.slice(i + 1)]).map(rest => [el, ...rest]));
        };

        let bestOrder: RouteStop[];
        if (middle.length <= 7) {
            const perms = permute(middle);
            bestOrder = perms.reduce((best, perm) => {
                const candidate = [first, ...perm, last];
                return routeDist(candidate) < routeDist([first, ...best, last]) ? perm : best;
            }, middle);
        } else {
            // Nearest-neighbour keeping first and last fixed
            const optimized: RouteStop[] = [];
            let remaining = [...middle];
            let current = first;
            while (remaining.length > 0) {
                let nearestIdx = 0;
                let minDist = Infinity;
                remaining.forEach((s, i) => { const d = haversine(current, s); if (d < minDist) { minDist = d; nearestIdx = i; } });
                optimized.push(remaining[nearestIdx]);
                current = remaining[nearestIdx];
                remaining.splice(nearestIdx, 1);
            }
            bestOrder = optimized;
        }

        setRouteStops([first, ...bestOrder, last]);
    };

    const handleExportGoogleMaps = () => {
        if (routeStops.length === 0) return;
        const origin = `${routeStops[0].lat},${routeStops[0].lng}`;
        if (routeStops.length === 1) {
            window.open(`https://www.google.com/maps/search/?api=1&query=${origin}`, '_blank');
            return;
        }
        const last = routeStops[routeStops.length - 1];
        const destination = `${last.lat},${last.lng}`;
        const waypoints = routeStops.slice(1, -1).map(s => `${s.lat},${s.lng}`).join('|');
        const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${waypoints ? `&waypoints=${waypoints}` : ''}&travelmode=driving`;
        window.open(url, '_blank');
    };

    const handleExportWaze = () => {
        if (routeStops.length === 0) return;
        const last = routeStops[routeStops.length - 1];
        window.open(`https://waze.com/ul?ll=${last.lat},${last.lng}&navigate=yes`, '_blank');
    };

    const handleSaveRoute = async () => {
        if (routeStops.length < 2) return;
        setIsSaving(true);
        try {
            const { data, success } = await saveRoute({
                motorista_id: selectedMotorista || undefined,
                viatura_id: selectedViatura || undefined,
                data: new Date().toISOString().split('T')[0],
                distancia_estimada: summary.distance,
                tempo_estimado: Math.round(summary.time),
                consumo_estimado: summary.fuel,
                custo_estimado: summary.cost,
                rota_json: routeStops,
                estado: 'planeada'
            });
            if (success && data) {
                await registerLog({
                    utilizador: currentUser?.email || 'Sistema',
                    acao: 'PLANEAR_ROTA',
                    referencia_id: data.id,
                    detalhes_json: { paragens: routeStops.length, distancia: summary.distance }
                });
                alert('Rota guardada com sucesso!');
            } else {
                throw new Error('Falha');
            }
        } catch {
            alert('Erro ao guardar rota.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleFinalizeRoute = async (routeId: string, plannedDist: number) => {
        const realDist = prompt(`Distância real percorrida (KM) — estimativa: ${plannedDist.toFixed(1)}km:`, plannedDist.toFixed(1));
        if (realDist === null) return;
        const distance = parseFloat(realDist);
        const deviation = Math.abs(distance - plannedDist) / plannedDist;
        let justification = '';
        if (deviation > 0.25) {
            justification = prompt('Desvio >25% detetado. Introduza uma justificação:', '') || '';
            if (!justification) { alert('Justificação obrigatória para desvios >25%.'); return; }
        }
        try {
            await updateRouteStatus(routeId, 'concluida', distance, justification);
            alert('Rota concluída!');
        } catch { alert('Erro ao concluir rota.'); }
    };

    const handleSearchChange = (value: string) => {
        setSearchTerm(value);
        setShowDropdown(value.length > 1);
        if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
        if (value.length < 3) { setGeocodeResults([]); return; }
        setIsSearching(true);
        searchDebounceRef.current = setTimeout(async () => {
            try {
                const res = await fetch(
                    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(value)}&limit=6&countrycodes=pt&accept-language=pt`,
                    { headers: { 'Accept-Language': 'pt' } }
                );
                setGeocodeResults(await res.json());
            } catch { setGeocodeResults([]); }
            finally { setIsSearching(false); }
        }, 500);
    };

    // Combine local POIs + Cartrack geofences with validated/computed coordinates
    const cartrackPOIs = geofences
        .map(g => {
            const center = getGeofenceCentroid(g);
            if (!center) return null;
            return { id: g.id, nome: g.name, latitude: center.lat, longitude: center.lng, tipo: g.group_name || 'cartrack', source: 'geofence' as const };
        })
        .filter((g): g is NonNullable<typeof g> => g !== null);
    const allPOIs = [
        ...locais.map(l => ({ ...l, source: 'local' as const })),
        ...cartrackPOIs,
    ];
    const filteredPOIs = allPOIs.filter(p => p.nome?.toLowerCase().includes(searchTerm.toLowerCase()));
    const activeRoutes = rotasPlaneadas.filter(r => r.estado === 'planeada');

    const formatTime = (mins: number) => {
        if (mins < 60) return `${Math.round(mins)} min`;
        const h = Math.floor(mins / 60);
        const m = Math.round(mins % 60);
        return m > 0 ? `${h}h ${m}min` : `${h}h`;
    };

    return (
        <div className="flex h-full w-full overflow-hidden">
            {/* ── LEFT SIDEBAR ── */}
            <div className="w-[360px] shrink-0 flex flex-col bg-white border-r border-slate-200 shadow-lg z-10 overflow-hidden">

                {/* Header */}
                <div className="px-5 pt-5 pb-4 border-b border-slate-100 shrink-0">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25 shrink-0">
                            <Route className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-sm font-extrabold text-slate-900 uppercase tracking-tight leading-none">Roteirização</h1>
                            <p className="text-[10px] text-blue-500 font-bold uppercase tracking-widest mt-0.5">Planeador de Trajetos</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Motorista</label>
                            <select
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400 transition-all"
                                value={selectedMotorista}
                                onChange={e => setSelectedMotorista(e.target.value)}
                            >
                                <option value="">Nenhum</option>
                                {motoristas.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Viatura</label>
                            <select
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400 transition-all"
                                value={selectedViatura}
                                onChange={e => setSelectedViatura(e.target.value)}
                            >
                                <option value="">Nenhuma</option>
                                {viaturas.map(v => <option key={v.id} value={v.id}>{v.matricula}</option>)}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Search box */}
                <div className="px-4 pt-3 pb-2 shrink-0">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Pesquisar morada, local, POI..."
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-8 py-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400 transition-all"
                            value={searchTerm}
                            onChange={e => handleSearchChange(e.target.value)}
                            onFocus={() => searchTerm.length > 1 && setShowDropdown(true)}
                            onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                        />
                        {isSearching ? (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                            </div>
                        ) : searchTerm && (
                            <button className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500"
                                onMouseDown={() => { setSearchTerm(''); setGeocodeResults([]); setShowDropdown(false); }}>
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                        {showDropdown && (filteredPOIs.length > 0 || geocodeResults.length > 0) && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl overflow-hidden z-50 shadow-2xl max-h-64 overflow-y-auto">
                                {filteredPOIs.slice(0, 4).map(poi => (
                                    <button key={`${poi.source}-${poi.id}`}
                                        onMouseDown={() => { handleAddStop(poi); setShowDropdown(false); setSearchTerm(''); }}
                                        className="w-full text-left px-3 py-2.5 hover:bg-blue-50 flex items-center gap-2.5 border-b border-slate-100 transition-colors">
                                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${poi.source === 'geofence' ? 'bg-indigo-100' : 'bg-blue-100'}`}>
                                            <MapPin className={`w-3 h-3 ${poi.source === 'geofence' ? 'text-indigo-600' : 'text-blue-600'}`} />
                                        </div>
                                        <div>
                                            <div className="text-xs text-slate-800 font-semibold">{poi.nome}</div>
                                            <div className="text-[9px] text-slate-400">{poi.source === 'geofence' ? '🛰 Cartrack' : '📍 Local'} • {poi.tipo}</div>
                                        </div>
                                    </button>
                                ))}
                                {geocodeResults.map((result, i) => (
                                    <button key={i}
                                        onMouseDown={() => handleAddGeocodedStop(result)}
                                        className="w-full text-left px-3 py-2.5 hover:bg-slate-50 flex items-center gap-2.5 border-b border-slate-100 last:border-0 transition-colors">
                                        <div className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                                            <Search className="w-3 h-3 text-slate-500" />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="text-xs text-slate-800 font-semibold truncate">{result.display_name.split(',').slice(0, 2).join(',')}</div>
                                            <div className="text-[9px] text-slate-400 truncate">{result.display_name.split(',').slice(2, 4).join(',')}</div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Stops List */}
                <div className="px-4 pb-2 shrink-0">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                            <MapPin className="w-3 h-3 text-blue-500" />
                            Paragens ({routeStops.length})
                        </span>
                        {routeStops.length > 0 && (
                            <button onClick={() => setRouteStops([])} className="text-[10px] text-red-400 hover:text-red-600 font-semibold transition-colors">
                                Limpar tudo
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto scrollbar-none px-4 min-h-0 pb-2">
                    {routeStops.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center gap-3 py-8">
                            <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center">
                                <Route className="w-7 h-7 text-blue-300" />
                            </div>
                            <div className="text-center">
                                <p className="text-xs font-semibold text-slate-500">Sem paragens definidas</p>
                                <p className="text-[10px] text-slate-400 mt-1">Pesquise um local ou selecione um POI abaixo</p>
                            </div>
                        </div>
                    ) : (
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                            <SortableContext items={routeStops} strategy={verticalListSortingStrategy}>
                                <div className="space-y-1.5">
                                    {routeStops.map((stop, index) => {
                                        const isFirst = index === 0;
                                        const isLast = index === routeStops.length - 1;
                                        return (
                                            <SortableItem key={stop.id} id={stop.id}>
                                                <div className={`group flex items-center gap-2.5 p-2.5 rounded-xl border cursor-grab active:cursor-grabbing transition-all hover:shadow-sm ${
                                                    isFirst ? 'bg-emerald-50 border-emerald-200' :
                                                    isLast && routeStops.length > 1 ? 'bg-red-50 border-red-200' :
                                                    'bg-white border-slate-200 hover:border-blue-200'
                                                }`}>
                                                    <GripVertical className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 text-white ${
                                                        isFirst ? 'bg-emerald-500' :
                                                        isLast && routeStops.length > 1 ? 'bg-red-500' :
                                                        'bg-blue-500'
                                                    }`}>{index + 1}</div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-xs font-semibold text-slate-800 truncate">{stop.name}</div>
                                                        <div className="text-[9px] text-slate-400 capitalize">
                                                            {isFirst ? '🟢 Partida' : isLast && routeStops.length > 1 ? '🔴 Destino' : `⭕ Paragem ${index}`}
                                                        </div>
                                                    </div>
                                                    <button onClick={() => handleRemoveStop(stop.id)}
                                                        className="p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0">
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </SortableItem>
                                        );
                                    })}
                                </div>
                            </SortableContext>
                        </DndContext>
                    )}
                </div>

                {/* Summary strip */}
                {osrmRoute && (
                    <div className="mx-4 mb-3 p-3 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl shrink-0">
                        <div className="grid grid-cols-4 gap-2">
                            <div className="text-center">
                                <div className="text-[8px] font-bold text-blue-200 uppercase">KM</div>
                                <div className="text-sm font-black text-white">{summary.distance.toFixed(1)}</div>
                            </div>
                            <div className="text-center">
                                <div className="text-[8px] font-bold text-blue-200 uppercase">Tempo</div>
                                <div className="text-sm font-black text-white">{formatTime(summary.time)}</div>
                            </div>
                            <div className="text-center">
                                <div className="text-[8px] font-bold text-blue-200 uppercase">Litros</div>
                                <div className="text-sm font-black text-amber-300">{summary.fuel.toFixed(1)}</div>
                            </div>
                            <div className="text-center">
                                <div className="text-[8px] font-bold text-blue-200 uppercase">Custo</div>
                                <div className="text-sm font-black text-emerald-300">{summary.cost.toFixed(2)}€</div>
                            </div>
                        </div>
                        {isRouting && (
                            <div className="flex items-center justify-center gap-1.5 mt-2">
                                <div className="w-2 h-2 border border-white border-t-transparent rounded-full animate-spin" />
                                <span className="text-[9px] text-blue-200 font-semibold">A calcular rota...</span>
                            </div>
                        )}
                    </div>
                )}
                {routeError && (
                    <div className="mx-4 mb-3 p-2.5 bg-red-50 border border-red-200 rounded-xl shrink-0">
                        <div className="flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                            <span className="text-[10px] text-red-600 font-semibold">{routeError}</span>
                        </div>
                    </div>
                )}

                {/* Action Buttons */}
                <div className="px-4 pb-4 space-y-2 shrink-0">
                    <div className="grid grid-cols-2 gap-2">
                        <button onClick={handleOptimize} disabled={routeStops.length < 3}
                            className="flex items-center justify-center gap-1.5 py-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl text-[11px] font-bold text-slate-700 uppercase transition-all disabled:opacity-40 group">
                            <RefreshCw className="w-3.5 h-3.5 group-hover:rotate-180 transition-transform duration-500" />
                            Otimizar
                        </button>
                        <button onClick={handleSaveRoute} disabled={routeStops.length < 2 || isSaving}
                            className="flex items-center justify-center gap-1.5 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-[11px] font-bold text-white uppercase transition-all disabled:opacity-40 shadow-md shadow-emerald-500/20">
                            <Save className="w-3.5 h-3.5" />
                            {isSaving ? 'A guardar...' : 'Guardar'}
                        </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <button onClick={handleExportGoogleMaps} disabled={routeStops.length === 0}
                            className="flex items-center justify-center gap-1.5 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-[11px] font-bold text-white uppercase transition-all disabled:opacity-40 shadow-md shadow-blue-500/20">
                            <Navigation className="w-3.5 h-3.5" />
                            Google Maps
                        </button>
                        <button onClick={handleExportWaze} disabled={routeStops.length === 0}
                            className="flex items-center justify-center gap-1.5 py-2.5 bg-cyan-500 hover:bg-cyan-400 rounded-xl text-[11px] font-bold text-white uppercase transition-all disabled:opacity-40 shadow-md shadow-cyan-500/20">
                            <Navigation className="w-3.5 h-3.5 rotate-45" />
                            Waze
                        </button>
                    </div>
                </div>

                {/* POI / Active routes tabs */}
                <div className="border-t border-slate-100 flex flex-col shrink-0" style={{ height: '220px' }}>
                    <div className="flex gap-1 px-4 pt-3 pb-2">
                        {(['locais', 'ativas'] as const).map(tab => (
                            <button key={tab} onClick={() => setActiveTab(tab)}
                                className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${activeTab === tab ? 'bg-blue-600 text-white shadow' : 'text-slate-500 hover:bg-slate-100'}`}>
                                {tab === 'locais' ? `POIs (${filteredPOIs.length})` : `Ativas${activeRoutes.length > 0 ? ` (${activeRoutes.length})` : ''}`}
                            </button>
                        ))}
                    </div>
                    <div className="flex-1 overflow-y-auto scrollbar-none px-4 pb-3 space-y-1.5 min-h-0">
                        {activeTab === 'locais' && filteredPOIs.map(poi => (
                            <button key={`${poi.source}-${poi.id}`} onClick={() => handleAddStop(poi)}
                                className="w-full text-left p-2.5 rounded-xl bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 flex items-center gap-2.5 group transition-all">
                                <div className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 transition-all group-hover:bg-blue-600 group-hover:border-blue-600 ${poi.source === 'geofence' ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-200'}`}>
                                    <MapPin className="w-3.5 h-3.5 text-slate-400 group-hover:text-white transition-colors" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-xs font-semibold text-slate-700 truncate group-hover:text-blue-700">{poi.nome}</div>
                                    <div className="text-[9px] text-slate-400 capitalize flex items-center gap-1">
                                        {poi.source === 'geofence' ? '🛰 Cartrack' : '📍 Local'} • {poi.tipo}
                                    </div>
                                </div>
                                <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-500 transition-colors shrink-0" />
                            </button>
                        ))}
                        {activeTab === 'locais' && filteredPOIs.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-24 gap-2 text-slate-400">
                                <MapPin className="w-5 h-5 opacity-30" />
                                <p className="text-[10px] font-semibold">Sem POIs disponíveis</p>
                            </div>
                        )}
                        {activeTab === 'ativas' && activeRoutes.map(route => {
                            const mot = motoristas.find(m => m.id === route.motorista_id);
                            const vtr = viaturas.find(v => v.id === route.viatura_id);
                            return (
                                <div key={route.id} className="p-3 rounded-xl bg-white border border-slate-200 space-y-2">
                                    <div className="flex justify-between items-start">
                                        <div className="min-w-0">
                                            <div className="text-[10px] font-bold text-slate-700 truncate">{route.data}</div>
                                            <div className="text-[9px] text-slate-400 flex items-center gap-1 mt-0.5">
                                                <Car className="w-3 h-3" />{vtr?.matricula || 'N/A'} • {mot?.nome || 'N/A'}
                                            </div>
                                        </div>
                                        <span className="text-[9px] font-bold text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-lg">
                                            {route.distancia_estimada.toFixed(0)}km
                                        </span>
                                    </div>
                                    <button onClick={() => handleFinalizeRoute(route.id, route.distancia_estimada)}
                                        className="w-full py-1.5 bg-emerald-50 hover:bg-emerald-600 text-emerald-600 hover:text-white text-[9px] font-bold uppercase rounded-lg border border-emerald-200 hover:border-emerald-600 transition-all flex items-center justify-center gap-1.5">
                                        <CheckCircle2 className="w-3 h-3" />Concluir
                                    </button>
                                </div>
                            );
                        })}
                        {activeTab === 'ativas' && activeRoutes.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-24 gap-2 text-slate-400">
                                <History className="w-5 h-5 opacity-30" />
                                <p className="text-[10px] font-semibold">Nenhuma rota ativa</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── MAP AREA ── */}
            <div className="flex-1 relative overflow-hidden">
                <MapContainer center={defaultCenter} zoom={11} className="h-full w-full outline-none" zoomControl={false}>
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                    />

                    {/* Real OSRM route geometry */}
                    {routePolyline.length > 1 && (
                        <>
                            <Polyline positions={routePolyline} color="#ffffff" weight={7} opacity={0.6} />
                            <Polyline positions={routePolyline} color="#2563eb" weight={4} opacity={0.9} />
                        </>
                    )}

                    {/* Markers */}
                    {routeStops.map((stop, index) => (
                        <Marker key={stop.id} position={[stop.lat, stop.lng]}
                            icon={createNumberedIcon(index + 1, index === routeStops.length - 1, index === 0)}>
                            <Popup>
                                <div className="text-sm font-bold text-slate-800">{stop.name}</div>
                                <div className="text-[10px] text-slate-400 mt-0.5">
                                    {index === 0 ? 'Ponto de partida' : index === routeStops.length - 1 ? 'Destino final' : `Paragem ${index}`}
                                </div>
                            </Popup>
                        </Marker>
                    ))}

                    <MapBounds points={routeStops} />
                    <MapResizer />
                </MapContainer>

                {/* Computing overlay */}
                {isRouting && (
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-white/95 backdrop-blur-md px-4 py-2.5 rounded-full border border-blue-100 shadow-lg flex items-center gap-2.5">
                        <div className="w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs font-semibold text-blue-700">A calcular melhor trajeto...</span>
                    </div>
                )}

                {/* Floating stats card (top-right) */}
                {routeStops.length > 0 && (
                    <div className="absolute top-4 right-4 z-[1000] w-[240px]">
                        <div className="bg-white/96 backdrop-blur-xl rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
                            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 flex items-center justify-between">
                                <span className="text-[10px] font-bold text-white/80 uppercase tracking-widest">Resumo do Percurso</span>
                                <div className={`w-2 h-2 rounded-full ${osrmRoute ? 'bg-emerald-400' : 'bg-white/30'} ${isRouting ? 'animate-pulse' : ''}`} />
                            </div>
                            <div className="p-4 grid grid-cols-2 gap-3">
                                <div className="flex items-start gap-2">
                                    <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 mt-0.5">
                                        <Navigation className="w-3.5 h-3.5 text-blue-500" />
                                    </div>
                                    <div>
                                        <div className="text-[9px] font-semibold text-slate-400 uppercase">Distância</div>
                                        <div className="text-base font-black text-slate-800">{summary.distance.toFixed(1)}<span className="text-[9px] text-slate-400 ml-0.5">km</span></div>
                                    </div>
                                </div>
                                <div className="flex items-start gap-2">
                                    <div className="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center shrink-0 mt-0.5">
                                        <Clock className="w-3.5 h-3.5 text-purple-500" />
                                    </div>
                                    <div>
                                        <div className="text-[9px] font-semibold text-slate-400 uppercase">Tempo</div>
                                        <div className="text-base font-black text-slate-800">{formatTime(summary.time)}</div>
                                    </div>
                                </div>
                                <div className="flex items-start gap-2">
                                    <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center shrink-0 mt-0.5">
                                        <Fuel className="w-3.5 h-3.5 text-amber-500" />
                                    </div>
                                    <div>
                                        <div className="text-[9px] font-semibold text-slate-400 uppercase">Consumo</div>
                                        <div className="text-base font-black text-amber-600">{summary.fuel.toFixed(1)}<span className="text-[9px] text-slate-400 ml-0.5">L</span></div>
                                    </div>
                                </div>
                                <div className="flex items-start gap-2">
                                    <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0 mt-0.5">
                                        <Euro className="w-3.5 h-3.5 text-emerald-500" />
                                    </div>
                                    <div>
                                        <div className="text-[9px] font-semibold text-slate-400 uppercase">Custo Est.</div>
                                        <div className="text-base font-black text-emerald-600">{summary.cost.toFixed(2)}<span className="text-[9px] text-slate-400 ml-0.5">€</span></div>
                                    </div>
                                </div>
                            </div>
                            <div className="px-4 pb-3 pt-0">
                                <div className="text-[9px] text-slate-400 text-center">
                                    {routeStops.length} paragem{routeStops.length !== 1 ? 's' : ''} • 8.5L/100km • €1.62/L
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Empty state hint */}
                {routeStops.length === 0 && (
                    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[1000]">
                        <div className="bg-white/95 backdrop-blur-md px-5 py-3 rounded-2xl border border-slate-200 shadow-lg text-center">
                            <p className="text-xs font-semibold text-slate-600">Adicione paragens na barra lateral para calcular o melhor trajeto</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">Usa os POIs Cartrack ou pesquisa qualquer morada</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
