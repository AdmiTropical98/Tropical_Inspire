import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap, useMapEvents, LayersControl } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import {
    MapPin, Plus, Trash2, Search, Navigation,
    Hotel, Plane, Wrench, Map as MapIcon, Save, X, Loader2, Globe
} from 'lucide-react';
import { useWorkshop } from '../../contexts/WorkshopContext';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../contexts/PermissionsContext';
import type { Local } from '../../types';

interface SearchResult {
    place_id: number;
    lat: string;
    lon: string;
    display_name: string;
    type: string;
}

// Fix Leaflet Icons
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// --- Sub-components ---

function MapClickEvents({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
    useMapEvents({
        click(e) {
            onMapClick(e.latlng.lat, e.latlng.lng);
        },
    });
    return null;
}

function MapResizer() {
    const map = useMap();
    useEffect(() => {
        const timer = setTimeout(() => map.invalidateSize(), 500);
        return () => clearTimeout(timer);
    }, [map]);
    return null;
}

function FlyToLocation({ location }: { location: { lat: number, lng: number } | null }) {
    const map = useMap();
    useEffect(() => {
        if (location) {
            map.flyTo([location.lat, location.lng], 16, { duration: 1.5 });
        }
    }, [location, map]);
    return null;
}

// --- Main Component ---

export default function Locais() {
    const { locais, addLocal, deleteLocal, updateLocal } = useWorkshop();
    const { userRole } = useAuth();
    const { hasAccess } = usePermissions();

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedLocation, setSelectedLocation] = useState<{ lat: number, lng: number } | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [newLocalPos, setNewLocalPos] = useState<{ lat: number, lng: number } | null>(null);

    // Geocoding State
    const [geoResults, setGeoResults] = useState<SearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showResults, setShowResults] = useState(false);

    // Search Effect (Debounced) - SWITCHED TO PHOTON
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (searchTerm.length < 3) {
                setGeoResults([]);
                return;
            }

            setIsSearching(true);
            try {
                // Using Photon (Komoot) -> Returns GeoJSON
                const response = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(searchTerm)}&limit=5`);

                if (!response.ok) {
                    throw new Error(`Photon API error: ${response.status}`);
                }

                const data = await response.json();
                console.log("Photon Results:", data);

                // Map GeoJSON features to our SearchResult interface
                if (data.features) {
                    const mappedResults: SearchResult[] = data.features.map((f: any) => ({
                        place_id: f.properties.osm_id || Math.random(),
                        lat: f.geometry.coordinates[1].toString(), // GeoJSON is [lon, lat]
                        lon: f.geometry.coordinates[0].toString(),
                        display_name: `${f.properties.name || ''} ${f.properties.street || ''} ${f.properties.city || ''} ${f.properties.country || ''}`.trim().replace(/\s+/g, ' '),
                        type: f.properties.osm_value || 'place'
                    }));
                    setGeoResults(mappedResults);
                } else {
                    setGeoResults([]);
                }

            } catch (err) {
                console.error("Geocoding error:", err);
                setGeoResults([]);
            } finally {
                setIsSearching(false);
            }
        }, 800);

        return () => clearTimeout(timer);
    }, [searchTerm]);

    const handleSelectGlobalLocation = (result: SearchResult) => {
        const lat = parseFloat(result.lat);
        const lng = parseFloat(result.lon);

        setSelectedLocation({ lat, lng });
        setSearchTerm('');
        setShowResults(false);
        setGeoResults([]);

        // Auto-trigger creation mode
        if (userRole === 'admin') {
            setNewLocalPos({ lat, lng });
            setIsCreating(true);
            setFormData(prev => ({ ...prev, nome: result.display_name.split(',')[0] }));
        }
    };

    // Form State
    const [formData, setFormData] = useState<{
        nome: string;
        raio: number;
        tipo: 'hotel' | 'aeroporto' | 'oficina' | 'outros';
        cor: string;
    }>({
        nome: '',
        raio: 50,
        tipo: 'outros',
        cor: '#3b82f6'
    });

    // Default Center (Lisbon)
    const defaultCenter: [number, number] = [38.7223, -9.1393];

    const handleMapClick = (lat: number, lng: number) => {
        if (userRole !== 'admin') return;
        setNewLocalPos({ lat, lng });
        setIsCreating(true);
        // Reset form but keep defaults
        setFormData({ ...formData, nome: '' });
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newLocalPos) return;

        await addLocal({
            id: crypto.randomUUID(),
            nome: formData.nome,
            latitude: newLocalPos.lat,
            longitude: newLocalPos.lng,
            raio: formData.raio,
            tipo: formData.tipo,
            cor: formData.cor
        });

        setIsCreating(false);
        setNewLocalPos(null);
    };

    const handleDelete = async (id: string) => {
        if (confirm('Tem a certeza que deseja eliminar este local?')) {
            await deleteLocal(id);
        }
    };

    const filteredLocais = locais.filter(l =>
        l.nome.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getIconForType = (tipo: string) => {
        switch (tipo) {
            case 'hotel': return <Hotel className="w-4 h-4" />;
            case 'aeroporto': return <Plane className="w-4 h-4" />;
            case 'oficina': return <Wrench className="w-4 h-4" />;
            default: return <MapPin className="w-4 h-4" />;
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#0f172a] text-slate-200">
            {/* Header */}
            <div className="relative z-50 h-16 border-b border-white/5 flex items-center justify-between px-6 bg-[#0f172a]/80 backdrop-blur-md">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-600/20 rounded-lg">
                        <MapIcon className="w-6 h-6 text-blue-400" />
                    </div>
                    <h1 className="text-xl font-bold text-white">Gestão de Locais (POIs)</h1>
                </div>

                <div className="relative w-72 z-[1001]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                        type="text"
                        placeholder="Procurar local ou morada..."
                        value={searchTerm}
                        onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setShowResults(true);
                        }}
                        onFocus={() => setShowResults(true)}
                        className="w-full bg-[#1e293b] border border-white/10 rounded-xl py-2 pl-9 pr-4 text-sm focus:outline-none focus:border-blue-500/50"
                    />

                    {/* Search Dropdown */}
                    {showResults && searchTerm.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-[#1e293b] border border-white/10 rounded-xl shadow-2xl overflow-hidden max-h-[400px] overflow-y-auto">
                            {/* Local Results */}
                            {filteredLocais.length > 0 && (
                                <div className="p-2">
                                    <div className="text-[10px] font-bold text-slate-500 uppercase px-2 mb-1">Meus Locais</div>
                                    {filteredLocais.slice(0, 3).map(local => (
                                        <button
                                            key={local.id}
                                            onClick={() => {
                                                setSelectedLocation({ lat: local.latitude, lng: local.longitude });
                                                setSearchTerm('');
                                                setShowResults(false);
                                            }}
                                            className="w-full text-left p-2 hover:bg-white/5 rounded-lg flex items-center gap-2 group"
                                        >
                                            <div className={`p-1.5 rounded-md ${local.tipo === 'aeroporto' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-blue-500/20 text-blue-400'}`}>
                                                {getIconForType(local.tipo)}
                                            </div>
                                            <span className="text-sm text-slate-200 truncate">{local.nome}</span>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Global Results */}
                            <div className="p-2 border-t border-white/10">
                                <div className="flex items-center justify-between px-2 mb-1">
                                    <div className="text-[10px] font-bold text-slate-500 uppercase">Resultados Globais</div>
                                    {isSearching && <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />}
                                </div>

                                {geoResults.map(result => (
                                    <button
                                        key={result.place_id}
                                        onClick={() => handleSelectGlobalLocation(result)}
                                        className="w-full text-left p-2 hover:bg-white/5 rounded-lg flex items-start gap-2"
                                    >
                                        <div className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-md mt-0.5">
                                            <Globe className="w-3.5 h-3.5" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm text-slate-200 font-medium truncate">{result.display_name.split(',')[0]}</div>
                                            <div className="text-xs text-slate-500 truncate">{result.display_name}</div>
                                        </div>
                                    </button>
                                ))}

                                {!isSearching && geoResults.length === 0 && searchTerm.length >= 3 && (
                                    <div className="text-center py-2 text-xs text-slate-500">
                                        Sem resultados externos.
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Sidebar List */}
                <div className="w-80 border-r border-white/5 bg-[#0b1120] flex flex-col">
                    <div className="p-4 border-b border-white/5">
                        <p className="text-xs text-slate-400">
                            Clique no mapa para adicionar um novo ponto. Estes locais serão usados para validação de escalas.
                        </p>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
                        {filteredLocais.map(local => (
                            <div
                                key={local.id}
                                onClick={() => setSelectedLocation({ lat: local.latitude, lng: local.longitude })}
                                className="p-3 rounded-xl bg-[#1e293b]/50 border border-white/5 hover:border-blue-500/30 hover:bg-[#1e293b] transition-all cursor-pointer group"
                            >
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg ${local.tipo === 'aeroporto' ? 'bg-indigo-500/20 text-indigo-400' : local.tipo === 'hotel' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'}`}>
                                            {getIconForType(local.tipo)}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-white text-sm">{local.nome}</h3>
                                            <p className="text-xs text-slate-400 capitalize">{local.tipo} • {local.raio}m</p>
                                        </div>
                                    </div>
                                    {userRole === 'admin' && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDelete(local.id); }}
                                            className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}

                        {filteredLocais.length === 0 && (
                            <div className="text-center py-8 text-slate-500 text-sm">
                                Nenhum local encontrado.
                            </div>
                        )}
                    </div>
                </div>

                {/* Map Area */}
                <div className="flex-1 relative bg-slate-900 z-0">
                    <MapContainer
                        center={defaultCenter}
                        zoom={12}
                        className="h-full w-full outline-none"
                    >
                        <LayersControl position="topright" collapsed={false}>
                            <LayersControl.BaseLayer checked name="Mapa Estrada">
                                <TileLayer
                                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                                    url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                                />
                            </LayersControl.BaseLayer>

                            <LayersControl.BaseLayer name="Satélite">
                                <TileLayer
                                    attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
                                    url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                                />
                            </LayersControl.BaseLayer>
                        </LayersControl>

                        <MapResizer />
                        <MapClickEvents onMapClick={handleMapClick} />
                        <FlyToLocation location={selectedLocation} />

                        {/* Render Locais */}
                        {locais.map(local => (
                            <Circle
                                key={local.id}
                                center={[local.latitude, local.longitude]}
                                radius={local.raio}
                                pathOptions={{ color: local.cor, fillColor: local.cor, fillOpacity: 0.2 }}
                            >
                                <Popup>
                                    <div className="font-bold">{local.nome}</div>
                                    <div className="text-xs capitalize">{local.tipo}</div>
                                </Popup>
                            </Circle>
                        ))}

                        {/* New Local Marker Preview */}
                        {isCreating && newLocalPos && (
                            <Marker position={[newLocalPos.lat, newLocalPos.lng]} />
                        )}
                    </MapContainer>

                    {/* Creation Modal (Overlay) */}
                    {isCreating && (
                        <div className="absolute top-4 right-4 w-80 bg-[#1e293b] border border-white/10 rounded-2xl shadow-2xl p-4 z-[1000] animate-in slide-in-from-right">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold text-white flex items-center gap-2">
                                    <Plus className="w-4 h-4 text-blue-400" />
                                    Novo Local
                                </h3>
                                <button onClick={() => { setIsCreating(false); setNewLocalPos(null); }} className="text-slate-400 hover:text-white">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <form onSubmit={handleSave} className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Nome</label>
                                    <input
                                        autoFocus
                                        type="text"
                                        required
                                        className="w-full bg-[#0b1120] border border-white/10 rounded-lg p-2 text-white text-sm focus:border-blue-500 outline-none"
                                        value={formData.nome}
                                        onChange={e => setFormData({ ...formData, nome: e.target.value })}
                                        placeholder="Ex: Aeroporto Faro"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Tipo</label>
                                        <select
                                            className="w-full bg-[#0b1120] border border-white/10 rounded-lg p-2 text-white text-sm outline-none"
                                            value={formData.tipo}
                                            onChange={e => setFormData({ ...formData, tipo: e.target.value as any })}
                                        >
                                            <option value="outros">Outros</option>
                                            <option value="aeroporto">Aeroporto</option>
                                            <option value="hotel">Hotel</option>
                                            <option value="oficina">Oficina</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Raio (m)</label>
                                        <input
                                            type="number"
                                            className="w-full bg-[#0b1120] border border-white/10 rounded-lg p-2 text-white text-sm outline-none"
                                            value={formData.raio}
                                            onChange={e => setFormData({ ...formData, raio: Number(e.target.value) })}
                                            min="10"
                                            max="5000"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Cor</label>
                                    <div className="flex gap-2">
                                        {['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'].map(c => (
                                            <button
                                                key={c}
                                                type="button"
                                                onClick={() => setFormData({ ...formData, cor: c })}
                                                className={`w-6 h-6 rounded-full border-2 ${formData.cor === c ? 'border-white scale-110' : 'border-transparent opacity-50 hover:opacity-100'}`}
                                                style={{ backgroundColor: c }}
                                            />
                                        ))}
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 rounded-lg transition-colors flex items-center justify-center gap-2 mt-2"
                                >
                                    <Save className="w-4 h-4" />
                                    Guardar Ponto
                                </button>
                            </form>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
