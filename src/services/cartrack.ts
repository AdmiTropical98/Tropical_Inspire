export const CARTRACK_USER = 'ALGA00012';
export const CARTRACK_PASS = 'Tropical_Inspire98';
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

            // Fetch Geofences and POIs in parallel
            const [geoRes, poiRes] = await Promise.all([
                fetch(`${BASE_URL}/geofences`, { headers: { 'Authorization': `Basic ${auth}` } }),
                fetch(`${BASE_URL}/pois`, { headers: { 'Authorization': `Basic ${auth}` } })
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

            // Primary endpoint for real-time data
            let response = await fetch(`${BASE_URL}/vehicles/status`, {
                method: 'GET',
                headers: { 'Authorization': `Basic ${auth}` },
            });

            if (!response.ok) throw new Error(`Cartrack Vehicles Error: ${response.status}`);

            const data = await response.json();
            return mapCartrackDataToVehicles(data);
        } catch (error) {
            console.error('Failed to fetch vehicles:', error);
            throw error;
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
                ignition: !!(item.ignition || item.ign)
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
