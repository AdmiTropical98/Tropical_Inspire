import { useEffect, useRef } from 'react';
import type { CartrackGeofence, CartrackVehicle } from '../../services/cartrack';
import type { Local } from '../../types';

const HERE_API_KEY = String(import.meta.env.VITE_HERE_API_KEY || '');

interface GeofenceMapProps {
    geofences: CartrackGeofence[];
    vehicles?: CartrackVehicle[];
    selectedVehicle?: CartrackVehicle | null;
    locais?: Local[];
    onSelectVehicle?: (v: CartrackVehicle) => void;
    activeServiceByVehicle?: Record<string, VehicleServiceTracking>;
}

export interface VehicleServiceTracking {
    serviceId: string;
    passenger?: string;
    hora?: string;
    origem?: string;
    destino?: string;
    originConfirmed?: boolean;
    destinationConfirmed?: boolean;
    originInside?: boolean;
    destinationInside?: boolean;
    originArrivalTime?: string | null;
    destinationArrivalTime?: string | null;
    originDepartureTime?: string | null;
    destinationDepartureTime?: string | null;
    lastEventLabel?: string;
    lastEventTime?: string | null;
}

function buildVehicleMarkerEl(vehicle: CartrackVehicle, isSelected: boolean): HTMLElement {
    const status = (vehicle.status || 'stopped') as 'moving' | 'idle' | 'stopped';
    const color = status === 'moving' ? '#22c55e' : status === 'idle' ? '#f59e0b' : '#94a3b8';
    const border = isSelected ? '#fbbf24' : 'white';
    const shadow = isSelected
        ? `0 0 0 3px #fbbf24, 0 0 15px ${color}80`
        : `0 0 15px ${color}80`;
    const el = document.createElement('div');
    el.style.cssText = 'display:flex;flex-direction:column;align-items:center;cursor:pointer;';
    el.innerHTML = `
        <div style="background:#1e293b;color:white;padding:2px 8px;border-radius:6px;font-size:11px;font-weight:900;border:1px solid rgba(255,255,255,0.2);box-shadow:0 4px 15px rgba(0,0,0,0.4);margin-bottom:4px;white-space:nowrap;letter-spacing:-0.5px;">${vehicle.registration}</div>
        <div style="width:22px;height:22px;background:${color};border:3px solid ${border};border-radius:50%;box-shadow:${shadow};display:flex;align-items:center;justify-content:center;">
            <div style="width:0;height:0;border-left:4px solid transparent;border-right:4px solid transparent;border-bottom:7px solid white;margin-top:-3px;transform:rotate(${vehicle.bearing || 0}deg);"></div>
        </div>`;
    return el;
}

export default function GeofenceMap({
    geofences,
    vehicles = [],
    selectedVehicle,
    locais = [],
    onSelectVehicle,
    activeServiceByVehicle = {}
}: GeofenceMapProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<any>(null);
    const geofenceGroupRef = useRef<any>(null);
    const clusterLayerRef = useRef<any>(null);
    const initRef = useRef(false);
    const onSelectRef = useRef(onSelectVehicle);
    onSelectRef.current = onSelectVehicle;

    // Initialize HERE Map once
    useEffect(() => {
        if (!containerRef.current || initRef.current) return;
        const tryInit = () => {
            const H = window.H;
            if (!H) { setTimeout(tryInit, 150); return; }
            initRef.current = true;
            const platform = new H.service.Platform({ apikey: HERE_API_KEY });
            const layers = platform.createDefaultLayers();
            const map = new H.Map(containerRef.current!, layers.vector.normal.map, {
                zoom: 9,
                center: { lat: 37.1, lng: -8.0 },
            });
            mapRef.current = map;
            new H.mapevents.Behavior(new H.mapevents.MapEvents(map));
            H.ui.UI.createDefault(map, layers);
            const gGroup = new H.map.Group();
            geofenceGroupRef.current = gGroup;
            map.addObject(gGroup);
            const onResize = () => map.getViewPort().resize();
            window.addEventListener('resize', onResize);
            return () => window.removeEventListener('resize', onResize);
        };
        const cleanup = tryInit();
        return () => {
            cleanup?.();
            if (mapRef.current) { mapRef.current.dispose(); mapRef.current = null; initRef.current = false; }
        };
    }, []);

    // Draw geofences and local POIs
    useEffect(() => {
        const H = window.H;
        if (!mapRef.current || !H || !geofenceGroupRef.current) return;
        const group = geofenceGroupRef.current;
        group.removeObjects(group.getObjects(true));

        geofences.forEach(geo => {
            try {
                if (geo.points && geo.points.length > 2) {
                    const ls = new H.geo.LineString();
                    geo.points.forEach((p: any) => { if (p.lat && p.lng) ls.pushPoint({ lat: p.lat, lng: p.lng }); });
                    if (geo.points[0]) ls.pushPoint({ lat: geo.points[0].lat, lng: geo.points[0].lng });
                    group.addObject(new H.map.Polygon(ls, {
                        style: { strokeColor: 'rgba(59,130,246,0.8)', fillColor: 'rgba(59,130,246,0.15)', lineWidth: 2 }
                    }));
                } else if ((geo as any).latitude && (geo as any).longitude && (geo as any).radius) {
                    group.addObject(new H.map.Circle(
                        { lat: (geo as any).latitude, lng: (geo as any).longitude },
                        (geo as any).radius,
                        { style: { strokeColor: 'rgba(139,92,246,0.8)', fillColor: 'rgba(139,92,246,0.15)', lineWidth: 2 } }
                    ));
                }
            } catch { /* skip invalid geometry */ }
        });

        locais.forEach(local => {
            if (!local.latitude || !local.longitude) return;
            try {
                group.addObject(new H.map.Circle(
                    { lat: local.latitude, lng: local.longitude },
                    local.raio || 50,
                    { style: { strokeColor: local.cor ? local.cor + 'cc' : 'rgba(16,185,129,0.8)', fillColor: local.cor ? local.cor + '26' : 'rgba(16,185,129,0.15)', lineWidth: 2 } }
                ));
            } catch { /* skip */ }
        });
    }, [geofences, locais]);

    // Update vehicle clustering layer
    useEffect(() => {
        const H = window.H;
        if (!mapRef.current || !H) return;
        const map = mapRef.current;

        if (clusterLayerRef.current) {
            try { map.removeLayer(clusterLayerRef.current); } catch { /* ignore */ }
            clusterLayerRef.current = null;
        }

        const valid = vehicles.filter(v => v.latitude && v.longitude && v.latitude !== 0 && v.longitude !== 0);
        if (!valid.length) return;

        const dataPoints = valid.map(v => new H.clustering.DataPoint(v.latitude, v.longitude, null, v));

        const theme = {
            getClusterPresentation(cluster: any) {
                const el = document.createElement('div');
                el.style.cssText = [
                    'background:#2563eb', 'color:white', 'border:3px solid white',
                    'border-radius:50%', 'width:40px', 'height:40px',
                    'display:flex', 'align-items:center', 'justify-content:center',
                    'font-weight:900', 'font-size:14px',
                    'box-shadow:0 4px 15px rgba(37,99,235,0.5)', 'cursor:pointer'
                ].join(';');
                el.textContent = String(cluster.getWeight());
                return new H.map.DomMarker(cluster.getPosition(), { icon: new H.map.DomIcon(el) });
            },
            getNoisePresentation(noisePoint: any) {
                const v: CartrackVehicle = noisePoint.getData();
                const isSelected = selectedVehicle?.id === v.id;
                const el = buildVehicleMarkerEl(v, isSelected);
                const marker = new H.map.DomMarker(noisePoint.getPosition(), { icon: new H.map.DomIcon(el), data: v });
                marker.addEventListener('tap', () => onSelectRef.current?.(v));
                return marker;
            }
        };

        const provider = new H.clustering.Provider(dataPoints, {
            clusteringOptions: { eps: 40, minWeight: 2 },
            theme
        });
        const layer = new H.map.layer.ObjectLayer(provider);
        clusterLayerRef.current = layer;
        map.addLayer(layer);

        // Auto-fit bounds to all vehicles (only when no vehicle is selected)
        if (!selectedVehicle) {
            let top = -Infinity, left = Infinity, bottom = Infinity, right = -Infinity;
            valid.forEach(v => {
                top = Math.max(top, v.latitude);
                left = Math.min(left, v.longitude);
                bottom = Math.min(bottom, v.latitude);
                right = Math.max(right, v.longitude);
            });
            if (top > -Infinity) {
                setTimeout(() => {
                    if (mapRef.current) {
                        mapRef.current.setLookAtData({ bounds: new H.geo.Rect(top, left, bottom, right) }, true);
                    }
                }, 400);
            }
        }
    }, [vehicles, selectedVehicle, activeServiceByVehicle]);

    // Focus map on selected vehicle
    useEffect(() => {
        if (!mapRef.current || !selectedVehicle?.latitude || !selectedVehicle?.longitude) return;
        mapRef.current.setCenter({ lat: selectedVehicle.latitude, lng: selectedVehicle.longitude }, true);
        mapRef.current.setZoom(17, true);
    }, [selectedVehicle?.id]);

    return <div ref={containerRef} style={{ width: '100%', height: '100%', borderRadius: 'inherit' }} />;
}
                
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
function AutoFitBounds({ geofences, vehicles, locais = [] }: { geofences: CartrackGeofence[], vehicles: CartrackVehicle[], locais?: Local[] }) {
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

        // Add Local POIs to bounds
        locais.forEach(l => {
            if (l.latitude && l.longitude && l.latitude !== 0 && l.longitude !== 0) {
                bounds.extend([l.latitude, l.longitude]);
                hasValidPoints = true;
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
    }, [geofences, vehicles, locais, map]);

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

export default function GeofenceMap({ geofences, vehicles = [], selectedVehicle = null, locais = [], onSelectVehicle, activeServiceByVehicle = {} }: GeofenceMapProps) {
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
                <AutoFitBounds geofences={geofences} vehicles={vehicles} locais={locais} />
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

                {/* Local POIs (Zonas de Centro de Custo) Rendering */}
                {locais.map((local) => (
                    <Circle
                        key={`local-${local.id}`}
                        center={[local.latitude, local.longitude]}
                        radius={local.raio}
                        pathOptions={{
                            color: local.cor || '#3b82f6',
                            fillColor: local.cor || '#3b82f6',
                            fillOpacity: 0.2,
                            weight: 2,
                            dashArray: local.centroCustoId ? '0' : '5, 5'
                        }}
                    >
                        <Popup>
                            <div className="p-2 min-w-[150px]">
                                <div className="font-bold text-slate-900 border-b pb-1 mb-1">{local.nome}</div>
                                <div className="text-[10px] text-slate-500 uppercase font-black tracking-widest flex items-center gap-1.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                                    Local Localizado
                                </div>
                                {local.centroCustoId && (
                                    <div className="mt-2 pt-2 border-t border-slate-100">
                                        <div className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Centro de Custo Atribuído</div>
                                        <div className="text-xs font-black text-blue-600 uppercase mt-0.5">
                                            {local.nome}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </Popup>
                    </Circle>
                ))}

                {/* Vehicles Markers */}
                {vehicles.map(vehicle => {
                    // Safety check for valid coordinates
                    if (!vehicle.latitude || !vehicle.longitude) return null;

                    const activeService = activeServiceByVehicle[vehicle.id];

                    return (
                        <Marker
                            key={vehicle.id}
                            position={[vehicle.latitude, vehicle.longitude]}
                            // Use 'bearing' as heading (fallback to 0) e cast status
                            icon={createCarIcon(vehicle.registration, vehicle.bearing || 0, (vehicle.status as 'moving' | 'stopped' | 'idle') || 'idle')}
                            eventHandlers={{
                                click: () => onSelectVehicle?.(vehicle)
                            }}
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
                                        {activeService && (
                                            <div className="mb-2 rounded-lg border border-blue-100 bg-blue-50 p-2">
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="text-[9px] font-black uppercase tracking-wider text-blue-700">Serviço Ativo</span>
                                                    <span className="text-[10px] font-mono font-black text-blue-900">{activeService.hora || '--:--'}</span>
                                                </div>
                                                <div className="mt-1 text-[10px] font-bold text-slate-700">
                                                    {activeService.origem || 'Origem'} → {activeService.destino || 'Destino'}
                                                </div>
                                                <div className="mt-2 grid grid-cols-2 gap-1">
                                                    <span className={`rounded px-1.5 py-1 text-[9px] font-bold uppercase tracking-wider ${activeService.originInside ? 'bg-emerald-100 text-emerald-700' : activeService.originConfirmed ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                                                        Origem {activeService.originInside ? 'Dentro' : activeService.originConfirmed ? 'OK' : 'Pendente'}
                                                    </span>
                                                    <span className={`rounded px-1.5 py-1 text-[9px] font-bold uppercase tracking-wider ${activeService.destinationInside ? 'bg-emerald-100 text-emerald-700' : activeService.destinationConfirmed ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                                                        Destino {activeService.destinationInside ? 'Dentro' : activeService.destinationConfirmed ? 'OK' : 'Pendente'}
                                                    </span>
                                                </div>
                                                {activeService.lastEventLabel && (
                                                    <div className="mt-2 text-[9px] text-slate-500">
                                                        <span className="font-black uppercase tracking-wider">Último Evento:</span>{' '}
                                                        {activeService.lastEventLabel}
                                                        {activeService.lastEventTime ? ` • ${new Date(activeService.lastEventTime).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}` : ''}
                                                    </div>
                                                )}
                                            </div>
                                        )}
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
                                            Atualizado: {(vehicle.last_position_update || vehicle.last_activity)
                                                ? new Date(vehicle.last_position_update || vehicle.last_activity).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
                                                : '--:--'}
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
