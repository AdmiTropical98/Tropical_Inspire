import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Navigation, MapPin, Compass, Clock, ChevronLeft, LocateFixed, Search, ArrowRight, ExternalLink, X } from 'lucide-react';
import type { CartrackGeofence } from '../../services/cartrack';

interface NavigationAppProps {
    driverLocation?: [number, number];
    destination?: string;
    geofences?: CartrackGeofence[];
    error?: string | null;
    vehicleRegistration?: string;
    onRetry?: () => void;
    onBack: () => void;
    onLocationUpdate?: (reg: string, lat: number, lng: number) => void;
}

function MapController({ center, followMe }: { center: [number, number], followMe: boolean }) {
    const map = useMap();
    useEffect(() => {
        if (followMe) {
            map.flyTo(center, 19, { animate: true, duration: 1 });
        }
    }, [center, followMe, map]);
    return null;
}

export default function NavigationApp({
    driverLocation: initialLocation = [37.0716, -8.1006],
    destination: initialDestination,
    geofences = [],
    error,
    vehicleRegistration,
    onRetry,
    onBack,
    onLocationUpdate
}: NavigationAppProps) {
    const [isNavigating, setIsNavigating] = useState(false);
    const [currentPos, setCurrentPos] = useState<[number, number]>(initialLocation);
    const [gpsAccuracy, setGpsAccuracy] = useState<number>(0);
    const [hasGpsLock, setHasGpsLock] = useState(false);
    const [route, setRoute] = useState<[number, number][]>([]);
    const [destCoords, setDestCoords] = useState<[number, number] | null>(null);
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState({ distance: 0, duration: 0, eta: '' });
    const [followMe, setFollowMe] = useState(true);

    const [destinationName, setDestinationName] = useState(initialDestination || '');
    const [showSelection, setShowSelection] = useState(!initialDestination);
    const [searchTerm, setSearchTerm] = useState('');

    const watchIdRef = useRef<number | null>(null);
    const wakeLockRef = useRef<EventTarget | null>(null);

    useEffect(() => {
        if ('geolocation' in navigator) {
            watchIdRef.current = navigator.geolocation.watchPosition(
                (pos) => {
                    const { latitude, longitude, accuracy } = pos.coords;
                    if (accuracy > 2000) return;
                    const newPos: [number, number] = [latitude, longitude];
                    setCurrentPos(newPos);
                    setGpsAccuracy(accuracy);
                    setHasGpsLock(true);
                    if (vehicleRegistration && onLocationUpdate) {
                        onLocationUpdate(vehicleRegistration, latitude, longitude);
                    }
                },
                (err) => console.error('GPS Error:', err),
                { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
            );
        }
        return () => {
            if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
        };
    }, []);

    const filteredGeofences = geofences.filter(g =>
        g.name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleSelectGeofence = (geo: CartrackGeofence) => {
        let lat = geo.latitude;
        let lng = geo.longitude;
        if ((!lat || !lng) && geo.points && geo.points.length > 0) {
            lat = geo.points[0].lat;
            lng = geo.points[0].lng;
        }
        if (lat && lng) {
            setDestCoords([Number(lat), Number(lng)]);
        } else {
            setDestCoords(null);
        }
        setDestinationName(geo.name);
        setShowSelection(false);
    };

    useEffect(() => {
        if (!destCoords && !destinationName) return;

        const calculateRoute = async () => {
            setLoading(true);
            try {
                let targetCoords = destCoords;
                if (!targetCoords && destinationName) {
                    const match = geofences.find(g => g.name.toLowerCase() === destinationName.toLowerCase());
                    if (match && (match.latitude && match.longitude)) {
                        targetCoords = [Number(match.latitude), Number(match.longitude)];
                        setDestCoords(targetCoords);
                    } else if (match && match.points && match.points.length > 0) {
                        targetCoords = [match.points[0].lat, match.points[0].lng];
                        setDestCoords(targetCoords);
                    } else {
                        const cleanName = destinationName.replace(/_/g, ' ').replace(/-teste/gi, '').trim();
                        const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cleanName + ', Portugal')}`);
                        const geoData = await geoRes.json();
                        if (geoData && geoData[0]) {
                            targetCoords = [parseFloat(geoData[0].lat), parseFloat(geoData[0].lon)];
                            setDestCoords(targetCoords);
                        }
                    }
                }

                if (targetCoords) {
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

        if (!isNavigating || !route.length) {
            calculateRoute();
        }
    }, [destinationName, destCoords, isNavigating, currentPos]);

    const startNavigation = async () => {
        setIsNavigating(true);
        setFollowMe(true);
        try {
            if ('wakeLock' in navigator) {
                wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
            }
        } catch (err) { }

        if ('geolocation' in navigator) {
            watchIdRef.current = navigator.geolocation.watchPosition(
                (pos) => {
                    const { latitude, longitude, accuracy } = pos.coords;
                    setCurrentPos([latitude, longitude]);
                    setGpsAccuracy(accuracy);
                    if (destCoords) {
                        const dist = L.latLng(latitude, longitude).distanceTo(L.latLng(destCoords[0], destCoords[1]));
                        const timeSecs = dist / 13.8;
                        setStats(prev => ({
                            ...prev,
                            distance: dist / 1000,
                            duration: timeSecs / 60,
                            eta: new Date(Date.now() + timeSecs * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        }));
                    }
                },
                (err) => console.error(err),
                { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
            );
        }
    };

    const stopNavigation = () => {
        setIsNavigating(false);
        if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
        if (wakeLockRef.current) (wakeLockRef.current as any).release();
        watchIdRef.current = null;
    };

    useEffect(() => { return () => stopNavigation(); }, []);

    const carIcon = new L.Icon({
        iconUrl: '/nav-car-blue.png',
        iconSize: [80, 80],
        iconAnchor: [40, 40],
        popupAnchor: [0, -40],
        className: 'navigation-car-blue-3d'
    });

    const destIcon = L.divIcon({
        className: 'navigation-dest-icon',
        html: `<div style="background: #ef4444; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 15px rgba(239, 68, 68, 0.5); display: flex; align-items: center; justify-content: center;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg></div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
    });

    const openGoogleMaps = () => {
        if (destCoords) {
            window.open(`https://www.google.com/maps/dir/?api=1&destination=${destCoords[0]},${destCoords[1]}`, '_blank');
        } else if (destinationName) {
            window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destinationName + ', Portugal')}`, '_blank');
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[9999] bg-slate-950 flex flex-col font-sans h-[100dvh] w-screen overflow-hidden">
            <div className="absolute top-4 left-1/2 -translate-x-1/2 w-[95%] md:w-[400px] z-[10000] pointer-events-none">
                <div className={`bg-slate-900/95 backdrop-blur-xl border ${isNavigating ? 'border-emerald-500/50' : 'border-blue-500/30'} rounded-2xl p-3 shadow-2xl flex items-center gap-3 pointer-events-auto`}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg shrink-0 ${isNavigating ? 'bg-emerald-600 animate-pulse' : 'bg-blue-600'}`}>
                        <Navigation className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                        <p className={`${isNavigating ? 'text-emerald-400' : 'text-blue-400'} text-[10px] font-bold uppercase tracking-wider mb-0.5`}>{isNavigating ? 'Em Viagem' : 'Destino'}</p>
                        <button disabled={isNavigating} onClick={() => setShowSelection(true)} className="text-white font-bold text-base leading-tight truncate hover:text-blue-400 transition-colors w-full text-left">{destinationName || 'Selecionar Destino...'}</button>
                    </div>
                    {!isNavigating && (
                        <button onClick={onBack} className="p-2 bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors">
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                    )}
                </div>
            </div>

            <div className="fixed inset-0 z-0 w-full h-full" style={isNavigating ? { transform: 'scale(2.5) perspective(1000px) rotateX(55deg) translateY(10%)', transformOrigin: '50% 50%', transition: 'transform 1s ease-in-out' } : { transition: 'transform 1s ease-in-out' }}>
                <MapContainer center={currentPos} zoom={18} zoomControl={false} dragging={!isNavigating} touchZoom={!isNavigating} scrollWheelZoom={!isNavigating} doubleClickZoom={!isNavigating} className="h-full w-full">
                    <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" maxZoom={20} />
                    <MapController center={currentPos} followMe={followMe} />
                    {route.length > 0 && <Polyline positions={route} pathOptions={{ color: isNavigating ? '#22d3ee' : '#3b82f6', weight: 10, opacity: 0.9 }} />}
                    <Marker position={currentPos} icon={carIcon} />
                    {destCoords && <Marker position={destCoords} icon={destIcon} />}
                </MapContainer>
                {isNavigating && !hasGpsLock && (
                    <div className="absolute inset-0 bg-slate-950 z-[10002] flex flex-col items-center justify-center p-6 text-center">
                        <LocateFixed className="w-20 h-20 text-blue-500 mb-6 animate-bounce" />
                        <h3 className="text-2xl font-bold text-white mb-2">A obter localização...</h3>
                        <div className="flex gap-4">
                            <button onClick={stopNavigation} className="px-6 py-3 bg-red-500/10 text-red-400 border border-red-500/50 rounded-xl font-bold">Cancelar</button>
                            <button onClick={() => setHasGpsLock(true)} className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold">Simular GPS</button>
                        </div>
                    </div>
                )}
                <div className="absolute right-4 bottom-40 z-[1000]">
                    <button onClick={() => setFollowMe(p => !p)} className={`p-3.5 rounded-full shadow-2xl transition-all ${followMe ? 'bg-blue-600 text-white' : 'bg-slate-900 text-slate-400 border border-slate-700'}`}>
                        <LocateFixed className="w-6 h-6" />
                    </button>
                </div>
            </div>

            <div className="bg-slate-900/95 backdrop-blur-xl border-t border-slate-800 p-4 pb-8 z-[10000] shrink-0">
                <div className="max-w-md grid grid-cols-3 gap-2 mb-4">
                    <div className="text-center p-2 rounded-xl bg-slate-800/50">
                        <div className="flex items-center justify-center gap-1.5 text-slate-400 mb-1"><Clock className="w-3 h-3" /><span className="text-[9px] font-bold uppercase tracking-widest">Tempo</span></div>
                        <p className="text-white text-lg font-bold">{Math.round(stats.duration)} <span className="text-[10px] text-slate-500">min</span></p>
                    </div>
                    <div className="text-center p-2 rounded-xl bg-slate-800/50 border border-slate-700/50">
                        <div className={`flex items-center justify-center gap-1.5 ${isNavigating ? 'text-emerald-400' : 'text-blue-400'} mb-1`}><Compass className="w-3 h-3" /><span className="text-[9px] font-bold uppercase tracking-widest">Chegada</span></div>
                        <p className="text-white text-lg font-bold">{stats.eta || '--:--'}</p>
                    </div>
                    <div className="text-center p-2 rounded-xl bg-slate-800/50">
                        <div className="flex items-center justify-center gap-1.5 text-slate-400 mb-1"><MapPin className="w-3 h-3" /><span className="text-[9px] font-bold uppercase tracking-widest">Dist</span></div>
                        <p className="text-white text-lg font-bold">{stats.distance.toFixed(1)} <span className="text-[10px] text-slate-500">km</span></p>
                    </div>
                </div>
                <div className="max-w-md w-full">
                    {isNavigating ? (
                        <button onClick={stopNavigation} className="w-full py-4 bg-red-600 text-white font-bold rounded-xl flex items-center justify-center gap-2"><X className="w-5 h-5" />Terminar Viagem</button>
                    ) : (
                        <div className="flex flex-col gap-3">
                            <div className="flex gap-3">
                                <button onClick={() => setShowSelection(true)} className="px-5 bg-slate-800 text-white font-bold rounded-xl"><Search className="w-6 h-6" /></button>
                                <button onClick={startNavigation} disabled={!destCoords} className="flex-1 py-4 bg-blue-600 disabled:opacity-50 text-white font-bold rounded-xl flex items-center justify-center gap-2"><Navigation className="w-5 h-5" />Iniciar (App)</button>
                            </div>
                            <button onClick={openGoogleMaps} className="w-full py-4 bg-emerald-600 text-white font-bold rounded-xl flex items-center justify-center gap-2"><ExternalLink className="w-5 h-5" />Abrir no Google Maps</button>
                        </div>
                    )}
                </div>
            </div>

            {showSelection && (
                <div className="absolute inset-0 z-[10001] bg-slate-950 flex flex-col p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold text-white">Onde queres ir?</h2>
                        <button onClick={() => setShowSelection(false)} className="p-2 text-slate-400"><ChevronLeft className="w-6 h-6" /></button>
                    </div>
                    <div className="relative mb-6">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input type="text" placeholder="Pesquisar local ou zona..." className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-12 pr-4 py-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} autoFocus />
                    </div>
                    <div className="flex-1 overflow-y-auto space-y-2">
                        {filteredGeofences.map(geo => (
                            <button key={geo.id} onClick={() => handleSelectGeofence(geo)} className="w-full flex items-center justify-between p-4 bg-slate-900/50 border border-slate-800 rounded-xl hover:bg-slate-800 hover:border-blue-500/30 transition-all text-left">
                                <div className="flex items-center gap-3"><div className="p-2 bg-blue-500/10 rounded-lg text-blue-500"><MapPin className="w-5 h-5" /></div><span className="font-bold text-white">{geo.name}</span></div>
                                <ArrowRight className="w-4 h-4 text-slate-600" />
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>,
        document.body
    );
}
