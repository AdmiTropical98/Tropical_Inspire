import { MapContainer, TileLayer, Marker, Popup, Polygon, Circle, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useState, useEffect } from 'react';
import L from 'leaflet';
import type { CartrackGeofence, CartrackVehicle } from '../../services/cartrack';

// Default Marker (Geofence Center / Offices)
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

// ... createCarIcon ...
const createCarIcon = (heading: number, status: string) => L.divIcon({
    html: `<div style="transform: rotate(${heading}deg);" class="${status === 'moving' ? 'text-green-600' : 'text-slate-600'} drop-shadow-lg filter">
             <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="currentColor" stroke="white" stroke-width="2">
               <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2a2 2 0 0 0 2-2v-1.5h10V15a2 2 0 0 0 2 2z"/>
             </svg>
           </div>`,
    className: 'bg-transparent',
    iconSize: [32, 32],
    iconAnchor: [16, 16]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface GeofenceMapProps {
    geofences: CartrackGeofence[];
    vehicles?: CartrackVehicle[];
}

// Component to handle auto-focus
function AutoFitBounds({ geofences, vehicles }: { geofences: CartrackGeofence[], vehicles: CartrackVehicle[] }) {
    const map = useMap();

    useEffect(() => {
        if (geofences.length === 0 && vehicles.length === 0) return;

        const bounds = L.latLngBounds([]);
        let hasValidPoints = false;

        // Add Geofences to bounds
        geofences.forEach(geo => {
            if (geo.coordinates.length > 0) {
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
            map.fitBounds(bounds, { padding: [50, 50] });
        }
    }, [geofences, vehicles, map]);

    return null;
}

export default function GeofenceMap({ geofences, vehicles = [] }: GeofenceMapProps) {
    const [position] = useState<[number, number]>([38.7223, -9.1393]); // Lisbon default

    return (
        <div className="h-[600px] w-full rounded-2xl overflow-hidden border border-slate-700 shadow-xl relative z-0 bg-slate-900">
            <MapContainer center={position} zoom={12} scrollWheelZoom={true} className="h-full w-full">
                <AutoFitBounds geofences={geofences} vehicles={vehicles} />

                {/* Satellite Map (Esri World Imagery) */}
                <TileLayer
                    attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
                    url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                />

                {/* Street Labels Overlay (Hybrid look) */}
                <TileLayer
                    attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
                    url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png"
                />


                {/* Geofences */}
                {geofences.map((geo) => {
                    if (geo.type === 'POLYGON' && geo.coordinates.length > 0) {
                        return (
                            <Polygon
                                key={geo.id}
                                positions={geo.coordinates.map(c => [c.lat, c.lng])}
                                pathOptions={{ color: geo.color || 'blue', fillOpacity: 0.2 }}
                            >
                                <Popup>
                                    <div className="font-bold">{geo.name}</div>
                                    <div className="text-xs">Geofence (Polígono)</div>
                                </Popup>
                            </Polygon>
                        );
                    }

                    if (geo.type === 'CIRCLE' && geo.coordinates.length > 0) {
                        return (
                            <Circle
                                key={geo.id}
                                center={[geo.coordinates[0].lat, geo.coordinates[0].lng]}
                                radius={geo.radius || 100}
                                pathOptions={{ color: geo.color || 'blue', fillOpacity: 0.2 }}
                            >
                                <Popup>
                                    <div className="font-bold">{geo.name}</div>
                                    <div className="text-xs">Geofence (Circular)</div>
                                </Popup>
                            </Circle>
                        );
                    }
                    return null;
                })}

                {/* Vehicles */}
                {vehicles.map(vehicle => (
                    <Marker
                        key={vehicle.id}
                        position={[vehicle.latitude, vehicle.longitude]}
                        icon={createCarIcon(vehicle.heading, vehicle.status)}
                    >
                        <Popup>
                            <div className="p-1">
                                <div className="font-bold text-sm mb-1">{vehicle.name}</div>
                                <div className="text-xs space-y-1 text-slate-600">
                                    <p>Matrícula: <span className="font-mono">{vehicle.registration}</span></p>
                                    <p>Velocidade: {vehicle.speed} km/h</p>
                                    <p>Estado:
                                        <span className={`ml-1 font-bold ${vehicle.status === 'moving' ? 'text-green-600' : 'text-orange-500'}`}>
                                            {vehicle.status === 'moving' ? 'Em Movimento' : 'Parado'}
                                        </span>
                                    </p>
                                    <p className="text-[10px] text-slate-400 mt-2">
                                        Atualizado: {new Date(vehicle.updatedAt).toLocaleTimeString()}
                                    </p>
                                </div>
                            </div>
                        </Popup>
                    </Marker>
                ))}

                <Marker position={position}>
                    <Popup>
                        Oficina Central <br /> (Localização Aproximada)
                    </Popup>
                </Marker>
            </MapContainer>
        </div>
    );
}
