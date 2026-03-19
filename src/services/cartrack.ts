// ==============================
// 🔹 CONFIG
// ==============================

const BASE_URL = import.meta.env.VITE_CARTRACK_API_URL || 'https://fleetapi-pt.cartrack.com/rest';

const CARTRACK_USERNAME = import.meta.env.VITE_CARTRACK_USERNAME;
const CARTRACK_PASSWORD = import.meta.env.VITE_CARTRACK_PASSWORD;
const CARTRACK_API_KEY = import.meta.env.VITE_CARTRACK_API_KEY;
// DEFAULT TO FALSE if username is present to ensure local testing works
const USE_PROXY_AUTH = String(import.meta.env.VITE_CARTRACK_USE_PROXY_AUTH || (CARTRACK_USERNAME ? 'false' : 'true')) !== 'false';

const CACHE_TTL = {
    vehicles: 30_000,
    geofences: 300_000,
    drivers: 300_000,
};

// ==============================
// 🔹 CACHE
// ==============================

type CacheEntry<T> = {
    value: T;
    expiresAt: number;
};

const cacheStore = new Map<string, CacheEntry<unknown>>();
const inFlightRequests = new Map<string, Promise<unknown>>();

let preferredVehicleEndpoint: '/vehicles/status' | '/vehicles' = '/vehicles/status';

type JsonObject = Record<string, unknown>;

interface CartrackListResponse<T> {
    data?: T[];
    rows?: T[];
    geofences?: T[];
    drivers?: T[];
    personnel?: T[];
    identification_tags?: T[];
    visits?: T[];
    positions?: T[];
    meta?: {
        pagination?: {
            total_pages?: number;
        };
    };
}

export interface CartrackGeofence {
    id: string;
    name: string;
    area_id?: string;
    latitude?: number;
    longitude?: number;
    radius?: number;
    polygon_wkt?: string;
    points?: { lat: number, lng: number }[];
    group_name?: string;
}

export interface CartrackVehicle {
    id: string;
    registration: string;
    label: string;
    make?: string;
    model?: string;
    latitude: number;
    longitude: number;
    speed: number;
    bearing: number;
    last_activity: string;
    driverName?: string;
    driverKey?: string;
    tagId?: string;
    driverId?: number | string;
    status?: string;
    fuelType?: string;
    ignition?: boolean;
    odometer?: number;
    last_position_update?: string;
    address?: string;
    currentCentroCustoId?: string;
    currentCentroCustoName?: string;
    currentGeofenceName?: string;
}

export interface CartrackDriver {
    id: string;
    firstName: string;
    lastName: string;
    fullName: string;
    tagId?: string;
    tagVariants?: string[];
    customFields?: Record<string, string>;
}

export interface CartrackGeofenceVisit {
    id: string;
    vehicleId: string;
    registration: string;
    geofenceId: string;
    geofenceName: string;
    entryTime: string;
    exitTime: string | null;
    durationSeconds: number | null;
}

// ==============================
// 🔹 AUTH & REQUEST
// ==============================

const getAuthHeaders = (): HeadersInit => {
    if (CARTRACK_API_KEY) {
        return { Authorization: `Bearer ${CARTRACK_API_KEY}` };
    }

    if (USE_PROXY_AUTH) {
        return {};
    }

    if (CARTRACK_USERNAME && CARTRACK_PASSWORD) {
        const auth = btoa(`${CARTRACK_USERNAME}:${CARTRACK_PASSWORD}`);
        return { 
            Authorization: `Basic ${auth}`,
            'Accept': 'application/iso15143-snapshot+json' // Added for AEMP support
        };
    }

    return {};
};

const buildCartrackUrl = (endpoint: string, queryParams?: Record<string, string | number | undefined>): string => {
    const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    let url = `${BASE_URL}${normalizedEndpoint}`;

    if (queryParams) {
        const params = new URLSearchParams();
        Object.entries(queryParams).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
                params.append(key, String(value));
            }
        });

        const queryString = params.toString();
        if (queryString) {
            url += `${url.includes('?') ? '&' : '?'}${queryString}`;
        }
    }

    return url;
};

const createCartrackRequest = async <T extends JsonObject | CartrackListResponse<unknown>>(
    endpoint: string,
    queryParams?: Record<string, string | number | undefined>,
): Promise<T> => {
    const url = buildCartrackUrl(endpoint, queryParams);
    const response = await fetch(url, {
        method: 'GET',
        headers: getAuthHeaders(),
    });

    if (!response.ok) {
        throw new Error(`Cartrack request failed (${response.status}) for ${endpoint}`);
    }

    return response.json() as Promise<T>;
};

const getCache = <T>(key: string): T | null => {
    const entry = cacheStore.get(key) as CacheEntry<T>;
    if (!entry) return null;

    if (entry.expiresAt <= Date.now()) {
        cacheStore.delete(key);
        return null;
    }

    return entry.value;
};

const setCache = <T>(key: string, value: T, ttlMs: number): T => {
    cacheStore.set(key, {
        value,
        expiresAt: Date.now() + ttlMs,
    });
    return value;
};

const fetchWithDeduplication = <T>(key: string, fetcher: () => Promise<T>): Promise<T> => {
    const existing = inFlightRequests.get(key) as Promise<T> | undefined;
    if (existing) return existing;

    const promise = fetcher().finally(() => inFlightRequests.delete(key));
    inFlightRequests.set(key, promise);
    return promise;
};

// ==============================
// 🔹 SERVICE
// ==============================

export const CartrackService = {
    getVehicles: async (): Promise<CartrackVehicle[]> => {
        const cacheKey = 'vehicles';
        const cached = getCache<CartrackVehicle[]>(cacheKey);
        if (cached) return cached;

        return fetchWithDeduplication(cacheKey, async () => {
            const endpoints: string[] = [preferredVehicleEndpoint, '/vehicles', '/aemp/iso15143-3/beta/fleet'];
            
            for (const endpoint of endpoints) {
                try {
                    const response = await createCartrackRequest<any>(endpoint);
                    const items = response.data || response.rows || [];

                    if (items.length === 0 && endpoint !== '/aemp/iso15143-3/beta/fleet') continue;

                    // Mapping logic
                    if (endpoint.includes('/aemp')) {
                        const vehicles: CartrackVehicle[] = items.map((item: any) => ({
                            id: String(item.equipment_header?.equipment_id || ''),
                            registration: item.equipment_header?.serial_number || 'Sem Matrícula',
                            label: item.equipment_header?.equipment_id || 'Sem Nome',
                            latitude: Number(item.location?.latitude || 0),
                            longitude: Number(item.location?.longitude || 0),
                            speed: Number(item.location?.speed || 0),
                            bearing: 0,
                            last_activity: item.location?.timestamp || new Date().toISOString(),
                            status: (Number(item.location?.speed || 0) > 0) ? 'moving' : 'stopped',
                        }));
                        if (vehicles.length > 0) return setCache(cacheKey, vehicles, CACHE_TTL.vehicles);
                    } else {
                        const vehicles: CartrackVehicle[] = items.map((item: any) => ({
                            id: String(item.id || item.vehicle_id),
                            registration: item.registration || item.serial_number || 'Sem Matrícula',
                            label: item.label || item.equipment_id || item.registration || 'Sem Nome',
                            latitude: Number(item.latitude || item.location?.latitude || 0),
                            longitude: Number(item.longitude || item.location?.longitude || 0),
                            speed: Number(item.speed || item.location?.speed || 0),
                            bearing: Number(item.bearing || 0),
                            last_activity: item.last_activity || item.location?.timestamp || new Date().toISOString(),
                            ignition: item.ignition ?? false,
                            status: item.ignition ? 'moving' : (item.idling ? 'idle' : 'stopped'),
                        }));
                        if (vehicles.length > 0) {
                            preferredVehicleEndpoint = endpoint as any;
                            return setCache(cacheKey, vehicles, CACHE_TTL.vehicles);
                        }
                    }
                } catch (error) {
                    console.error(`Error fetching from ${endpoint}:`, error);
                }
            }
            return [];
        });
    },

    getGeofences: async (): Promise<CartrackGeofence[]> => {
        const cacheKey = 'geofences';
        const cached = getCache<CartrackGeofence[]>(cacheKey);
        if (cached) return cached;

        return fetchWithDeduplication(cacheKey, async () => {
            const endpoints = ['/geofences', '/points_of_interest'];
            
            for (const endpoint of endpoints) {
                try {
                    const response = await createCartrackRequest<any>(endpoint);
                    const items = response.geofences || response.points_of_interest || response.data || response.rows || (Array.isArray(response) ? response : []);

                    if (items.length > 0) {
                        const geofences: CartrackGeofence[] = items.map((item: any) => ({
                            id: String(item.id || item.poi_id || item.geofence_id),
                            name: item.name || item.label || item.description || `POI ${item.id}`,
                            area_id: item.area_id,
                            latitude: Number(item.latitude || item.lat || item.center?.lat || 0),
                            longitude: Number(item.longitude || item.lng || item.center?.lng || 0),
                            radius: item.radius || item.center?.radius || 0,
                        })).filter((g: CartrackGeofence) => g.latitude !== 0 && g.longitude !== 0);

                        if (geofences.length > 0) {
                            return setCache(cacheKey, geofences, CACHE_TTL.geofences);
                        }
                    }
                } catch (error) {
                    console.error(`Error fetching geofences from ${endpoint}:`, error);
                }
            }
            return [];
        });
    },

    getDrivers: async (): Promise<CartrackDriver[]> => {
        const cacheKey = 'drivers';
        const cached = getCache<CartrackDriver[]>(cacheKey);
        if (cached) return cached;

        return fetchWithDeduplication(cacheKey, async () => {
            try {
                const response = await createCartrackRequest<CartrackListResponse<any>>('/drivers');
                const items = response.drivers || response.personnel || response.data || [];

                const drivers: CartrackDriver[] = items.map((item: any) => ({
                    id: String(item.id),
                    firstName: item.first_name || '',
                    lastName: item.last_name || '',
                    fullName: item.full_name || `${item.first_name || ''} ${item.last_name || ''}`.trim(),
                    tagId: item.tag_id,
                }));

                return setCache(cacheKey, drivers, CACHE_TTL.drivers);
            } catch (error) {
                console.error('Error fetching drivers:', error);
                return [];
            }
        });
    },

    getGeofenceVisits: async (vehicleId: string, daysBack = 1): Promise<CartrackGeofenceVisit[]> => {
        try {
            const date = new Date();
            date.setDate(date.getDate() - daysBack);
            const startTime = date.toISOString();

            const response = await createCartrackRequest<CartrackListResponse<any>>('/geofence_visits', {
                vehicle_id: vehicleId,
                start_time: startTime,
            });

            const items = response.visits || response.data || [];

            return items.map((item: any) => ({
                id: String(item.id),
                vehicleId: String(item.vehicle_id),
                registration: item.registration,
                geofenceId: String(item.geofence_id),
                geofenceName: item.geofence_name,
                entryTime: item.entry_time,
                exitTime: item.exit_time,
                durationSeconds: item.duration_seconds,
            }));
        } catch (error) {
            console.error('Error fetching geofence visits:', error);
            return [];
        }
    }
};

// ==============================
// 🔹 HELPERS
// ==============================

export const cleanTagId = (tag?: string): string => {
    if (!tag) return '';
    return tag.trim().toUpperCase().replace(/\s+/g, '').replace(/-/g, '');
};

export const getTagVariants = (tag?: string): string[] => {
    if (!tag) return [];
    const cleaned = cleanTagId(tag);
    return [cleaned, cleaned.replace(/\s/g, '')];
};
