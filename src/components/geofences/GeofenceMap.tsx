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
    selectedVehicle?: CartrackVehicle | null;
}

// Custom icon for car with rotation and license plate label
const createCarIcon = (registration: string, heading: number, status: 'moving' | 'stopped' | 'idle') => {
    const color = status === 'moving' ? '#22c55e' : (status === 'idle' ? '#f59e0b' : '#94a3b8');
    const isMoving = status === 'moving';

    return L.divIcon({
        className: 'custom-car-marker',
        html: `
            <div style="display: flex; flex-direction: column; align-items: center; position: relative;">
                <div style="
                    background: #1e1e2d; 
                    color: white; 
                    padding: 2px 8px; 
                    border-radius: 6px; 
                    font-size: 11px; 
                    font-family: 'JetBrains Mono', monospace;
                    font-weight: 900; 
                    border: 1px solid rgba(255,255,255,0.2);
                    box-shadow: 0 4px 15px rgba(0,0,0,0.8);
                    margin-bottom: 5px;
                    white-space: nowrap;
                    z-index: 10;
                    letter-spacing: -0.5px;
                ">${registration}</div>
                
                <div style="transform: rotate(${heading}deg); transition: transform 0.6s ease; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; position: relative;">
                    ${isMoving ? `<div class="pulse-ring"></div>` : ''}
                    <div style="
                        width: 22px;
                        height: 22px;
                        background: ${color};
                        border: 3px solid white;
                        border-radius: 50%;
                        box-shadow: 0 0 15px ${color}80;
                        z-index: 5;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    ">
                        <div style="width: 0; height: 0; border-left: 4px solid transparent; border-right: 4px solid transparent; border-bottom: 7px solid white; margin-top: -3px;"></div>
                    </div>
                </div>
                
                <style>
                    .pulse-ring {
                        position: absolute;
                        width: 50px;
                        height: 50px;
                        border: 4px solid ${color};
                        border-radius: 50%;
                        animation: ring-pulse 2s infinite;
                        opacity: 0;
                    }
                    @keyframes ring-pulse {
                        0% { transform: scale(0.4); opacity: 0.8; }
                        100% { transform: scale(1.3); opacity: 0; }
                    }
                </style>
            </div>
        `,
        iconSize: [60, 60],
        iconAnchor: [30, 45]
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
            if (geo.points && geo.points.length > 0) {
                geo.points.forEach(coord => {
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

// Component to focus on a specific vehicle
function MapFocus({ vehicle }: { vehicle: CartrackVehicle | null }) {
    const map = useMap();

    useEffect(() => {
        if (vehicle && vehicle.latitude && vehicle.longitude) {
            console.log('Map: Focusing on vehicle', vehicle.registration);
            map.setView([vehicle.latitude, vehicle.longitude], 18, {
                animate: true,
                duration: 1.5
            });
        }
    }, [vehicle, map]);

    return null;
}

export default function GeofenceMap({ geofences, vehicles = [], selectedVehicle = null }: GeofenceMapProps) {
    const [center] = useState<[number, number]>([38.7223, -9.1393]); // Lisbon default

    return (
        <div className="h-full w-full rounded-[32px] overflow-hidden border border-white/5 shadow-2xl relative z-0 bg-[#0a0a0f]">
            <MapContainer
                center={center}
                zoom={12}
                scrollWheelZoom={true}
                className="h-full w-full"
            >
                <MapResizer />
                <AutoFitBounds geofences={geofences} vehicles={vehicles} />
                <MapFocus vehicle={selectedVehicle} />

                {/* Waze-like Tile Layer (Voyager) */}
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                    url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                />

                <style>{`
                    .leaflet-container {
                        background: #f8fafc !important;
                    }
                    .custom-popup .leaflet-popup-content-wrapper {
                        background: #ffffff !important;
                        color: #1e293b !important;
                        border-radius: 12px;
                        box-shadow: 0 10px 25px rgba(0,0,0,0.2) !important;
                        border: 2px solid white;
                    }
                    .custom-car-marker {
                        transition: all 0.5s ease;
                        z-index: 1000 !important;
                    }
                `}</style>

                {/* Geofences Rendering */}
                {geofences.map((geo) => {
                    const points = geo.points || [];
                    if (points.length === 0) return null;

                    // Naive check: if radius is present and points < 3, treat as Circle (POI), else Polygon
                    const isPolygon = points.length > 2;

                    if (isPolygon) {
                        return (
                            <Polygon
                                key={geo.id}
                                positions={points.map(c => [c.lat, c.lng])}
                                pathOptions={{
                                    color: '#3b82f6', // Default color, as geo.color excludes from type
                                    fillColor: '#3b82f6',
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
                            center={[points[0].lat, points[0].lng]}
                            radius={geo.radius || 200}
                            pathOptions={{
                                color: '#8b5cf6',
                                fillColor: '#8b5cf6',
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
                {vehicles.map(vehicle => {
                    // Safety check for valid coordinates
                    if (!vehicle.latitude || !vehicle.longitude) return null;

                    return (
                        <Marker
                            key={vehicle.id}
                            position={[vehicle.latitude, vehicle.longitude]}
                            // Use 'bearing' as heading (fallback to 0) e cast status
                            icon={createCarIcon(vehicle.registration, vehicle.bearing || 0, (vehicle.status as 'moving' | 'stopped' | 'idle') || 'idle')}
                        >
                            <Popup className="custom-popup">
                                <div className="p-3 min-w-[220px]">
                                    <div className="font-black text-xl text-slate-900 border-b border-slate-100 pb-2 mb-3 flex justify-between items-center">
                                        <span>{vehicle.registration}</span>
                                        <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-black tracking-tighter ${vehicle.status === 'moving' ? 'bg-green-100 text-green-700' :
                                            vehicle.status === 'idle' ? 'bg-orange-100 text-orange-700' :
                                                'bg-slate-100 text-slate-500'
                                            }`}>
                                            {vehicle.status === 'moving' ? 'Em Movimento' : vehicle.status === 'idle' ? 'Em Relanti' : 'Parado'}
                                        </span>
                                    </div>
                                    <div className="space-y-2 text-xs text-slate-600">
                                        <div className="flex justify-between items-start">
                                            <span className="text-slate-400 font-bold uppercase tracking-wider text-[9px] mt-1">Motorista</span>
                                            <div className="flex flex-col items-end">
                                                <span className="font-black text-slate-900 leading-tight">{vehicle.driverName || 'Sem Motorista'}</span>
                                                {vehicle.tagId && (
                                                    <span className="text-[10px] text-blue-500 font-mono font-bold uppercase tracking-tighter mt-1 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                                                        Tag: {vehicle.tagId}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-slate-400 font-bold uppercase tracking-wider text-[9px]">Velocidade</span>
                                            <span className="font-black text-slate-900 font-mono">{Math.round(vehicle.speed)} km/h</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-slate-400 font-bold uppercase tracking-wider text-[9px]">Ignição</span>
                                            <span className={`font-black ${vehicle.ignition ? 'text-green-600' : 'text-red-500'}`}>
                                                {vehicle.ignition ? 'Ligada' : 'Desligada'}
                                            </span>
                                        </div>
                                        <div className="text-[9px] text-slate-400 mt-3 pt-2 border-t border-slate-50 text-right italic font-medium">
                                            Atualizado: {new Date(vehicle.last_position_update || vehicle.last_activity || Date.now()).toLocaleTimeString()}
                                        </div>
                                    </div>
                                </div>
                            </Popup>
                        </Marker>
                    );
                })}
            </MapContainer>
        </div>
    );
}
