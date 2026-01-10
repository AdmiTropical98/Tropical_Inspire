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

// Mock Data for "My Office" and "Drop-off Zone"
const MOCK_GEOFENCES: CartrackGeofence[] = [];

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
    }
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
