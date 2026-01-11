
import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Navigation, MapPin, Compass, Clock, Map as MapIcon, ChevronLeft, LocateFixed } from 'lucide-react';

interface NavigationAppProps {
    driverLocation?: [number, number];
    destination?: string;
    onBack: () => void;
}

// Map Updater Component
function MapController({ center, followMe }: { center: [number, number], followMe: boolean }) {
    const map = useMap();
    useEffect(() => {
        if (followMe) {
            map.flyTo(center, map.getZoom(), { animate: true, duration: 1.5 });
        }
    }, [center, followMe, map]);
    return null;
}

export default function NavigationApp({ driverLocation = [38.7223, -9.1393], destination, onBack }: NavigationAppProps) {
    const [route, setRoute] = useState<[number, number][]>([]);
    const [destCoords, setDestCoords] = useState<[number, number] | null>(null);
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState({ distance: 0, duration: 0 });
    const [followMe, setFollowMe] = useState(true);

    // Geocode destination and fetch route
    useEffect(() => {
        if (!destination) return;

        const geocodeAndRoute = async () => {
            setLoading(true);
            try {
                // 1. Geocode
                const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(destination + ', Portugal')}`);
                const geoData = await geoRes.json();

                if (geoData && geoData[0]) {
                    const dLat = parseFloat(geoData[0].lat);
                    const dLng = parseFloat(geoData[0].lon);
                    setDestCoords([dLat, dLng]);

                    // 2. Fetch Route from OSRM
                    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${driverLocation[1]},${driverLocation[0]};${dLng},${dLat}?overview=full&geometries=geojson`;
                    const routeRes = await fetch(osrmUrl);
                    const routeData = await routeRes.json();

                    if (routeData.routes && routeData.routes[0]) {
                        const coords = routeData.routes[0].geometry.coordinates.map((c: any) => [c[1], c[0]]);
                        setRoute(coords);
                        setStats({
                            distance: routeData.routes[0].distance / 1000, // km
                            duration: routeData.routes[0].duration / 60 // min
                        });
                    }
                }
            } catch (error) {
                console.error('Navigation Error:', error);
            } finally {
                setLoading(false);
            }
        };

        geocodeAndRoute();
    }, [destination, driverLocation]);

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

    return (
        <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col font-sans overflow-hidden">
            {/* Top HUD - Next Step */}
            <div className="absolute top-6 left-1/2 -translate-x-1/2 w-[90%] md:w-[400px] z-[110]">
                <div className="bg-slate-900/90 backdrop-blur-xl border border-blue-500/20 rounded-2xl p-4 shadow-2xl flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/40">
                        <Navigation className="w-7 h-7 text-white" />
                    </div>
                    <div className="flex-1">
                        <p className="text-blue-400 text-[10px] font-bold uppercase tracking-wider mb-0.5">Siga em frente</p>
                        <h2 className="text-white font-bold text-lg leading-tight truncate">
                            {destination || 'Selecione destino'}
                        </h2>
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
                        <Marker position={destCoords}>
                            <Popup>{destination}</Popup>
                        </Marker>
                    )}
                </MapContainer>

                {/* Loading Indicator */}
                {loading && (
                    <div className="absolute inset-0 bg-slate-950/20 backdrop-blur-sm z-[105] flex items-center justify-center">
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
            <div className="bg-slate-900/90 backdrop-blur-2xl border-t border-slate-800 p-6 z-[110]">
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
                    <button className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl shadow-lg shadow-emerald-900/40 transition-colors">
                        Cheguei
                    </button>
                </div>
            </div>

            <style>{`
                .navigation-car-icon { background: none !important; border: none !important; }
                .leaflet-container { background: #020617 !important; }
            `}</style>
        </div>
    );
}
