
import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Navigation, MapPin, Compass, Clock, Map as MapIcon, ChevronLeft, LocateFixed, Search, ArrowRight } from 'lucide-react';
import type { CartrackGeofence } from '../../services/cartrack';

interface NavigationAppProps {
    driverLocation?: [number, number];
    destination?: string;
    geofences?: CartrackGeofence[];
    onBack: () => void;
}

// Map Updater Component
function MapController({ center, followMe }: { center: [number, number], followMe: boolean }) {
    const map = useMap();
    useEffect(() => {
        if (followMe) {
            map.flyTo(center, 16, { animate: true, duration: 1.5 });
        }
    }, [center, followMe, map]);
    return null;
}

export default function NavigationApp({ driverLocation = [38.7223, -9.1393], destination: initialDestination, geofences = [], onBack }: NavigationAppProps) {
    const [route, setRoute] = useState<[number, number][]>([]);
    const [destCoords, setDestCoords] = useState<[number, number] | null>(null);
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState({ distance: 0, duration: 0 });
    const [followMe, setFollowMe] = useState(true);

    // Selection State
    const [destinationName, setDestinationName] = useState(initialDestination || '');
    const [showSelection, setShowSelection] = useState(!initialDestination);
    const [searchTerm, setSearchTerm] = useState('');

    // Filter Geofences
    const filteredGeofences = geofences.filter(g =>
        g.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
        g.latitude && g.longitude
    );

    const handleSelectGeofence = (geo: CartrackGeofence) => {
        if (geo.latitude && geo.longitude) {
            setDestCoords([Number(geo.latitude), Number(geo.longitude)]);
            setDestinationName(geo.name);
            setShowSelection(false);
        }
    };

    // Geocode destination and fetch route
    useEffect(() => {
        if (!destCoords && !destinationName) return;

        const calculateRoute = async () => {
            setLoading(true);
            try {
                let targetCoords = destCoords;

                // If we have a name but no coords (passed via prop but not matched yet), try to find in geofences first
                if (!targetCoords && destinationName) {
                    const match = geofences.find(g => g.name.toLowerCase() === destinationName.toLowerCase());
                    if (match && match.latitude && match.longitude) {
                        targetCoords = [Number(match.latitude), Number(match.longitude)];
                        setDestCoords(targetCoords);
                    } else {
                        // Fallback: Geocode
                        const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(destinationName + ', Portugal')}`);
                        const geoData = await geoRes.json();
                        if (geoData && geoData[0]) {
                            targetCoords = [parseFloat(geoData[0].lat), parseFloat(geoData[0].lon)];
                            setDestCoords(targetCoords);
                        }
                    }
                }

                if (targetCoords) {
                    // Fetch Route from OSRM
                    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${driverLocation[1]},${driverLocation[0]};${targetCoords[1]},${targetCoords[0]}?overview=full&geometries=geojson`;
                    const routeRes = await fetch(osrmUrl);
                    const routeData = await routeRes.json();

                    if (routeData.routes && routeData.routes[0]) {
                        const coords = routeData.routes[0].geometry.coordinates.map((c: any) => [c[1], c[0]]);
                        setRoute(coords);
                        setStats({
                            distance: routeData.routes[0].distance / 1000, // km
                            duration: routeData.routes[0].duration / 60 // min
                        });

                        // Fit bounds if generic view
                        // ...
                    }
                }
            } catch (error) {
                console.error('Navigation Error:', error);
            } finally {
                setLoading(false);
            }
        };

        calculateRoute();
    }, [destinationName, destCoords, driverLocation, geofences]);

    const carIcon = L.divIcon({
        className: 'navigation-car-icon',
        html: `
            <div style="background: #3b82f6; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 15px rgba(59, 130, 246, 0.5); position: relative;">
                <div style="position: absolute; top: -10px; left: 50%; transform: translateX(-50%); width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-bottom: 10px solid #3b82f6;"></div>
            </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
    });

    const destIcon = L.divIcon({
        className: 'navigation-dest-icon',
        html: `
            <div style="background: #ef4444; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 15px rgba(239, 68, 68, 0.5); display: flex; align-items: center; justify-content: center;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
            </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
    });

    // Google Maps Deep Link
    const openGoogleMaps = () => {
        if (destCoords) {
            window.open(`https://www.google.com/maps/dir/?api=1&destination=${destCoords[0]},${destCoords[1]}`, '_blank');
        } else if (destinationName) {
            window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destinationName + ', Portugal')}`, '_blank');
        }
    };

    return (
        <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col font-sans overflow-hidden">
            {/* Top HUD - Next Step */}
            <div className="absolute top-6 left-1/2 -translate-x-1/2 w-[90%] md:w-[400px] z-[110]">
                <div className="bg-slate-900/90 backdrop-blur-xl border border-blue-500/20 rounded-2xl p-4 shadow-2xl flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/40 shrink-0">
                        <Navigation className="w-7 h-7 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-blue-400 text-[10px] font-bold uppercase tracking-wider mb-0.5">Destino</p>
                        <button
                            onClick={() => setShowSelection(true)}
                            className="text-white font-bold text-lg leading-tight truncate hover:text-blue-400 transition-colors text-left w-full"
                        >
                            {destinationName || 'Selecionar Destino...'}
                        </button>
                    </div>
                    <button
                        onClick={onBack}
                        className="p-2 bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Map Area */}
            <div className="flex-1 relative">
                <MapContainer
                    center={driverLocation}
                    zoom={16}
                    zoomControl={false}
                    className="h-full w-full"
                >
                    <TileLayer
                        attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
                        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_labels_under/{z}/{x}/{y}{r}.png"
                    />
                    <MapController center={driverLocation} followMe={followMe} />

                    {route.length > 0 && (
                        <Polyline
                            positions={route}
                            pathOptions={{ color: '#3b82f6', weight: 6, opacity: 0.8, lineJoin: 'round' }}
                        />
                    )}

                    <Marker position={driverLocation} icon={carIcon} />

                    {destCoords && (
                        <Marker position={destCoords} icon={destIcon}>
                            <Popup>{destinationName}</Popup>
                        </Marker>
                    )}
                </MapContainer>

                {/* Loading Indicator */}
                {loading && (
                    <div className="absolute inset-0 bg-slate-950/20 backdrop-blur-sm z-[105] flex items-center justify-center pointer-events-none">
                        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent shadow-xl"></div>
                    </div>
                )}

                {/* Controls */}
                <div className="absolute right-4 bottom-32 z-[110] flex flex-col gap-3">
                    <button
                        onClick={() => setFollowMe(prev => !prev)}
                        className={`p-4 rounded-full shadow-2xl transition-all ${followMe ? 'bg-blue-600 text-white' : 'bg-slate-900 text-slate-400 border border-slate-700'}`}
                    >
                        <LocateFixed className="w-6 h-6" />
                    </button>
                </div>
            </div>

            {/* Bottom HUD - Stats */}
            <div className="bg-slate-900/90 backdrop-blur-2xl border-t border-slate-800 p-6 z-[110] pb-10 md:pb-6">
                <div className="max-w-md mx-auto grid grid-cols-3 gap-4">
                    <div className="text-center">
                        <div className="flex items-center justify-center gap-1.5 text-slate-400 mb-1">
                            <Clock className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-bold uppercase tracking-widest">Tempo</span>
                        </div>
                        <p className="text-white text-xl font-bold">{Math.round(stats.duration)} <span className="text-xs text-slate-500">min</span></p>
                    </div>

                    <div className="text-center border-x border-slate-800">
                        <div className="flex items-center justify-center gap-1.5 text-blue-400 mb-1">
                            <Compass className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-bold uppercase tracking-widest">Chegada</span>
                        </div>
                        <p className="text-white text-xl font-bold">
                            {new Date(Date.now() + stats.duration * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                    </div>

                    <div className="text-center">
                        <div className="flex items-center justify-center gap-1.5 text-slate-400 mb-1">
                            <MapPin className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-bold uppercase tracking-widest">Distância</span>
                        </div>
                        <p className="text-white text-xl font-bold">{stats.distance.toFixed(1)} <span className="text-xs text-slate-500">km</span></p>
                    </div>
                </div>

                <div className="mt-6 flex gap-3">
                    <button
                        onClick={onBack}
                        className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-2xl transition-colors flex items-center justify-center gap-2"
                    >
                        <MapIcon className="w-5 h-5" />
                        Sair
                    </button>
                    <button
                        onClick={openGoogleMaps}
                        className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl shadow-lg shadow-emerald-900/40 transition-colors flex items-center justify-center gap-2"
                    >
                        <Navigation className="w-5 h-5" />
                        Navegar (Google)
                    </button>
                </div>
            </div>

            {/* SELECTION OVERLAY */}
            {showSelection && (
                <div className="absolute inset-0 z-[120] bg-slate-950 flex flex-col p-6 animate-in slide-in-from-bottom duration-300">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-bold text-white">Onde queres ir?</h2>
                        {initialDestination || destinationName ? (
                            <button onClick={() => setShowSelection(false)} className="p-2 text-slate-400 hover:text-white">
                                <ChevronLeft className="w-6 h-6" />
                            </button>
                        ) : (
                            <button onClick={onBack} className="p-2 text-slate-400 hover:text-white">
                                <ChevronLeft className="w-6 h-6" />
                            </button>
                        )}
                    </div>

                    <div className="relative mb-6">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Pesquisar local ou zona..."
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-12 pr-4 py-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            autoFocus
                        />
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2">
                        <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 px-2">Geofences Disponíveis ({filteredGeofences.length})</div>
                        {filteredGeofences.map(geo => (
                            <button
                                key={geo.id}
                                onClick={() => handleSelectGeofence(geo)}
                                className="w-full flex items-center justify-between p-4 bg-slate-900/50 border border-slate-800 rounded-xl hover:bg-slate-800 hover:border-blue-500/30 transition-all group text-left"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                                        <MapPin className="w-5 h-5" />
                                    </div>
                                    <span className="font-bold text-white">{geo.name}</span>
                                </div>
                                <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-white transition-colors" />
                            </button>
                        ))}
                        {filteredGeofences.length === 0 && (
                            <div className="text-center py-10 text-slate-500">
                                Local não encontrado na lista.
                            </div>
                        )}
                    </div>
                </div>
            )}

            <style>{`
                .navigation-car-icon { background: none !important; border: none !important; }
                .navigation-dest-icon { background: none !important; border: none !important; }
                .leaflet-container { background: #020617 !important; }
            `}</style>
        </div>
    );
}
