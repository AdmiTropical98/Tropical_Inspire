export const CARTRACK_API_KEY = 'd395112ab45cf4a2cfa734a478e699b6964b4281fa47aebc069ce0793cfd1b45';
export const BASE_URL = 'https://api.cartrack.com'; // Potentially https://api-pt.cartrack.com

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
const MOCK_GEOFENCES: CartrackGeofence[] = [
    {
        id: '1',
        name: 'Oficina Central (Mock)',
        type: 'CIRCLE',
        coordinates: [{ lat: 38.7223, lng: -9.1393 }],
        radius: 500,
        color: 'red'
    },
    {
        id: '2',
        name: 'Zona Industrial (Mock)',
        type: 'POLYGON',
        coordinates: [
            { lat: 38.7436, lng: -9.1601 },
            { lat: 38.7450, lng: -9.1550 },
            { lat: 38.7410, lng: -9.1550 },
            { lat: 38.7400, lng: -9.1600 }
        ],
        color: 'green'
    }
];

export const CartrackService = {
    /**
     * Fetch all geofences from Cartrack
     */
    getGeofences: async (): Promise<CartrackGeofence[]> => {
        try {
            // Note: This is a best-guess implementation based on standard REST patterns vs Cartrack docs.
            // We might need to adjust the endpoint '/geofences' or '/pois' based on specific regional API.
            const response = await fetch(`${BASE_URL}/geofences`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Api-Key': CARTRACK_API_KEY,
                },
            });

            if (!response.ok) {
                console.warn('Cartrack API Error:', response.status, response.statusText);
                // For demonstration/fallback if API fails (likely due to CORS or wrong endpoint)
                console.info('Falling back to mock data due to API error.');
                return MOCK_GEOFENCES;
            }

            const data = await response.json();
            return mapCartrackDataToGeofences(data);

        } catch (error) {
            console.error('Failed to fetch from Cartrack:', error);
            return MOCK_GEOFENCES; // Fallback to mock for now
        }
    }
};

// Helper: Map raw API data to our interface
// (This needs to be adjusted once we see the real JSON response)
const mapCartrackDataToGeofences = (data: any[]): CartrackGeofence[] => {
    if (!Array.isArray(data)) return [];

    return data.map((item: any, index: number) => ({
        id: item.id || `geo-${index}`,
        name: item.name || 'Sem nome',
        type: item.shape === 'polygon' ? 'POLYGON' : 'CIRCLE',
        coordinates: item.points || [],
        radius: item.radius || 0,
        color: 'blue'
    }));
};
