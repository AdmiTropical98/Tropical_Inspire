import { useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import {
    MapPin, Search, Navigation, Layers,
    GripVertical, Trash2, RotateCcw, ArrowRight,
    Play, Save, CheckCircle2, RefreshCw
} from 'lucide-react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent
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
import { usePermissions } from '../../contexts/PermissionsContext';

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
    const { locais, motoristas, geofences, geofenceMappings } = useWorkshop();
    const { userRole } = useAuth();

    const [selectedMotorista, setSelectedMotorista] = useState('');
    const [routeStops, setRouteStops] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<'locais' | 'geofences'>('locais');

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    // Initial Center (Lisbon)
    const defaultCenter: [number, number] = [38.7223, -9.1393];

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

    // Filtered lists
    const filteredLocais = locais.filter(l => l.nome.toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <div className="flex h-full bg-[#0a0a0f] text-slate-200 overflow-hidden">
            {/* LEFT SIDEBAR: Controls */}
            <div className="w-[400px] flex flex-col border-r border-white/5 bg-[#161625] shadow-2xl z-10">
                {/* Header */}
                <div className="p-6 border-b border-white/5 bg-[#0a0a0f]">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-purple-600 rounded-lg shadow-[0_0_20px_rgba(147,51,234,0.3)]">
                            <Navigation className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-white uppercase tracking-tight">Roteirização</h1>
                            <p className="text-[10px] text-purple-400 font-bold uppercase tracking-widest">Otimizador de Rotas</p>
                        </div>
                    </div>

                    {/* Driver Selection */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Motorista (Opcional)</label>
                        <select
                            className="w-full bg-[#161625] border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-purple-500 transition-all cursor-pointer"
                            value={selectedMotorista}
                            onChange={(e) => setSelectedMotorista(e.target.value)}
                        >
                            <option value="">Selecione um motorista...</option>
                            {motoristas.filter(m => m.status === 'disponivel').map(m => (
                                <option key={m.id} value={m.id}>{m.nome}</option>
                            ))}
                        </select>
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
                                                    <div className="text-xs font-bold text-white truncate">{stop.name}</div>
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

                    {/* Action Buttons */}
                    <div className="grid grid-cols-2 gap-3 shrink-0">
                        <button
                            onClick={handleOptimize}
                            disabled={routeStops.length < 3}
                            className="flex flex-col items-center justify-center gap-1 p-3 bg-[#1e293b] hover:bg-[#2d3b55] border border-white/10 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                            title="Start point is fixed, others reordered"
                        >
                            <RefreshCw className="w-5 h-5 text-purple-400 group-hover:rotate-180 transition-transform duration-500" />
                            <span className="text-[10px] font-black text-white uppercase tracking-wider">Otimizar</span>
                        </button>

                        <button
                            onClick={handleExportGoogleMaps}
                            disabled={routeStops.length === 0}
                            className="flex flex-col items-center justify-center gap-1 p-3 bg-blue-600 hover:bg-blue-500 rounded-xl transition-all disabled:opacity-50 shadow-lg shadow-blue-600/20"
                        >
                            <Navigation className="w-5 h-5 text-white" />
                            <span className="text-[10px] font-black text-white uppercase tracking-wider">Google Maps</span>
                        </button>
                    </div>
                </div>

                {/* Locations Picker */}
                <div className="h-1/3 border-t border-white/5 bg-[#0a0a0f] flex flex-col">
                    <div className="p-3 border-b border-white/5 flex gap-2">
                        <button
                            onClick={() => setActiveTab('locais')}
                            className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'locais' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-white'}`}
                        >
                            Locais
                        </button>
                        <button
                            // Disable Geofences for now if no coords logic
                            disabled
                            onClick={() => setActiveTab('geofences')}
                            className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all opacity-50 cursor-not-allowed`}
                            title="WKT Parsing Required"
                        >
                            Geofences (Em Breve)
                        </button>
                    </div>
                    <div className="p-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <input
                                type="text"
                                placeholder="Procurar local..."
                                className="w-full bg-[#161625] border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-3 pt-0 space-y-2">
                        {filteredLocais.map(local => (
                            <button
                                key={local.id}
                                onClick={() => handleAddStop(local, 'local')}
                                className="w-full text-left p-3 rounded-xl bg-[#1e293b]/50 border border-white/5 hover:bg-[#1e293b] hover:border-purple-500/50 flex justify-between items-center group transition-all"
                            >
                                <div className="min-w-0">
                                    <div className="text-xs font-bold text-white truncate group-hover:text-purple-300">{local.nome}</div>
                                    <div className="text-[9px] text-slate-500 capitalize">{local.tipo}</div>
                                </div>
                                <div className="p-1.5 rounded-lg bg-white/5 text-slate-400 group-hover:bg-purple-500 group-hover:text-white transition-all">
                                    <ArrowRight className="w-3 h-3" />
                                </div>
                            </button>
                        ))}
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
                        >
                            <Popup>
                                <div className="font-bold">{index + 1}. {stop.name}</div>
                            </Popup>
                        </Marker>
                    ))}

                    {/* Map Bounds Adjuster */}
                    <MapBounds points={routeStops} />

                </MapContainer>

                {/* Floating Info */}
                <div className="absolute top-6 right-6 z-[1000]">
                    <div className="bg-black/80 backdrop-blur-xl p-4 rounded-2xl border border-white/10 shadow-2xl">
                        <div className="flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full bg-purple-500 animate-pulse" />
                            <span className="text-[10px] font-black text-white uppercase tracking-widest">Modo Planeamento</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
