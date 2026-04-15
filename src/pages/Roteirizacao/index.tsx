import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
    MapPin, Search, Navigation,
    GripVertical, Trash2, ArrowRight,
    Save, RefreshCw, Car, CheckCircle2,
    AlertCircle, X, Route, Crosshair
} from 'lucide-react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { useWorkshop } from '../../contexts/WorkshopContext';
import { useAuth } from '../../contexts/AuthContext';

const HERE_API_KEY = String(
    import.meta.env.VITE_HERE_API_KEY || (import.meta.env as any).HERE_API_KEY || ''
).trim();

interface RouteStop {
    id: string;
    name: string;
    lat: number;
    lng: number;
    type: string;
}

interface RouteSummary {
    distance: number;
    time: number;
    fuel: number;
    cost: number;
}

interface RoutePoint {
    lat: number;
    lng: number;
}

function parseCoordinateValue(value: unknown): number | null {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null;
    }

    if (typeof value === 'string') {
        const normalized = value.trim().replace(',', '.');
        if (!normalized) return null;
        const parsed = Number(normalized);
        return Number.isFinite(parsed) ? parsed : null;
    }

    return null;
}

function normalizeCoordinatePair(latValue: unknown, lngValue: unknown): RoutePoint | null {
    let lat = parseCoordinateValue(latValue);
    let lng = parseCoordinateValue(lngValue);

    if (lat === null || lng === null) return null;

    const looksSwapped = (Math.abs(lat) > 90 && Math.abs(lng) <= 90)
        || (Math.abs(lat) < 25 && Math.abs(lng) > 25);

    if (looksSwapped) {
        [lat, lng] = [lng, lat];
    }

    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
        return null;
    }

    return { lat, lng };
}

function getItemCoordinates(item: any): RoutePoint | null {
    return normalizeCoordinatePair(
        item?.points?.[0]?.lat ?? item?.position?.lat ?? item?.center?.lat ?? item?.lat ?? item?.latitude ?? item?.y,
        item?.points?.[0]?.lng ?? item?.position?.lng ?? item?.center?.lng ?? item?.lng ?? item?.longitude ?? item?.x
    );
}

function formatHereWaypoint(point: RoutePoint) {
    return `${point.lat},${point.lng}`;
}

function getHereBaseLayer(layers: any) {
    return layers?.raster?.normal?.map
        || layers?.vector?.normal?.map
        || layers?.normal?.map
        || layers?.raster?.satellite?.map
        || null;
}

function SortableItem(props: any) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: props.id });
    const style = { transform: CSS.Transform.toString(transform), transition };
    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="touch-none">
            {props.children}
        </div>
    );
}

function normalizePlate(value?: string | null) {
    return String(value || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

function buildStopIcon(index: number, total: number) {
    const isFirst = index === 0;
    const isLast = index === total - 1;
    const bg = isFirst ? '#22c55e' : (isLast ? '#ef4444' : '#2563eb');
    const border = isFirst ? '#16a34a' : (isLast ? '#dc2626' : '#1d4ed8');

    const el = document.createElement('div');
    el.style.cssText = 'width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-weight:900;font-size:13px;border:3px solid ' + border + ';box-shadow:0 4px 14px rgba(0,0,0,0.25);background:' + bg + ';';
    el.innerText = String(index + 1);
    return new window.H.map.DomIcon(el);
}

function buildVehicleMarkerEl(registration: string) {
    const el = document.createElement('div');
    el.style.cssText = 'display:flex;flex-direction:column;align-items:center;';
    el.innerHTML = `
        <div style="background:#0f172a;color:white;padding:2px 8px;border-radius:6px;font-size:11px;font-weight:900;border:1px solid rgba(255,255,255,0.2);box-shadow:0 4px 12px rgba(0,0,0,0.4);margin-bottom:5px;white-space:nowrap;">${registration}</div>
        <div style="width:24px;height:24px;background:#0ea5e9;border:3px solid white;border-radius:50%;box-shadow:0 0 16px rgba(14,165,233,0.65);"></div>
    `;
    return el;
}

function projectToSegment(point: RoutePoint, a: RoutePoint, b: RoutePoint): RoutePoint {
    const ax = a.lng;
    const ay = a.lat;
    const bx = b.lng;
    const by = b.lat;
    const px = point.lng;
    const py = point.lat;

    const abx = bx - ax;
    const aby = by - ay;
    const ab2 = abx * abx + aby * aby;
    if (ab2 === 0) return a;

    const apx = px - ax;
    const apy = py - ay;
    const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / ab2));
    return { lat: ay + aby * t, lng: ax + abx * t };
}

function distanceMeters(a: RoutePoint, b: RoutePoint) {
    const R = 6371000;
    const dLat = (b.lat - a.lat) * Math.PI / 180;
    const dLng = (b.lng - a.lng) * Math.PI / 180;
    const lat1 = a.lat * Math.PI / 180;
    const lat2 = b.lat * Math.PI / 180;

    const sinDLat = Math.sin(dLat / 2);
    const sinDLng = Math.sin(dLng / 2);
    const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
    return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function snapToRoute(point: RoutePoint, path: RoutePoint[]) {
    if (path.length < 2) return { snapped: point, distance: Infinity };

    let bestPoint = point;
    let bestDistance = Infinity;

    for (let i = 0; i < path.length - 1; i += 1) {
        const projected = projectToSegment(point, path[i], path[i + 1]);
        const d = distanceMeters(point, projected);
        if (d < bestDistance) {
            bestDistance = d;
            bestPoint = projected;
        }
    }

    return { snapped: bestPoint, distance: bestDistance };
}

function decodeSectionPolyline(polyline: string): RoutePoint[] {
    const H = window.H;
    if (!H || !polyline) return [];

    const line = H.geo.LineString.fromFlexPolyline(polyline);
    const points: RoutePoint[] = [];

    for (let i = 0; i < line.getPointCount(); i += 1) {
        const p = line.extractPoint(i);
        points.push({ lat: p.lat, lng: p.lng });
    }

    return points;
}

export default function Roteirizacao() {
    const {
        locais,
        motoristas,
        viaturas,
        saveRoute,
        registerLog,
        rotasPlaneadas,
        updateRouteStatus,
        geofences,
        cartrackVehicles
    } = useWorkshop();
    const { currentUser } = useAuth();

    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<any>(null);
    const platformRef = useRef<any>(null);
    const routeGroupRef = useRef<any>(null);
    const stopMarkerGroupRef = useRef<any>(null);
    const navMarkerRef = useRef<any>(null);
    const routePathRef = useRef<RoutePoint[]>([]);
    const lastRerouteAtRef = useRef(0);

    const [selectedMotorista, setSelectedMotorista] = useState('');
    const [selectedViatura, setSelectedViatura] = useState('');
    const [trackedVehicleId, setTrackedVehicleId] = useState('');
    const [routeStops, setRouteStops] = useState<RouteStop[]>([]);

    const [searchTerm, setSearchTerm] = useState('');
    const [geocodeResults, setGeocodeResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    const searchDebounceRef = useRef<any>(null);

    const [activeTab, setActiveTab] = useState<'locais' | 'ativas'>('locais');
    const [isSaving, setIsSaving] = useState(false);
    const [isRouting, setIsRouting] = useState(false);
    const [routeError, setRouteError] = useState<string | null>(null);
    const [navigationEnabled, setNavigationEnabled] = useState(false);
    const [autoCenterNav, setAutoCenterNav] = useState(true);
    const [isOffRoute, setIsOffRoute] = useState(false);

    const [routePath, setRoutePath] = useState<RoutePoint[]>([]);
    const [summary, setSummary] = useState<RouteSummary>({ distance: 0, time: 0, fuel: 0, cost: 0 });

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const defaultCenter = { lat: 38.7223, lng: -9.1393 };

    const trackedVehicle = useMemo(() => {
        if (!trackedVehicleId) return null;
        return cartrackVehicles.find(v => String(v.id) === String(trackedVehicleId)) || null;
    }, [cartrackVehicles, trackedVehicleId]);

    useEffect(() => {
        if (!selectedViatura || trackedVehicleId) return;
        const appVehicle = viaturas.find(v => v.id === selectedViatura);
        if (!appVehicle) return;

        const target = normalizePlate(appVehicle.matricula);
        if (!target) return;

        const match = cartrackVehicles.find(v => normalizePlate(v.registration) === target);
        if (match) setTrackedVehicleId(match.id);
    }, [selectedViatura, trackedVehicleId, viaturas, cartrackVehicles]);

    const initializeMap = useCallback(() => {
        if (mapRef.current || !mapContainerRef.current || !HERE_API_KEY) return undefined;

        let cancelled = false;
        let resizeHandler: (() => void) | null = null;

        const tryInit = () => {
            if (cancelled || mapRef.current || !mapContainerRef.current) return;

            const H = window.H;
            if (!H) {
                window.setTimeout(tryInit, 150);
                return;
            }

            try {
                const platform = new H.service.Platform({ apikey: HERE_API_KEY });
                platformRef.current = platform;

                const layers = platform.createDefaultLayers();
                const baseLayer = getHereBaseLayer(layers);
                if (!baseLayer) {
                    console.error('[Roteirização] HERE base layer indisponível.');
                    return;
                }

                const map = new H.Map(mapContainerRef.current, baseLayer, {
                    center: defaultCenter,
                    zoom: 11,
                    pixelRatio: window.devicePixelRatio || 1
                });

                mapRef.current = map;
                new H.mapevents.Behavior(new H.mapevents.MapEvents(map));
                H.ui.UI.createDefault(map, layers, 'pt-PT');

                routeGroupRef.current = new H.map.Group();
                stopMarkerGroupRef.current = new H.map.Group();

                map.addObject(routeGroupRef.current);
                map.addObject(stopMarkerGroupRef.current);

                map.addEventListener('tap', async (evt: any) => {
                    const target = evt.target;
                    if (target && target !== map) return;

                    const pointer = evt.currentPointer;
                    const coord = map.screenToGeo(pointer.viewportX, pointer.viewportY);
                    if (!coord) return;

                    const name = await (async () => {
                        try {
                            const response = await fetch(
                                `https://revgeocode.search.hereapi.com/v1/revgeocode?at=${coord.lat},${coord.lng}&lang=pt-PT&limit=1&apikey=${HERE_API_KEY}`
                            );
                            const data = await response.json();
                            return data?.items?.[0]?.title || `Ponto ${coord.lat.toFixed(5)}, ${coord.lng.toFixed(5)}`;
                        } catch {
                            return `Ponto ${coord.lat.toFixed(5)}, ${coord.lng.toFixed(5)}`;
                        }
                    })();

                    setRouteStops(prev => [
                        ...prev,
                        {
                            id: crypto.randomUUID(),
                            name,
                            lat: coord.lat,
                            lng: coord.lng,
                            type: 'mapa'
                        }
                    ]);
                });

                const resizeMap = () => {
                    try {
                        map.getViewPort().resize();
                    } catch {
                        // Ignore transient resize issues
                    }
                };

                resizeHandler = () => resizeMap();
                window.addEventListener('resize', resizeHandler);

                window.setTimeout(resizeMap, 120);
                window.setTimeout(resizeMap, 600);
                window.setTimeout(resizeMap, 1200);
            } catch (error) {
                console.error('[Roteirização] Falha ao inicializar HERE map:', error);
            }
        };

        tryInit();

        return () => {
            cancelled = true;
            if (resizeHandler) {
                window.removeEventListener('resize', resizeHandler);
            }
        };
    }, []);

    useEffect(() => {
        const cleanupInit = initializeMap();
        return () => {
            cleanupInit?.();
            if (mapRef.current) {
                mapRef.current.dispose();
                mapRef.current = null;
            }
        };
    }, [initializeMap]);

    const fetchHereRoute = useCallback(async (stops: RouteStop[], originOverride?: RoutePoint) => {
        if (stops.length < 2 || !HERE_API_KEY) {
            setRoutePath([]);
            setSummary({ distance: 0, time: 0, fuel: 0, cost: 0 });
            return;
        }

        setIsRouting(true);
        setRouteError(null);

        try {
            const normalizedStops = stops.map(stop => ({
                stop,
                coords: getItemCoordinates(stop)
            }));
            const hasInvalidStop = normalizedStops.some(entry => entry.coords === null);
            const origin = originOverride
                ? normalizeCoordinatePair(originOverride.lat, originOverride.lng)
                : normalizedStops[0]?.coords ?? null;
            const destination = normalizedStops[normalizedStops.length - 1]?.coords ?? null;
            const viaStops = normalizedStops.slice(1, -1).map(entry => entry.coords).filter((coords): coords is RoutePoint => coords !== null);

            if (hasInvalidStop || !origin || !destination) {
                setRouteError('Os pontos selecionados não têm coordenadas válidas para cálculo de rota.');
                setRoutePath([]);
                setSummary({ distance: 0, time: 0, fuel: 0, cost: 0 });
                return;
            }

            const params = new URLSearchParams();
            params.set('transportMode', 'car');
            params.set('origin', formatHereWaypoint(origin));
            params.set('destination', formatHereWaypoint(destination));
            params.set('return', 'polyline,summary');
            params.set('apikey', HERE_API_KEY);
            viaStops.forEach(coords => params.append('via', formatHereWaypoint(coords)));

            const response = await fetch(`https://router.hereapi.com/v8/routes?${params.toString()}`);
            const data = await response.json();

            if (!response.ok) {
                console.error('[HERE Routing] API error:', data);
                throw new Error(data?.error_description || data?.error || data?.title || 'HERE routing failed');
            }

            const route = data?.routes?.[0];
            if (!route || !route.sections?.length) {
                console.warn('[HERE Routing] No route found for waypoints:', {
                    origin,
                    destination,
                    via: viaStops,
                    data
                });
                setRouteError('Não foi possível calcular a rota para os pontos selecionados.');
                setRoutePath([]);
                setSummary({ distance: 0, time: 0, fuel: 0, cost: 0 });
                return;
            }

            const points: RoutePoint[] = route.sections.flatMap((section: any) => decodeSectionPolyline(section.polyline || ''));
            const totalDistance = route.sections.reduce((sum: number, section: any) => sum + Number(section.summary?.length || 0), 0);
            const totalDuration = route.sections.reduce((sum: number, section: any) => sum + Number(section.summary?.duration || 0), 0);

            const distanceKm = totalDistance / 1000;
            const minutes = totalDuration / 60;

            setSummary({
                distance: distanceKm,
                time: minutes,
                fuel: (distanceKm / 100) * 8.5,
                cost: (distanceKm / 100) * 8.5 * 1.62
            });
            setRoutePath(points);
        } catch (error) {
            console.error('[HERE Routing] Route calculation failed:', error);
            setRouteError('Erro ao contactar o serviço HERE Routing.');
            setRoutePath([]);
            setSummary({ distance: 0, time: 0, fuel: 0, cost: 0 });
        } finally {
            setIsRouting(false);
        }
    }, []);

    useEffect(() => {
        if (routeStops.length >= 2) {
            const timer = setTimeout(() => {
                void fetchHereRoute(routeStops);
            }, 450);
            return () => clearTimeout(timer);
        }

        setRoutePath([]);
        setSummary({ distance: 0, time: 0, fuel: 0, cost: 0 });
        setRouteError(null);
    }, [routeStops, fetchHereRoute]);

    useEffect(() => {
        const H = window.H;
        if (!H || !mapRef.current || !routeGroupRef.current) return;

        const routeGroup = routeGroupRef.current;
        routeGroup.removeObjects(routeGroup.getObjects(true));
        routePathRef.current = routePath;

        if (routePath.length < 2) return;

        const borderLine = new H.geo.LineString();
        const mainLine = new H.geo.LineString();

        routePath.forEach(point => {
            borderLine.pushPoint(point);
            mainLine.pushPoint(point);
        });

        const borderPolyline = new H.map.Polyline(borderLine, {
            style: { strokeColor: 'rgba(255,255,255,0.7)', lineWidth: 8 }
        });
        const mainPolyline = new H.map.Polyline(mainLine, {
            style: { strokeColor: '#2563eb', lineWidth: 5 }
        });

        routeGroup.addObject(borderPolyline);
        routeGroup.addObject(mainPolyline);

        const bounds = routeGroup.getBoundingBox();
        if (bounds) {
            mapRef.current.setLookAtData({ bounds }, true);
        }
    }, [routePath]);

    useEffect(() => {
        const H = window.H;
        if (!H || !mapRef.current || !stopMarkerGroupRef.current) return;

        const group = stopMarkerGroupRef.current;
        group.removeObjects(group.getObjects(true));

        const markers = routeStops.map((stop, index) => {
            const marker = new H.map.DomMarker({ lat: stop.lat, lng: stop.lng }, {
                icon: buildStopIcon(index, routeStops.length),
                data: stop
            });
            marker.addEventListener('tap', () => {
                const HRef = window.H;
                if (!HRef || !mapRef.current) return;
                const bubble = new HRef.ui.InfoBubble({ lat: stop.lat, lng: stop.lng }, {
                    content: `<div style="font-size:12px;font-weight:700;">${stop.name}</div>`
                });
                const ui = HRef.ui.UI.createDefault(mapRef.current, platformRef.current?.createDefaultLayers?.() || undefined, 'pt-PT');
                ui.addBubble(bubble);
                setTimeout(() => bubble.close(), 1600);
            });
            return marker;
        });

        group.addObjects(markers);
    }, [routeStops]);

    useEffect(() => {
        if (!navigationEnabled || !trackedVehicle || !mapRef.current || !window.H) return;

        const currentPosition = { lat: trackedVehicle.latitude, lng: trackedVehicle.longitude };
        if (!currentPosition.lat || !currentPosition.lng) return;

        const { snapped, distance } = snapToRoute(currentPosition, routePathRef.current);

        if (!navMarkerRef.current) {
            navMarkerRef.current = new window.H.map.DomMarker(snapped, {
                icon: new window.H.map.DomIcon(buildVehicleMarkerEl(trackedVehicle.registration || 'VIATURA'))
            });
            mapRef.current.addObject(navMarkerRef.current);
        } else {
            navMarkerRef.current.setGeometry(snapped);
        }

        if (autoCenterNav) {
            mapRef.current.setCenter(snapped, true);
            mapRef.current.setZoom(16, true);
        }

        const deviated = Number.isFinite(distance) && distance > 120;
        setIsOffRoute(deviated);

        const now = Date.now();
        if (deviated && routeStops.length >= 2 && now - lastRerouteAtRef.current > 12000) {
            lastRerouteAtRef.current = now;
            void fetchHereRoute(routeStops, currentPosition);
        }
    }, [navigationEnabled, autoCenterNav, trackedVehicle?.latitude, trackedVehicle?.longitude, trackedVehicle?.id, fetchHereRoute, routeStops]);

    useEffect(() => {
        if (!navigationEnabled || !mapRef.current || !navMarkerRef.current) return;

        if (!trackedVehicle) {
            mapRef.current.removeObject(navMarkerRef.current);
            navMarkerRef.current = null;
            setIsOffRoute(false);
        }
    }, [navigationEnabled, trackedVehicle]);

    useEffect(() => {
        if (navigationEnabled) return;
        if (mapRef.current && navMarkerRef.current) {
            mapRef.current.removeObject(navMarkerRef.current);
            navMarkerRef.current = null;
        }
        setIsOffRoute(false);
    }, [navigationEnabled]);

    const handleAddStop = (item: any) => {
        const coords = getItemCoordinates(item);
        if (!coords) {
            console.warn('[Roteirização] Ignored POI with invalid coordinates:', item);
            return;
        }

        const stop: RouteStop = {
            id: crypto.randomUUID(),
            name: item.nome || item.name,
            lat: coords.lat,
            lng: coords.lng,
            type: item.source === 'geofence' ? 'pesquisa' : 'local'
        };
        setRouteStops(prev => [...prev, stop]);
    };

    const handleAddGeocodedStop = (result: any) => {
        const coords = getItemCoordinates(result);
        if (!coords) return;

        const stop: RouteStop = {
            id: `geo-${Date.now()}`,
            name: result.title || result.address?.label || `${result.position?.lat}, ${result.position?.lng}`,
            lat: coords.lat,
            lng: coords.lng,
            type: 'pesquisa'
        };
        setRouteStops(prev => [...prev, stop]);
        setSearchTerm('');
        setGeocodeResults([]);
        setShowDropdown(false);
    };

    const handleRemoveStop = (id: string) => setRouteStops(prev => prev.filter(s => s.id !== id));

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            setRouteStops(items => {
                const oldIndex = items.findIndex(i => i.id === active.id);
                const newIndex = items.findIndex(i => i.id === over.id);
                return arrayMove(items, oldIndex, newIndex);
            });
        }
    };

    const handleOptimize = () => {
        if (routeStops.length < 3) return;

        const haversine = (a: RouteStop, b: RouteStop) => {
            const R = 6371;
            const dLat = (b.lat - a.lat) * Math.PI / 180;
            const dLng = (b.lng - a.lng) * Math.PI / 180;
            const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
            return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
        };

        const routeDist = (order: RouteStop[]) => order.reduce((sum, s, i) => i === 0 ? 0 : sum + haversine(order[i - 1], s), 0);

        const first = routeStops[0];
        const last = routeStops[routeStops.length - 1];
        const middle = routeStops.slice(1, -1);
        if (middle.length === 0) return;

        const permute = (arr: RouteStop[]): RouteStop[][] => {
            if (arr.length <= 1) return [arr];
            return arr.flatMap((el, i) => permute([...arr.slice(0, i), ...arr.slice(i + 1)]).map(rest => [el, ...rest]));
        };

        let bestOrder: RouteStop[];
        if (middle.length <= 7) {
            const perms = permute(middle);
            bestOrder = perms.reduce((best, perm) => {
                const candidate = [first, ...perm, last];
                return routeDist(candidate) < routeDist([first, ...best, last]) ? perm : best;
            }, middle);
        } else {
            const optimized: RouteStop[] = [];
            let remaining = [...middle];
            let current = first;
            while (remaining.length > 0) {
                let nearestIdx = 0;
                let minDist = Infinity;
                remaining.forEach((s, i) => {
                    const d = haversine(current, s);
                    if (d < minDist) {
                        minDist = d;
                        nearestIdx = i;
                    }
                });
                optimized.push(remaining[nearestIdx]);
                current = remaining[nearestIdx];
                remaining.splice(nearestIdx, 1);
            }
            bestOrder = optimized;
        }

        setRouteStops([first, ...bestOrder, last]);
    };

    const handleSaveRoute = async () => {
        if (routeStops.length < 2) return;
        setIsSaving(true);
        try {
            const { data, success } = await saveRoute({
                motorista_id: selectedMotorista || undefined,
                viatura_id: selectedViatura || undefined,
                data: new Date().toISOString().split('T')[0],
                distancia_estimada: summary.distance,
                tempo_estimado: Math.round(summary.time),
                consumo_estimado: summary.fuel,
                custo_estimado: summary.cost,
                rota_json: routeStops,
                estado: 'planeada'
            });

            if (success && data) {
                await registerLog({
                    utilizador: currentUser?.email || 'Sistema',
                    acao: 'PLANEAR_ROTA',
                    referencia_id: data.id,
                    detalhes_json: { paragens: routeStops.length, distancia: summary.distance }
                });
                alert('Rota guardada com sucesso!');
            } else {
                throw new Error('Falha');
            }
        } catch {
            alert('Erro ao guardar rota.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleFinalizeRoute = async (routeId: string, plannedDist: number) => {
        const realDist = prompt(`Distância real percorrida (KM) - estimativa: ${plannedDist.toFixed(1)}km:`, plannedDist.toFixed(1));
        if (realDist === null) return;
        const distance = parseFloat(realDist);
        const deviation = Math.abs(distance - plannedDist) / plannedDist;
        let justification = '';
        if (deviation > 0.25) {
            justification = prompt('Desvio >25% detetado. Introduza uma justificação:', '') || '';
            if (!justification) {
                alert('Justificação obrigatória para desvios >25%.');
                return;
            }
        }
        try {
            await updateRouteStatus(routeId, 'concluida', distance, justification);
            alert('Rota concluída!');
        } catch {
            alert('Erro ao concluir rota.');
        }
    };

    const handleSearchChange = (value: string) => {
        setSearchTerm(value);
        setShowDropdown(value.length > 1);
        if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
        if (value.length < 3) {
            setGeocodeResults([]);
            return;
        }
        setIsSearching(true);

        searchDebounceRef.current = setTimeout(async () => {
            try {
                const response = await fetch(`https://geocode.search.hereapi.com/v1/geocode?q=${encodeURIComponent(value)}&in=countryCode:PRT&limit=6&lang=pt-PT&apiKey=${HERE_API_KEY}`);
                const data = await response.json();
                setGeocodeResults(data?.items || []);
            } catch {
                setGeocodeResults([]);
            } finally {
                setIsSearching(false);
            }
        }, 450);
    };

    const cartrackPOIs = geofences
        .map(g => {
            const coords = getItemCoordinates(g);
            if (!coords) return null;
            return {
                id: g.id,
                nome: g.name,
                latitude: coords.lat,
                longitude: coords.lng,
                tipo: g.group_name || 'cartrack',
                source: 'geofence' as const
            };
        })
        .filter((g): g is NonNullable<typeof g> => g !== null);

    const allPOIs = [
        ...locais.map(l => ({ ...l, source: 'local' as const })),
        ...cartrackPOIs
    ];
    const filteredPOIs = allPOIs.filter(p => p.nome?.toLowerCase().includes(searchTerm.toLowerCase()));
    const activeRoutes = rotasPlaneadas.filter(r => r.estado === 'planeada');

    const formatTime = (mins: number) => {
        if (mins < 60) return `${Math.round(mins)} min`;
        const h = Math.floor(mins / 60);
        const m = Math.round(mins % 60);
        return m > 0 ? `${h}h ${m}min` : `${h}h`;
    };

    return (
        <div className="flex h-full w-full overflow-hidden">
            <div className="w-[380px] shrink-0 flex flex-col bg-white border-r border-slate-200 shadow-lg z-10 overflow-hidden">
                <div className="px-5 pt-5 pb-4 border-b border-slate-100 shrink-0">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25 shrink-0">
                            <Route className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-sm font-extrabold text-slate-900 uppercase tracking-tight leading-none">Roteirização</h1>
                            <p className="text-[10px] text-blue-500 font-bold uppercase tracking-widest mt-0.5">HERE Navigation Mode</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mb-2">
                        <div>
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Motorista</label>
                            <select
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none"
                                value={selectedMotorista}
                                onChange={e => setSelectedMotorista(e.target.value)}
                            >
                                <option value="">Nenhum</option>
                                {motoristas.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Viatura</label>
                            <select
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none"
                                value={selectedViatura}
                                onChange={e => setSelectedViatura(e.target.value)}
                            >
                                <option value="">Nenhuma</option>
                                {viaturas.map(v => <option key={v.id} value={v.id}>{v.matricula}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2">
                        <div>
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Viatura Cartrack</label>
                            <select
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none"
                                value={trackedVehicleId}
                                onChange={e => setTrackedVehicleId(e.target.value)}
                            >
                                <option value="">Selecionar viatura para navegação</option>
                                {cartrackVehicles
                                    .filter(v => v.latitude && v.longitude)
                                    .sort((a, b) => a.registration.localeCompare(b.registration))
                                    .map(v => (
                                        <option key={v.id} value={v.id}>{v.registration}</option>
                                    ))}
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={() => setNavigationEnabled(v => !v)}
                                disabled={!trackedVehicleId || routeStops.length < 2}
                                className={`py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition ${navigationEnabled ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700'} disabled:opacity-40`}
                            >
                                {navigationEnabled ? 'Navegação ON' : 'Navegação OFF'}
                            </button>
                            <button
                                onClick={() => setAutoCenterNav(v => !v)}
                                disabled={!navigationEnabled}
                                className={`py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition ${autoCenterNav ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'} disabled:opacity-40`}
                            >
                                Auto-center
                            </button>
                        </div>
                    </div>
                </div>

                <div className="px-4 pt-3 pb-2 shrink-0">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Pesquisar morada, local, POI..."
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-8 py-2.5 text-xs"
                            value={searchTerm}
                            onChange={e => handleSearchChange(e.target.value)}
                            onFocus={() => searchTerm.length > 1 && setShowDropdown(true)}
                            onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                        />
                        {isSearching ? (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                            </div>
                        ) : searchTerm && (
                            <button className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500"
                                onMouseDown={() => { setSearchTerm(''); setGeocodeResults([]); setShowDropdown(false); }}>
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}

                        {showDropdown && (filteredPOIs.length > 0 || geocodeResults.length > 0) && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl overflow-hidden z-50 shadow-2xl max-h-64 overflow-y-auto">
                                {filteredPOIs.slice(0, 4).map(poi => (
                                    <button key={`${poi.source}-${poi.id}`}
                                        onMouseDown={() => { handleAddStop(poi); setShowDropdown(false); setSearchTerm(''); }}
                                        className="w-full text-left px-3 py-2.5 hover:bg-blue-50 flex items-center gap-2.5 border-b border-slate-100 transition-colors">
                                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${poi.source === 'geofence' ? 'bg-indigo-100' : 'bg-blue-100'}`}>
                                            <MapPin className={`w-3 h-3 ${poi.source === 'geofence' ? 'text-indigo-600' : 'text-blue-600'}`} />
                                        </div>
                                        <div>
                                            <div className="text-xs text-slate-800 font-semibold">{poi.nome}</div>
                                            <div className="text-[9px] text-slate-400">{poi.source === 'geofence' ? 'Cartrack' : 'Local'} - {poi.tipo}</div>
                                        </div>
                                    </button>
                                ))}
                                {geocodeResults.map((result, i) => (
                                    <button key={i}
                                        onMouseDown={() => handleAddGeocodedStop(result)}
                                        className="w-full text-left px-3 py-2.5 hover:bg-slate-50 flex items-center gap-2.5 border-b border-slate-100 last:border-0 transition-colors">
                                        <div className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                                            <Search className="w-3 h-3 text-slate-500" />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="text-xs text-slate-800 font-semibold truncate">{result.title}</div>
                                            <div className="text-[9px] text-slate-400 truncate">{result.address?.label || ''}</div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="px-4 pb-2 shrink-0">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                            <MapPin className="w-3 h-3 text-blue-500" />
                            Paragens ({routeStops.length})
                        </span>
                        {routeStops.length > 0 && (
                            <button onClick={() => setRouteStops([])} className="text-[10px] text-red-400 hover:text-red-600 font-semibold transition-colors">
                                Limpar tudo
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto scrollbar-none px-4 min-h-0 pb-2">
                    {routeStops.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center gap-3 py-8">
                            <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center">
                                <Route className="w-7 h-7 text-blue-300" />
                            </div>
                            <div className="text-center">
                                <p className="text-xs font-semibold text-slate-500">Sem paragens definidas</p>
                                <p className="text-[10px] text-slate-400 mt-1">Pesquise, clique no mapa, ou use POIs Cartrack</p>
                            </div>
                        </div>
                    ) : (
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                            <SortableContext items={routeStops} strategy={verticalListSortingStrategy}>
                                <div className="space-y-1.5">
                                    {routeStops.map((stop, index) => {
                                        const isFirst = index === 0;
                                        const isLast = index === routeStops.length - 1;
                                        return (
                                            <SortableItem key={stop.id} id={stop.id}>
                                                <div className={`group flex items-center gap-2.5 p-2.5 rounded-xl border cursor-grab active:cursor-grabbing transition-all hover:shadow-sm ${
                                                    isFirst ? 'bg-emerald-50 border-emerald-200' :
                                                        isLast && routeStops.length > 1 ? 'bg-red-50 border-red-200' :
                                                            'bg-white border-slate-200 hover:border-blue-200'
                                                    }`}>
                                                    <GripVertical className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 text-white ${
                                                        isFirst ? 'bg-emerald-500' :
                                                            isLast && routeStops.length > 1 ? 'bg-red-500' :
                                                                'bg-blue-500'
                                                        }`}>{index + 1}</div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-xs font-semibold text-slate-800 truncate">{stop.name}</div>
                                                        <div className="text-[9px] text-slate-400 capitalize">
                                                            {isFirst ? 'Partida' : isLast && routeStops.length > 1 ? 'Destino' : `Paragem ${index}`}
                                                        </div>
                                                    </div>
                                                    <button onClick={() => handleRemoveStop(stop.id)}
                                                        className="p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0">
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </SortableItem>
                                        );
                                    })}
                                </div>
                            </SortableContext>
                        </DndContext>
                    )}
                </div>

                {routePath.length > 1 && (
                    <div className="mx-4 mb-3 p-3 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl shrink-0">
                        <div className="grid grid-cols-4 gap-2">
                            <div className="text-center"><div className="text-[8px] font-bold text-blue-200 uppercase">KM</div><div className="text-sm font-black text-white">{summary.distance.toFixed(1)}</div></div>
                            <div className="text-center"><div className="text-[8px] font-bold text-blue-200 uppercase">Tempo</div><div className="text-sm font-black text-white">{formatTime(summary.time)}</div></div>
                            <div className="text-center"><div className="text-[8px] font-bold text-blue-200 uppercase">Litros</div><div className="text-sm font-black text-amber-300">{summary.fuel.toFixed(1)}</div></div>
                            <div className="text-center"><div className="text-[8px] font-bold text-blue-200 uppercase">Custo</div><div className="text-sm font-black text-emerald-300">{summary.cost.toFixed(2)}EUR</div></div>
                        </div>
                        {isRouting && (
                            <div className="flex items-center justify-center gap-1.5 mt-2">
                                <div className="w-2 h-2 border border-white border-t-transparent rounded-full animate-spin" />
                                <span className="text-[9px] text-blue-200 font-semibold">A calcular rota HERE...</span>
                            </div>
                        )}
                    </div>
                )}

                {(routeError || isOffRoute) && (
                    <div className="mx-4 mb-3 p-2.5 bg-red-50 border border-red-200 rounded-xl shrink-0">
                        <div className="flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                            <span className="text-[10px] text-red-600 font-semibold">{routeError || 'Desvio de rota detetado. A recalcular automaticamente...'}</span>
                        </div>
                    </div>
                )}

                <div className="px-4 pb-4 space-y-2 shrink-0">
                    <div className="grid grid-cols-2 gap-2">
                        <button onClick={handleOptimize} disabled={routeStops.length < 3}
                            className="flex items-center justify-center gap-1.5 py-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl text-[11px] font-bold text-slate-700 uppercase transition-all disabled:opacity-40 group">
                            <RefreshCw className="w-3.5 h-3.5 group-hover:rotate-180 transition-transform duration-500" />
                            Otimizar
                        </button>
                        <button onClick={handleSaveRoute} disabled={routeStops.length < 2 || isSaving}
                            className="flex items-center justify-center gap-1.5 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-[11px] font-bold text-white uppercase transition-all disabled:opacity-40 shadow-md shadow-emerald-500/20">
                            <Save className="w-3.5 h-3.5" />
                            {isSaving ? 'A guardar...' : 'Guardar'}
                        </button>
                    </div>
                </div>

                <div className="border-t border-slate-100 flex flex-col shrink-0" style={{ height: '220px' }}>
                    <div className="flex gap-1 px-4 pt-3 pb-2">
                        {(['locais', 'ativas'] as const).map(tab => (
                            <button key={tab} onClick={() => setActiveTab(tab)}
                                className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${activeTab === tab ? 'bg-blue-600 text-white shadow' : 'text-slate-500 hover:bg-slate-100'}`}>
                                {tab === 'locais' ? `POIs (${filteredPOIs.length})` : `Ativas${activeRoutes.length > 0 ? ` (${activeRoutes.length})` : ''}`}
                            </button>
                        ))}
                    </div>
                    <div className="flex-1 overflow-y-auto scrollbar-none px-4 pb-3 space-y-1.5 min-h-0">
                        {activeTab === 'locais' && filteredPOIs.map(poi => (
                            <button key={`${poi.source}-${poi.id}`} onClick={() => handleAddStop(poi)}
                                className="w-full text-left p-2.5 rounded-xl bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 flex items-center gap-2.5 group transition-all">
                                <div className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 transition-all group-hover:bg-blue-600 group-hover:border-blue-600 ${poi.source === 'geofence' ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-200'}`}>
                                    <MapPin className="w-3.5 h-3.5 text-slate-400 group-hover:text-white transition-colors" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-xs font-semibold text-slate-700 truncate group-hover:text-blue-700">{poi.nome}</div>
                                    <div className="text-[9px] text-slate-400 capitalize flex items-center gap-1">{poi.source === 'geofence' ? 'Cartrack' : 'Local'} - {poi.tipo}</div>
                                </div>
                                <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-500 transition-colors shrink-0" />
                            </button>
                        ))}
                        {activeTab === 'locais' && filteredPOIs.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-24 gap-2 text-slate-400">
                                <MapPin className="w-5 h-5 opacity-30" />
                                <p className="text-[10px] font-semibold">Sem POIs disponíveis</p>
                            </div>
                        )}
                        {activeTab === 'ativas' && activeRoutes.map(route => {
                            const mot = motoristas.find(m => m.id === route.motorista_id);
                            const vtr = viaturas.find(v => v.id === route.viatura_id);
                            return (
                                <div key={route.id} className="p-3 rounded-xl bg-white border border-slate-200 space-y-2">
                                    <div className="flex justify-between items-start">
                                        <div className="min-w-0">
                                            <div className="text-[10px] font-bold text-slate-700 truncate">{route.data}</div>
                                            <div className="text-[9px] text-slate-400 flex items-center gap-1 mt-0.5">
                                                <Car className="w-3 h-3" />{vtr?.matricula || 'N/A'} - {mot?.nome || 'N/A'}
                                            </div>
                                        </div>
                                        <span className="text-[9px] font-bold text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-lg">{route.distancia_estimada.toFixed(0)}km</span>
                                    </div>
                                    <button onClick={() => handleFinalizeRoute(route.id, route.distancia_estimada)}
                                        className="w-full py-1.5 bg-emerald-50 hover:bg-emerald-600 text-emerald-600 hover:text-white text-[9px] font-bold uppercase rounded-lg border border-emerald-200 hover:border-emerald-600 transition-all flex items-center justify-center gap-1.5">
                                        <CheckCircle2 className="w-3 h-3" />Concluir
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className="flex-1 relative overflow-hidden bg-slate-100">
                {!HERE_API_KEY && (
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-red-50 border border-red-200 rounded-xl px-4 py-2 text-xs text-red-600 font-semibold">
                        HERE_API_KEY em falta.
                    </div>
                )}

                <div ref={mapContainerRef} className="h-full w-full" />

                <div className="absolute top-4 right-4 z-[1000] flex gap-2">
                    <button
                        onClick={() => setAutoCenterNav(v => !v)}
                        disabled={!navigationEnabled}
                        className={`px-3 py-2 rounded-xl text-[11px] font-bold border ${autoCenterNav ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 border-slate-200'} disabled:opacity-40`}
                    >
                        <Crosshair className="w-4 h-4 inline mr-1" />
                        Seguir Viatura
                    </button>
                    <button
                        onClick={() => setNavigationEnabled(v => !v)}
                        disabled={!trackedVehicleId || routeStops.length < 2}
                        className={`px-3 py-2 rounded-xl text-[11px] font-bold border ${navigationEnabled ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-700 border-slate-200'} disabled:opacity-40`}
                    >
                        <Navigation className="w-4 h-4 inline mr-1" />
                        {navigationEnabled ? 'Navegação Ativa' : 'Iniciar Navegação'}
                    </button>
                </div>

                {routeStops.length === 0 && (
                    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[1000]">
                        <div className="bg-white/95 backdrop-blur-md px-5 py-3 rounded-2xl border border-slate-200 shadow-lg text-center">
                            <p className="text-xs font-semibold text-slate-600">Clique no mapa para adicionar paragens rapidamente</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">A rota HERE é recalculada automaticamente ao alterar paragens</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
