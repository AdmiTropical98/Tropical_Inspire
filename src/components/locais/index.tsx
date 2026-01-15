import { MapContainer, TileLayer, Marker, Popup, Circle, useMap, useMapEvents, LayersControl } from 'react-leaflet';
// ... (imports remain)
import type { Local } from '../../types';

// ... (SearchResult interface remains consistent)

// Fix Leaflet Icons (remains)

// ... (Sub-components remain)

// ... (MapResizer, FlyToLocation remain)

// --- Main Component ---

export default function Locais() {
    const { locais, addLocal, deleteLocal, updateLocal } = useWorkshop();
    // ... (hooks remain)

    // ... (state remains)

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
                const response = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(searchTerm)}&limit=5&lang=pt`);

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

    // ... (handleSelectGlobalLocation, handleMapClick, handleSave, handleDelete remain)

    // ... (filteredLocais logic remains)

    // ... (JSX render - Header section remains)

    // ... (Dropdown logic remains)

    // ... (Sidebar List remains)

    {/* Map Area */ }
    <div className="flex-1 relative bg-slate-900 z-0">
        <MapContainer
            center={defaultCenter}
            zoom={12}
            className="h-full w-full outline-none"
        >
            <LayersControl position="topright">
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
            </div >
        </div >
    );
}
