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
    const color = status === 'moving' ? '#22c55e' : (status === 'idle' ? '#f59e0b' : '#64748b');
    const isMoving = status === 'moving';

    return L.divIcon({
        className: 'custom-car-marker',
        html: `
            <div class="marker-container" style="display: flex; flex-direction: column; align-items: center; position: relative;">
                <div class="plate-label" style="
                    background: white; 
                    color: #1e293b; 
                    padding: 2px 6px; 
                    border-radius: 4px; 
                    font-size: 10px; 
                    font-weight: 800; 
                    border: 1.5px solid ${color};
                    box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
                    margin-bottom: 4px;
                    white-space: nowrap;
                    font-family: 'Inter', sans-serif;
                ">${registration}</div>
                
                <div style="transform: rotate(${heading}deg); transition: transform 0.3s ease; position: relative;">
                    ${isMoving ? `<div class="pulse-effect" style="
                        position: absolute;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%);
                        width: 40px;
                        height: 40px;
                        background: ${color}22;
                        border-radius: 50%;
                        animation: pulse 2s infinite;
                        z-index: -1;
                    "></div>` : ''}
                    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="20" cy="20" r="18" fill="white" fill-opacity="0.95" stroke="${color}" stroke-width="2.5" />
                        <!-- Car body -->
                        <path d="M20 10L24 16H16L20 10Z" fill="${color}" />
                        <rect x="17.5" y="16" width="5" height="12" rx="1.5" fill="${color}" />
                        <!-- Headlights -->
                        <circle cx="17.5" cy="12" r="1" fill="${color}" fill-opacity="0.5" />
                        <circle cx="22.5" cy="12" r="1" fill="${color}" fill-opacity="0.5" />
                    </svg>
                </div>
                
                <style>
                    @keyframes pulse {
                        0% { transform: translate(-50%, -50%) scale(0.6); opacity: 1; }
                        100% { transform: translate(-50%, -50%) scale(1.5); opacity: 0; }
                    }
                </style>
            </div>
        `,
        iconSize: [80, 80],
        iconAnchor: [40, 55]
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
                    attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
                    url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                />

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
                            <div className="p-3 min-w-[220px] bg-white/10 backdrop-blur-md rounded-xl">
                                <div className="font-black text-xl text-slate-900 border-b-2 border-slate-100 pb-2 mb-3 flex justify-between items-center">
                                    <span>{vehicle.registration}</span>
                                    <span className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-tighter ${vehicle.status === 'moving' ? 'bg-green-100 text-green-700' :
                                        vehicle.status === 'idle' ? 'bg-orange-100 text-orange-700' :
                                            'bg-slate-100 text-slate-700'
                                        }`}>
                                        {vehicle.status === 'moving' ? 'Em Movimento' : vehicle.status === 'idle' ? 'Em Relanti' : 'Parado'}
                                    </span>
                                </div>
                                <div className="space-y-2 text-xs text-slate-700">
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-500">Motorista:</span>
                                        <span className="font-semibold text-slate-900">{vehicle.driverName || vehicle.name}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-500">Velocidade:</span>
                                        <span className="font-semibold text-slate-900">{Math.round(vehicle.speed)} km/h</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-500">Ignição:</span>
                                        <span className={`font-bold ${vehicle.ignition ? 'text-green-600' : 'text-red-500'}`}>
                                            {vehicle.ignition ? 'Ligada' : 'Desligada'}
                                        </span>
                                    </div>
                                    <div className="text-[10px] text-slate-400 mt-3 pt-2 border-t text-right italic">
                                        Atualizado há instantes: {new Date(vehicle.updatedAt).toLocaleTimeString()}
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
