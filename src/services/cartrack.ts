export const CARTRACK_USER = 'ALGA00012';
export const CARTRACK_PASS = 'd395112ab45cf4a2cfa734a478e699b6964b4281fa47aebc069ce0793cfd1b45';
export const BASE_URL = 'https://fleetapi-pt.cartrack.com/rest'; // REST API base

// Types for Geofence Data
export interface CartrackGeofence {
    id: string;
    name: string;
    type: 'CIRCLE' | 'POLYGON';
    coordinates: { lat: number; lng: number }[];
    radius?: number; // Only for CIRCLE
    color?: string; // Optional color
}

// Types for Vehicle Data
export interface CartrackVehicle {
    id: string;
    registration: string; // License Plate
    name: string;
    latitude: number;
    longitude: number;
    speed: number;
    heading: number; // Direction (0-360)
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

            // Try /pois first
            let response = await fetch(`${BASE_URL}/pois`, {
                method: 'GET',
                headers: { 'Authorization': `Basic ${auth}` },
            });

            if (!response.ok) {
                // Fallback
                response = await fetch(`${BASE_URL}/geofences`, {
                    method: 'GET',
                    headers: { 'Authorization': `Basic ${auth}` },
                });
            }

            if (!response.ok) throw new Error(`Cartrack Geofences Error: ${response.status}`);

            const data = await response.json();
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

            // Try /stats for real-time info
            let response = await fetch(`${BASE_URL}/stats`, {
                method: 'GET',
                headers: { 'Authorization': `Basic ${auth}` },
            });

            if (!response.ok) {
                response = await fetch(`${BASE_URL}/vehicles`, {
                    method: 'GET',
                    headers: { 'Authorization': `Basic ${auth}` },
                });
            }

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
            const lat = parseFloat(item.latitude || item.lat || item.loc_lat || item.loc_y || item.y || 0);
            const lng = parseFloat(item.longitude || item.lng || item.lon || item.loc_lng || item.loc_x || item.x || 0);
            const speed = parseFloat(item.speed || item.vel || 0);

            return {
                id: String(item.id || item.vehicle_id || item.vehicleId || index),
                registration: item.registration || item.plate || item.label || 'N/A',
                name: item.name || item.registration || 'Viatura',
                latitude: lat,
                longitude: lng,
                speed: speed,
                heading: parseFloat(item.heading || item.direction || item.bearing || 0),
                updatedAt: item.updated_at || item.last_update || item.timestamp || new Date().toISOString(),
                status: (speed > 0 ? 'moving' : (item.ignition ? 'idle' : 'stopped')) as 'moving' | 'stopped' | 'idle',
                ignition: !!(item.ignition || item.ign)
            };
        })
        .filter(v => v.latitude !== 0 && v.longitude !== 0);
};

const mapCartrackDataToGeofences = (data: any): CartrackGeofence[] => {
    const items = Array.isArray(data) ? data : (data?.data || data?.rows || data?.items || []);
    if (!Array.isArray(items)) return [];

    return items.map((item: any, index: number) => {
        let points: { lat: number, lng: number }[] = [];

        if (Array.isArray(item.points)) {
            points = item.points.map((p: any) => {
                if (Array.isArray(p)) return { lat: parseFloat(p[0]), lng: parseFloat(p[1]) };
                return {
                    lat: parseFloat(p.lat || p.latitude || p.y || 0),
                    lng: parseFloat(p.lng || p.lon || p.longitude || p.x || 0)
                };
            });
        } else if (item.latitude && (item.longitude || item.lon)) {
            points = [{ lat: parseFloat(item.latitude), lng: parseFloat(item.longitude || item.lon) }];
        }

        return {
            id: String(item.id || index),
            name: item.name || item.description || 'Sem nome',
            type: (item.shape && item.shape.toLowerCase().includes('poly')) ? 'POLYGON' : 'CIRCLE',
            coordinates: points,
            radius: item.radius ? parseFloat(item.radius) : 100,
            color: item.color || (index % 2 === 0 ? '#3b82f6' : '#8b5cf6')
        };
    });
};
