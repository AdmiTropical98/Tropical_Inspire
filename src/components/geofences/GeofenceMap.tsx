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

// Custom icon for car with rotation
const createCarIcon = (heading: number, status: 'moving' | 'stopped' | 'idle') => {
    const color = status === 'moving' ? '#22c55e' : (status === 'idle' ? '#f59e0b' : '#64748b');

    return L.divIcon({
        className: 'custom-car-icon',
        html: `
            <div style="transform: rotate(${heading}deg); transition: transform 0.3s ease;">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="10" fill="white" fill-opacity="0.8" />
                    <path d="M12 2L15 8H9L12 2Z" fill="${color}" />
                    <rect x="10" y="8" width="4" height="10" rx="1" fill="${color}" />
                </svg>
            </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
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
                    if (coord.lat !== 0 && coord.lng !== 0) {
                        bounds.extend([coord.lat, coord.lng]);
                        hasValidPoints = true;
                    }
                });
            }
        });

        // Add Vehicles to bounds
        vehicles.forEach(vehicle => {
            if (vehicle.latitude !== 0 && vehicle.longitude !== 0) {
                bounds.extend([vehicle.latitude, vehicle.longitude]);
                hasValidPoints = true;
            }
        });

        if (hasValidPoints && bounds.isValid()) {
            map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
        }
    }, [geofences, vehicles, map]);

    return null;
}

// Component to fix Leaflet size issues
function MapResizer() {
    const map = useMap();
    useEffect(() => {
        const timer = setTimeout(() => {
            map.invalidateSize();
        }, 500);
        return () => clearTimeout(timer);
    }, [map]);
    return null;
}

export default function GeofenceMap({ geofences, vehicles = [] }: GeofenceMapProps) {
    const [position] = useState<[number, number]>([38.8000, -9.1000]);

    return (
        <div className="h-[600px] w-full rounded-2xl overflow-hidden border border-slate-700 shadow-xl relative z-0 bg-slate-900 border-2">
            <MapContainer center={position} zoom={11} scrollWheelZoom={true} className="h-full w-full">
                <MapResizer />
                <AutoFitBounds geofences={geofences} vehicles={vehicles} />

                {/* Clean Professional Tile Layer: CartoDB Voyager */}
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
                                pathOptions={{ color: geo.color || '#3b82f6', fillOpacity: 0.3, weight: 2 }}
                            >
                                <Popup>
                                    <div className="font-bold text-slate-800">{geo.name}</div>
                                    <div className="text-xs text-slate-500">Geofence (Polígono)</div>
                                </Popup>
                            </Polygon>
                        );
                    }

                    return (
                        <Circle
                            key={geo.id}
                            center={[geo.coordinates[0].lat, geo.coordinates[0].lng]}
                            radius={geo.radius || 100}
                            pathOptions={{ color: geo.color || '#8b5cf6', fillOpacity: 0.3, weight: 2 }}
                        >
                            <Popup>
                                <div className="font-bold text-slate-800">{geo.name}</div>
                                <div className="text-xs text-slate-500">POI (Circular)</div>
                            </Popup>
                        </Circle>
                    );
                })}

                {/* Vehicles Markers */}
                {vehicles.map(vehicle => (
                    <Marker
                        key={vehicle.id}
                        position={[vehicle.latitude, vehicle.longitude]}
                        icon={createCarIcon(vehicle.heading, vehicle.status)}
                    >
                        <Popup>
                            <div className="p-2 min-w-[150px]">
                                <div className="font-bold text-slate-900 border-b pb-1 mb-2 uppercase">
                                    {vehicle.registration}
                                </div>
                                <div className="space-y-1 text-xs text-slate-700">
                                    <div className="flex justify-between gap-4">
                                        <span>Estado:</span>
                                        <span className={`font-bold ${vehicle.status === 'moving' ? 'text-green-600' : 'text-slate-500'}`}>
                                            {vehicle.status === 'moving' ? 'Em Movimento' : (vehicle.status === 'idle' ? 'Relanti' : 'Parado')}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Velocidade:</span>
                                        <span className="font-medium">{vehicle.speed} km/h</span>
                                    </div>
                                    <div className="text-[10px] text-slate-400 mt-2 text-right">
                                        Atualizado: {new Date(vehicle.updatedAt).toLocaleTimeString()}
                                    </div>
                                </div>
                            </div>
                        </Popup>
                    </Marker>
                ))}

                <Marker position={position}>
                    <Popup>Oficina Central</Popup>
                </Marker>
            </MapContainer>
        </div>
    );
}
