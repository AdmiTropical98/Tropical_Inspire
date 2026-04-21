import { useEffect, useRef, useState } from 'react';
import type { CartrackGeofence, CartrackVehicle } from '../../services/cartrack';
import type { Local } from '../../types';

const HERE_API_KEY = String(
    import.meta.env.VITE_HERE_API_KEY
    || (import.meta.env as any).HERE_API_KEY
    || (window as any).__HERE_API_KEY__
    || ''
).trim();

const HERE_SCRIPT_URLS = [
    'https://js.api.here.com/v3/3.1/mapsjs-core.js',
    'https://js.api.here.com/v3/3.1/mapsjs-service.js',
    'https://js.api.here.com/v3/3.1/mapsjs-vector.js',
    'https://js.api.here.com/v3/3.1/mapsjs-harp.js',
    'https://js.api.here.com/v3/3.1/mapsjs-ui.js',
    'https://js.api.here.com/v3/3.1/mapsjs-mapevents.js',
    'https://js.api.here.com/v3/3.1/mapsjs-clustering.js'
] as const;

function loadScript(src: string) {
    return new Promise<void>((resolve, reject) => {
        const existing = document.querySelector(`script[src="${src}"]`) as HTMLScriptElement | null;
        if (existing?.dataset.loaded === 'true') {
            resolve();
            return;
        }

        if (existing) {
            existing.dataset.loaded = 'true';
            resolve();
            return;
        }

        const script = document.createElement('script');
        script.src = src;
        script.async = true;

        const onLoad = () => {
            script.dataset.loaded = 'true';
            script.removeEventListener('load', onLoad);
            script.removeEventListener('error', onError);
            resolve();
        };

        const onError = () => {
            script.removeEventListener('load', onLoad);
            script.removeEventListener('error', onError);
            reject(new Error(`Failed to load HERE script: ${src}`));
        };

        script.addEventListener('load', onLoad);
        script.addEventListener('error', onError);

        document.head.appendChild(script);
    });
}

async function ensureHereSdkLoaded() {
    if (window.H) return;
    await HERE_SCRIPT_URLS.reduce(
        (chain, src) => chain.then(() => loadScript(src)),
        Promise.resolve()
    );
}

function getHereBaseLayer(layers: any) {
    return layers?.raster?.normal?.map
        || layers?.vector?.normal?.map
        || layers?.normal?.map
        || layers?.raster?.satellite?.map
        || null;
}

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

    const el = document.createElement('div');
    el.style.cssText = 'display:flex;flex-direction:column;align-items:center;cursor:pointer;';
    el.innerHTML = `
        <div style="background:#1e293b;color:white;padding:2px 8px;border-radius:6px;font-size:11px;font-weight:900;border:1px solid rgba(255,255,255,0.2);box-shadow:0 4px 15px rgba(0,0,0,0.4);margin-bottom:4px;white-space:nowrap;letter-spacing:-0.2px;">${vehicle.registration}</div>
        <div style="width:22px;height:22px;background:${color};border:3px solid ${border};border-radius:50%;box-shadow:0 0 15px ${color}80;display:flex;align-items:center;justify-content:center;">
            <div style="width:0;height:0;border-left:4px solid transparent;border-right:4px solid transparent;border-bottom:7px solid white;transform:rotate(${vehicle.bearing || 0}deg);"></div>
        </div>
    `;
    return el;
}

function computeBounds(vehicles: CartrackVehicle[]) {
    let top = -Infinity;
    let left = Infinity;
    let bottom = Infinity;
    let right = -Infinity;

    vehicles.forEach(v => {
        top = Math.max(top, v.latitude);
        left = Math.min(left, v.longitude);
        bottom = Math.min(bottom, v.latitude);
        right = Math.max(right, v.longitude);
    });

    if (!Number.isFinite(top)) return null;
    return new window.H.geo.Rect(top, left, bottom, right);
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
    const initializedRef = useRef(false);
    const resizeObserverRef = useRef<ResizeObserver | null>(null);
    const [mapError, setMapError] = useState<string | null>(null);

    const onSelectVehicleRef = useRef(onSelectVehicle);
    onSelectVehicleRef.current = onSelectVehicle;

    useEffect(() => {
        if (!containerRef.current || initializedRef.current) return;

        let canceled = false;

        const tryInit = async () => {
            if (!HERE_API_KEY) {
                setMapError('HERE API key em falta (VITE_HERE_API_KEY).');
                return;
            }

            try {
                await ensureHereSdkLoaded();
            } catch (error) {
                setMapError(error instanceof Error ? error.message : 'Falha ao carregar HERE SDK.');
                return;
            }

            if (canceled) return;

            const H = window.H;
            if (!H) {
                setMapError('HERE SDK indisponível após carregamento.');
                return;
            }

            initializedRef.current = true;
            const platform = new H.service.Platform({ apikey: HERE_API_KEY });
            const layers = platform.createDefaultLayers();
            const baseLayer = getHereBaseLayer(layers);
            if (!baseLayer) {
                setMapError('Não foi possível criar camada base do mapa HERE.');
                initializedRef.current = false;
                return;
            }

            const map = new H.Map(containerRef.current!, baseLayer, {
                zoom: 9,
                center: { lat: 37.1, lng: -8.0 },
                pixelRatio: window.devicePixelRatio || 1
            });

            setMapError(null);

            mapRef.current = map;
            new H.mapevents.Behavior(new H.mapevents.MapEvents(map));
            H.ui.UI.createDefault(map, layers, 'pt-PT');

            const geofenceGroup = new H.map.Group();
            geofenceGroupRef.current = geofenceGroup;
            map.addObject(geofenceGroup);

            const resizeMap = () => {
                try {
                    map.getViewPort().resize();
                } catch {
                    // Ignore transient resize issues
                }
            };

            const onResize = () => resizeMap();
            window.addEventListener('resize', onResize);

            if ('ResizeObserver' in window) {
                resizeObserverRef.current = new ResizeObserver(() => resizeMap());
                resizeObserverRef.current.observe(containerRef.current!);
            }

            window.setTimeout(resizeMap, 120);
            window.setTimeout(resizeMap, 600);

            return () => {
                window.removeEventListener('resize', onResize);
                resizeObserverRef.current?.disconnect();
                resizeObserverRef.current = null;
            };
        };

        let cleanup: (() => void) | void;
        void tryInit().then((fn) => {
            cleanup = fn;
        });

        return () => {
            canceled = true;
            cleanup?.();
            resizeObserverRef.current?.disconnect();
            resizeObserverRef.current = null;
            if (mapRef.current) {
                mapRef.current.dispose();
                mapRef.current = null;
                initializedRef.current = false;
            }
        };
    }, []);

    useEffect(() => {
        const H = window.H;
        if (!H || !geofenceGroupRef.current) return;

        const group = geofenceGroupRef.current;
        group.removeObjects(group.getObjects(true));

        geofences.forEach(geo => {
            try {
                if (geo.points && geo.points.length > 2) {
                    const ls = new H.geo.LineString();
                    geo.points.forEach((p: any) => {
                        if (p.lat && p.lng) ls.pushPoint({ lat: p.lat, lng: p.lng });
                    });
                    if (geo.points[0]) ls.pushPoint({ lat: geo.points[0].lat, lng: geo.points[0].lng });

                    group.addObject(new H.map.Polygon(ls, {
                        style: {
                            strokeColor: 'rgba(59,130,246,0.75)',
                            fillColor: 'rgba(59,130,246,0.16)',
                            lineWidth: 2
                        }
                    }));
                } else if (geo.latitude && geo.longitude && geo.radius) {
                    group.addObject(new H.map.Circle(
                        { lat: geo.latitude, lng: geo.longitude },
                        geo.radius,
                        {
                            style: {
                                strokeColor: 'rgba(139,92,246,0.75)',
                                fillColor: 'rgba(139,92,246,0.14)',
                                lineWidth: 2
                            }
                        }
                    ));
                }
            } catch {
                // Skip invalid geofence geometry
            }
        });

        locais.forEach(local => {
            if (!local.latitude || !local.longitude) return;
            try {
                group.addObject(new H.map.Circle(
                    { lat: local.latitude, lng: local.longitude },
                    local.raio || 50,
                    {
                        style: {
                            strokeColor: local.cor ? `${local.cor}cc` : 'rgba(16,185,129,0.8)',
                            fillColor: local.cor ? `${local.cor}26` : 'rgba(16,185,129,0.15)',
                            lineWidth: 2
                        }
                    }
                ));
            } catch {
                // Skip invalid local geometry
            }
        });
    }, [geofences, locais]);

    useEffect(() => {
        const H = window.H;
        if (!H || !mapRef.current) return;

        const map = mapRef.current;

        if (clusterLayerRef.current) {
            try {
                map.removeLayer(clusterLayerRef.current);
            } catch {
                // Ignore stale layer
            }
            clusterLayerRef.current = null;
        }

        const validVehicles = vehicles.filter(v => v.latitude && v.longitude && v.latitude !== 0 && v.longitude !== 0);
        if (!validVehicles.length) return;

        const dataPoints = validVehicles.map(v => new H.clustering.DataPoint(v.latitude, v.longitude, null, v));

        const theme = {
            getClusterPresentation(cluster: any) {
                const el = document.createElement('div');
                el.style.cssText = [
                    'background:#2563eb',
                    'color:white',
                    'border:3px solid white',
                    'border-radius:50%',
                    'width:40px',
                    'height:40px',
                    'display:flex',
                    'align-items:center',
                    'justify-content:center',
                    'font-weight:900',
                    'font-size:14px',
                    'box-shadow:0 4px 15px rgba(37,99,235,0.5)',
                    'cursor:pointer'
                ].join(';');
                el.textContent = String(cluster.getWeight());
                return new H.map.DomMarker(cluster.getPosition(), { icon: new H.map.DomIcon(el) });
            },
            getNoisePresentation(noisePoint: any) {
                const vehicle: CartrackVehicle = noisePoint.getData();
                const isSelected = selectedVehicle?.id === vehicle.id;
                const marker = new H.map.DomMarker(noisePoint.getPosition(), {
                    icon: new H.map.DomIcon(buildVehicleMarkerEl(vehicle, isSelected)),
                    data: vehicle
                });
                marker.addEventListener('tap', () => onSelectVehicleRef.current?.(vehicle));
                return marker;
            }
        };

        const provider = new H.clustering.Provider(dataPoints, {
            clusteringOptions: {
                eps: 44,
                minWeight: 2
            },
            theme
        });

        const layer = new H.map.layer.ObjectLayer(provider);
        clusterLayerRef.current = layer;
        map.addLayer(layer);

        if (!selectedVehicle) {
            const bounds = computeBounds(validVehicles);
            if (bounds) {
                map.getViewModel().setLookAtData({ bounds }, true);
            }
        }
    }, [vehicles, selectedVehicle, activeServiceByVehicle]);

    useEffect(() => {
        if (!mapRef.current || !selectedVehicle?.latitude || !selectedVehicle?.longitude) return;
        mapRef.current.setCenter({ lat: selectedVehicle.latitude, lng: selectedVehicle.longitude }, true);
        mapRef.current.setZoom(16, true);
    }, [selectedVehicle?.id]);

    return (
        <div ref={containerRef} style={{ width: '100%', height: '100%', borderRadius: 'inherit', position: 'relative' }}>
            {mapError && (
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(10,10,15,0.82)',
                    color: '#fca5a5',
                    fontWeight: 700,
                    fontSize: '12px',
                    textAlign: 'center',
                    padding: '20px',
                    zIndex: 5
                }}>
                    {mapError}
                </div>
            )}
        </div>
    );
}
