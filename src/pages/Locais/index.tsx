import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap, useMapEvents, LayersControl } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import {
    MapPin, Plus, Trash2, Search, Navigation,
    Hotel, Plane, Wrench, Map as MapIcon, Save, X, Loader2, Globe, LayoutGrid,
    ArrowRight, Settings
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
    const {
        locais, addLocal, deleteLocal, updateLocal,
        centrosCustos,
        zonasOperacionais, addZonaOperacional, deleteZonaOperacional,
        areasOperacionais, addAreaOperacional, deleteAreaOperacional
    } = useWorkshop();

    const { userRole } = useAuth();
    const { hasAccess } = usePermissions();

    const [activeTab, setActiveTab] = useState<'map' | 'zones'>('map');
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
        centroCustoId: string;
    }>({
        nome: '',
        raio: 50,
        tipo: 'outros',
        cor: '#3b82f6',
        centroCustoId: ''
    });

    // Default Center (Lisbon)
    const defaultCenter: [number, number] = [37.1000, -8.3000]; // Algarve center as it's the main focus

    // Zone Form State
    const [zoneFormData, setZoneFormData] = useState({
        nome_local: '',
        area_operacional: ''
    });

    const [newAreaName, setNewAreaName] = useState('');
    const [isManagingAreas, setIsManagingAreas] = useState(false);


    const handleSaveZone = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!zoneFormData.nome_local || !zoneFormData.area_operacional) return;

        await addZonaOperacional({
            nome_local: zoneFormData.nome_local,
            area_operacional: zoneFormData.area_operacional
        });

        setZoneFormData({ nome_local: '', area_operacional: '' });
    };

    const handleAddArea = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newAreaName.trim()) return;
        await addAreaOperacional({ nome: newAreaName.trim() });
        setNewAreaName('');
    };


    const handleMapClick = (lat: number, lng: number) => {
        if (userRole !== 'admin') return;
        setNewLocalPos({ lat, lng });
        setIsCreating(true);
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
            cor: formData.cor,
            centroCustoId: formData.centroCustoId || undefined
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
            <div className="relative z-50 h-16 border-b border-white/5 flex items-center justify-between px-6 bg-[#0f172a]/80 backdrop-blur-md shrink-0">
                <div className="flex items-center gap-6">
                    <h1 className="text-xl font-bold text-white whitespace-nowrap">Gestão de Locais</h1>

                    <div className="flex bg-[#1e293b] p-1 rounded-xl border border-white/5 shrink-0">
                        <button
                            onClick={() => setActiveTab('map')}
                            className={`px-4 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'map' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                        >
                            <MapIcon className="w-4 h-4" />
                            Mapa (POIs)
                        </button>
                        <button
                            onClick={() => setActiveTab('zones')}
                            className={`px-4 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'zones' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                        >
                            <LayoutGrid className="w-4 h-4" />
                            Zonas Operacionais
                        </button>
                    </div>
                </div>

                <div className="relative w-80 z-[1001]">
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
                                    {filteredLocais.slice(0, 5).map(local => (
                                        <button
                                            key={local.id}
                                            onClick={() => {
                                                setSelectedLocation({ lat: local.latitude, lng: local.longitude });
                                                setSearchTerm('');
                                                setShowResults(false);
                                                setActiveTab('map');
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
                                        onClick={() => {
                                            handleSelectGlobalLocation(result);
                                            setActiveTab('map');
                                        }}
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
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-hidden">
                {activeTab === 'map' ? (
                    <div className="flex h-full overflow-hidden">
                        {/* Sidebar List */}
                        <div className="w-80 border-r border-white/5 bg-[#0b1120] flex flex-col shrink-0">
                            <div className="p-4 border-b border-white/5">
                                <p className="text-xs text-slate-400">
                                    Pressione no mapa para adicionar pontos de interesse.
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
                                                <div className="min-w-0">
                                                    <h3 className="font-bold text-white text-sm truncate">{local.nome}</h3>
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
                            </div>
                        </div>

                        {/* Map Area */}
                        <div className="flex-1 relative bg-slate-900 z-0">
                            <MapContainer
                                center={defaultCenter}
                                zoom={11}
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

                                {isCreating && newLocalPos && (
                                    <Marker position={[newLocalPos.lat, newLocalPos.lng]} />
                                )}
                            </MapContainer>

                            {/* Creation Modal */}
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
                                            <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Vincular a Centro de Custo</label>
                                            <select
                                                className="w-full bg-[#0b1120] border border-white/10 rounded-lg p-2 text-white text-sm outline-none"
                                                value={formData.centroCustoId}
                                                onChange={e => setFormData({ ...formData, centroCustoId: e.target.value })}
                                            >
                                                <option value="">Nenhum (Ponto Geral)</option>
                                                {centrosCustos.map(cc => (
                                                    <option key={cc.id} value={cc.id}>{cc.nome}</option>
                                                ))}
                                            </select>
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
                ) : (
                    <div className="flex h-full flex-col md:flex-row gap-6 p-6 bg-[#0b1120] overflow-y-auto">
                        {/* Zones Sidebar - Add/Edit */}
                        <div className="w-full md:w-96 bg-[#1e293b]/50 border border-white/5 rounded-3xl p-6 flex flex-col gap-6 shrink-0 h-fit">
                            <div>
                                <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                                    <Plus className="w-5 h-5 text-emerald-400" />
                                    Atribuir Local a Zona
                                </h2>
                                <p className="text-sm text-slate-400">Estabeleça a relação entre o nome do hotel (da folha de serviço) e a área operacional pretendida.</p>
                            </div>

                            <form onSubmit={handleSaveZone} className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase block mb-2">Nome do Local (Como aparece na folha)</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            required
                                            className="w-full bg-[#0f172a] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-emerald-500 outline-none"
                                            placeholder="Ex: Hilton Vilamoura"
                                            value={zoneFormData.nome_local}
                                            onChange={e => setZoneFormData({ ...zoneFormData, nome_local: e.target.value })}
                                        />
                                        {/* Suggestions */}
                                        {zoneFormData.nome_local.length > 1 && (
                                            <div className="absolute top-full left-0 right-0 mt-1 bg-[#0f172a] border border-white/10 rounded-xl shadow-2xl z-20 max-h-40 overflow-y-auto">
                                                {locais.filter(l => l.nome.toLowerCase().includes(zoneFormData.nome_local.toLowerCase())).map(l => (
                                                    <button
                                                        key={l.id}
                                                        type="button"
                                                        onClick={() => setZoneFormData({ ...zoneFormData, nome_local: l.nome })}
                                                        className="w-full text-left p-2 hover:bg-emerald-500/10 text-xs text-slate-400 hover:text-emerald-400 border-b border-white/5 last:border-0"
                                                    >
                                                        {l.nome}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-xs font-bold text-slate-400 uppercase">Área Operacional</label>
                                        <button
                                            type="button"
                                            onClick={() => setIsManagingAreas(!isManagingAreas)}
                                            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md transition-all ${isManagingAreas ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30' : 'bg-slate-800 text-slate-400 hover:text-white border border-white/5'}`}
                                        >
                                            {isManagingAreas ? 'Fechar Gestão' : 'Gerir Áreas'}
                                        </button>
                                    </div>

                                    {isManagingAreas ? (
                                        <div className="bg-slate-900/50 border border-white/5 rounded-xl p-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    placeholder="Nova área..."
                                                    className="flex-1 bg-[#0f172a] border border-white/10 rounded-lg px-3 py-2 text-white text-xs outline-none focus:border-emerald-500"
                                                    value={newAreaName}
                                                    onChange={e => setNewAreaName(e.target.value)}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={handleAddArea}
                                                    className="bg-emerald-600 hover:bg-emerald-500 text-white p-2 rounded-lg transition-all"
                                                >
                                                    <Plus className="w-4 h-4" />
                                                </button>
                                            </div>

                                            <div className="space-y-2 max-h-32 overflow-y-auto custom-scrollbar pr-1">
                                                {areasOperacionais.length > 0 ? areasOperacionais.map(area => (
                                                    <div key={area.id} className="flex items-center justify-between p-2 bg-slate-800/50 rounded-lg border border-white/5 group">
                                                        <span className="text-xs text-white truncate">{area.nome}</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => deleteAreaOperacional(area.id)}
                                                            className="text-slate-600 hover:text-red-400 p-1 transition-colors"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                )) : (
                                                    <div className="text-[10px] text-slate-500 text-center py-2 italic">Nenhuma área definida</div>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <select
                                            required
                                            className="w-full bg-[#0f172a] border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-emerald-500 appearance-none cursor-pointer"
                                            value={zoneFormData.area_operacional}
                                            onChange={e => setZoneFormData({ ...zoneFormData, area_operacional: e.target.value })}
                                        >
                                            <option value="">Selecionar zona...</option>
                                            {areasOperacionais.length > 0 ? areasOperacionais.map(area => (
                                                <option key={area.id} value={area.nome}>{area.nome}</option>
                                            )) : (
                                                <option disabled>Adicione áreas primeiro...</option>
                                            )}
                                        </select>
                                    )}
                                </div>

                                <button
                                    type="submit"
                                    disabled={isManagingAreas}
                                    className={`w-full font-bold py-3 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 ${isManagingAreas ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/20'}`}
                                >
                                    <Save className="w-4 h-4" />
                                    Guardar Mapeamento
                                </button>
                            </form>
                        </div>


                        {/* Zones List */}
                        <div className="flex-1 bg-[#1e293b]/30 border border-white/5 rounded-3xl overflow-hidden flex flex-col min-h-[400px]">
                            <div className="p-6 border-b border-white/5 flex items-center justify-between">
                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                    <LayoutGrid className="w-5 h-5 text-blue-400" />
                                    Mapeamentos Ativos
                                </h2>
                                <div className="text-xs text-slate-500 font-mono">{zonasOperacionais.length} Mapeamentos</div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 space-y-3 custom-scrollbar">
                                {zonasOperacionais.length > 0 ? zonasOperacionais.map(zona => (
                                    <div key={zona.id} className="group flex items-center justify-between p-4 bg-slate-900/50 border border-white/5 rounded-2xl hover:border-emerald-500/30 transition-all">
                                        <div className="flex items-center gap-4 min-w-0">
                                            <div className="p-3 bg-slate-800 rounded-xl text-slate-400 group-hover:text-emerald-400 transition-colors shrink-0">
                                                <Hotel className="w-5 h-5" />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="text-white font-bold truncate">{zona.nome_local}</div>
                                                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                                    <span className="shrink-0">Zona:</span>
                                                    <span className="text-emerald-400 font-bold uppercase tracking-wider truncate">{zona.area_operacional}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => deleteZonaOperacional(zona.id)}
                                            className="p-2 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all md:opacity-0 group-hover:opacity-100 shrink-0"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    </div>
                                )) : (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-4 opacity-50">
                                        <LayoutGrid className="w-16 h-16 animate-pulse" />
                                        <p className="font-medium text-center px-4">Nenhum mapeamento de zona definido.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
