import { MapContainer, TileLayer, Marker, Popup, Polygon, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useState } from 'react';
import L from 'leaflet';
import type { CartrackGeofence } from '../../services/cartrack';

// Fix for default marker icon in React-Leaflet
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface GeofenceMapProps {
    geofences: CartrackGeofence[];
}

export default function GeofenceMap({ geofences }: GeofenceMapProps) {
    const [position] = useState<[number, number]>([38.7223, -9.1393]); // Lisbon default

    return (
        <div className="h-[600px] w-full rounded-2xl overflow-hidden border border-slate-700 shadow-2xl relative z-0">
            <MapContainer center={position} zoom={13} scrollWheelZoom={true} className="h-full w-full">
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {geofences.map((geo) => {
                    if (geo.type === 'POLYGON' && geo.coordinates.length > 0) {
                        return (
                            <Polygon
                                key={geo.id}
                                positions={geo.coordinates.map(c => [c.lat, c.lng])}
                                pathOptions={{ color: geo.color || 'blue' }}
                            >
                                <Popup>{geo.name}</Popup>
                            </Polygon>
                        );
                    }

                    if (geo.type === 'CIRCLE' && geo.coordinates.length > 0) {
                        return (
                            <Circle
                                key={geo.id}
                                center={[geo.coordinates[0].lat, geo.coordinates[0].lng]}
                                radius={geo.radius || 100}
                                pathOptions={{ color: geo.color || 'blue' }}
                            >
                                <Popup>{geo.name}</Popup>
                            </Circle>
                        );
                    }
                    return null;
                })}

                <Marker position={position}>
                    <Popup>
                        Oficina Central <br /> (Localização Aproximada)
                    </Popup>
                </Marker>
            </MapContainer>
        </div>
    );
}
