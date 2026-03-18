// ==============================
// 🔹 CONFIG
// ==============================

const BASE_URL = 'https://fleetapi-pt.cartrack.com/rest/alerts?limit=10';

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

// ==============================
// 🔹 AUTH
// ==============================

const getAuthHeaders = (): HeadersInit => {
    if (!CARTRACK_USERNAME || !CARTRACK_PASSWORD) {
        console.error("❌ Credenciais Cartrack não definidas");
        return {};
    }

    const credentials = btoa(`${CARTRACK_USERNAME}:${CARTRACK_PASSWORD}`);

    return {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/json',

        // 🔥 IMPORTANTE PARA AEMP
        'Accept': 'application/iso15143-snapshot+json'
    };
};

// ==============================
// 🔹 REQUEST
// ==============================

const buildUrl = (endpoint: string) => {
    return endpoint.startsWith('/')
        ? `${BASE_URL}${endpoint}`
        : `${BASE_URL}/${endpoint}`;
};

const request = async <T>(endpoint: string): Promise<T> => {
    const url = buildUrl(endpoint);

    console.log("🚀 Cartrack Request:", url);

    const response = await fetch(url, {
        method: 'GET',
        headers: getAuthHeaders(),
    });

    console.log("📡 Status:", response.status);

    if (!response.ok) {
        const text = await response.text();
        console.error("❌ Cartrack Error:", text);
        throw new Error(`Cartrack error ${response.status}`);
    }

    return response.json();
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
    last_activity: string;
}

// ==============================
// 🔹 MAPPER AEMP (REAL)
// ==============================

const mapAEMP = (data: any): CartrackVehicle[] => {
    if (!data?.data) return [];

    return data.data.map((item: any) => ({
        id: item.equipment_header?.equipment_id || '',
        registration: item.equipment_header?.serial_number || 'Sem Matrícula',
        label: item.equipment_header?.equipment_id || 'Sem Nome',

        latitude: Number(item.location?.latitude || 0),
        longitude: Number(item.location?.longitude || 0),

        speed: Number(item.location?.speed || 0),

        last_activity: item.location?.timestamp || new Date().toISOString(),
    }));
};

// ==============================
// 🔹 SERVICE
// ==============================

export const CartrackService = {

    getVehicles: async (): Promise<CartrackVehicle[]> => {
        try {
            const cached = getCache<CartrackVehicle[]>('vehicles');
            if (cached) return cached;

            // 🔥 ENDPOINT CERTO (GPS REAL)
            const data = await request<any>('/aemp/iso15143-3/beta/fleet');

            const vehicles = mapAEMP(data);

            console.log("🚗 Veículos reais:", vehicles.length);

            if (vehicles.length === 0) {
                console.warn("⚠️ Sem dados GPS disponíveis");
            }

            return setCache('vehicles', vehicles, CACHE_TTL.vehicles);

        } catch (error) {
            console.error("🔥 ERRO FINAL:", error);

            // ❌ NADA DE DEMO
            return [];
        }
    }
};

// ==============================
// 🔹 HELPERS
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
