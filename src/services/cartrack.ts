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
}

export const CartrackService = {
    /**
     * Fetch all geofences/POIs from Cartrack
     */
    getGeofences: async (): Promise<CartrackGeofence[]> => {
        try {
            const auth = btoa(`${CARTRACK_USER}:${CARTRACK_PASS}`);

            // Try different endpoints for Geofences/POIs
            const endpoints = ['/geofences', '/pois', '/circles', '/polygons'];
            let data = null;
            let lastError = null;

            for (const ep of endpoints) {
                try {
                    const response = await fetch(`${BASE_URL}${ep}`, {
                        method: 'GET',
                        headers: { 'Authorization': `Basic ${auth}` },
                    });
                    if (response.ok) {
                        data = await response.json();
                        const items = Array.isArray(data) ? data : (data?.data || data?.rows || data?.items || []);
                        if (items.length > 0) break;
                    }
                } catch (e) {
                    lastError = e;
                }
            }

            if (!data) throw new Error(lastError || 'Falha ao buscar geofences');
            return mapCartrackDataToGeofences(data);
        } catch (error) {
            console.error('Failed to fetch geofences:', error);
            throw error;
        }
    },

    /**
     * Fetch real-time vehicle positions
     */
    getVehicles: async (): Promise<CartrackVehicle[]> => {
        try {
            const auth = btoa(`${CARTRACK_USER}:${CARTRACK_PASS}`);

            // Try stats first (often contains bulk latest positions)
            const endpoints = ['/stats', '/vehicles', '/positions', '/last_positions'];
            let data = null;
            let lastError = null;

            for (const ep of endpoints) {
                try {
                    const response = await fetch(`${BASE_URL}${ep}`, {
                        method: 'GET',
                        headers: { 'Authorization': `Basic ${auth}` },
                    });
                    if (response.ok) {
                        data = await response.json();
                        const items = Array.isArray(data) ? data : (data?.data || data?.rows || data?.items || []);
                        if (items.length > 0) break;
                    }
                } catch (e) {
                    lastError = e;
                }
            }

            if (!data) throw new Error(lastError || 'Falha ao buscar veículos');
            return mapCartrackDataToVehicles(data);
        } catch (error) {
            console.error('Failed to fetch vehicles:', error);
            throw error;
        }
    }
};

const mapCartrackDataToVehicles = (data: any): CartrackVehicle[] => {
    // Logging for debug in browser console
    console.log('CARTRACK_RAW_VEHICLES:', data);

    const items = Array.isArray(data) ? data : (data?.data || data?.rows || data?.items || []);
    if (!Array.isArray(items)) return [];

    return items
        .map((item: any, index: number) => {
            // Check main object and nested position objects
            const pos = item.last_position || item.position || item.gps || item;

            const latValue = pos.latitude || pos.lat || pos.loc_lat || pos.loc_y || pos.y || item.latitude || item.lat;
            const lngValue = pos.longitude || pos.lng || pos.lon || pos.loc_lng || pos.loc_x || pos.x || item.longitude || item.lng || item.lon;

            const lat = parseFloat(latValue || 0);
            const lng = parseFloat(lngValue || 0);
            const speed = parseFloat(item.speed || item.vel || pos.speed || 0);

            return {
                id: String(item.id || item.vehicle_id || item.vehicleId || item.imei || index),
                registration: item.registration || item.plate || item.label || 'N/A',
                name: item.name || item.registration || item.label || 'Viatura',
                latitude: lat,
                longitude: lng,
                speed: speed,
                heading: parseFloat(item.heading || item.direction || item.bearing || 0),
                updatedAt: item.updated_at || item.last_update || item.timestamp || item.ts || new Date().toISOString(),
                status: (speed > 0 ? 'moving' : (item.ignition ? 'idle' : 'stopped')) as 'moving' | 'stopped' | 'idle',
                ignition: !!(item.ignition || item.ign)
            };
        })
        .filter(v => v.latitude !== 0 && v.longitude !== 0);
};

const mapCartrackDataToGeofences = (data: any): CartrackGeofence[] => {
    console.log('CARTRACK_RAW_GEOFENCES:', data);

    const items = Array.isArray(data) ? data : (data?.data || data?.rows || data?.items || []);
    if (!Array.isArray(items)) return [];

    return items.map((item: any, index: number) => {
        let coords: { lat: number, lng: number }[] = [];

        // Handle variations of points array
        const rawPoints = item.points || item.coordinates || item.shape_points || item.geometry?.coordinates;

        if (Array.isArray(rawPoints)) {
            coords = rawPoints.map((p: any) => {
                if (Array.isArray(p)) return { lat: parseFloat(p[0]), lng: parseFloat(p[1]) };
                return {
                    lat: parseFloat(p.lat || p.latitude || p.y || 0),
                    lng: parseFloat(p.lng || p.lon || p.longitude || p.x || 0)
                };
            }).filter(p => p.lat !== 0 && p.lng !== 0);
        } else {
            // Check for single point
            const lat = item.latitude || item.lat || item.loc_lat || item.y;
            const lng = item.longitude || item.lng || item.lon || item.loc_lng || item.x;
            if (lat && lng) {
                coords = [{ lat: parseFloat(lat), lng: parseFloat(lng) }];
            }
        }

        return {
            id: String(item.id || index),
            name: item.name || item.description || item.label || 'Sem nome',
            type: (item.shape && item.shape.toLowerCase().includes('poly')) ? 'POLYGON' : 'CIRCLE',
            coordinates: coords,
            radius: item.radius ? parseFloat(item.radius) : (item.type === 'POI' ? 100 : 0),
            color: item.color || (index % 2 === 0 ? '#3b82f6' : '#8b5cf6')
        };
    });
};
