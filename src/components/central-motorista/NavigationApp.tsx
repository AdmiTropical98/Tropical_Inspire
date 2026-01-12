import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Navigation, MapPin, Compass, Clock, ChevronLeft, LocateFixed, Search, ArrowRight, ExternalLink } from 'lucide-react';
import type { CartrackGeofence } from '../../services/cartrack';

interface NavigationAppProps {
    driverLocation?: [number, number];
    destination?: string;
    geofences?: CartrackGeofence[];
    error?: string | null;
    onRetry?: () => void;
    onBack: () => void;
}

// Map Controller with multiple modes
function MapController({ center, followMe }: { center: [number, number], followMe: boolean }) {
    const map = useMap();
    useEffect(() => {
        if (followMe) {
            map.flyTo(center, 18, { animate: true, duration: 1 });
        }
    }, [center, followMe, map]);
    return null;
}

export default function NavigationApp({ driverLocation: initialLocation = [38.7223, -9.1393], destination: initialDestination, geofences = [], error, onRetry, onBack }: NavigationAppProps) {
    // Navigation State
    const [isNavigating, setIsNavigating] = useState(false);
    const [currentPos, setCurrentPos] = useState<[number, number]>(initialLocation);
    const [gpsAccuracy, setGpsAccuracy] = useState<number>(0);

    const [route, setRoute] = useState<[number, number][]>([]);
    const [destCoords, setDestCoords] = useState<[number, number] | null>(null);
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState({ distance: 0, duration: 0, eta: '' });
    const [followMe, setFollowMe] = useState(true);

    // Selection State
    const [destinationName, setDestinationName] = useState(initialDestination || '');
    const [showSelection, setShowSelection] = useState(!initialDestination);
    const [searchTerm, setSearchTerm] = useState('');

    // Refs
    const watchIdRef = useRef<number | null>(null);
    const wakeLockRef = useRef<any>(null);

    // Filter Geofences
    // Filter Geofences
    const filteredGeofences = geofences.filter(g =>
        g.name?.toLowerCase().includes(searchTerm.toLowerCase()) &&
        ((g.latitude && g.longitude) || (g.points && g.points.length > 0))
    );

    const handleSelectGeofence = (geo: CartrackGeofence) => {
        let lat = geo.latitude;
        let lng = geo.longitude;

        // Fallback to first point of polygon if center is missing
        if ((!lat || !lng) && geo.points && geo.points.length > 0) {
            lat = geo.points[0].lat;
            lng = geo.points[0].lng;
        }

        if (lat && lng) {
            setDestCoords([Number(lat), Number(lng)]);
            setDestinationName(geo.name);
            setShowSelection(false);
        }
    };

    // Calculate/Recalculate Route
    useEffect(() => {
        if (!destCoords && !destinationName) return;

        const calculateRoute = async () => {
            setLoading(true);
            try {
                let targetCoords = destCoords;

                // Match name if needed
                if (!targetCoords && destinationName) {
                    const match = geofences.find(g => g.name.toLowerCase() === destinationName.toLowerCase());
                    if (match && match.latitude && match.longitude) {
                        targetCoords = [Number(match.latitude), Number(match.longitude)];
                        setDestCoords(targetCoords);
                    } else {
                        // Fallback Geocode
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
                    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${currentPos[1]},${currentPos[0]};${targetCoords[1]},${targetCoords[0]}?overview=full&geometries=geojson`;
                    const routeRes = await fetch(osrmUrl);
                    const routeData = await routeRes.json();

                    if (routeData.routes && routeData.routes[0]) {
                        const r = routeData.routes[0];
                        const coords = r.geometry.coordinates.map((c: any) => [c[1], c[0]]);
                        setRoute(coords);

                        const durationMins = r.duration / 60;
                        setStats({
                            distance: r.distance / 1000,
                            duration: durationMins,
                            eta: new Date(Date.now() + durationMins * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        });
                    }
                }
            } catch (error) {
                console.error('Navigation Error:', error);
            } finally {
                setLoading(false);
            }
        };

        // If not navigating (just preview), allow route calc
        if (!isNavigating || !route.length) {
            calculateRoute();
        }
        // If navigating, we might want to recalc periodically, but let's stick to initial route for simplicity first
    }, [destinationName, destCoords, isNavigating, currentPos]); // Removed full props dependencies to avoid loops

    // Start Internal Navigation
    const startNavigation = async () => {
        setIsNavigating(true);
        setFollowMe(true);

        // Request Wake Lock
        try {
            if ('wakeLock' in navigator) {
                wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
            }
        } catch (err) {
            console.log('Wake Lock error:', err);
        }

        // Start GPS Watch
        if ('geolocation' in navigator) {
            watchIdRef.current = navigator.geolocation.watchPosition(
                (pos) => {
                    const { latitude, longitude, accuracy } = pos.coords;
                    setCurrentPos([latitude, longitude]);
                    setGpsAccuracy(accuracy);

                    // Simple ETA update (linear)
                    if (destCoords) {
                        const dist = L.latLng(latitude, longitude).distanceTo(L.latLng(destCoords[0], destCoords[1]));
                        // Assume 50km/h average speed = 13.8 m/s
                        const timeSecs = dist / 13.8;
                        setStats(prev => ({
                            ...prev,
                            distance: dist / 1000,
                            duration: timeSecs / 60,
                            eta: new Date(Date.now() + timeSecs * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        }));
                    }
                },
                (err) => console.error('GPS Error:', err),
                {
                    enableHighAccuracy: true,
                    maximumAge: 0,
                    timeout: 5000
                }
            );
        } else {
            alert('Geolocalização não suportada neste dispositivo.');
        }
    };

    const stopNavigation = () => {
        setIsNavigating(false);
        if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
        if (wakeLockRef.current) wakeLockRef.current.release();
        watchIdRef.current = null;
    };

    useEffect(() => {
        return () => {
            stopNavigation();
        };
    }, []);

    // Icons
    const carIcon = L.divIcon({
        className: 'navigation-car-icon',
        html: `
            <div style="background: ${isNavigating ? '#10b981' : '#3b82f6'}; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 15px ${isNavigating ? 'rgba(16, 185, 129, 0.5)' : 'rgba(59, 130, 246, 0.5)'}; position: relative;">
                 ${isNavigating ? '<div style="position: absolute; inset: 0; border-radius: 50%; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite; background: rgba(16, 185, 129, 0.3);"></div>' : ''}
                <div style="position: absolute; top: -10px; left: 50%; transform: translateX(-50%); width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-bottom: 10px solid ${isNavigating ? '#10b981' : '#3b82f6'};"></div>
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

    return createPortal(
        <div className="fixed inset-0 z-[9999] bg-slate-950 flex flex-col font-sans h-[100dvh] w-screen overflow-hidden supports-[height:100dvh]:h-[100dvh]">
            {/* Top HUD */}
            <div className={`absolute top-4 left-1/2 -translate-x-1/2 w-[95%] md:w-[400px] z-[10000] transition-all duration-300 pointer-events-none`}>
                <div className={`bg-slate-900/95 backdrop-blur-xl border ${isNavigating ? 'border-emerald-500/50' : 'border-blue-500/30'} rounded-2xl p-3 shadow-2xl flex items-center gap-3 pointer-events-auto pb-4 pt-3`}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg shrink-0 ${isNavigating ? 'bg-emerald-600 shadow-emerald-900/40 animate-pulse' : 'bg-blue-600 shadow-blue-900/40'}`}>
                        <Navigation className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className={`${isNavigating ? 'text-emerald-400' : 'text-blue-400'} text-[10px] font-bold uppercase tracking-wider mb-0.5`}>
                            {isNavigating ? 'Em Viagem' : 'Destino'}
                        </p>
                        <button
                            disabled={isNavigating}
                            onClick={() => setShowSelection(true)}
                            className="text-white font-bold text-base leading-tight truncate hover:text-blue-400 transition-colors text-left w-full disabled:hover:text-white disabled:cursor-default"
                        >
                            {destinationName || 'Selecionar Destino...'}
                        </button>
                    </div>
                    {!isNavigating && (
                        <button
                            onClick={onBack}
                            className="p-2 bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                    )}
                </div>
                {isNavigating && gpsAccuracy > 50 && (
                    <div className="mt-2 bg-amber-500/20 border border-amber-500/30 text-amber-200 backdrop-blur-md rounded-lg p-1.5 text-center text-xs font-bold animate-pulse">
                        Sinal GPS Fraco ({Math.round(gpsAccuracy)}m)
                    </div>
                )}
            </div>

            {/* Map Area */}
            <div className="flex-1 relative w-full z-0">
                <MapContainer
                    center={currentPos}
                    zoom={16}
                    zoomControl={false}
                    className="h-full w-full z-0 outline-none"
                    style={{ background: '#0f172a' }}
                >
                    <TileLayer
                        attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
                        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_labels_under/{z}/{x}/{y}{r}.png"
                    />
                    <MapController center={currentPos} followMe={followMe} />

                    {route.length > 0 && (
                        <Polyline
                            positions={route}
                            pathOptions={{ color: isNavigating ? '#10b981' : '#3b82f6', weight: 8, opacity: 0.9, lineJoin: 'round', lineCap: 'round' }}
                        />
                    )}

                    <Marker position={currentPos} icon={carIcon} />

                    {destCoords && (
                        <Marker position={destCoords} icon={destIcon}>
                            <Popup>{destinationName}</Popup>
                        </Marker>
                    )}
                </MapContainer>

                {/* Loading Indicator */}
                {loading && (
                    <div className="absolute inset-0 bg-slate-950/20 backdrop-blur-sm z-[500] flex items-center justify-center pointer-events-none">
                        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent shadow-xl"></div>
                    </div>
                )}

                {/* Recenter Button */}
                <div className="absolute right-4 bottom-6 z-[1000] flex flex-col gap-3">
                    <button
                        onClick={() => setFollowMe(prev => !prev)}
                        className={`p-3.5 rounded-full shadow-2xl transition-all active:scale-95 ${followMe ? 'bg-blue-600 text-white shadow-blue-900/30' : 'bg-slate-900 text-slate-400 border border-slate-700'}`}
                    >
                        <LocateFixed className="w-6 h-6" />
                    </button>
                </div>
            </div>

            {/* Bottom HUD - Stats & Actions */}
            <div className="bg-slate-900/95 backdrop-blur-xl border-t border-slate-800 p-4 pb-8 md:pb-4 z-[10000] shrink-0 safe-pb">
                <div className="max-w-md mx-auto grid grid-cols-3 gap-2 mb-4">
                    <div className="text-center p-2 rounded-xl bg-slate-800/50">
                        <div className="flex items-center justify-center gap-1.5 text-slate-400 mb-1">
                            <Clock className="w-3 h-3" />
                            <span className="text-[9px] font-bold uppercase tracking-widest">Tempo</span>
                        </div>
                        <p className="text-white text-lg font-bold leading-none">{Math.round(stats.duration)} <span className="text-[10px] text-slate-500 font-normal">min</span></p>
                    </div>

                    <div className="text-center p-2 rounded-xl bg-slate-800/50 border border-slate-700/50">
                        <div className={`flex items-center justify-center gap-1.5 ${isNavigating ? 'text-emerald-400' : 'text-blue-400'} mb-1`}>
                            <Compass className="w-3 h-3" />
                            <span className="text-[9px] font-bold uppercase tracking-widest">Chegada</span>
                        </div>
                        <p className="text-white text-lg font-bold leading-none">
                            {stats.eta || '--:--'}
                        </p>
                    </div>

                    <div className="text-center p-2 rounded-xl bg-slate-800/50">
                        <div className="flex items-center justify-center gap-1.5 text-slate-400 mb-1">
                            <MapPin className="w-3 h-3" />
                            <span className="text-[9px] font-bold uppercase tracking-widest">Dist</span>
                        </div>
                        <p className="text-white text-lg font-bold leading-none">{stats.distance.toFixed(1)} <span className="text-[10px] text-slate-500 font-normal">km</span></p>
                    </div>
                </div>

                <div className="max-w-md mx-auto flex gap-3">
                    {isNavigating ? (
                        <button
                            onClick={stopNavigation}
                            className="flex-1 py-3.5 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold rounded-xl shadow-lg shadow-red-900/20 transition-all flex items-center justify-center gap-2"
                        >
                            Terminar Viagem
                        </button>
                    ) : (
                        <>
                            <button
                                onClick={() => setShowSelection(true)}
                                className="px-5 py-3.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                            >
                                <Search className="w-5 h-5" />
                            </button>
                            <button
                                onClick={startNavigation}
                                disabled={!destCoords}
                                className="flex-1 py-3.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-lg shadow-blue-900/20 transition-all flex items-center justify-center gap-2"
                            >
                                <Navigation className="w-5 h-5" />
                                Iniciar Viagem
                            </button>
                            <button
                                onClick={openGoogleMaps}
                                className="px-4 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition-colors flex items-center justify-center"
                                title="Abrir no Google Maps"
                            >
                                <ExternalLink className="w-5 h-5" />
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* SELECTION OVERLAY */}
            {showSelection && (
                <div className="absolute inset-0 z-[10001] bg-slate-950 flex flex-col p-6 animate-in slide-in-from-bottom duration-300">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold text-white">Onde queres ir?</h2>
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
                                {error ? (
                                    <div className="mb-4 text-red-400 text-sm">
                                        <p className="mb-2 font-bold">Erro ao carregar:</p>
                                        <p>{error}</p>
                                    </div>
                                ) : (
                                    <p>Local não encontrado na lista.</p>
                                )}

                                {onRetry && (
                                    <button
                                        onClick={() => onRetry()}
                                        className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-bold transition-colors"
                                    >
                                        Tentar Novamente
                                    </button>
                                )}

                                <div className="mt-8 p-4 bg-slate-900/50 rounded text-xs text-left font-mono text-slate-600 overflow-x-auto border border-slate-800">
                                    <p className="font-bold text-slate-500 mb-1">Debug Info:</p>
                                    <p>Env: {import.meta.env.DEV ? 'DEV' : 'PROD'}</p>
                                    <p>Geofences: {geofences?.length ?? 'undefined'}</p>
                                    <p>Error: {error || 'None'}</p>
                                    <p>Endpoint: {import.meta.env.DEV ? '/api/cartrack' : '/proxy.php?endpoint='}</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <style>{`
                .navigation-car-icon { background: none !important; border: none !important; }
                .navigation-dest-icon { background: none !important; border: none !important; }
                .leaflet-container { background: #0f172a !important; width: 100% !important; height: 100% !important; }
                .leaflet-control-container .leaflet-top, .leaflet-control-container .leaflet-bottom { z-index: 400 !important; }
                .supports-\[height\:100dvh\]\:h-\[100dvh\] { margin-bottom: env(safe-area-inset-bottom); }
                @keyframes ping {
                    75%, 100% { transform: scale(2); opacity: 0; }
                }
            `}</style>
        </div>,
        document.body
    );
}
