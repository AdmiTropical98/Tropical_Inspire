const BASE_URL = 'https://api.cartrack.com/rest';

const CARTRACK_TOKEN = process.env.CARTRACK_TOKEN;

const CACHE_TTL = {
    vehicles: 30_000,
};

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

const getAuthHeaders = (): HeadersInit => {
    if (!CARTRACK_TOKEN) {
        console.error("❌ CARTRACK_TOKEN não definido");
        return {};
    }

    return {
        Authorization: `Bearer ${CARTRACK_TOKEN}`,
        'Content-Type': 'application/json'
    };
};

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

    console.log("🚀 Request Cartrack:", url);

    const response = await fetch(url, {
        method: 'GET',
        headers: getAuthHeaders(),
    });

    console.log("📡 Status:", response.status);

    if (!response.ok) {
        const text = await response.text();
        console.error("❌ Erro API:", text);
        throw new Error(`Cartrack request failed (${response.status})`);
    }

    const data = await response.json();

    console.log("✅ Resposta:", data);

    return data as T;
};

const getListItems = (result: any): any[] => {
    if (!result) return [];
    return result.data || result.rows || result.positions || [];
};

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

export const CartrackService = {

    getVehicles: async (): Promise<CartrackVehicle[]> => {
        try {
            const cached = getCache<CartrackVehicle[]>('cartrack:vehicles');
            if (cached) return cached;

            let data = null;

            const endpoints = ['/vehicles/status', '/vehicles'];

            for (const ep of endpoints) {
                try {
                    const result = await createCartrackRequest<any>(ep, { per_page: 100 });

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
                throw new Error("❌ Nenhum endpoint retornou dados");
            }

            const mapped = mapCartrackDataToVehicles(data);

            console.log("🚗 Veículos encontrados:", mapped.length);

            return setCache('cartrack:vehicles', mapped, CACHE_TTL.vehicles);

        } catch (error) {
            console.error("🔥 ERRO REAL CARTRACK:", error);
            throw error;
        }
    }
};
