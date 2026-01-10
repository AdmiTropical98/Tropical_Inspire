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

// Mock Data for "My Office" and "Drop-off Zone"
// const MOCK_GEOFENCES: CartrackGeofence[] = [];

export const CartrackService = {
    /**
     * Fetch all geofences from Cartrack
     */
    getGeofences: async (): Promise<CartrackGeofence[]> => {
        try {
            // Encode credentials for Basic Auth
            const auth = btoa(`${CARTRACK_USER}:${CARTRACK_PASS}`);

            // Try '/geofences' which is common standard, if fails we might need to look up documentation for specific endpoint like '/pois'
            const response = await fetch(`${BASE_URL}/geofences`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Basic ${auth}`
                },
            });

            if (!response.ok) {
                console.warn('Cartrack API Error:', response.status, response.statusText);
                throw new Error(`Cartrack API Error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            return mapCartrackDataToGeofences(data);

        } catch (error) {
            console.error('Failed to fetch from Cartrack:', error);
            throw error; // Propagate error to UI
        }
    },

    /**
     * Fetch real-time vehicle positions
     */
    getVehicles: async (): Promise<CartrackVehicle[]> => {
        try {
            const auth = btoa(`${CARTRACK_USER}:${CARTRACK_PASS}`);
            // Endpoint might be /vehicles or /positions. Trying /vehicles based on standard patterns.
            const response = await fetch(`${BASE_URL}/vehicles`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Basic ${auth}`
                },
            });

            if (!response.ok) {
                throw new Error(`Cartrack Vehicles API Error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            return mapCartrackDataToVehicles(data);
        } catch (error) {
            console.error('Failed to fetch vehicles:', error);
            throw error;
        }
    }
};

// ... existing code ...

// Helper: Map raw API data to Vehicle interface
const mapCartrackDataToVehicles = (data: any): CartrackVehicle[] => {
    const items = Array.isArray(data) ? data : (data?.data || data?.rows || data?.items || []);
    if (!Array.isArray(items)) return [];

    return items.map((item: any) => ({
        id: String(item.id || item.vehicle_id),
        registration: item.registration || item.plate || 'N/A',
        name: item.name || item.registration || 'Viatura',
        latitude: parseFloat(item.latitude || item.lat || 0),
        longitude: parseFloat(item.longitude || item.lng || item.lon || 0),
        speed: parseFloat(item.speed || 0),
        heading: parseFloat(item.heading || item.direction || 0),
        updatedAt: item.updated_at || item.last_update || new Date().toISOString(),
        status: (parseFloat(item.speed || 0) > 0) ? 'moving' : (item.ignition ? 'idle' : 'stopped'),
        ignition: !!item.ignition
    }));
};

// Helper: Map raw API data to our interface
const mapCartrackDataToGeofences = (data: any): CartrackGeofence[] => {
    // Handle { data: [...] } or { rows: [...] } wrappers
    const items = Array.isArray(data) ? data : (data?.data || data?.rows || data?.items || []);

    if (!Array.isArray(items)) return [];

    return items.map((item: any, index: number) => ({
        id: item.id ? String(item.id) : `geo-${index}`,
        name: item.name || item.description || 'Sem nome',
        type: (item.shape && item.shape.toLowerCase().includes('poly')) ? 'POLYGON' : 'CIRCLE',
        coordinates: item.points || (item.latitude && item.longitude ? [{ lat: parseFloat(item.latitude), lng: parseFloat(item.longitude) }] : []),
        radius: item.radius ? parseFloat(item.radius) : 100,
        color: item.color || '#3b82f6' // Default blue
    }));
};
