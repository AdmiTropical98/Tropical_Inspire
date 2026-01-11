export const CARTRACK_USER = 'ALGA00012';
export const CARTRACK_PASS = 'd395112ab45cf4a2cfa734a478e699b6964b4281fa47aebc069ce0793cfd1b45';
export const BASE_URL = 'https://fleetapi-pt.cartrack.com/rest';

// Types for Geofence Data
export interface CartrackGeofence {
    id: string;
    name: string;
    type: 'CIRCLE' | 'POLYGON';
    coordinates: { lat: number; lng: number }[];
    radius?: number;
    color?: string;
}

// Types for Vehicle Data
export interface CartrackVehicle {
    id: string;
    registration: string;
    name: string;
    latitude: number;
    longitude: number;
    speed: number;
    heading: number;
    updatedAt: string;
    status: 'moving' | 'stopped' | 'idle';
    ignition: boolean;
    driverName?: string;
    driverId?: string;
    tagId?: string;
}

export interface CartrackDriver {
    id: string;
    firstName: string;
    lastName: string;
    fullName: string;
    tagId?: string;
    cleanedTagId?: string;
    customFields?: Record<string, string>;
}

export interface CartrackGeofenceVisit {
    id: string;
    vehicleId: number;
    registration: string;
    geofenceId: string;
    geofenceName: string;
    enterTimestamp: string;
    exitTimestamp: string | null;
    durationSeconds: number | null;
}

/**
 * Utility to clean a Tag ID to its most significant part
 */
export const cleanTagId = (rawTagId?: string | null): string | undefined => {
    if (!rawTagId) return undefined;
    let tag = rawTagId.trim().toUpperCase();

    // 1. If it's a UUID style (0000-01A7F485), take the last part
    if (tag.includes('-')) {
        tag = tag.split('-').pop() || tag;
    }

    // 2. Remove leading zeros
    tag = tag.replace(/^0+/, '');

    // 3. Handle 16-char hex IDs common in Cartrack (e.g. 3D000001A8A3ED01)
    if (tag.length >= 12) {
        // Pattern: [Start] + [Zeros/Padding] + [Body] + [Ending]
        // Very common: starts with 3D or similar, has a bunch of zeros, then the ID, then 01 or similar.
        // Let's try to find the "middle" part if there are at least 3 zeros in a row.
        const midMatch = tag.match(/[0-9A-F]{2}0+([0-9A-F]{4,10})[0-9A-F]{2}$/);
        if (midMatch) {
            return midMatch[1];
        }

        // Alternative: just take the central 6-8 characters if it's very long
        if (tag.length >= 14) {
            return tag.substring(tag.length - 10, tag.length - 2).replace(/^0+/, '');
        }
    }

    return tag || undefined;
};

/**
 * Utility to parse WKT POLYGON((lng lat, lng lat, ...))
 * Cartrack typically uses (longitude latitude) order in WKT
 */
const parseWKT = (wkt: string): { lat: number, lng: number }[] => {
    if (!wkt) return [];
    try {
        // Handle POLYGON ((...)) or other WKT variants
        const coordsMatch = wkt.match(/\(\((.*)\)\)/) || wkt.match(/\((.*)\)/);
        if (!coordsMatch) return [];

        return coordsMatch[1].split(',').map(pair => {
            const cleanPair = pair.trim();
            const [lng, lat] = cleanPair.split(/\s+/).map(Number);
            return { lat, lng };
        }).filter(p => !isNaN(p.lat) && !isNaN(p.lng));
    } catch (e) {
        console.warn('Failed to parse WKT:', wkt, e);
        return [];
    }
};

export const CartrackService = {
    /**
     * Fetch all geofences and POIs from Cartrack
     */
    getGeofences: async (): Promise<CartrackGeofence[]> => {
        try {
            const auth = btoa(`${CARTRACK_USER}:${CARTRACK_PASS}`);

            // Fetch Geofences and POIs in parallel, requesting 100 items to avoid pagination issues
            const [geoRes, poiRes] = await Promise.all([
                fetch(`${BASE_URL}/geofences?per_page=100`, { headers: { 'Authorization': `Basic ${auth}` } }),
                fetch(`${BASE_URL}/pois?per_page=100`, { headers: { 'Authorization': `Basic ${auth}` } })
            ]);

            let allGeofences: CartrackGeofence[] = [];

            if (geoRes.ok) {
                const geoData = await geoRes.json();
                allGeofences = [...allGeofences, ...mapCartrackDataToGeofences(geoData, 'POLYGON')];
            }

            if (poiRes.ok) {
                const poiData = await poiRes.json();
                allGeofences = [...allGeofences, ...mapCartrackDataToGeofences(poiData, 'CIRCLE')];
            }

            return allGeofences;
        } catch (error) {
            console.error('Failed to fetch geofences/pois:', error);
            throw error;
        }
    },

    /**
     * Fetch real-time vehicle positions using the official /vehicles/status endpoint
     */
    getVehicles: async (): Promise<CartrackVehicle[]> => {
        try {
            const auth = btoa(`${CARTRACK_USER}:${CARTRACK_PASS}`);

            // Try vehicles/activity (best for driver info) then status then others
            const endpoints = ['/vehicles/activity', '/vehicles/status', '/stats', '/vehicles'];
            let data = null;

            for (const ep of endpoints) {
                try {
                    const response = await fetch(`${BASE_URL}${ep}?per_page=100`, {
                        method: 'GET',
                        headers: { 'Authorization': `Basic ${auth}` },
                    });
                    if (response.ok) {
                        data = await response.json();
                        const items = Array.isArray(data) ? data : (data?.data || data?.rows || data?.items || []);
                        if (items.length > 0) break;
                    }
                } catch (e) {
                    console.warn(`Endpoint ${ep} failed:`, e);
                }
            }

            if (!data) throw new Error('Falha ao obter dados das viaturas da Cartrack');

            return mapCartrackDataToVehicles(data);
        } catch (error) {
            console.error('Failed to fetch vehicles:', error);
            throw error;
        }
    },

    /**
     * Fetch all drivers from Cartrack
     */
    getDrivers: async (): Promise<CartrackDriver[]> => {
        try {
            const auth = btoa(`${CARTRACK_USER}:${CARTRACK_PASS}`);
            let allItems: any[] = [];
            let page = 1;
            let totalPages = 1;

            do {
                try {
                    const response = await fetch(`${BASE_URL}/drivers?per_page=100&page=${page}`, {
                        method: 'GET',
                        headers: { 'Authorization': `Basic ${auth}` },
                    });
                    if (response.ok) {
                        const result = await response.json();
                        const items = result.data || result.rows || result.drivers || result || [];
                        if (Array.isArray(items)) {
                            allItems = [...allItems, ...items];
                            if (result.meta?.pagination?.total_pages) {
                                totalPages = result.meta.pagination.total_pages;
                            } else if (items.length === 100) {
                                totalPages = page + 1;
                            }
                        }
                    } else { break; }
                } catch (e) { break; }
                page++;
            } while (page <= totalPages && page < 10);

            // 2. Try Personnel (some API versions use this)
            try {
                const pRes = await fetch(`${BASE_URL}/personnel?per_page=100`, {
                    headers: { 'Authorization': `Basic ${auth}` }
                });
                if (pRes.ok) {
                    const pData = await pRes.json();
                    const pItems = pData.data || pData.rows || pData.personnel || pData || [];
                    if (Array.isArray(pItems)) allItems = [...allItems, ...pItems];
                }
            } catch { }

            // Fetch secondary tags if possible
            try {
                const tRes = await fetch(`${BASE_URL}/identification_tags?per_page=100`, {
                    headers: { 'Authorization': `Basic ${auth}` }
                });
                if (tRes.ok) {
                    const tData = await tRes.json();
                    const tItems = tData.data || tData.rows || tData.identification_tags || tData || [];
                    if (Array.isArray(tItems)) {
                        tItems.forEach((tg: any) => {
                            const tid = String(tg.tag_id || tg.id || (typeof tg === 'string' ? tg : ''));
                            if (tid && !allItems.some(ex => (ex.tag_id || ex.identification_tag_id) === tid)) {
                                allItems.push({
                                    id: `tag-${tid}`,
                                    full_name: `Tag Oficial (${tid.slice(-4)})`,
                                    tag_id: tid
                                });
                            }
                        });
                    }
                }
            } catch { }

            return allItems.map((item: any) => {
                const rawTag = item.tag_id ||
                    item.identification_tag_id ||
                    item.identification_tag?.tag_id ||
                    item.tag ||
                    item.external_id ||
                    item.driver_identification;

                return {
                    id: String(item.id || item.driver_id || rawTag),
                    firstName: item.first_name || '',
                    lastName: item.last_name || '',
                    fullName: item.full_name || `${item.first_name || ''} ${item.last_name || ''}`.trim() || 'Motorista S/ Nome',
                    tagId: rawTag ? String(rawTag).toUpperCase() : undefined,
                    cleanedTagId: cleanTagId(rawTag ? String(rawTag) : undefined),
                    customFields: item.custom_fields
                };
            }).filter(d => d.fullName !== 'Motorista S/ Nome' || d.tagId);
        } catch (error) {
            console.error('Failed to fetch drivers:', error);
            return [];
        }
    },

    /**
     * Fetch geofence visits for a specific time range (max 24h)
     */
    getGeofenceVisits: async (startDate: string, endDate: string): Promise<CartrackGeofenceVisit[]> => {
        try {
            const auth = btoa(`${CARTRACK_USER}:${CARTRACK_PASS}`);
            // Use encodeURIComponent for the filter parameters
            const params = new URLSearchParams();
            params.append('filter[enter_timestamp]', startDate);
            params.append('filter[exit_timestamp]', endDate);
            params.append('per_page', '100');

            const response = await fetch(`${BASE_URL}/geofences/visits?${params.toString()}`, {
                method: 'GET',
                headers: { 'Authorization': `Basic ${auth}` },
            });

            if (!response.ok) {
                const err = await response.json();
                console.error('Visits API Error:', err);
                return [];
            }

            const result = await response.json();
            const items = result.data || [];

            return items.map((item: any) => ({
                id: String(item.id),
                vehicleId: item.vehicle_id,
                registration: item.registration,
                geofenceId: item.geofence_id,
                geofenceName: item.geofence_name,
                enterTimestamp: item.enter_timestamp,
                exitTimestamp: item.exit_timestamp,
                durationSeconds: item.duration_total
            }));
        } catch (error) {
            console.error('Failed to fetch geofence visits:', error);
            return [];
        }
    }
};

const mapCartrackDataToVehicles = (data: any): CartrackVehicle[] => {
    const items = Array.isArray(data) ? data : (data?.data || data?.rows || data?.items || []);
    if (!Array.isArray(items)) return [];

    return items
        .map((item: any, index: number) => {
            // Check for nested location object or direct fields
            const loc = item.location || item;

            const latValue = loc.latitude || loc.lat || item.latitude || item.lat || 0;
            const lngValue = loc.longitude || loc.lng || loc.lon || item.longitude || item.lng || item.lon || 0;
            const speed = parseFloat(item.speed || item.vel || loc.speed || 0);

            const isIgnition = (item.ignition === true || item.ignition === 1 || item.ignition === '1' || item.ignition === 'true' || item.ignition === 'on' ||
                item.ign === true || item.ign === 1 || item.ign === '1' || item.ign === 'true' || item.ign === 'on');

            let finalStatus: 'moving' | 'stopped' | 'idle' = 'stopped';
            if (speed > 5) {
                finalStatus = 'moving';
            } else if (isIgnition) {
                finalStatus = 'idle';
            } else {
                finalStatus = 'stopped';
            }

            const rawTagId = item.drivers?.[0]?.tag_id ||
                item.drivers?.[0]?.identification_tag_id ||
                item.drivers?.[0]?.driver_tag ||
                item.tag_id ||
                item.current_tag_id ||
                item.identification_tag_id ||
                item.last_identification_tag_id ||
                item.driver_tag ||
                item.tag ||
                item.driver_identification ||
                item.identification ||
                item.fob ||
                item.key_id ||
                item.current_driver?.tag_id ||
                item.current_driver?.identification_tag_id ||
                item.driver_key ||
                item.key ||
                item.rfid ||
                item.tag_number;

            const tagId = cleanTagId(rawTagId);

            const driverId = item.drivers?.[0]?.driver_id ||
                item.drivers?.[0]?.id ||
                item.driver_id ||
                item.driver?.id ||
                item.driver?.driver_id ||
                item.current_driver_id ||
                item.current_driver?.id ||
                item.current_driver?.driver_id;

            if (item.registration === '16-UO-20' || item.registration?.includes('16-UO')) {
                console.log('DEBUG 16-UO-20 RAW:', {
                    registration: item.registration,
                    drivers: item.drivers,
                    current_driver: item.current_driver,
                    driver_id: item.driver_id,
                    tag_id: item.tag_id,
                    identification: item.identification,
                    raw: item
                });
            }

            return {
                id: String(item.id || item.vehicle_id || item.vehicleId || index),
                registration: item.registration || item.plate || item.label || 'N/A',
                name: item.name || item.registration || item.label || 'Viatura',
                latitude: parseFloat(latValue),
                longitude: parseFloat(lngValue),
                speed: speed,
                heading: parseFloat(item.bearing || item.heading || item.direction || 0),
                updatedAt: item.updated_at || item.last_update || item.timestamp || item.location?.ts || new Date().toISOString(),
                status: finalStatus,
                ignition: isIgnition,
                driverName: item.drivers?.[0]?.first_name ? `${item.drivers[0].first_name} ${item.drivers[0].last_name || ''}`.trim() :
                    (item.driver?.first_name ? `${item.driver.first_name} ${item.driver.last_name || ''}`.trim() :
                        (item.driver_name || item.driver?.name || item.current_driver?.name || item.current_driver?.first_name)),
                driverId,
                tagId: tagId || undefined
            };
        })
        .filter(v => v.latitude !== 0 && v.longitude !== 0);
};

const mapCartrackDataToGeofences = (data: any, defaultType: 'POLYGON' | 'CIRCLE'): CartrackGeofence[] => {
    const items = Array.isArray(data) ? data : (data?.data || data?.rows || data?.items || []);
    if (!Array.isArray(items)) return [];

    return items.map((item: any, index: number) => {
        let coords: { lat: number, lng: number }[] = [];
        let type: 'POLYGON' | 'CIRCLE' = defaultType;
        let radius = item.radius || item.geo_radius;

        // Handle WKT Polygon
        if (item.polygon) {
            coords = parseWKT(item.polygon);
            type = 'POLYGON';
        }
        // Handle POI Point
        else if (item.latitude && item.longitude) {
            coords = [{ lat: parseFloat(item.latitude), lng: parseFloat(item.longitude) }];
            type = 'CIRCLE';
        }
        // Handle fallback points array
        else if (Array.isArray(item.points)) {
            coords = item.points.map((p: any) => {
                if (Array.isArray(p)) return { lat: parseFloat(p[0]), lng: parseFloat(p[1]) };
                return { lat: parseFloat(p.lat || p.latitude), lng: parseFloat(p.lng || p.longitude) };
            });
            type = 'POLYGON';
        }

        return {
            id: String(item.geofence_id || item.poi_id || item.id || index),
            name: item.name || item.description || item.label || 'Sem nome',
            type: type,
            coordinates: coords,
            radius: radius ? parseFloat(radius) : (type === 'CIRCLE' ? 100 : undefined),
            color: item.colour || item.color || (index % 2 === 0 ? '#3b82f6' : '#8b5cf6')
        };
    }).filter(g => g.coordinates.length > 0);
};
