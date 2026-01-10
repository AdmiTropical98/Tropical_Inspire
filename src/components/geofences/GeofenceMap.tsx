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
                    <circle cx="12" cy="12" r="10" fill="white" fill-opacity="0.9" stroke="${color}" stroke-width="2" />
                    <path d="M12 2L15 8H9L12 2Z" fill="${color}" />
                    <rect x="10" y="8" width="4" height="8" rx="1" fill="${color}" />
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
                    if (coord.lat && coord.lng && coord.lat !== 0 && coord.lng !== 0) {
                        bounds.extend([coord.lat, coord.lng]);
                        hasValidPoints = true;
                    }
                });
            }
        });

        // Add Vehicles to bounds
        vehicles.forEach(vehicle => {
            if (vehicle.latitude && vehicle.longitude && vehicle.latitude !== 0 && vehicle.longitude !== 0) {
                bounds.extend([vehicle.latitude, vehicle.longitude]);
                hasValidPoints = true;
            }
        });

        if (hasValidPoints && bounds.isValid()) {
            console.log('Fitting bounds to:', bounds.getCenter());
            // Set a small delay to ensure the map is ready for fitting
            const timer = setTimeout(() => {
                map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
            }, 300);
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

        // Immediate invalidate
        map.invalidateSize();

        // Delayed invalidates for various browser rendering stages
        const timers = [100, 500, 1000, 2500].map(ms =>
            setTimeout(() => map.invalidateSize(), ms)
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
    const [lisbon] = useState<[number, number]>([38.7223, -9.1393]);

    return (
        <div className="h-[600px] w-full rounded-2xl overflow-hidden border border-slate-700 shadow-xl relative z-0 bg-slate-900 border-2">
            <MapContainer
                center={lisbon}
                zoom={7}
                scrollWheelZoom={true}
                className="h-full w-full"
                style={{ height: '100%', width: '100%' }}
            >
                <MapResizer />
                <AutoFitBounds geofences={geofences} vehicles={vehicles} />

                {/* Standard Tile Layer */}
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
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
                                    fillOpacity: 0.35,
                                    weight: 2
                                }}
                            >
                                <Popup>
                                    <div className="font-bold text-slate-800">{geo.name}</div>
                                    <div className="text-xs text-slate-500 italic">Área de Geofence</div>
                                </Popup>
                            </Polygon>
                        );
                    }

                    return (
                        <Circle
                            key={geo.id}
                            center={[geo.coordinates[0].lat, geo.coordinates[0].lng]}
                            radius={geo.radius || 150}
                            pathOptions={{
                                color: geo.color || '#8b5cf6',
                                fillColor: geo.color || '#8b5cf6',
                                fillOpacity: 0.35,
                                weight: 2
                            }}
                        >
                            <Popup>
                                <div className="font-bold text-slate-800">{geo.name}</div>
                                <div className="text-xs text-slate-500 italic">Ponto de Interesse</div>
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
                            <div className="p-2 min-w-[170px]">
                                <div className="font-bold text-slate-900 border-b pb-2 mb-2 uppercase flex justify-between items-center">
                                    <span>{vehicle.registration}</span>
                                    <span className={`w-2 h-2 rounded-full ${vehicle.status === 'moving' ? 'bg-green-500' : 'bg-slate-400'}`}></span>
                                </div>
                                <div className="space-y-1.5 text-xs text-slate-700">
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">Estado:</span>
                                        <span className={`font-bold ${vehicle.status === 'moving' ? 'text-green-600' : 'text-slate-500'}`}>
                                            {vehicle.status === 'moving' ? 'Em Movimento' : (vehicle.status === 'idle' ? 'Em Relanti' : 'Parado')}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">Velocidade:</span>
                                        <span className="font-medium">{vehicle.speed} km/h</span>
                                    </div>
                                    <div className="text-[10px] text-slate-400 mt-2 pt-2 border-t text-right">
                                        Última atualização: {new Date(vehicle.updatedAt).toLocaleTimeString()}
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
