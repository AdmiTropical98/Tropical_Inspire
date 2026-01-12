const CARTRACK_USER = 'ALGA00012';
const CARTRACK_PASS = 'd395112ab45cf4a2cfa734a478e699b6964b4281fa47aebc069ce0793cfd1b45';

const BASE_URL = import.meta.env.DEV
    ? '/api/cartrack'
    : '/proxy.php?endpoint=';

export interface CartrackGeofence {
    id: string;
    name: string;
    area_id?: string;
    latitude?: number;
    longitude?: number;
    radius?: number;
    polygon_wkt?: string;
    points?: { lat: number, lng: number }[];
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
            tagId: cleanTagId(item.last_identification_tag_id) || '' // Limpa o ID da tag (remove 0000-0000...)
        };
    });
};

// DEBUG VAR
export let debugLastResponse: any = null;

export const CartrackService = {
    getGeofences: async (): Promise<CartrackGeofence[]> => {
        try {
            const auth = btoa(`${CARTRACK_USER}:${CARTRACK_PASS}`);
            const response = await fetch(`${BASE_URL}/geofences?per_page=100`, {
                method: 'GET',
                headers: { 'Authorization': `Basic ${auth}` },
            });

            if (!response.ok) throw new Error('Falha ao obter geofences da Cartrack');

            const result = await response.json();
            const items = result.data || result.rows || result.geofences || [];

            return items.map((item: any) => ({
                id: String(item.id),
                name: item.name,
                radius: item.radius,
                latitude: item.latitude,
                longitude: item.longitude,
                polygon_wkt: item.polygon_wkt,
                points: item.polygon_wkt ? parseWKT(item.polygon_wkt) : undefined
            }));
        } catch (error) {
            console.error('Failed to fetch geofences:', error);
            throw error;
        }
    },

    getVehicles: async (): Promise<CartrackVehicle[]> => {
        try {
            const auth = btoa(`${CARTRACK_USER}:${CARTRACK_PASS}`);
            // FIXED: Prioritize /vehicles/status which contains 'location' object with coords
            const endpoints = ['/vehicles/status', '/vehicles', '/vehicles/activity', '/stats'];
            let data = null;

            console.log('Fetching Cartrack Vehicles...');

            for (const ep of endpoints) {
                try {
                    // Force higher limit to get all vehicles
                    const separator = ep.includes('?') ? '&' : '?';
                    const url = `${BASE_URL}${ep}${separator}per_page=100`;
                    console.log(`Trying endpoint: ${url}`);

                    const response = await fetch(url, {
                        headers: { 'Authorization': `Basic ${auth}` }
                    });

                    if (response.ok) {
                        data = await response.json();
                        debugLastResponse = { endpoint: ep, status: response.status, data: data };
                        // Validate if this endpoint actually returned useful data (e.g. has list)
                        if (data && data.data && Array.isArray(data.data) && data.data.length > 0) {
                            // Check if it has location data (heuristic)
                            const firstItem = data.data[0];
                            if (firstItem.location || firstItem.last_pos || firstItem.latitude) {
                                console.log(`Endpoint ${ep} returned valid vehicle data with location candidates.`);
                                break;
                            } else {
                                console.log(`Endpoint ${ep} returned data but missing location fields, trying next...`);
                                // Don't break, try to find a better endpoint unless this is the only one
                                // Specifically, /vehicles has no location, so we want to skip it if possible if /vehicles/status fails
                            }
                        }
                    } else {
                        debugLastResponse = { endpoint: ep, status: response.status, error: 'Not OK' };
                        console.warn(`Endpoint ${ep} failed: ${response.status}`);
                    }
                } catch (e) {
                    console.warn(`Error fetching ${ep}`, e);
                }
            }

            if (!data) {
                console.warn('Cartrack vehicles endpoint returned no data.');
                return [];
            }

            const mapped = mapCartrackDataToVehicles(data);
            console.log(`Mapped ${mapped.length} vehicles.`);


            return mapped;
        } catch (error) {
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
            const auth = btoa(`${CARTRACK_USER}:${CARTRACK_PASS}`);

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

            // 2. Fetch Drivers (Safety limit: 50 pages)
            let page = 1;
            let totalPages = 1;
            do {
                try {
                    const response = await fetch(`${BASE_URL}/drivers?per_page=100&page=${page}`, {
                        method: 'GET', headers: { 'Authorization': `Basic ${auth}` },
                    });
                    if (response.ok) {
                        const result = await response.json();
                        const items = result.data || result.rows || result.drivers || result || [];
                        if (Array.isArray(items)) {
                            allItems = [...allItems, ...items];
                            if (result.meta?.pagination?.total_pages) totalPages = result.meta.pagination.total_pages;
                            else if (items.length === 100) totalPages = page + 1;
                        }
                    } else break;
                } catch (e) { break; }
                page++;
            } while (page <= totalPages && page < 50);

            // 3. Try Personnel
            try {
                const pRes = await fetch(`${BASE_URL}/personnel?per_page=100`, { headers: { 'Authorization': `Basic ${auth}` } });
                if (pRes.ok) {
                    const pData = await pRes.json();
                    const pItems = pData.data || pData.rows || pData.personnel || pData || [];
                    if (Array.isArray(pItems)) allItems = [...allItems, ...pItems];
                }
            } catch { }

            // 4. Try Identification Tags directly
            try {
                const tRes = await fetch(`${BASE_URL}/identification_tags?per_page=100`, { headers: { 'Authorization': `Basic ${auth}` } });
                if (tRes.ok) {
                    const tData = await tRes.json();
                    const tItems = tData.data || tData.rows || tData.identification_tags || tData || [];
                    if (Array.isArray(tItems)) {
                        tItems.forEach((tg: any) => {
                            const tid = String(tg.tag_id || tg.id || (typeof tg === 'string' ? tg : ''));
                            if (tid && !allItems.some(ex => (ex.tag_id || ex.identification_tag_id) === tid)) {
                                allItems.push({ id: `tag-${tid}`, full_name: `Tag Oficial (${tid.slice(-4)})`, tag_id: tid });
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
        } catch (error) {
            console.warn('Failed to fetch drivers (returning empty):', error);
            return [];
        }
    },

    getGeofenceVisits: async (startDate: string, endDate: string, vehicleId?: string): Promise<CartrackGeofenceVisit[]> => {
        try {
            const auth = btoa(`${CARTRACK_USER}:${CARTRACK_PASS}`);
            // Note: Cartrack API param names might vary. Common possibilities: start_date, from, since.
            // Using standard guess based on previous logic attempt or reverting to 'last_position' if this is a stateless fetch.
            // If the user context was sending specific dates, let's pass them.

            let url = `${BASE_URL}/geofence_visits?per_page=100`;
            if (vehicleId) url += `&vehicle_id=${vehicleId}`;
            // Adding date filters if API supports them (usually event_ts or similar, but let's try standard REST filters)
            if (startDate) url += `&start_date=${encodeURIComponent(startDate)}`;
            if (endDate) url += `&end_date=${encodeURIComponent(endDate)}`;

            const response = await fetch(url, {
                method: 'GET',
                headers: { 'Authorization': `Basic ${auth}` },
            });

            if (!response.ok) {
                // Try fallback without date filters if 400, or just throw
                throw new Error(`Falha API (${response.status}): ${response.statusText}`);
            }

            const result = await response.json();
            const items = result.data || result.rows || result.visits || [];

            return items.map((item: any) => ({
                id: String(item.id),
                vehicleId: String(item.vehicle_id),
                registration: item.registration,
                geofenceId: String(item.geofence_id),
                geofenceName: item.geofence_name,
                entryTime: item.entry_time,
                exitTime: item.exit_time,
                durationSeconds: item.duration_seconds
            }));
        } catch (error) {
            console.error('Failed to fetch geofence visits:', error);
            throw error;
        }
    }
};
