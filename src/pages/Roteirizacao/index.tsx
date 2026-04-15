import { useState, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import {
    MapPin, Search, Navigation,
    GripVertical, Trash2, ArrowRight,
    Save, RefreshCw, Car, CheckCircle2,
    AlertCircle, History
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
    const bgColor = isFirst ? '#22c55e' : (isLast ? '#ef4444' : '#9333ea');
    return L.divIcon({
        className: 'custom-div-icon',
        html: `<div style="
            background-color: ${bgColor};
            color: white;
            width: 30px;
            height: 30px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 900;
            font-size: 13px;
            border: 3px solid rgba(255,255,255,0.3);
            box-shadow: 0 4px 12px rgba(0,0,0,0.4);
            transform: translate(-15px, -15px);
        ">${number}</div>`,
        iconSize: [0, 0],
        iconAnchor: [0, 0]
    });
};

// Haversine Distance Helper (meters)
const calculateHaversine = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

// Sortable Item Component
function SortableItem(props: any) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
    } = useSortable({ id: props.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="touch-none">
            {props.children}
        </div>
    );
}

// Map Component to handle fitting bounds
function MapBounds({ points }: { points: { lat: number; lng: number }[] }) {
    const map = useMap();

    useMemo(() => {
        if (points.length > 0) {
            const bounds = L.latLngBounds(points.map(p => [p.lat, p.lng]));
            map.fitBounds(bounds, { padding: [50, 50] });
        }
    }, [points, map]);

    return null;
}

export default function Roteirizacao() {
    const { locais, motoristas, viaturas, saveRoute, registerLog, rotasPlaneadas, updateRouteStatus, vehicleMetrics } = useWorkshop();
    const { currentUser } = useAuth();

    const [selectedMotorista, setSelectedMotorista] = useState('');
    const [selectedViatura, setSelectedViatura] = useState('');
    const [routeStops, setRouteStops] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [geocodeResults, setGeocodeResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    const searchDebounceRef = useRef<any>(null);
    const [activeTab, setActiveTab] = useState<'locais' | 'geofences' | 'ativas'>('locais');
    const [isSaving, setIsSaving] = useState(false);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    // Initial Center (Lisbon)
    const defaultCenter: [number, number] = [38.7223, -9.1393];

    // Summary Calculation
    const summary = useMemo(() => {
        if (routeStops.length < 2) return { distance: 0, time: 0, fuel: 0, cost: 0 };

        let totalMeters = 0;
        for (let i = 0; i < routeStops.length - 1; i++) {
            totalMeters += calculateHaversine(
                routeStops[i].lat, routeStops[i].lng,
                routeStops[i + 1].lat, routeStops[i + 1].lng
            );
        }

        const distanceKm = totalMeters / 1000;
        const timeMins = (distanceKm / 45) * 60; // 45km/h avg
        const fuelLiters = (distanceKm / 100) * 8.5; // 8.5L/100km avg
        const costEur = fuelLiters * 1.62; // 1.62€/L

        return {
            distance: distanceKm,
            time: timeMins,
            fuel: fuelLiters,
            cost: costEur
        };
    }, [routeStops]);

    // Fuel Validation Logic
    const fuelAlert = useMemo(() => {
        if (!selectedViatura || summary.distance === 0) return null;
        const metrics = vehicleMetrics.find(m => m.vehicleId === selectedViatura);
        if (!metrics) return null;

        // estimativaAutonomia is in KM.
        if (summary.distance > metrics.estimativaAutonomia) {
            return {
                severity: 'high',
                message: `Combustível Insuficiente! Autonomia est. ${Math.round(metrics.estimativaAutonomia)}km vs Rota ${Math.round(summary.distance)}km.`
            };
        } else if (summary.distance > metrics.estimativaAutonomia * 0.8) {
            return {
                severity: 'medium',
                message: `Aviso: Reserva próxima. Autonomia est. ${Math.round(metrics.estimativaAutonomia)}km.`
            };
        }
        return null;
    }, [selectedViatura, summary.distance, vehicleMetrics]);

    // --- LOGIC ---

    const handleAddStop = (item: any, type: 'local' | 'geofence') => {
        // Avoid duplicates? Maybe allow duplicates for complex routes.
        // For now, simple unique ID generation based on timestamp to allow duplicate locations
        const newStop = {
            id: crypto.randomUUID(),
            sourceId: item.id,
            name: type === 'local' ? item.nome : item.name,
            lat: type === 'local' ? item.latitude : (item.center?.lat || 0), // Geofences need center logic separately if not pre-calc
            lng: type === 'local' ? item.longitude : (item.center?.lng || 0),
            type: type,
            original: item
        };

        // For Geofences, if we don't have lat/lng directly on the object from context, we might need to parse WKT or rely on center properties if added.
        // Assuming geofences might NOT have center props yet.
        // If geofence data from Cartrack doesn't include lat/lng center, we can't map it easily without parsing the polygon.
        // Let's assume for now Locais are the primary verified points, and Geofences are secondary if they have coords.
        // If geofence has no coords, skip or warn.

        if (!newStop.lat || !newStop.lng) {
            // Fallback for demo/safety if geofence structure varies
            // Assuming user uses "Locais" primarily for routing stops as they are points.
            // If a Geofence is selected (which is usually a polygon), we'd need its centroid.
            // For this implementation, I'll focus on 'locais' which are points. 
            // If 'geofences' are needed, I'd check if they have center properties.
        }

        setRouteStops([...routeStops, newStop]);
    };

    const handleRemoveStop = (id: string) => {
        setRouteStops(routeStops.filter(s => s.id !== id));
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            setRouteStops((items) => {
                const oldIndex = items.findIndex((i) => i.id === active.id);
                const newIndex = items.findIndex((i) => i.id === over.id);
                return arrayMove(items, oldIndex, newIndex);
            });
        }
    };

    const handleOptimize = () => {
        if (routeStops.length < 3) return; // Nothing to optimize if just Start/End or less

        // Simple Nearest Neighbor
        // 1. Keep the first point as fixed Start.
        // 2. Find nearest unvisited point.
        // 3. Repeat.

        const optimized = [routeStops[0]];
        let remaining = [...routeStops.slice(1)];

        let current = optimized[0];

        while (remaining.length > 0) {
            let nearest: any = null;
            let minDist = Infinity;
            let nearestIdx = -1;

            remaining.forEach((stop, idx) => {
                const d = Math.sqrt(
                    Math.pow(stop.lat - current.lat, 2) +
                    Math.pow(stop.lng - current.lng, 2)
                );
                if (d < minDist) {
                    minDist = d;
                    nearest = stop;
                    nearestIdx = idx;
                }
            });

            if (nearest) {
                optimized.push(nearest);
                current = nearest;
                remaining.splice(nearestIdx, 1);
            } else {
                break;
            }
        }

        setRouteStops(optimized);
    };

    const handleExportGoogleMaps = () => {
        if (routeStops.length === 0) return;

        const baseUrl = "https://www.google.com/maps/dir/?api=1";

        const origin = `${routeStops[0].lat},${routeStops[0].lng}`;

        let destination = "";
        let waypoints = "";

        if (routeStops.length > 1) {
            const last = routeStops[routeStops.length - 1];
            destination = `&destination=${last.lat},${last.lng}`;
        } else {
            // Just one point? navigate to it
            window.open(`https://www.google.com/maps/search/?api=1&query=${origin}`, '_blank');
            return;
        }

        if (routeStops.length > 2) {
            const stops = routeStops.slice(1, routeStops.length - 1);
            waypoints = `&waypoints=${stops.map(s => `${s.lat},${s.lng}`).join('|')}`;
        }

        const fullUrl = `${baseUrl}&origin=${origin}${destination}${waypoints}&travelmode=driving`;
        window.open(fullUrl, '_blank');
    };

    const handleExportWaze = () => {
        // Waze usually takes lat,lon to navigate to. It supports a list but it's trickier web-wise.
        // Usually we just open the first or optimized sequence via external links/universal links.
        // For now, we'll focus on Google Maps as requested primarily, but Waze can just be a "Navigate to Next" feature.
        // Or simple search.
        if (routeStops.length === 0) return;
        // Just open location of first stop?
        // Waze deep link: https://waze.com/ul?ll=LAT,LON&navigate=yes
        const first = routeStops[0];
        window.open(`https://waze.com/ul?ll=${first.lat},${first.lng}&navigate=yes`, '_blank');
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
                    detalhes_json: {
                        paragens: routeStops.length,
                        distancia: summary.distance,
                        motorista_id: selectedMotorista,
                        viatura_id: selectedViatura
                    }
                });
                alert('Rota guardada com sucesso!');
            } else {
                throw new Error('Falha ao guardar rota');
            }
        } catch (error) {
            console.error('Save Route Error:', error);
            alert('Erro ao guardar rota.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleFinalizeRoute = async (routeId: string, plannedDist: number) => {
        const realDist = prompt(`Distância Real Percorrida (KM) para a rota de ${plannedDist.toFixed(1)}KM:`, plannedDist.toFixed(1));
        if (realDist === null) return;

        const distance = parseFloat(realDist);
        const deviation = Math.abs(distance - plannedDist) / plannedDist;
        let justification = '';

        if (deviation > 0.25) {
            justification = prompt('Desvio superior a 25% detetado. Por favor, introduza uma justificação obrigatória:', '') || '';
            if (!justification) {
                alert('Justificação é obrigatória para desvios superiores a 25%.');
                return;
            }
        }

        try {
            await updateRouteStatus(routeId, 'concluida', distance, justification);
            await registerLog({
                utilizador: currentUser?.email || 'Sistema',
                acao: 'CONCLUIR_ROTA',
                referencia_id: routeId,
                detalhes_json: {
                    distancia_planeada: plannedDist,
                    distancia_real: distance,
                    desvio: (deviation * 100).toFixed(1) + '%',
                    justificacao: justification
                }
            });
            alert('Rota concluída com sucesso!');
        } catch (error) {
            alert('Erro ao concluir rota.');
        }
    };

    // Filtered lists
    const filteredLocais = locais.filter(l => l.nome.toLowerCase().includes(searchTerm.toLowerCase()));
    const activeRoutes = rotasPlaneadas.filter(r => r.estado === 'planeada');

    // Geocoding search handler
    const handleSearchChange = (value: string) => {
        setSearchTerm(value);
        setShowDropdown(value.length > 1);
        if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
        if (value.length < 3) { setGeocodeResults([]); return; }
        setIsSearching(true);
        searchDebounceRef.current = setTimeout(async () => {
            try {
                const res = await fetch(
                    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(value)}&limit=5&countrycodes=pt&accept-language=pt`,
                    { headers: { 'Accept-Language': 'pt' } }
                );
                const data = await res.json();
                setGeocodeResults(data);
            } catch (e) {
                setGeocodeResults([]);
            } finally {
                setIsSearching(false);
            }
        }, 500);
    };

    const handleAddGeocodedStop = (result: any) => {
        const stop = {
            id: `geo-${Date.now()}`,
            name: result.display_name.split(',').slice(0, 2).join(',').trim(),
            lat: parseFloat(result.lat),
            lng: parseFloat(result.lon),
            type: result.type || 'local'
        };
        setRouteStops(prev => [...prev, stop]);
        setSearchTerm('');
        setGeocodeResults([]);
        setShowDropdown(false);
    };

    return (
        <div className="flex h-full bg-[#0a0a0f] text-slate-200 overflow-hidden">
            {/* LEFT SIDEBAR: Controls */}
            <div className="w-[400px] flex flex-col border-r border-white/5 bg-[#161625] shadow-2xl z-10">
                {/* Header */}
                <div className="p-6 border-b border-white/5 bg-[#0a0a0f]">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-purple-600 rounded-lg shadow-[0_0_20px_rgba(147,51,234,0.3)]">
                            <Navigation className="w-6 h-6 text-slate-900" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight">Roteirização</h1>
                            <p className="text-[10px] text-purple-400 font-bold uppercase tracking-widest">Otimizador de Rotas</p>
                        </div>
                    </div>

                    {/* Selection Controls */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Motorista</label>
                            <select
                                className="w-full bg-[#161625] border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-purple-500 transition-all cursor-pointer"
                                value={selectedMotorista}
                                onChange={(e) => setSelectedMotorista(e.target.value)}
                            >
                                <option value="">Nenhum</option>
                                {motoristas.map(m => (
                                    <option key={m.id} value={m.id}>{m.nome}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Viatura</label>
                            <select
                                className="w-full bg-[#161625] border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-purple-500 transition-all cursor-pointer"
                                value={selectedViatura}
                                onChange={(e) => setSelectedViatura(e.target.value)}
                            >
                                <option value="">Nenhuma</option>
                                {viaturas.map(v => (
                                    <option key={v.id} value={v.id}>{v.matricula}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Route Builder List */}
                <div className="flex-1 flex flex-col p-4 overflow-hidden">
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <MapPin className="w-3 h-3" />
                            Paragens da Rota ({routeStops.length})
                        </h3>
                        {routeStops.length > 0 && (
                            <button onClick={() => setRouteStops([])} className="text-[10px] text-red-400 hover:text-red-300 font-bold uppercase hover:underline">
                                Limpar
                            </button>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#0a0a0f] rounded-2xl border border-white/5 p-2 space-y-2 mb-4">
                        {routeStops.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-600 space-y-3 opacity-50">
                                <Search className="w-8 h-8" />
                                <p className="text-xs font-bold text-center px-6">Adicione locais do mapa ou da lista abaixo para criar uma rota.</p>
                            </div>
                        ) : (
                            <DndContext
                                sensors={sensors}
                                collisionDetection={closestCenter}
                                onDragEnd={handleDragEnd}
                            >
                                <SortableContext items={routeStops} strategy={verticalListSortingStrategy}>
                                    {routeStops.map((stop, index) => (
                                        <SortableItem key={stop.id} id={stop.id}>
                                            <div className="group bg-[#1e293b] border border-white/5 p-3 rounded-xl flex items-center gap-3 cursor-grab active:cursor-grabbing hover:border-purple-500/30 transition-all">
                                                <div className="cursor-grab text-slate-600 group-hover:text-slate-400">
                                                    <GripVertical className="w-4 h-4" />
                                                </div>
                                                <div className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-[10px] font-black border border-purple-500/20 shrink-0">
                                                    {index + 1}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-xs font-bold text-slate-900 truncate">{stop.name}</div>
                                                    <div className="text-[9px] text-slate-500 uppercase tracking-wider">{stop.type}</div>
                                                </div>
                                                <button
                                                    onClick={() => handleRemoveStop(stop.id)}
                                                    className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </SortableItem>
                                    ))}
                                </SortableContext>
                            </DndContext>
                        )}
                    </div>

                    <div className="flex flex-col gap-2 shrink-0">
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={handleOptimize}
                                disabled={routeStops.length < 3}
                                className="flex items-center justify-center gap-2 p-3 bg-[#1e293b] hover:bg-[#2d3b55] border border-white/10 rounded-xl transition-all disabled:opacity-50 group"
                            >
                                <RefreshCw className="w-4 h-4 text-purple-400 group-hover:rotate-180 transition-transform" />
                                <span className="text-[10px] font-black text-slate-900 uppercase">Otimizar</span>
                            </button>

                            <button
                                onClick={handleSaveRoute}
                                disabled={routeStops.length < 2 || isSaving}
                                className="flex items-center justify-center gap-2 p-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-all disabled:opacity-50"
                            >
                                <Save className="w-4 h-4 text-slate-900" />
                                <span className="text-[10px] font-black text-slate-900 uppercase">{isSaving ? 'A guardar...' : 'Guardar'}</span>
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={handleExportGoogleMaps}
                                disabled={routeStops.length === 0}
                                className="flex items-center justify-center gap-2 p-3 bg-blue-600 hover:bg-blue-500 rounded-xl transition-all disabled:opacity-50"
                            >
                                <Navigation className="w-4 h-4 text-slate-900" />
                                <span className="text-[10px] font-black text-slate-900 uppercase">Google Maps</span>
                            </button>

                            <button
                                onClick={handleExportWaze}
                                disabled={routeStops.length === 0}
                                className="flex items-center justify-center gap-2 p-3 bg-[#33ccff] hover:bg-[#2bbbdd] rounded-xl transition-all disabled:opacity-50"
                            >
                                <Navigation className="w-4 h-4 text-slate-900 rotate-45" />
                                <span className="text-[10px] font-black text-[#1e293b] uppercase">Waze</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Locations Picker */}
                <div className="h-1/3 border-t border-white/5 bg-[#0a0a0f] flex flex-col">
                    <div className="p-3 border-b border-white/5 flex gap-1">
                        <button
                            onClick={() => setActiveTab('locais')}
                            className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${activeTab === 'locais' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-900'}`}
                        >
                            Locais
                        </button>
                        <button
                            onClick={() => setActiveTab('ativas')}
                            className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all relative ${activeTab === 'ativas' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-900'}`}
                        >
                            Ativas
                            {activeRoutes.length > 0 && (
                                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-purple-600 text-[8px] flex items-center justify-center font-black animate-bounce shadow-lg shadow-purple-600/50">
                                    {activeRoutes.length}
                                </span>
                            )}
                        </button>
                        <button
                            disabled
                            className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all opacity-30 cursor-not-allowed`}
                            title="Em breve"
                        >
                            Zonas
                        </button>
                    </div>
                    <div className="p-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <input
                                type="text"
                                placeholder="Procurar local, hotel, aeroporto..."
                                className="w-full bg-[#161625] border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                                value={searchTerm}
                                onChange={e => handleSearchChange(e.target.value)}
                                onFocus={() => searchTerm.length > 1 && setShowDropdown(true)}
                                onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                            />
                            {isSearching && (
                                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                    <div className="w-3 h-3 border border-purple-400 border-t-transparent rounded-full animate-spin" />
                                </div>
                            )}
                            {/* Dropdown com resultados geocoding */}
                            {showDropdown && (filteredLocais.length > 0 || geocodeResults.length > 0) && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-[#1e293b] border border-white/10 rounded-xl overflow-hidden z-50 shadow-2xl">
                                    {filteredLocais.slice(0, 3).map(local => (
                                        <button
                                            key={local.id}
                                            onMouseDown={() => { handleAddStop(local, 'local'); setShowDropdown(false); setSearchTerm(''); }}
                                            className="w-full text-left px-3 py-2 hover:bg-purple-500/20 flex items-center gap-2 transition-colors border-b border-white/5"
                                        >
                                            <span className="text-purple-400 text-[10px]">📍</span>
                                            <div>
                                                <div className="text-xs text-slate-900 font-bold">{local.nome}</div>
                                                <div className="text-[9px] text-slate-500">POI Guardado • {local.tipo}</div>
                                            </div>
                                        </button>
                                    ))}
                                    {geocodeResults.map((result, i) => (
                                        <button
                                            key={i}
                                            onMouseDown={() => handleAddGeocodedStop(result)}
                                            className="w-full text-left px-3 py-2 hover:bg-blue-500/20 flex items-center gap-2 transition-colors border-b border-white/5 last:border-0"
                                        >
                                            <span className="text-blue-400 text-[10px]">🌍</span>
                                            <div className="min-w-0">
                                                <div className="text-xs text-slate-900 font-bold truncate">{result.display_name.split(',').slice(0, 2).join(',')}</div>
                                                <div className="text-[9px] text-slate-500 truncate">{result.display_name.split(',').slice(2, 4).join(',')}</div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-3 pt-0 space-y-2">
                        {activeTab === 'locais' && filteredLocais.map(local => (
                            <button
                                key={local.id}
                                onClick={() => handleAddStop(local, 'local')}
                                className="w-full text-left p-3 rounded-xl bg-[#1e293b]/50 border border-white/5 hover:bg-[#1e293b] hover:border-purple-500/50 flex justify-between items-center group transition-all"
                            >
                                <div className="min-w-0">
                                    <div className="text-xs font-bold text-slate-900 truncate group-hover:text-purple-300">{local.nome}</div>
                                    <div className="text-[9px] text-slate-500 capitalize">{local.tipo}</div>
                                </div>
                                <div className="p-1.5 rounded-lg bg-white/5 text-slate-400 group-hover:bg-purple-500 group-hover:text-slate-900 transition-all">
                                    <ArrowRight className="w-3 h-3" />
                                </div>
                            </button>
                        ))}

                        {activeTab === 'ativas' && activeRoutes.map(route => {
                            const motorista = motoristas.find(m => m.id === route.motorista_id);
                            const viatura = viaturas.find(v => v.id === route.viatura_id);
                            return (
                                <div
                                    key={route.id}
                                    className="w-full p-3 rounded-xl bg-[#1e293b]/30 border border-white/5 space-y-3"
                                >
                                    <div className="flex justify-between items-start">
                                        <div className="min-w-0">
                                            <div className="text-[10px] font-black text-slate-900 truncate uppercase tracking-tight">{route.data}</div>
                                            <div className="text-[9px] text-slate-500 flex items-center gap-1">
                                                <Car className="w-3 h-3" /> {viatura?.matricula || 'N/A'} • {motorista?.nome || 'N/A'}
                                            </div>
                                        </div>
                                        <div className="px-2 py-1 rounded bg-purple-500/20 text-purple-400 text-[8px] font-black uppercase tracking-widest border border-purple-500/20">
                                            {route.distancia_estimada.toFixed(0)}km
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => handleFinalizeRoute(route.id, route.distancia_estimada)}
                                        className="w-full py-2 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-slate-900 text-[10px] font-black uppercase tracking-widest rounded-lg border border-emerald-600/20 transition-all flex items-center justify-center gap-2"
                                    >
                                        <CheckCircle2 className="w-3 h-3" />
                                        Concluir Rota
                                    </button>
                                </div>
                            );
                        })}

                        {activeTab === 'ativas' && activeRoutes.length === 0 && (
                            <div className="h-32 flex flex-col items-center justify-center text-slate-600 space-y-2 opacity-50">
                                <History className="w-6 h-6" />
                                <p className="text-[10px] uppercase font-black">Nenhuma rota ativa</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* RIGHT MAP AREA */}
            <div className="flex-1 relative bg-[#0b1120]">
                <MapContainer
                    center={defaultCenter}
                    zoom={12}
                    className="h-full w-full outline-none"
                >
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                    />

                    {/* Draw Route Polyline */}
                    {routeStops.length > 1 && (
                        <Polyline
                            positions={routeStops.map(s => [s.lat, s.lng])}
                            color="#9333ea"
                            weight={4}
                            opacity={0.7}
                            dashArray="10, 10"
                        />
                    )}

                    {/* Markers for Route Stops */}
                    {routeStops.map((stop, index) => (
                        <Marker
                            key={stop.id}
                            position={[stop.lat, stop.lng]}
                            icon={createNumberedIcon(index + 1, index === routeStops.length - 1, index === 0)}
                        >
                            <Popup>
                                <div className="p-1">
                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Paragem {index + 1}</div>
                                    <div className="text-sm font-bold text-slate-800">{stop.name}</div>
                                </div>
                            </Popup>
                        </Marker>
                    ))}

                    {/* Map Bounds Adjuster */}
                    <MapBounds points={routeStops} />

                </MapContainer>

                {/* Floating Summary & Alerts */}
                <div className="absolute top-6 right-6 z-[1000] flex flex-col gap-3 items-end max-w-sm">
                    {/* Fuel Alert */}
                    {fuelAlert && (
                        <div className={`flex items-center gap-3 p-4 rounded-2xl border backdrop-blur-xl animate-in slide-in-from-right duration-500 shadow-2xl ${fuelAlert.severity === 'high'
                            ? 'bg-red-600/90 border-red-500/50 text-white'
                            : 'bg-yellow-600/90 border-yellow-500/50 text-white'
                            }`}>
                            <AlertCircle className={`w-5 h-5 shrink-0 ${fuelAlert.severity === 'high' ? 'animate-pulse' : ''}`} />
                            <div className="text-xs font-black uppercase tracking-tight leading-tight">
                                {fuelAlert.message}
                            </div>
                        </div>
                    )}

                    <div className="bg-black/90 backdrop-blur-xl p-5 rounded-2xl border border-white/10 shadow-2xl min-w-[280px]">
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Resumo do Percurso</span>
                            <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <div className="text-[9px] font-bold text-slate-500 uppercase mb-1">Distância</div>
                                <div className="text-xl font-black text-slate-900 font-mono">{summary.distance.toFixed(1)}<span className="text-xs text-slate-500 ml-1">KM</span></div>
                            </div>
                            <div>
                                <div className="text-[9px] font-bold text-slate-500 uppercase mb-1">Tempo Est.</div>
                                <div className="text-xl font-black text-slate-900 font-mono">{Math.round(summary.time)}<span className="text-xs text-slate-500 ml-1">MIN</span></div>
                            </div>
                            <div className="pt-2 border-t border-white/5">
                                <div className="text-[9px] font-bold text-slate-500 uppercase mb-1">Consumo</div>
                                <div className="text-lg font-black text-yellow-500 font-mono">{summary.fuel.toFixed(1)}<span className="text-xs text-slate-500 ml-1">L</span></div>
                            </div>
                            <div className="pt-2 border-t border-white/5">
                                <div className="text-[9px] font-bold text-slate-500 uppercase mb-1">Custo Est.</div>
                                <div className="text-lg font-black text-emerald-400 font-mono">{summary.cost.toFixed(2)}<span className="text-xs text-slate-500 ml-1">€</span></div>
                            </div>
                        </div>

                        {routeStops.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                                <div className="flex -space-x-2">
                                    {routeStops.slice(0, 3).map((s, i) => (
                                        <div key={i} className="w-6 h-6 rounded-full bg-slate-100 border-2 border-black flex items-center justify-center text-[8px] font-black text-slate-900 uppercase">
                                            {s.name.slice(0, 1)}
                                        </div>
                                    ))}
                                    {routeStops.length > 3 && (
                                        <div className="w-6 h-6 rounded-full bg-slate-100 border-2 border-black flex items-center justify-center text-[8px] font-black text-slate-900 uppercase">
                                            +{routeStops.length - 3}
                                        </div>
                                    )}
                                </div>
                                <span className="text-[9px] font-bold text-slate-500 uppercase">{routeStops.length} Paragens</span>
                            </div>
                        )}
                    </div>

                    <div className="bg-purple-600/20 backdrop-blur-md px-4 py-2 rounded-full border border-purple-500/30">
                        <span className="text-[9px] font-black text-purple-300 uppercase tracking-widest">Modo Planeamento Ativo</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
