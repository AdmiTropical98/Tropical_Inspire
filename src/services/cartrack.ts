// ==============================
// 🔹 CONFIG
// ==============================

const BASE_URL = 'https://fleetapi-pt.cartrack.com/rest';

const CARTRACK_USERNAME = import.meta.env.VITE_CARTRACK_USERNAME;
const CARTRACK_PASSWORD = import.meta.env.VITE_CARTRACK_PASSWORD;

const CACHE_TTL = {
    vehicles: 30_000,
};

// ==============================
// 🔹 CACHE
// ==============================

type CacheEntry<T> = {
    value: T;
    expiresAt: number;
};

const cacheStore = new Map<string, CacheEntry<unknown>>();

const getCache = <T>(key: string): T | null => {
    const entry = cacheStore.get(key) as CacheEntry<T> | undefined;
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

// ==============================
// 🔹 AUTH
// ==============================

const getAuthHeaders = (): HeadersInit => {
    if (!CARTRACK_USERNAME || !CARTRACK_PASSWORD) {
        console.error("❌ Credenciais Cartrack não definidas");
        return {};
    }

    const credentials = btoa(`${CARTRACK_USERNAME}:${CARTRACK_PASSWORD}`);

    console.log("🔐 Username:", CARTRACK_USERNAME);

    return {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/json',
    };
};

// ==============================
// 🔹 DEBUG
// ==============================

let lastCartrackResponse: any = null;

export const setLastResponse = (data: any) => {
    lastCartrackResponse = data;
};

export const debugLastResponse = () => {
    console.log("📦 Última resposta Cartrack:", lastCartrackResponse);
    return lastCartrackResponse;
};

// ==============================
// 🔹 REQUEST
// ==============================

const buildCartrackUrl = (
    endpoint: string,
    queryParams?: Record<string, string | number | undefined>
): string => {

    const normalizedEndpoint = endpoint.startsWith('/')
        ? endpoint
        : `/${endpoint}`;

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
            url += `?${queryString}`;
        }
    }

    return url;
};

const createCartrackRequest = async <T>(
    endpoint: string,
    queryParams?: Record<string, string | number | undefined>,
): Promise<T> => {

    const url = buildCartrackUrl(endpoint, queryParams);

    console.log("🚀 Request:", url);

    const response = await fetch(url, {
        method: 'GET',
        headers: getAuthHeaders(),
    });

    console.log("📡 Status:", response.status);

    if (!response.ok) {
        const text = await response.text();

        console.error("❌ ERRO COMPLETO CARTRACK:");
        console.error("Status:", response.status);
        console.error("Resposta:", text);

       return null as unknown as T;
    }

    const data = await response.json();

    setLastResponse(data);

    console.log("✅ Resposta:", data);

    return data as T;
};

// ==============================
// 🔹 HELPERS
// ==============================

const getListItems = (result: any): any[] => {
    if (!result) return [];

    if (Array.isArray(result)) return result;

    return result.data || result.rows || result.positions || [];
};

// ==============================
// 🔹 TYPES
// ==============================

export interface CartrackVehicle {
    id: string;
    registration: string;
    label: string;
    latitude: number;
    longitude: number;
    speed: number;
    bearing: number;
    last_activity: string;
}

// ==============================
// 🔹 MAPPER
// ==============================

const mapCartrackDataToVehicles = (data: any): CartrackVehicle[] => {
    if (!data) return [];

    const items = getListItems(data);

    return items.map((item: any) => {
        const loc = item.location || item.last_pos || item;

        return {
            id: String(item.vehicle_id || item.id),
            registration: item.registration || 'Sem Matrícula',
            label: item.vehicle_name || item.registration || 'Sem Nome',
            latitude: Number(loc.latitude || loc.lat || 0),
            longitude: Number(loc.longitude || loc.lng || 0),
            speed: Number(item.speed || 0),
            bearing: Number(item.bearing || 0),
            last_activity: item.event_ts || new Date().toISOString(),
        };
    });
};

// ==============================
// 🔹 SERVICE
// ==============================

export const CartrackService = {

    getVehicles: async (): Promise<CartrackVehicle[]> => {
        try {
            const cached = getCache<CartrackVehicle[]>('cartrack:vehicles');
            if (cached) return cached;

            let data = null;

            const endpoints = [
                '/position',
                '/lastposition',
                '/vehicle',
            ];

            for (const ep of endpoints) {
                try {
                    const result = await createCartrackRequest<any>(ep);

                    const items = getListItems(result);

                    if (items.length > 0) {
                        data = result;
                        console.log("✅ Endpoint válido:", ep);
                        break;
                    }

                } catch (err) {
                    console.warn("❌ Falhou endpoint:", ep);
                }
            }

            if (!data) {
                console.error("⚠️ A usar dados mock (fallback)");

                return [
                    {
                        id: "demo",
                        registration: "00-XX-00",
                        label: "Viatura Demo",
                        latitude: 37.089,
                        longitude: -8.247,
                        speed: 0,
                        bearing: 0,
                        last_activity: new Date().toISOString(),
                    }
                ];
            }

            const mapped = mapCartrackDataToVehicles(data);

            console.log("🚗 Veículos:", mapped.length);

            return setCache('cartrack:vehicles', mapped, CACHE_TTL.vehicles);

        } catch (error) {
            console.error("🔥 ERRO FINAL CARTRACK:", error);

            return [];
        }
    }
};

// ==============================
// 🔹 COMPATIBILIDADE
// ==============================

export const cleanTagId = (tag?: string): string => {
    if (!tag) return '';

    return tag
        .trim()
        .toUpperCase()
        .replace(/\s+/g, '')
        .replace(/-/g, '');
};

export const getTagVariants = (tag?: string): string[] => {
    if (!tag) return [];

    const cleaned = cleanTagId(tag);

    return [
        cleaned,
        cleaned.replace(/\s/g, ''),
    ];
};
