import { MapContainer, TileLayer, Polygon, Circle, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useState, useEffect } from 'react';
import type { CartrackGeofence, CartrackVehicle } from '../../services/cartrack';

// Fix for default marker icons in Leaflet
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

interface GeofenceMapProps {
    geofences: CartrackGeofence[];
    vehicles?: CartrackVehicle[];
}

// Custom icon for car with rotation and license plate label
const createCarIcon = (registration: string, heading: number, status: 'moving' | 'stopped' | 'idle') => {
    const color = status === 'moving' ? '#22c55e' : (status === 'idle' ? '#f59e0b' : '#94a3b8');
    const isMoving = status === 'moving';

    return L.divIcon({
        className: 'custom-car-marker',
        html: `
            <div class="marker-container" style="display: flex; flex-direction: column; align-items: center; position: relative;">
                <div class="plate-label" style="
                    background: rgba(15, 23, 42, 0.95); 
                    color: white; 
                    padding: 1px 4px; 
                    border-radius: 3px; 
                    font-size: 8px; 
                    font-weight: 900; 
                    border: 1px solid ${color}66;
                    box-shadow: 0 0 15px rgba(0,0,0,0.8);
                    margin-bottom: 1px;
                    white-space: nowrap;
                    font-family: 'JetBrains Mono', monospace;
                    backdrop-filter: blur(4px);
                    z-index: 10;
                    letter-spacing: -0.05em;
                ">${registration}</div>
                
                <div style="transform: rotate(${heading}deg); transition: transform 0.8s cubic-bezier(0.4, 0, 0.2, 1); width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; position: relative;">
                    ${isMoving ? `
                    <div style="
                        position: absolute;
                        width: 48px;
                        height: 48px;
                        border: 1px solid ${color}44;
                        border-radius: 50%;
                        animation: ring-expand 2s infinite ease-out;
                    "></div>
                    <div style="
                        position: absolute;
                        width: 24px;
                        height: 24px;
                        background: radial-gradient(circle, ${color}66 0%, transparent 70%);
                        border-radius: 50%;
                    "></div>
                    ` : ''}
                    
                    <div style="
                        width: 14px;
                        height: 14px;
                        background: ${isMoving ? color : '#1e293b'};
                        border: 2px solid ${isMoving ? 'white' : color};
                        border-radius: 50%;
                        box-shadow: 0 0 10px ${color}88;
                        z-index: 5;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    ">
                        <svg width="6" height="6" viewBox="0 0 24 24" fill="none" stroke="${isMoving ? 'white' : color}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M12 19V5M5 12l7-7 7 7"/>
                        </svg>
                    </div>
                </div>
                
                <style>
                    @keyframes ring-expand {
                        0% { transform: scale(0.4); opacity: 1; }
                        100% { transform: scale(1.2); opacity: 0; }
                    }
                </style>
            </div>
        `,
        iconSize: [50, 50],
        iconAnchor: [25, 35]
    });
};

// Component to handle auto-focus
function AutoFitBounds({ geofences, vehicles }: { geofences: CartrackGeofence[], vehicles: CartrackVehicle[] }) {
    const map = useMap();

    useEffect(() => {
        if (geofences.length === 0 && vehicles.length === 0) return;

        const bounds = L.latLngBounds([]);
        let hasValidPoints = false;

        // Add Geofences to bounds
        geofences.forEach(geo => {
            if (geo.coordinates && geo.coordinates.length > 0) {
                geo.coordinates.forEach(coord => {
                    if (coord.lat && coord.lng && coord.lat !== 0 && coord.lng !== 0) {
                        bounds.extend([coord.lat, coord.lng]);
                        hasValidPoints = true;
                    }
                });
            }
        });

        // Add Vehicles to bounds
        if (vehicles.length > 0) {
            vehicles.forEach(vehicle => {
                if (vehicle.latitude && vehicle.longitude && vehicle.latitude !== 0 && vehicle.longitude !== 0) {
                    bounds.extend([vehicle.latitude, vehicle.longitude]);
                    hasValidPoints = true;
                }
            });
        }

        if (hasValidPoints && bounds.isValid()) {
            console.log('Map: Fitting bounds to data points');
            // Use longer timeout to ensure data is rendered
            const timer = setTimeout(() => {
                map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16, animate: true });
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [geofences, vehicles, map]);

    return null;
}

// Component to fix Leaflet size issues
function MapResizer() {
    const map = useMap();
    useEffect(() => {
        const handleResize = () => {
            map.invalidateSize();
        };

        // Multiple passes to handle flexbox/grid layout settle
        const timers = [100, 500, 1000, 2500, 5000].map(ms =>
            setTimeout(() => map.invalidateSize({ animate: false }), ms)
        );

        window.addEventListener('resize', handleResize);
        return () => {
            window.removeEventListener('resize', handleResize);
            timers.forEach(t => clearTimeout(t));
        };
    }, [map]);
    return null;
}

export default function GeofenceMap({ geofences, vehicles = [] }: GeofenceMapProps) {
    const [center] = useState<[number, number]>([38.7223, -9.1393]); // Lisbon default

    return (
        <div className="h-[800px] w-full rounded-3xl overflow-hidden border border-slate-800 shadow-2xl relative z-0 bg-slate-950">
            <MapContainer
                center={center}
                zoom={12}
                scrollWheelZoom={true}
                className="h-full w-full"
            >
                <MapResizer />
                <AutoFitBounds geofences={geofences} vehicles={vehicles} />

                {/* High Contrast Professional Tile Layer (Voyager) */}
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                />

                <style>{`
                    .leaflet-container {
                        background: #020617 !important;
                    }
                    .custom-popup .leaflet-popup-content-wrapper {
                        background: rgba(15, 23, 42, 0.9) !important;
                        backdrop-filter: blur(8px);
                        color: white !important;
                        border: 1px solid rgba(255,255,255,0.1);
                        border-radius: 16px;
                    }
                    .custom-popup .leaflet-popup-tip {
                        background: rgba(15, 23, 42, 0.9) !important;
                    }
                `}</style>

                {/* Geofences Rendering */}
                {geofences.map((geo) => {
                    if (!geo.coordinates || geo.coordinates.length === 0) return null;

                    if (geo.type === 'POLYGON') {
                        return (
                            <Polygon
                                key={geo.id}
                                positions={geo.coordinates.map(c => [c.lat, c.lng])}
                                pathOptions={{
                                    color: geo.color || '#3b82f6',
                                    fillColor: geo.color || '#3b82f6',
                                    fillOpacity: 0.3,
                                    weight: 3,
                                    dashArray: '5, 10'
                                }}
                            >
                                <Popup>
                                    <div className="p-1">
                                        <div className="font-bold text-slate-900 border-b pb-1 mb-1">{geo.name}</div>
                                        <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Zona de Geofence</div>
                                    </div>
                                </Popup>
                            </Polygon>
                        );
                    }

                    return (
                        <Circle
                            key={geo.id}
                            center={[geo.coordinates[0].lat, geo.coordinates[0].lng]}
                            radius={geo.radius || 200}
                            pathOptions={{
                                color: geo.color || '#8b5cf6',
                                fillColor: geo.color || '#8b5cf6',
                                fillOpacity: 0.3,
                                weight: 3
                            }}
                        >
                            <Popup>
                                <div className="p-1">
                                    <div className="font-bold text-slate-900 border-b pb-1 mb-1">{geo.name}</div>
                                    <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Ponto de Interesse</div>
                                </div>
                            </Popup>
                        </Circle>
                    );
                })}

                {/* Vehicles Markers */}
                {vehicles.map(vehicle => (
                    <Marker
                        key={vehicle.id}
                        position={[vehicle.latitude, vehicle.longitude]}
                        icon={createCarIcon(vehicle.registration, vehicle.heading, vehicle.status)}
                    >
                        <Popup className="custom-popup">
                            <div className="p-3 min-w-[220px]">
                                <div className="font-black text-xl text-white border-b border-white/10 pb-2 mb-3 flex justify-between items-center">
                                    <span>{vehicle.registration}</span>
                                    <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-black tracking-tighter ${vehicle.status === 'moving' ? 'bg-green-500/20 text-green-400' :
                                        vehicle.status === 'idle' ? 'bg-orange-500/20 text-orange-400' :
                                            'bg-slate-700/50 text-slate-400'
                                        }`}>
                                        {vehicle.status === 'moving' ? 'Em Movimento' : vehicle.status === 'idle' ? 'Em Relanti' : 'Parado'}
                                    </span>
                                </div>
                                <div className="space-y-2 text-xs text-slate-300">
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-500 font-bold uppercase tracking-wider text-[9px]">Motorista</span>
                                        <span className="font-black text-white">{vehicle.driverName || vehicle.name}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-500 font-bold uppercase tracking-wider text-[9px]">Velocidade</span>
                                        <span className="font-black text-white font-mono">{Math.round(vehicle.speed)} km/h</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-500 font-bold uppercase tracking-wider text-[9px]">Ignição</span>
                                        <span className={`font-black ${vehicle.ignition ? 'text-green-400' : 'text-red-400'}`}>
                                            {vehicle.ignition ? 'Ligada' : 'Desligada'}
                                        </span>
                                    </div>
                                    <div className="text-[9px] text-slate-500 mt-3 pt-2 border-t border-white/5 text-right italic font-medium">
                                        Atualizado: {new Date(vehicle.updatedAt).toLocaleTimeString()}
                                    </div>
                                </div>
                            </div>
                        </Popup>
                    </Marker>
                ))}
            </MapContainer>
        </div>
    );
}
