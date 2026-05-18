import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWorkshop } from "../../contexts/WorkshopContext";
import type { CartrackGeofence } from "../../services/cartrack";

declare global {
  interface Window {
    H: any;
  }
}

const HERE_API_KEY = import.meta.env.VITE_HERE_API_KEY;
const DEFAULT_CONSUMPTION = 8.5;
const DEFAULT_FUEL_PRICE = 1.65;
const ROUTE_CALC_COOLDOWN_MS = 60_000;

type RouteMode = "fast" | "short";

type Poi = {
  id: string;
  name: string;
  lat: number;
  lng: number;
};

type HereSection = {
  polyline?: string;
  summary?: {
    length?: number;
    duration?: number;
    baseDuration?: number;
  };
};

type HereRoute = {
  id: string;
  sections: HereSection[];
  distanceMeters: number;
  durationSeconds: number;
  baseDurationSeconds: number;
};

type RouteIncident = {
  id: string;
  title: string;
  criticality: string;
  lat: number;
  lng: number;
};

type RouteRequestAudit = {
  id: string;
  time: Date;
  originName: string;
  destinationName: string;
  stopsCount: number;
  note: string;
};

const formatKm = (meters: number) => `${(meters / 1000).toFixed(1)} km`;

const formatDuration = (seconds: number) => {
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes}min`;
  return `${hours}h ${String(minutes).padStart(2, "0")}min`;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2
  }).format(value);

const normalizeName = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const buildPoiFromGeofence = (item: CartrackGeofence): Poi | null => {
  const lat = Number(item.latitude ?? item.points?.[0]?.lat ?? 0);
  const lng = Number(item.longitude ?? item.points?.[0]?.lng ?? 0);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat === 0 || lng === 0) {
    return null;
  }

  return {
    id: String(item.id),
    name: String(item.name || "POI sem nome").trim(),
    lat,
    lng
  };
};

const distanceBetween = (a: Poi, b: Poi) => {
  const R = 6371e3;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const y = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return R * y;
};

const optimizeStopSequence = (origin: Poi, stops: Poi[], destination: Poi) => {
  if (stops.length <= 1) return stops;
  const remaining = [...stops];
  const ordered: Poi[] = [];
  let cursor = origin;

  while (remaining.length > 0) {
    let bestIndex = 0;
    let bestDist = Number.POSITIVE_INFINITY;
    remaining.forEach((candidate, index) => {
      const dist = distanceBetween(cursor, candidate);
      if (dist < bestDist) {
        bestDist = dist;
        bestIndex = index;
      }
    });
    cursor = remaining[bestIndex];
    ordered.push(cursor);
    remaining.splice(bestIndex, 1);
  }

  // Keep destination as terminal hint by minimizing last hop when ties happen.
  ordered.sort((a, b) => distanceBetween(a, destination) - distanceBetween(b, destination));
  return ordered;
};

const markerHtml = (label: string, bg: string) =>
  `<div style="width:34px;height:34px;border-radius:9999px;background:${bg};border:2px solid #fff;box-shadow:0 6px 16px rgba(15,23,42,.3);display:flex;align-items:center;justify-content:center;font-weight:700;color:white;font-size:13px;">${label}</div>`;

const firstIncidentPoint = (incident: any): { lat: number; lng: number } | null => {
  const points = incident?.location?.shape?.links?.[0]?.points;
  if (Array.isArray(points) && points.length > 0) {
    const lat = Number(points[0].lat);
    const lng = Number(points[0].lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  }

  const original = incident?.location?.originalPosition;
  if (original) {
    const lat = Number(original.lat);
    const lng = Number(original.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  }

  return null;
};

const sumRouteMetrics = (sections: HereSection[]) =>
  sections.reduce(
    (acc, section) => {
      acc.distanceMeters += Number(section.summary?.length || 0);
      acc.durationSeconds += Number(section.summary?.duration || 0);
      acc.baseDurationSeconds += Number(section.summary?.baseDuration || section.summary?.duration || 0);
      return acc;
    },
    { distanceMeters: 0, durationSeconds: 0, baseDurationSeconds: 0 }
  );

const formatHereCoordinate = (value: number) => Number(value).toFixed(6);

export default function Roteirizacao() {
  const { geofences, viaturas } = useWorkshop();
  const mapRef = useRef<any>(null);
  const markersGroupRef = useRef<any>(null);
  const routesGroupRef = useRef<any>(null);
  const incidentsGroupRef = useRef<any>(null);
  const uiRef = useRef<any>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const resizeListenerRef = useRef<(() => void) | null>(null);
  const lastRouteCalculationRef = useRef(0);

  const [routeMode, setRouteMode] = useState<RouteMode>("fast");
  const [avoidTolls, setAvoidTolls] = useState(false);
  const [avoidFerries, setAvoidFerries] = useState(false);
  const [optimizeOrder, setOptimizeOrder] = useState(true);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("");
  const [consumptionPer100, setConsumptionPer100] = useState(DEFAULT_CONSUMPTION);
  const [fuelPrice, setFuelPrice] = useState(DEFAULT_FUEL_PRICE);

  const [originId, setOriginId] = useState<string>("");
  const [destinationId, setDestinationId] = useState<string>("");
  const [stopIds, setStopIds] = useState<string[]>([]);

  const [routes, setRoutes] = useState<HereRoute[]>([]);
  const [activeRouteId, setActiveRouteId] = useState<string>("");
  const [incidents, setIncidents] = useState<RouteIncident[]>([]);
  const [isRouting, setIsRouting] = useState(false);
  const [routeCalculated, setRouteCalculated] = useState(false);
  const [routeRequestCount, setRouteRequestCount] = useState(0);
  const [routeRequestHistory, setRouteRequestHistory] = useState<RouteRequestAudit[]>([]);
  const [lastTrafficUpdate, setLastTrafficUpdate] = useState<Date | null>(null);
  const [cooldownRemainingSec, setCooldownRemainingSec] = useState(0);

  const [mapError, setMapError] = useState<string | null>(null);

  const poiList = useMemo(() => {
    const unique = new Map<string, Poi>();
    geofences.forEach((item) => {
      const poi = buildPoiFromGeofence(item);
      if (!poi) return;
      const key = normalizeName(poi.name);
      if (!unique.has(key)) unique.set(key, poi);
    });
    return Array.from(unique.values()).sort((a, b) => a.name.localeCompare(b.name, "pt"));
  }, [geofences]);

  const poiById = useMemo(() => {
    const map = new Map<string, Poi>();
    poiList.forEach((poi) => map.set(poi.id, poi));
    return map;
  }, [poiList]);

  const origin = originId ? poiById.get(originId) || null : null;
  const destination = destinationId ? poiById.get(destinationId) || null : null;

  const selectedStops = useMemo(
    () => stopIds.map((id) => poiById.get(id)).filter(Boolean) as Poi[],
    [stopIds, poiById]
  );

  const orderedStops = useMemo(() => {
    if (!origin || !destination) return selectedStops;
    return optimizeOrder ? optimizeStopSequence(origin, selectedStops, destination) : selectedStops;
  }, [origin, destination, selectedStops, optimizeOrder]);

  const activeRoute = routes.find((item) => item.id === activeRouteId) || routes[0] || null;

  const estimatedLiters = activeRoute
    ? (activeRoute.distanceMeters / 1000) * (consumptionPer100 / 100)
    : 0;
  const estimatedCost = estimatedLiters * fuelPrice;

  const drawMarkers = useCallback(
    (currentOrigin: Poi | null, currentDestination: Poi | null, currentStops: Poi[]) => {
      const H = window.H;
      const group = markersGroupRef.current;
      if (!H || !group) return;

      group.removeObjects(group.getObjects(true));

      if (currentOrigin) {
        group.addObject(
          new H.map.DomMarker(
            { lat: currentOrigin.lat, lng: currentOrigin.lng },
            { icon: new H.map.DomIcon(markerHtml("O", "#16a34a")) }
          )
        );
      }

      currentStops.forEach((stop, index) => {
        group.addObject(
          new H.map.DomMarker(
            { lat: stop.lat, lng: stop.lng },
            { icon: new H.map.DomIcon(markerHtml(String(index + 1), "#2563eb")) }
          )
        );
      });

      if (currentDestination) {
        group.addObject(
          new H.map.DomMarker(
            { lat: currentDestination.lat, lng: currentDestination.lng },
            { icon: new H.map.DomIcon(markerHtml("D", "#dc2626")) }
          )
        );
      }
    },
    []
  );

  const drawIncidents = useCallback((currentIncidents: RouteIncident[]) => {
    const H = window.H;
    const group = incidentsGroupRef.current;
    if (!H || !group) return;

    group.removeObjects(group.getObjects(true));
    currentIncidents.forEach((incident) => {
      const marker = new H.map.DomMarker(
        { lat: incident.lat, lng: incident.lng },
        { icon: new H.map.DomIcon(markerHtml("!", "#f59e0b")) }
      );

      marker.addEventListener("tap", () => {
        if (!uiRef.current) return;
        const bubble = new H.ui.InfoBubble(
          { lat: incident.lat, lng: incident.lng },
          {
            content: `<div style=\"font-size:12px;max-width:220px;\"><strong>${incident.title}</strong><br/>${incident.criticality}</div>`
          }
        );
        uiRef.current.addBubble(bubble);
        window.setTimeout(() => bubble.close(), 2500);
      });

      group.addObject(marker);
    });
  }, []);

  const drawRoutes = useCallback((currentRoutes: HereRoute[], selectedId: string) => {
    const H = window.H;
    const map = mapRef.current;
    const group = routesGroupRef.current;
    if (!H || !map || !group) return;

    group.removeObjects(group.getObjects(true));

    const activeId = selectedId || currentRoutes[0]?.id;

    currentRoutes.forEach((route, routeIndex) => {
      const isMain = route.id === activeId;
      route.sections.forEach((section) => {
        if (!section.polyline) return;
        const ls = H.geo.LineString.fromFlexiblePolyline(section.polyline);
        const polyline = new H.map.Polyline(ls, {
          style: {
            strokeColor: isMain ? "rgba(37,99,235,0.94)" : "rgba(100,116,139,0.70)",
            lineWidth: isMain ? 8 : 5,
            lineJoin: "round"
          }
        });

        polyline.addEventListener("pointerenter", () => {
          polyline.setStyle({
            strokeColor: isMain ? "rgba(29,78,216,0.98)" : "rgba(71,85,105,0.88)",
            lineWidth: isMain ? 10 : 7,
            lineJoin: "round"
          });
        });

        polyline.addEventListener("pointerleave", () => {
          polyline.setStyle({
            strokeColor: isMain ? "rgba(37,99,235,0.94)" : "rgba(100,116,139,0.70)",
            lineWidth: isMain ? 8 : 5,
            lineJoin: "round"
          });
        });

        polyline.addEventListener("tap", () => setActiveRouteId(route.id));
        group.addObject(polyline);

        // Soft glow for primary route
        if (isMain) {
          const glow = new H.map.Polyline(ls, {
            style: {
              strokeColor: "rgba(59,130,246,0.20)",
              lineWidth: 16,
              lineJoin: "round"
            }
          });
          group.addObject(glow);
        }
      });

      if (routeIndex === 0 && map.getObjects().length > 0) {
        const bbox = group.getBoundingBox();
        if (bbox) {
          map.getViewModel().setLookAtData({ bounds: bbox }, true);
        }
      }
    });
  }, []);

  const fetchIncidents = useCallback(async (currentRoute: HereRoute) => {
    const coords: { lat: number; lng: number }[] = [];

    currentRoute.sections.forEach((section: any) => {
      const departure = section?.departure?.place?.location;
      const arrival = section?.arrival?.place?.location;
      if (departure) coords.push({ lat: Number(departure.lat), lng: Number(departure.lng) });
      if (arrival) coords.push({ lat: Number(arrival.lat), lng: Number(arrival.lng) });
    });

    if (coords.length === 0) {
      setIncidents([]);
      drawIncidents([]);
      return;
    }

    const lats = coords.map((c) => c.lat);
    const lngs = coords.map((c) => c.lng);
    const minLat = Math.min(...lats) - 0.08;
    const maxLat = Math.max(...lats) + 0.08;
    const minLng = Math.min(...lngs) - 0.08;
    const maxLng = Math.max(...lngs) + 0.08;

    const query = new URLSearchParams({
      in: `bbox:${minLng},${minLat},${maxLng},${maxLat}`,
      lang: "pt-PT",
      locationReferencing: "shape",
      apikey: HERE_API_KEY
    });

    try {
      const response = await fetch(`https://data.traffic.hereapi.com/v7/incidents?${query.toString()}`);
      if (!response.ok) {
        throw new Error(`Traffic API falhou (${response.status})`);
      }

      const payload = await response.json();
      const source = payload?.results || payload?.incidents || [];
      const parsed = (Array.isArray(source) ? source : [])
        .map((item: any) => {
          const point = firstIncidentPoint(item);
          if (!point) return null;
          return {
            id: String(item.id || item.incidentDetails?.id || Math.random()),
            title:
              item.description?.value ||
              item.incidentDetails?.summary?.value ||
              item.incidentDetails?.type ||
              "Incidente de tráfego",
            criticality:
              item.criticality ||
              item.incidentDetails?.criticality ||
              item.incidentDetails?.status ||
              "info",
            lat: point.lat,
            lng: point.lng
          } as RouteIncident;
        })
        .filter(Boolean)
        .slice(0, 8) as RouteIncident[];

      setIncidents(parsed);
      drawIncidents(parsed);
    } catch (error) {
      console.warn("Falha ao obter incidentes HERE:", error);
      setIncidents([]);
      drawIncidents([]);
    }
  }, [drawIncidents]);

  const recalculateRoute = useCallback(async (force = false) => {
    if (!origin || !destination || !HERE_API_KEY) return;

    const now = Date.now();
    const elapsed = now - lastRouteCalculationRef.current;
    if (lastRouteCalculationRef.current > 0 && elapsed < ROUTE_CALC_COOLDOWN_MS) {
      const remainingMs = ROUTE_CALC_COOLDOWN_MS - elapsed;
      const remainingSec = Math.ceil(remainingMs / 1000);
      setCooldownRemainingSec(remainingSec);
      setMapError(`Aguarde ${remainingSec}s antes de novo cálculo para proteger a quota HERE.`);
      return;
    }

    if (routeCalculated && !force) return;

    lastRouteCalculationRef.current = now;
    setCooldownRemainingSec(Math.ceil(ROUTE_CALC_COOLDOWN_MS / 1000));

    const orderedVia = orderedStops;
    const avoidFeatures: string[] = [];
    if (avoidTolls) avoidFeatures.push("tollRoad");
    if (avoidFerries) avoidFeatures.push("ferry");

    setIsRouting(true);
    setMapError(null);
    drawMarkers(origin, destination, orderedVia);

    const performRoutingRequest = async (includeAvoidFeatures: boolean, note: string) => {
      const params = new URLSearchParams({
        transportMode: "car",
        origin: `${origin.lat},${origin.lng}`,
        destination: `${destination.lat},${destination.lng}`,
        routingMode: routeMode,
        alternatives: "1",
        departureTime: new Date().toISOString(),
        return: "polyline,summary,travelSummary",
        apikey: HERE_API_KEY
      });

      if (includeAvoidFeatures && avoidFeatures.length > 0) {
        params.set("avoid[features]", avoidFeatures.join(","));
      }

      orderedVia.forEach((stop) => params.append("via", `${stop.lat},${stop.lng}`));

      setRouteRequestCount((prev) => prev + 1);
      setRouteRequestHistory((prev) => {
        const nextItem: RouteRequestAudit = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          time: new Date(),
          originName: origin.name,
          destinationName: destination.name,
          stopsCount: orderedVia.length,
          note
        };
        return [nextItem, ...prev].slice(0, 8);
      });

      const response = await fetch(`https://router.hereapi.com/v8/routes?${params.toString()}`);
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(`Routing API falhou (${response.status}): ${detail}`);
      }

      const payload = await response.json();
      return Array.isArray(payload?.routes) ? payload.routes : [];
    };

    try {
      let routeItems = await performRoutingRequest(true, "normal");
      let fallbackInfo: string | null = null;

      if (routeItems.length === 0 && avoidFeatures.length > 0) {
        routeItems = await performRoutingRequest(false, "fallback sem restricoes");
        if (routeItems.length > 0) {
          fallbackInfo = "Rota calculada sem evitar portagens/ferries para garantir cobertura dos POIs.";
        }
      }

      if (routeItems.length === 0) {
        throw new Error("HERE Routing não devolveu rotas para os pontos selecionados.");
      }

      const mappedRoutes: HereRoute[] = routeItems.map((item: any, index: number) => {
        const sections = (item.sections || []) as HereSection[];
        const totals = sumRouteMetrics(sections);
        return {
          id: String(item.id || `route-${index}`),
          sections,
          ...totals
        };
      });

      const nextActiveId =
        mappedRoutes.find((r) => r.id === activeRouteId)?.id || mappedRoutes[0].id;

      setRoutes(mappedRoutes);
      setActiveRouteId(nextActiveId);
      drawRoutes(mappedRoutes, nextActiveId);
      await fetchIncidents(mappedRoutes.find((r) => r.id === nextActiveId) || mappedRoutes[0]);
      setMapError(fallbackInfo);
      setRouteCalculated(true);
      setLastTrafficUpdate(new Date());
    } catch (error) {
      console.error(error);
      setMapError(error instanceof Error ? error.message : "Erro ao calcular rota HERE.");
      setRoutes([]);
      setIncidents([]);
      setRouteCalculated(false);
      drawRoutes([], "");
      drawIncidents([]);
    } finally {
      setIsRouting(false);
    }
  }, [
    activeRouteId,
    avoidFerries,
    avoidTolls,
    destination,
    drawIncidents,
    drawMarkers,
    drawRoutes,
    fetchIncidents,
    origin,
    orderedStops,
    routeCalculated,
    routeMode
  ]);

  useEffect(() => {
    const H = window.H;

    if (!H) {
      setMapError("HERE SDK não carregado.");
      return;
    }

    if (!mapContainerRef.current) return;

    if (!HERE_API_KEY) {
      setMapError("API Key HERE não definida.");
      return;
    }

    try {
      const platform = new H.service.Platform({
        apikey: HERE_API_KEY
      });

      const layers = platform.createDefaultLayers({
        engineType: H.Map.EngineType.VECTOR
      });

      const baseLayer = layers.vector?.normal?.map;
      // Prefer vector satellite to stay aligned with modern v3.1 vector setup.
      const satelliteLayer =
        layers.vector?.satellite?.map ||
        layers.raster?.satellite?.map ||
        layers.raster?.satellite?.xbase ||
        null;

      if (!baseLayer) {
        setMapError("Vector layer não disponível.");
        return;
      }

      const map = new H.Map(
        mapContainerRef.current,
        baseLayer,
        {
          center: { lat: 37.0891, lng: -8.2479 },
          zoom: 12,
          pixelRatio: window.devicePixelRatio || 1
        }
      );
      window.setTimeout(() => {
        map.getViewPort().resize();
      }, 300);
      
      new H.mapevents.Behavior(
        new H.mapevents.MapEvents(map)
      );

      const ui = H.ui.UI.createDefault(map, layers, "pt-PT");

      const baseLayers: Array<{ label: string; layer: any }> = [
        { label: "Vista do mapa", layer: baseLayer }
      ];

      if (satelliteLayer) {
        baseLayers.push({ label: "Satélite", layer: satelliteLayer });
      }

      const overlayLayers: Array<{ label: string; layer: any }> = [];
      try {
        const trafficService = platform.getTrafficService?.();
        const trafficFlowLayer = trafficService?.createTrafficFlowLayer?.();
        const trafficIncidentsLayer = trafficService?.createTrafficIncidentsLayer?.();

        if (trafficFlowLayer) {
          overlayLayers.push({ label: "Condições de trânsito", layer: trafficFlowLayer });
        }

        if (trafficIncidentsLayer) {
          overlayLayers.push({ label: "Mostrar incidentes de trânsito", layer: trafficIncidentsLayer });
        }
      } catch (trafficError) {
        console.warn("HERE Traffic layers indisponíveis para esta API key/projeto:", trafficError);
      }

      try {
        ui.removeControl("mapsettings");
        ui.addControl(
          "mapsettings",
          new H.ui.MapSettingsControl({
            baseLayers,
            layers: overlayLayers
          })
        );
      } catch (uiError) {
        console.warn("Falha ao configurar selector de camadas HERE:", uiError);
      }

      uiRef.current = ui;
      mapRef.current = map;
      markersGroupRef.current = new H.map.Group();
      routesGroupRef.current = new H.map.Group();
      incidentsGroupRef.current = new H.map.Group();

      map.addObject(routesGroupRef.current);
      map.addObject(markersGroupRef.current);
      map.addObject(incidentsGroupRef.current);

      const onResize = () => map.getViewPort().resize();
      resizeListenerRef.current = onResize;
      window.addEventListener("resize", onResize);

      setMapError(null);

    } catch (err) {
      console.error(err);
      setMapError("Erro ao inicializar o mapa HERE.");
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.dispose();
        mapRef.current = null;
      }

      if (resizeListenerRef.current) {
        window.removeEventListener("resize", resizeListenerRef.current);
      }

      resizeListenerRef.current = null;
      uiRef.current = null;
      markersGroupRef.current = null;
      routesGroupRef.current = null;
      incidentsGroupRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!selectedVehicleId) return;
    const raw = window.localStorage.getItem("routing.vehicleProfiles");
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as Record<string, { consumption: number; fuel: number }>;
      const profile = parsed[selectedVehicleId];
      if (!profile) return;
      if (Number.isFinite(profile.consumption)) setConsumptionPer100(profile.consumption);
      if (Number.isFinite(profile.fuel)) setFuelPrice(profile.fuel);
    } catch {
      // Ignore malformed local cache.
    }
  }, [selectedVehicleId]);

  useEffect(() => {
    if (!selectedVehicleId) return;
    const raw = window.localStorage.getItem("routing.vehicleProfiles");
    let parsed: Record<string, { consumption: number; fuel: number }> = {};
    try {
      parsed = raw ? JSON.parse(raw) : {};
    } catch {
      parsed = {};
    }
    parsed[selectedVehicleId] = { consumption: consumptionPer100, fuel: fuelPrice };
    window.localStorage.setItem("routing.vehicleProfiles", JSON.stringify(parsed));
  }, [consumptionPer100, fuelPrice, selectedVehicleId]);

  useEffect(() => {
    setRouteCalculated(false);
  }, [originId, destinationId, stopIds, optimizeOrder, avoidTolls, avoidFerries, routeMode]);

  useEffect(() => {
    if (cooldownRemainingSec <= 0) return;
    const timer = window.setInterval(() => {
      setCooldownRemainingSec((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [cooldownRemainingSec]);

  useEffect(() => {
    if (!activeRouteId || routes.length === 0) return;
    drawRoutes(routes, activeRouteId);
    const picked = routes.find((r) => r.id === activeRouteId);
    if (picked) {
      void fetchIncidents(picked);
    }
  }, [activeRouteId, drawRoutes, fetchIncidents, routes]);

  const availableStops = useMemo(() => {
    const blocked = new Set([originId, destinationId, ...stopIds]);
    return poiList.filter((poi) => !blocked.has(poi.id));
  }, [destinationId, originId, poiList, stopIds]);

  const addStop = () => {
    if (availableStops.length === 0) return;
    setStopIds((prev) => [...prev, availableStops[0].id]);
  };

  const updateStop = (index: number, nextId: string) => {
    setStopIds((prev) => prev.map((id, i) => (i === index ? nextId : id)));
  };

  const removeStop = (index: number) => {
    setStopIds((prev) => prev.filter((_, i) => i !== index));
  };

  const moveStop = (index: number, direction: -1 | 1) => {
    setStopIds((prev) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= prev.length) return prev;
      const copy = [...prev];
      [copy[index], copy[nextIndex]] = [copy[nextIndex], copy[index]];
      return copy;
    });
  };

  const clearRoute = useCallback(() => {
    drawRoutes([], "");
    drawIncidents([]);
    drawMarkers(null, null, []);
    setOriginId("");
    setDestinationId("");
    setStopIds([]);
    setRoutes([]);
    setActiveRouteId("");
    setIncidents([]);
    setRouteCalculated(false);
    lastRouteCalculationRef.current = 0;
    setCooldownRemainingSec(0);
    setRouteRequestCount(0);
    setRouteRequestHistory([]);
    setLastTrafficUpdate(null);
    setMapError(null);
  }, [drawIncidents, drawMarkers, drawRoutes]);

  const canCalculateRoute = Boolean(origin && destination && !isRouting && cooldownRemainingSec === 0);
  const canOpenHereWeGo = Boolean(destination);

  const buildHereWeGoUrl = useCallback(() => {
    if (!destination) return "";

    const destinationSegment = `${formatHereCoordinate(destination.lat)},${formatHereCoordinate(destination.lng)}`;

    if (!origin) {
      return `https://wego.here.com/directions/mix//${destinationSegment}`;
    }

    const segments = [
      `${formatHereCoordinate(origin.lat)},${formatHereCoordinate(origin.lng)}`,
      ...orderedStops.map((stop) => `${formatHereCoordinate(stop.lat)},${formatHereCoordinate(stop.lng)}`),
      destinationSegment
    ];

    return `https://wego.here.com/directions/drive/${segments.join("/")}`;
  }, [destination, orderedStops, origin]);

  const openHereWeGo = useCallback(async () => {
    const webUrl = buildHereWeGoUrl();
    if (!webUrl) return;

    if (Capacitor.isNativePlatform()) {
      try {
        await CapacitorApp.openUrl({ url: webUrl });
        return;
      } catch {
        // Fall back to a regular tab when native handoff is unavailable.
      }
    }

    window.open(webUrl, "_blank", "noopener,noreferrer");
  }, [buildHereWeGoUrl]);

  const liveTrackingReady = {
    enabled: false,
    etaRefreshSeconds: 30,
    supportsDynamicReRoute: true
  };

  return (
    <div className="h-full w-full p-4 md:p-5 bg-slate-50">
      <div className="h-full w-full rounded-3xl border border-slate-200 bg-white shadow-xl overflow-hidden flex flex-col xl:flex-row">
        <aside className="xl:w-[380px] border-b xl:border-b-0 xl:border-r border-slate-200 p-4 md:p-5 overflow-y-auto bg-white">
          <div className="mb-4">
            <p className="text-[11px] uppercase tracking-[0.16em] font-semibold text-blue-600">Roteirizacao Pro</p>
            <h2 className="text-2xl font-bold text-slate-900 leading-tight">POIs Cartrack + HERE Traffic</h2>
            <p className="text-sm text-slate-500 mt-1">Rota otimizada com transito em tempo real, incidentes e custo estimado.</p>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Origem</label>
              <select
                value={originId}
                onChange={(e) => setOriginId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 bg-white"
              >
                <option value="">Selecionar origem...</option>
                {poiList.map((poi) => (
                  <option key={poi.id} value={poi.id}>{poi.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Destino</label>
              <select
                value={destinationId}
                onChange={(e) => setDestinationId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 bg-white"
              >
                <option value="">Selecionar destino...</option>
                {poiList.map((poi) => (
                  <option key={poi.id} value={poi.id}>{poi.name}</option>
                ))}
              </select>
            </div>

            <div className="rounded-2xl border border-slate-200 p-3 bg-slate-50">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-slate-700">Paragens intermedias</p>
                <button
                  type="button"
                  onClick={addStop}
                  className="px-2 py-1 rounded-lg text-xs font-semibold bg-blue-600 text-white disabled:opacity-50"
                  disabled={availableStops.length === 0}
                >
                  + Adicionar
                </button>
              </div>

              <div className="space-y-2">
                {stopIds.length === 0 && (
                  <p className="text-xs text-slate-500">Sem paragens definidas. Pode construir rota direta ou adicionar POIs.</p>
                )}

                {stopIds.map((stopId, index) => (
                  <div key={`${stopId}-${index}`} className="grid grid-cols-[1fr_auto] gap-2 items-center">
                    <select
                      value={stopId}
                      onChange={(e) => updateStop(index, e.target.value)}
                      className="rounded-lg border border-slate-200 px-2 py-2 text-xs bg-white"
                    >
                      {poiList
                        .filter((poi) => poi.id === stopId || (!stopIds.includes(poi.id) && poi.id !== originId && poi.id !== destinationId))
                        .map((poi) => (
                          <option key={poi.id} value={poi.id}>{poi.name}</option>
                        ))}
                    </select>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => moveStop(index, -1)}
                        className="h-8 w-8 rounded-lg border border-slate-200 text-slate-600"
                        title="Subir"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => moveStop(index, 1)}
                        className="h-8 w-8 rounded-lg border border-slate-200 text-slate-600"
                        title="Descer"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => removeStop(index)}
                        className="h-8 w-8 rounded-lg border border-rose-200 text-rose-600"
                        title="Remover"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="rounded-xl border border-slate-200 p-2 text-xs text-slate-700 flex items-center gap-2 bg-slate-50">
                <input type="checkbox" checked={routeMode === "short"} onChange={(e) => setRouteMode(e.target.checked ? "short" : "fast")} />
                Priorizar distancia curta
              </label>
              <label className="rounded-xl border border-slate-200 p-2 text-xs text-slate-700 flex items-center gap-2 bg-slate-50">
                <input type="checkbox" checked={optimizeOrder} onChange={(e) => setOptimizeOrder(e.target.checked)} />
                Otimizar sequencia
              </label>
              <label className="rounded-xl border border-slate-200 p-2 text-xs text-slate-700 flex items-center gap-2 bg-slate-50">
                <input type="checkbox" checked={avoidTolls} onChange={(e) => setAvoidTolls(e.target.checked)} />
                Evitar portagens
              </label>
              <label className="rounded-xl border border-slate-200 p-2 text-xs text-slate-700 flex items-center gap-2 bg-slate-50">
                <input type="checkbox" checked={avoidFerries} onChange={(e) => setAvoidFerries(e.target.checked)} />
                Evitar ferries
              </label>
            </div>

            <div className="rounded-2xl border border-slate-200 p-3 space-y-2">
              <p className="text-xs font-semibold text-slate-700">Custo estimado</p>

              <select
                value={selectedVehicleId}
                onChange={(e) => setSelectedVehicleId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-2 py-2 text-xs"
              >
                <option value="">Viatura (opcional)</option>
                {viaturas.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>{vehicle.matricula} - {vehicle.marca} {vehicle.modelo}</option>
                ))}
              </select>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-slate-500">Consumo L/100</label>
                  <input
                    type="number"
                    min={1}
                    step={0.1}
                    value={consumptionPer100}
                    onChange={(e) => setConsumptionPer100(Number(e.target.value || DEFAULT_CONSUMPTION))}
                    className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500">Preco combustivel</label>
                  <input
                    type="number"
                    min={0.5}
                    step={0.01}
                    value={fuelPrice}
                    onChange={(e) => setFuelPrice(Number(e.target.value || DEFAULT_FUEL_PRICE))}
                    className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl bg-slate-900 text-white p-4">
            <p className="text-xs uppercase tracking-wide text-slate-300">Resumo da rota</p>
            <p className="text-sm mt-1">Origem: <span className="font-semibold">{origin?.name || "-"}</span></p>
            <p className="text-sm">Destino: <span className="font-semibold">{destination?.name || "-"}</span></p>
            <p className="text-sm">Paragens: <span className="font-semibold">{orderedStops.length}</span></p>
            <hr className="border-slate-700 my-3" />
            <p className="text-sm">Distancia: <span className="font-semibold">{activeRoute ? formatKm(activeRoute.distanceMeters) : "-"}</span></p>
            <p className="text-sm">Tempo estimado: <span className="font-semibold">{activeRoute ? formatDuration(activeRoute.durationSeconds) : "-"}</span></p>
            <p className="text-sm">Consumo estimado: <span className="font-semibold">{estimatedLiters.toFixed(2)} L</span></p>
            <p className="text-sm">Custo estimado: <span className="font-semibold">{formatCurrency(estimatedCost)}</span></p>
            {activeRoute && (
              <p className="text-xs text-amber-300 mt-1">Atraso por trafego: {formatDuration(Math.max(activeRoute.durationSeconds - activeRoute.baseDurationSeconds, 0))}</p>
            )}

            <button
              type="button"
              onClick={() => void openHereWeGo()}
              disabled={!canOpenHereWeGo}
              className="mt-3 w-full rounded-xl bg-cyan-500 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
            >
              Navegar com HERE WeGo
            </button>
            <p className="mt-2 text-[11px] text-slate-300">
              Abre navegacao externa turn-by-turn sem consumir quota adicional da Routing API na aplicacao.
            </p>
          </div>

          <div className="mt-4">
            <p className="text-xs font-semibold text-slate-700 mb-2">Alternativas de rota</p>
            <div className="space-y-2">
              {routes.length === 0 && <p className="text-xs text-slate-500">Sem rotas calculadas.</p>}
              {routes.map((route, index) => {
                const selected = (activeRouteId || routes[0]?.id) === route.id;
                return (
                  <button
                    key={route.id}
                    type="button"
                    onClick={() => setActiveRouteId(route.id)}
                    className={`w-full text-left rounded-xl border px-3 py-2 transition ${selected ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white"}`}
                  >
                    <p className="text-xs font-semibold text-slate-700">{index === 0 ? "Principal" : `Alternativa ${index}`}</p>
                    <p className="text-xs text-slate-600">{formatKm(route.distanceMeters)} · {formatDuration(route.durationSeconds)}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
            <p className="text-xs font-semibold text-emerald-700">Compatibilidade tracking live</p>
            <p className="text-xs text-emerald-900 mt-1">
              Estrutura pronta para GPS Cartrack em tempo real, ETA dinamico e recalculo automatico da rota.
            </p>
            <p className="text-[11px] text-emerald-700 mt-1">
              refresh ETA: {liveTrackingReady.etaRefreshSeconds}s · reroute: {liveTrackingReady.supportsDynamicReRoute ? "ativo" : "inativo"}
            </p>
          </div>
        </aside>

        <section className="relative flex-1 min-h-[520px]">
          {mapError && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-rose-50 border border-rose-200 text-rose-700 px-4 py-2 rounded-xl text-sm shadow">
              {mapError}
            </div>
          )}

          <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
            <div className="px-3 py-2 rounded-xl bg-white/95 border border-slate-200 text-xs text-slate-700 shadow">
              Trafego: {isRouting ? "a atualizar..." : routeCalculated ? "ativo" : "aguarda calculo"}
              <span className="block text-[10px] text-slate-500">Requests HERE (sessao): {routeRequestCount}</span>
              {lastTrafficUpdate && <span className="block text-[10px] text-slate-500">{lastTrafficUpdate.toLocaleTimeString("pt-PT")}</span>}
            </div>
            <button
              type="button"
              onClick={() => void recalculateRoute(true)}
              disabled={!canCalculateRoute}
              className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-xs font-semibold shadow"
            >
              {cooldownRemainingSec > 0 ? `Calcular rota (${cooldownRemainingSec}s)` : "Calcular rota"}
            </button>
            <button
              type="button"
              onClick={clearRoute}
              className="px-3 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow"
            >
              Limpar rota
            </button>
          </div>

          <div
            ref={mapContainerRef}
            style={{
              height: "100%",
              width: "100%"
            }}
          />

          <div className="absolute left-4 bottom-4 z-20 w-[min(420px,calc(100%-2rem))] rounded-2xl bg-white/95 border border-slate-200 p-3 shadow-lg">
            <p className="text-xs font-semibold text-slate-700 mb-1">Incidentes na rota</p>
            {incidents.length === 0 && <p className="text-xs text-slate-500">Sem incidentes relevantes no corredor atual.</p>}
            {incidents.map((incident) => (
              <p key={incident.id} className="text-xs text-slate-700 py-0.5">
                ⚠ {incident.title} <span className="text-slate-500">({incident.criticality})</span>
              </p>
            ))}

            <div className="mt-3 border-t border-slate-200 pt-2">
              <p className="text-xs font-semibold text-slate-700 mb-1">Historico de requests HERE</p>
              {routeRequestHistory.length === 0 && (
                <p className="text-xs text-slate-500">Sem chamadas nesta sessao.</p>
              )}
              {routeRequestHistory.map((item) => (
                <p key={item.id} className="text-[11px] text-slate-600 py-0.5">
                  {item.time.toLocaleTimeString("pt-PT")} · {item.originName} → {item.destinationName} · {item.stopsCount} paragens · {item.note}
                </p>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
