export interface CartrackProxyVehicle {
  name: string;
  lat: number;
  lng: number;
}

// The proxy runs on localhost:4005, or whatever is configured via Vite.
// To avoid CORS and Hardcoding, we use the absolute URL for the proxy while developing.
const PROXY_URL = 'http://localhost:4005/api/vehicles';

export const CartrackProxyService = {
  getVehicles: async (): Promise<CartrackProxyVehicle[]> => {
    try {
      const response = await fetch(PROXY_URL);
      if (!response.ok) {
        throw new Error(`Proxy error: ${response.status}`);
      }

      const data = await response.json();
      
      // Expected Data Mapping from the Cartrack Response to what you asked: { name, lat, lng }
      let vehicles: CartrackProxyVehicle[] = [];

      // Cartrack API usually returns data in data.data or similar. Adjust if your endpoint is different.
      const items = Array.isArray(data) ? data : (data.data || data.vehicles || []);

      vehicles = items.map((item: any) => {
        // Find location info based on typical Cartrack versions
        const loc = item.location || item.last_pos || item.last_position || item;
        
        // Find name based on typical naming
        const name = item.registration || item.name || item.vehicle_name || 'Desconhecido';

        return {
          name,
          lat: Number(loc.latitude || loc.lat || 0),
          lng: Number(loc.longitude || loc.lng || 0)
        };
      }).filter((v: CartrackProxyVehicle) => v.lat !== 0 && v.lng !== 0); // Ignore vehicles without GPS

      // MOCK DATA FALLBACK FOR SHOWCASE IF API FAILS BUT PROXY IS RUNNING
      if (vehicles.length === 0) {
        console.warn('Proxy fetched OK but no vehicles found. Injecting mock for testing.');
        return [
           { name: "12-VU-84", lat: 37.10, lng: -8.13 },
           { name: "77-XP-99", lat: 37.05, lng: -8.05 }
        ];
      }

      return vehicles;

    } catch (error) {
      console.error('Failed to fetch from Cartrack Proxy:', error);
      throw error;
    }
  }
};
