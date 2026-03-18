const BASE_URL = import.meta.env.DEV
    ? '/api/cartrack'
    : '/proxy.php?endpoint=';

const CARTRACK_USER = import.meta.env.VITE_CARTRACK_USER;
const CARTRACK_PASS = import.meta.env.VITE_CARTRACK_PASS;
const USE_PROXY_AUTH = String(import.meta.env.VITE_CARTRACK_USE_PROXY_AUTH ?? 'true') !== 'false';

const CACHE_TTL = {
    vehicles: 30_000,
    geofences: 5 * 60_000,
    drivers: 10 * 60_000,
    geofenceVisits: 60_000,
    routeHistory: 60_000,
};

const MAX_PAGES = 10;
const VEHICLES_MIN_REQUEST_INTERVAL_MS = 30_000;

type CacheEntry<T> = {
    value: T;
    expiresAt: number;
};

const cacheStore = new Map<string, CacheEntry<unknown>>();
const inFlightRequests = new Map<string, Promise<unknown>>();

let preferredVehicleEndpoint: '/vehicles/status' | '/vehicles' = '/vehicles/status';
let lastVehiclesFetchAt = 0;

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
    group_name?: string; // New field
}

export interface CartrackVehicle {
    id: string;
    registration: string; // Placa
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
    driverId?: number | string; // Corrected field
    status?: string; // Corrected field
    fuelType?: string; // Corrected optional/required
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

const getAuthHeaders = (): HeadersInit => {
    // Preferred mode: credentials stay in backend/proxy/edge function.
    if (USE_PROXY_AUTH) {
        return {};
    }

    if (CARTRACK_USER && CARTRACK_PASS) {
        const auth = btoa(`${CARTRACK_USER}:${CARTRACK_PASS}`);
        return { Authorization: `Basic ${auth}` };
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

const getListItems = <T>(result: CartrackListResponse<T> | T[] | unknown): T[] => {
    if (Array.isArray(result)) return result;
    if (!result || typeof result !== 'object') return [];

    const typed = result as CartrackListResponse<T>;
    return typed.data || typed.rows || typed.geofences || typed.drivers || typed.personnel || typed.identification_tags || typed.visits || typed.positions || [];
};

const dedupeByTagId = (items: any[]): any[] => {
    const seen = new Set<string>();
    return items.filter(item => {
        const key = String(item.tag_id || item.identification_tag_id || item.id || Math.random());
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
};

/**
 * Returns an array of possible variants for a Tag ID to ensure high matching recall
 */
export const getTagVariants = (rawTagId?: string | null): string[] => {
    if (!rawTagId) return [];
    let tag = String(rawTagId).trim().toUpperCase();
    const variants = new Set<string>();

    // 1. Add raw
    variants.add(tag);

    // 2. Remove leading zeros
    const noLeadingZeros = tag.replace(/^0+/, '');
    if (noLeadingZeros) variants.add(noLeadingZeros);

    // 3. Handle UUID styles (0000-01A7F485)
    if (tag.includes('-')) {
        const parts = tag.split('-');
        parts.forEach(p => {
            const cleanP = p.replace(/^0+/, '');
            if (cleanP.length >= 4) variants.add(cleanP);
        });
        const last = parts.pop();
        if (last) variants.add(last);
    }

    // 4. Handle 16-char hex IDs (e.g. 3D000001A8A3ED01)
    if (tag.length >= 10) {
        // Pattern 1: Central part (skipping first and last 2-4 chars)
        if (tag.length >= 14) {
            const central = tag.substring(2, tag.length - 2);
            variants.add(central);
            const cleanCentral = central.replace(/^0+/, '');
            if (cleanCentral.length >= 4) variants.add(cleanCentral);

            // Sub-central
            const mid8 = tag.substring(4, 12);
            if (mid8.length >= 6) variants.add(mid8);
        }

        // Pattern 2: Multi-length suffixes
        [14, 12, 10, 8, 6, 4].forEach(len => {
            if (tag.length >= len) {
                const suffix = tag.substring(tag.length - len);
                variants.add(suffix);
                const cleanSuffix = suffix.replace(/^0+/, '');
                if (cleanSuffix.length >= 4) variants.add(cleanSuffix);
            }
        });

        // Pattern 3: Middle extraction if there's a padding of zeros
        const midMatch = tag.match(/^[0-9A-F]{2,6}0+([0-9A-F]{4,10})[0-9A-F]{1,4}$/);
        if (midMatch) {
            variants.add(midMatch[1]);
            variants.add(midMatch[1].replace(/^0+/, ''));
        }
    }

    return Array.from(variants).filter(v => v.length >= 4);
};

/**
 * Legacy support for cleaning a tag to its 'best' variant
 */
export const cleanTagId = (rawTagId?: string | null): string | undefined => {
    const v = getTagVariants(rawTagId);
    if (v.length === 0) return undefined;
    // Prefer variants between 6 and 10 chars, then longest, then first
    return v.find(tag => tag.length >= 6 && tag.length <= 10) ||
        [...v].sort((a, b) => b.length - a.length)[0];
};

/**
 * Utility to parse WKT POLYGON((lng lat, lng lat, ...))
 * Cartrack typically uses (longitude latitude) order in WKT
 */
const parseWKT = (wkt: string): { lat: number, lng: number }[] => {
    if (!wkt) return [];
    try {
        const coordsMatch = wkt.match(/\(\((.*)\)\)/) || wkt.match(/\((.*)\)/);
        if (!coordsMatch) return [];

        return coordsMatch[1].split(',').map(pair => {
            const cleanPair = pair.trim();
            const [lng, lat] = cleanPair.split(/\s+/).map(Number);
            return { lat, lng };
        }).filter(p => !isNaN(p.lat) && !isNaN(p.lng));
    } catch (e) {
        console.error('Error parsing WKT:', e);
        return [];
    }
};

const mapCartrackDataToVehicles = (data: any): CartrackVehicle[] => {
    if (!data || !data.data) return [];

    return data.data.map((item: any) => {
        // Location mapping: Look for item.location (from /status), item.last_pos, or item root
        const loc = item.location || item.last_pos || item.last_position || item;

        // Driver Name Construction
        let driverName = 'Sem Condutor';
        if (item.driver) {
            if (item.driver.first_name || item.driver.last_name) {
                driverName = [item.driver.first_name, item.driver.last_name].filter(Boolean).join(' ');
            } else if (item.driver.full_name) {
                driverName = item.driver.full_name;
            } else if (item.driver.name) {
                driverName = item.driver.name;
            }
        }

        return {
            id: String(item.vehicle_id || item.id),
            registration: item.registration || item.name || 'Sem Matrícula',
            // Use label if present, otherwise registration
            label: item.vehicle_name || item.registration || 'Sem Nome',
            status: item.ignition ? 'moving' : (item.idling ? 'idle' : 'stopped'),
            latitude: Number(loc.latitude || loc.lat || 0),
            longitude: Number(loc.longitude || loc.lng || 0),
            speed: Number(item.speed || loc.speed || 0),
            bearing: Number(item.bearing || loc.heading || loc.bearing || 0),
            last_activity: item.event_ts || item.last_activity || new Date().toISOString(),
            last_position_update: loc.updated || item.last_position_update || new Date().toISOString(),
            address: loc.position_description || item.address || '',
            driverName: driverName,
            ignition: !!item.ignition,
            tagId: cleanTagId(item.last_identification_tag_id) || '', // Limpa o ID da tag (remove 0000-0000...)
            currentGeofenceName: item.geofence_name || loc.geofence_name || item.current_geofence || ''
        };
    });
};

// DEBUG VAR
export let debugLastResponse: any = null;

export const CartrackService = {
    getGeofences: async (): Promise<CartrackGeofence[]> => {
        try {
            const cached = getCache<CartrackGeofence[]>('cartrack:geofences');
            if (cached) return cached;

            let allGeofences: any[] = [];
            for (let page = 1; page <= MAX_PAGES; page++) {
                const result = await createCartrackRequest<CartrackListResponse<any>>('/geofences', {
                    per_page: 100,
                    page,
                });

                const items = getListItems(result);
                if (items.length === 0) break;

                allGeofences = [...allGeofences, ...items];
                if (items.length < 100) break;
            }

            const mapped = allGeofences.map((item: any) => ({
                id: String(item.id),
                name: item.name,
                radius: item.radius,
                latitude: item.latitude,
                longitude: item.longitude,
                polygon_wkt: item.polygon_wkt,
                points: item.polygon_wkt ? parseWKT(item.polygon_wkt) : undefined,
                group_name: item.group_name || 'Geral' // Expose Group Name
            }));

            return setCache('cartrack:geofences', mapped, CACHE_TTL.geofences);
        } catch (error) {
            console.error('Failed to fetch geofences:', error);
            throw error;
        }
    },

    getVehicles: async (): Promise<CartrackVehicle[]> => {
        try {
            const cached = getCache<CartrackVehicle[]>('cartrack:vehicles');
            if (cached) return cached;

            const elapsedSinceLastRequest = Date.now() - lastVehiclesFetchAt;
            if (elapsedSinceLastRequest < VEHICLES_MIN_REQUEST_INTERVAL_MS) {
                const inFlight = inFlightRequests.get('cartrack:vehicles');
                if (inFlight) return inFlight as Promise<CartrackVehicle[]>;
            }

            const endpoints: Array<'/vehicles/status' | '/vehicles'> = preferredVehicleEndpoint === '/vehicles/status'
                ? ['/vehicles/status', '/vehicles']
                : ['/vehicles', '/vehicles/status'];

            let data = null;

            console.log('Fetching Cartrack Vehicles...');

            const fetchPromise = (async () => {
                for (const ep of endpoints) {
                    try {
                        const result = await createCartrackRequest<CartrackListResponse<any>>(ep, { per_page: 100 });
                        data = result;
                        debugLastResponse = { endpoint: ep, status: 200, data };

                        const items = getListItems<any>(result);
                        if (items.length === 0) continue;

                        const firstItem = items[0];
                        if (firstItem.location || firstItem.last_pos || firstItem.latitude) {
                            preferredVehicleEndpoint = ep;
                            break;
                        }
                    } catch (e) {
                        debugLastResponse = { endpoint: ep, error: String(e) };
                        console.warn(`Error fetching ${ep}`, e);
                    }
                }

                if (!data) {
                    console.warn('Cartrack vehicles endpoints returned no data. Rejecting to trigger mock fallback.');
                    throw new Error('No data returned from Cartrack endpoints.');
                }

                const mapped = mapCartrackDataToVehicles(data);
                lastVehiclesFetchAt = Date.now();
                console.log(`Mapped ${mapped.length} vehicles.`);

                return setCache('cartrack:vehicles', mapped, CACHE_TTL.vehicles);
            })();

            inFlightRequests.set('cartrack:vehicles', fetchPromise);
            const result = await fetchPromise;
            inFlightRequests.delete('cartrack:vehicles');

            return result;
        } catch (error) {
            inFlightRequests.delete('cartrack:vehicles');
            console.warn('Failed to fetch vehicles:', error);

            // DEMO MODE FALLBACK ON ERROR (401/Network)
            console.warn('DEBUG MODE: API Failed, injecting MOCK VEHICLE for UI test.');
            return [{
                id: 'MOCK-ERROR-001',
                registration: 'DEMO-MODE',
                label: 'Viatura Demo (Erro Auth)',
                status: 'moving',
                latitude: 38.722, // Lisbon
                longitude: -9.139,
                speed: 80,
                bearing: 90,
                last_activity: new Date().toISOString(),
                last_position_update: new Date().toISOString(),
                driverName: 'Verifique Credenciais',
                ignition: true
            }];
        }
    },

    /**
     * Fetch all drivers from Cartrack with high recall and safety fallback
     */
    getDrivers: async (): Promise<CartrackDriver[]> => {
        try {
            const cached = getCache<CartrackDriver[]>('cartrack:drivers');
            if (cached) return cached;

            // 1. Known Tags Safety List (User Provided) - 100% official fallback
            const knownIds = [
                '01EEA0A600000080', '000000001FFFFF01', '3D0000011B567901', '3A0000011BD96201',
                '2D000001278D2401', '1B00000128A41901', 'B40000015D63FD01', '5C0000016142E901',
                '96000001619A3B01', '26000001636A2601', '6D000001637A2701', '6E0000016380F301',
                'F400000163B56F01', '470000016406F801', 'E20000016478DC01', '3C000001664EAF01',
                'F4000001665AF801', 'AD000001665DB401', '750000016661B801', 'A0000001666B8F01',
                '890000016679D401', '7B00000169313D01', 'C20000016936AE01', '3600000169508401',
                'C30000016959B101', 'A700000169766001', 'CC00000169876001', '5300000169B34601',
                'D00000016C42F401', 'ED0000016CF45201', '3100000171439901', '85000001722FF301',
                'F600000181A97201', 'D800000182003C01', '90000001824BD701', '63000001825FEB01',
                '6E0000018294DD01', 'CF00000182987901', 'A700000182BB6E01', 'A300000185133601',
                '0F0000018550EC01', '6000000185FBAF01', 'BB00000186A3A401', '3700000186F2EC01',
                '3E000001872A0601', '6B00000187A39201', 'CC000001881CE501', 'AD0000018850A101',
                'CE00000188588401', 'D300000188A4E701', '7700000188B1B801', '8900000188EAFA01',
                '5A00000188F07101', '85000001891B6901', '8A000001893B9E01', 'E7000001897C5301',
                'C3000001898FCF01', 'BF00000189927A01', '7F00000189C67701', 'B300000189C6EB01',
                'D20000018A5AF401', '0C0000018A8D1F01', '6A0000018A934601', '520000018AD19F01',
                '300000018C920301', 'A10000018D5C4601', '420000018D7F2F01', 'EF0000018E18F701',
                'EE0000019E03E501', 'A70000019E15A101', '910000019E290B01', 'EB0000019E2A9C01',
                '420000019E2FA501', 'BC0000019E37DA01', '950000019E42D301', 'E90000019EBB3301',
                '020000019EC88901', '6A0000019F632201', 'D30000019F668301', '620000019FD2D901',
                'B4000001A135D901', '21000001A1497E01', '30000001A16D0C01', '02000001A5D80401',
                '8D000001A5E10F01', '7F000001A5EAB801', 'AC000001A6063501', '3F000001A6A0EE01',
                'A7000001A7DECC01', '8B000001A7EE0D01', 'F3000001A7F0B501', '01000001A7F48501',
                '23000001A7F68D01', 'E3000001A7F9FC01', 'E5000001A802F101', '51000001A8083801',
                'D5000001A811E201', 'E8000001A81A5F01', 'C1000001A83CE201', '8A000001A85D6E01',
                '0C000001A8704101', '61000001A889BC01', '11000001A89F8001', '3D000001A8A3ED01',
                'CD000001A8C7D301', '05000001A8CD9301', '5000001A8CD9F301', 'E700001CB7314001',
                '0C00001D03D6AC01', 'AC0046A187A39201', '0001FFFF2550EC01', '201620031AFF2F01',
                '2080467FFBE68301', 'C08FFFFFFFFFD701', 'FFE000116142E901', 'FFE4000188B1B801',
                'FFF00001A7EE0D01', 'FFF2000186F2EC01', 'FFFFF00169B34601', 'FFFFFFD988B1B801',
                'FFFFFFFFCA5AF401', 'FFFFFFFFFFE5E201', 'FFFFFFFFFFFAEC01', 'D7FFFFFFFFFFF401'
            ];

            let allItems: any[] = knownIds.map(id => ({
                id: `known-${id}`,
                full_name: 'Tag Oficial AlgaTempo',
                tag_id: id
            }));

            // 2. Fetch Drivers (Safety limit: 10 pages)
            let totalPages = 1;
            for (let page = 1; page <= MAX_PAGES && page <= totalPages; page++) {
                try {
                    const result = await createCartrackRequest<CartrackListResponse<any>>('/drivers', {
                        per_page: 100,
                        page,
                    });

                    const items = getListItems(result);
                    if (!Array.isArray(items) || items.length === 0) break;

                    allItems = [...allItems, ...items];
                    const apiTotalPages = result.meta?.pagination?.total_pages;
                    if (apiTotalPages) {
                        totalPages = Math.min(apiTotalPages, MAX_PAGES);
                    } else if (items.length < 100) {
                        break;
                    }
                } catch {
                    break;
                }
            }

            // 3. Try Personnel
            try {
                const pData = await createCartrackRequest<CartrackListResponse<any>>('/personnel', { per_page: 100 });
                const pItems = getListItems(pData);
                if (Array.isArray(pItems)) allItems = [...allItems, ...pItems];
            } catch { }

            // 4. Try Identification Tags directly
            try {
                const tData = await createCartrackRequest<CartrackListResponse<any>>('/identification_tags', { per_page: 100 });
                const tItems = getListItems(tData);
                if (Array.isArray(tItems)) {
                    tItems.forEach((tg: any) => {
                        const tid = String(tg.tag_id || tg.id || (typeof tg === 'string' ? tg : ''));
                        if (tid && !allItems.some(ex => (ex.tag_id || ex.identification_tag_id) === tid)) {
                            allItems.push({ id: `tag-${tid}`, full_name: `Tag Oficial (${tid.slice(-4)})`, tag_id: tid });
                        }
                    });
                }
            } catch { }

            const mapped = dedupeByTagId(allItems).map((item: any) => {
                const rawTag = item.tag_id ||
                    item.identification_tag_id ||
                    item.identification_tag?.tag_id ||
                    item.tag ||
                    item.external_id ||
                    item.driver_identification ||
                    item.identification;

                return {
                    id: String(item.id || item.driver_id || rawTag),
                    firstName: item.first_name || '',
                    lastName: item.last_name || '',
                    fullName: item.full_name || `${item.first_name || ''} ${item.last_name || ''}`.trim() || 'Motorista S/ Nome',
                    tagId: rawTag ? String(rawTag).toUpperCase() : undefined,
                    tagVariants: getTagVariants(rawTag ? String(rawTag) : undefined),
                    customFields: item.custom_fields
                };
            }).filter(d => d.fullName !== 'Motorista S/ Nome' || d.tagId);

            return setCache('cartrack:drivers', mapped, CACHE_TTL.drivers);
        } catch (error) {
            console.warn('Failed to fetch drivers (returning empty):', error);
            return [];
        }
    },

    getGeofenceVisits: async (startDate: string, endDate: string, vehicleId?: string): Promise<CartrackGeofenceVisit[]> => {
        try {
            const cacheKey = `cartrack:geofence-visits:${vehicleId || 'all'}:${startDate}:${endDate}`;
            const cached = getCache<CartrackGeofenceVisit[]>(cacheKey);
            if (cached) return cached;

            // Note: Cartrack API param names might vary. Common possibilities: start_date, from, since.
            // Using standard guess based on previous logic attempt or reverting to 'last_position' if this is a stateless fetch.
            // If the user context was sending specific dates, let's pass them.

            const result = await createCartrackRequest<CartrackListResponse<any>>('/geofence_visits', {
                per_page: 100,
                vehicle_id: vehicleId,
                start_date: startDate,
                end_date: endDate,
            });

            const items = getListItems(result);
            const mapped = items.map((item: any) => ({
                id: String(item.id),
                vehicleId: String(item.vehicle_id),
                registration: item.registration,
                geofenceId: String(item.geofence_id),
                geofenceName: item.geofence_name,
                entryTime: item.entry_time,
                exitTime: item.exit_time,
                durationSeconds: item.duration_seconds
            }));

            return setCache(cacheKey, mapped, CACHE_TTL.geofenceVisits);
        } catch (error) {
            console.error('Failed to fetch geofence visits:', error);
            throw error;
        }
    },

    getRouteHistory: async (vehicleId: string, startDate: string, endDate: string): Promise<{ lat: number, lng: number, time: string }[]> => {
        try {
            const cacheKey = `cartrack:route-history:${vehicleId}:${startDate}:${endDate}`;
            const cached = getCache<{ lat: number, lng: number, time: string }[]>(cacheKey);
            if (cached) return cached;

            const allItems: any[] = [];
            for (let page = 1; page <= MAX_PAGES; page++) {
                const result = await createCartrackRequest<CartrackListResponse<any>>('/positions', {
                    'vehicle_ids[]': vehicleId,
                    start_date: startDate,
                    end_date: endDate,
                    per_page: 200,
                    page,
                });

                const items = getListItems(result);
                if (items.length === 0) break;

                allItems.push(...items);
                if (items.length < 200) break;
            }

            const mapped = allItems.map((item: any) => ({
                lat: Number(item.latitude),
                lng: Number(item.longitude),
                time: item.event_ts || item.timestamp
            })).filter((p: any) => !isNaN(p.lat) && !isNaN(p.lng) && p.lat !== 0 && p.lng !== 0);

            return setCache(cacheKey, mapped, CACHE_TTL.routeHistory);

        } catch (error) {
            console.error('Failed to fetch route history:', error);
            return [];
        }
    }
};
