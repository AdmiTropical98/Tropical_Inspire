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
            const response = await fetch(`${BASE_URL}/drivers?per_page=100`, {
                method: 'GET',
                headers: { 'Authorization': `Basic ${auth}` },
            });

            if (!response.ok) return [];

            const result = await response.json();
            const items = result.data || result.rows || result || [];

            return items.map((item: any) => ({
                id: String(item.id),
                firstName: item.first_name,
                lastName: item.last_name,
                fullName: `${item.first_name} ${item.last_name}`.trim(),
                tagId: item.tag_id || item.identification_tag_id,
                customFields: item.custom_fields
            }));
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

            return {
                id: String(item.id || item.vehicle_id || item.vehicleId || index),
                registration: item.registration || item.plate || item.label || 'N/A',
                name: item.name || item.registration || item.label || 'Viatura',
                latitude: parseFloat(latValue),
                longitude: parseFloat(lngValue),
                speed: speed,
                heading: parseFloat(item.bearing || item.heading || item.direction || 0),
                updatedAt: item.updated_at || item.last_update || item.timestamp || item.location?.ts || new Date().toISOString(),
                status: (speed > 0 ? 'moving' : (item.ignition ? 'idle' : 'stopped')) as 'moving' | 'stopped' | 'idle',
                ignition: !!(item.ignition || item.ign),
                driverName: item.drivers?.[0]?.first_name ? `${item.drivers[0].first_name} ${item.drivers[0].last_name}`.trim() : (item.driver_name || item.driver?.name || item.current_driver?.name),
                driverId: item.drivers?.[0]?.driver_id || item.drivers?.[0]?.id || item.driver_id || item.driver?.id || item.current_driver_id || item.current_driver?.id,
                tagId: item.drivers?.[0]?.tag_id || item.drivers?.[0]?.identification_tag_id || item.tag_id || item.current_tag_id || item.identification_tag_id
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
