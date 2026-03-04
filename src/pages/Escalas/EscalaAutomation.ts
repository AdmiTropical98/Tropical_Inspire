import type { Servico, Motorista, Viatura } from '../../types';
import type { CartrackVehicle } from '../../services/cartrack';
import * as XLSX from 'xlsx';

export interface GroupedTrip {
    id: string;
    hora: string;
    origem: string;
    destino: string;
    areaOrigem?: string;
    areaDestino?: string;
    servicos: Servico[];
    motoristaId?: string;
    vehicleId?: string;
    vehicleCapacity?: number;
    passengerCount?: number;
    occupancyRate?: number;
    conflict?: string;
}

const toMinutes = (value: string) => {
    const [h, m] = String(value || '00:00').split(':').map(Number);
    return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
};

const fromMinutes = (totalMinutes: number) => {
    const normalized = ((totalMinutes % (24 * 60)) + (24 * 60)) % (24 * 60);
    const hours = Math.floor(normalized / 60);
    const minutes = normalized % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const addMinutesToTime = (value: string, delta: number) => fromMinutes(toMinutes(value) + delta);

const normalizeText = (value?: string | null) => String(value || '').trim().toLowerCase();

const normalizePlate = (value?: string | null) => String(value || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

const haversineMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

export const AUTO_CONFIG = {
    ALBUFEIRA_SHEET_URL: localStorage.getItem('auto_sheet_albufeira') || '',
    QUARTEIRA_SHEET_URL: localStorage.getItem('auto_sheet_quarteira') || '',
};

export async function fetchSheetCSV(url: string, targetDate?: string): Promise<any[]> {
    try {
        let fetchUrl = url;
        const ssIdMatch = url.match(/\/d\/(.+?)\//) || url.match(/\/d\/(.+)/);

        if (ssIdMatch) {
            const ssId = ssIdMatch[1];
            // Fetch as XLSX to get all sheets
            fetchUrl = `https://docs.google.com/spreadsheets/d/${ssId}/export?format=xlsx`;
        }

        const response = await fetch(fetchUrl);
        if (!response.ok) {
            throw new Error('Falha ao aceder à Google Sheet. Verifique se está PUBLICADA NA WEB.');
        }

        const data = await response.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array' });

        let targetSheetName = workbook.SheetNames[0];

        // If a date is provided, try to find a matching sheet (e.g., "22/02" or "22")
        if (targetDate) {
            const dateObj = new Date(targetDate);
            const day = String(dateObj.getDate()).padStart(2, '0');
            const month = String(dateObj.getMonth() + 1).padStart(2, '0');
            const possibleNames = [
                `${day}/${month}`,
                `${day}-${month}`,
                day,
                `${day} / ${month}`,
                `${dateObj.getDate()}/${dateObj.getMonth() + 1}`
            ];

            const found = workbook.SheetNames.find(name =>
                possibleNames.some(p => name.toLowerCase().includes(p.toLowerCase()))
            );
            if (found) targetSheetName = found;
        } else {
            // Fallback to GID if provided in URL and no date match
            const gidMatch = url.match(/gid=(\d+)/);
            if (gidMatch) {
                // Note: gid mapping is complex in XLSX, but often the order matches
                // For now, if we can't match by date, we'll try the URL logic or first sheet
            }
        }

        const workbookSheet = workbook.Sheets[targetSheetName];
        const rows = XLSX.utils.sheet_to_json(workbookSheet);
        console.log(`Loaded ${rows.length} rows from sheet: ${targetSheetName}`);
        return rows;
    } catch (error) {
        console.error('Error fetching sheet:', error);
        if (error instanceof TypeError && error.message === 'Failed to fetch') {
            throw new Error('Erro de Conexão. Verifique se a folha está PUBLICADA NA WEB (Ficheiro > Partilhar > Publicar na Web).');
        }
        throw error;
    }
}

export function parseSheetToServices(rows: any[], selectedDate: string, centroCustoId: string): Servico[] {
    const services: Servico[] = [];

    // Helper to find a value in a row regardless of exact key match
    const getVal = (row: any, keywords: string[]) => {
        const keys = Object.keys(row);
        const normalizedKeywords = keywords.map(kw => kw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));

        for (const key of keys) {
            const normalizedKey = key.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            if (normalizedKeywords.some(kw => normalizedKey.includes(kw))) {
                return row[key];
            }
        }
        return null;
    };

    const parseTime = (val: any) => {
        if (!val) return null;
        if (typeof val === 'number') {
            // Handle Excel time format
            const totalSeconds = Math.round(val * 86400);
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
        }
        const str = String(val).trim();
        const match = str.match(/(\d{1,2})[h:](\d{2})/i) || str.match(/(\d{1,2})/);
        if (match) {
            const h = match[1].padStart(2, '0');
            const m = match[2] ? match[2].padStart(2, '0') : '00';
            return `${h}:${m}`;
        }
        return null;
    };

    rows.forEach((row: any) => {
        const nome = getVal(row, ['funcionario', 'nome', 'passageiro']) || '';
        if (!nome || String(nome).length < 2) return;

        const origem = getVal(row, ['origem']) || '';
        const destino = getVal(row, ['destino']) || '';

        const horaEntrada = parseTime(getVal(row, ['apanhar', 'entrada', 'chegada']));
        const horaSaida = parseTime(getVal(row, ['saida', 'termino', 'partida']));

        if (horaEntrada) {
            services.push({
                id: crypto.randomUUID(),
                data: selectedDate,
                hora: horaEntrada,
                passageiro: String(nome).trim(),
                origem: String(origem || 'Origem não definida').trim(),
                destino: String(destino || 'Destino não definida').trim(),
                concluido: false,
                centroCustoId,
                tipo: 'entrada',
                obs: 'Importação Automática'
            });
        }

        if (horaSaida) {
            services.push({
                id: crypto.randomUUID(),
                data: selectedDate,
                hora: horaSaida,
                passageiro: String(nome).trim(),
                origem: String(destino || 'Destino não definida').trim(), // Returning
                destino: String(origem || 'Origem não definida').trim(),
                concluido: false,
                centroCustoId,
                tipo: 'saida',
                obs: 'Importação Automática'
            });
        }
    });

    return services;
}

// Helper to map a location name to an operational area
function mapToArea(nome: string, zonas: any[]): string {
    const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const normalizedNome = normalize(nome);

    // Find a zone where the location name is contained within the zone's nome_local
    const match = zonas.find(z => {
        const zoneLoc = normalize(z.nome_local);
        return normalizedNome.includes(zoneLoc) || zoneLoc.includes(normalizedNome);
    });

    return match ? match.area_operacional : 'Geral';
}

export function groupServicesIntoTrips(services: Servico[], zonas: any[] = []): GroupedTrip[] {
    const trips: GroupedTrip[] = [];

    services.forEach(s => {
        const time = s.hora.trim();
        const from = s.origem.trim().toLowerCase();
        const to = s.destino.trim().toLowerCase();

        const areaO = mapToArea(s.origem, zonas);
        const areaD = mapToArea(s.destino, zonas);

        const existingTrip = trips.find(t =>
            t.hora.trim() === time &&
            t.origem.trim().toLowerCase() === from &&
            t.destino.trim().toLowerCase() === to
        );

        if (existingTrip) {
            existingTrip.servicos.push(s);
        } else {
            trips.push({
                id: crypto.randomUUID(),
                hora: time,
                origem: s.origem,
                destino: s.destino,
                areaOrigem: areaO,
                areaDestino: areaD,
                servicos: [s]
            });
        }
    });

    // Sort by time
    return trips.sort((a, b) => a.hora.localeCompare(b.hora));
}

// New function to group by Area instead of exact location
export function autoGroupTripsByZone(trips: GroupedTrip[]): GroupedTrip[] {
    const result: GroupedTrip[] = [];

    trips.forEach(trip => {
        // Try to find a trip at the same time and same areas (instead of exact same hotel)
        const canMerge = result.find(r =>
            r.hora === trip.hora &&
            r.areaOrigem === trip.areaOrigem &&
            r.areaDestino === trip.areaDestino
        );

        if (canMerge) {
            // Update labels to show both if different
            if (!canMerge.origem.includes(trip.origem)) canMerge.origem += ` / ${trip.origem}`;
            if (!canMerge.destino.includes(trip.destino)) canMerge.destino += ` / ${trip.destino}`;

            canMerge.servicos = [...canMerge.servicos, ...trip.servicos];
        } else {
            result.push({ ...trip });
        }
    });

    return result.sort((a, b) => a.hora.localeCompare(b.hora));
}

export function suggestDrivers(
    trips: GroupedTrip[],
    motoristas: Motorista[],
    existingServicos: Servico[],
    activeZone: string
): GroupedTrip[] {
    const mutableTrips = [...trips];

    // Track driver current "state" and workload for this session
    const driverSessionServices: Record<string, number> = {};
    const driverLastState: Record<string, { lastTime: string, lastDest: string }> = {};

    mutableTrips.forEach(trip => {
        const tripHour = trip.hora;
        const tripMinutes = timeToMinutes(tripHour);

        // Find best candidate
        const candidates = motoristas.filter(m => {
            // 1. Check Zone Permissions
            if (m.zones && m.zones.length > 0) {
                if (!m.zones.includes(activeZone.toLowerCase() as any)) return false;
            }

            // 2. Check Shifts (turnos múltiplos)
            let isInsideShift = false;
            if (m.shifts && m.shifts.length > 0) {
                isInsideShift = m.shifts.some(shift => {
                    const start = timeToMinutes(shift.inicio);
                    const end = timeToMinutes(shift.fim);
                    return tripMinutes >= start && tripMinutes <= end;
                });
            } else if (m.turnoInicio && m.turnoFim) {
                // Fallback to legacy single shift
                const start = timeToMinutes(m.turnoInicio);
                const end = timeToMinutes(m.turnoFim);
                isInsideShift = tripMinutes >= start && tripMinutes <= end;
            } else {
                // No shifts defined? We assume available 24h for now if not explicitly restricted
                isInsideShift = true;
            }
            if (!isInsideShift) return false;

            // 3. Check Blocked Periods
            if (m.blockedPeriods && m.blockedPeriods.length > 0) {
                const isBlocked = m.blockedPeriods.some(block => {
                    const start = timeToMinutes(block.inicio);
                    const end = timeToMinutes(block.fim);
                    return tripMinutes >= start && tripMinutes <= end;
                });
                if (isBlocked) return false;
            }

            // 4. Check Workload Limit
            const driverExistingCount = existingServicos.filter(s => s.motoristaId === m.id && s.data === trip.servicos[0].data).length;
            const currentSessionCount = driverSessionServices[m.id] || 0;
            const totalWorkload = driverExistingCount + currentSessionCount;

            if (m.maxDailyServices && totalWorkload >= m.maxDailyServices) return false;

            // 5. Check Overlap / Min Interval
            const minInterval = m.minIntervalMinutes || 30;
            const driverTrips = existingServicos.filter(s => s.motoristaId === m.id && s.data === trip.servicos[0].data);
            const sessionTrips = mutableTrips.filter(t => t.motoristaId === m.id);

            const allDriverTimes = [
                ...driverTrips.map(s => s.hora),
                ...sessionTrips.map(t => t.hora)
            ];

            const hasConflict = allDriverTimes.some(time => {
                const diff = Math.abs(timeToMinutes(time) - tripMinutes);
                return diff < minInterval;
            });

            if (hasConflict) return false;

            return true;
        });

        if (candidates.length === 0) return;

        // Selection Logic:
        // First priority: Driver with matching "Return Trip" (Opposite Destination)
        // Second priority: Driver with lowest workload (Balanced Load)

        candidates.sort((a, b) => {
            // Return Trip check
            const aState = driverLastState[a.id];
            const bState = driverLastState[b.id];
            const aIsReturn = aState?.lastDest.trim().toLowerCase() === trip.origem.trim().toLowerCase();
            const bIsReturn = bState?.lastDest.trim().toLowerCase() === trip.origem.trim().toLowerCase();

            if (aIsReturn && !bIsReturn) return -1;
            if (!aIsReturn && bIsReturn) return 1;

            // Load Balance check
            const aLoad = (driverSessionServices[a.id] || 0) + existingServicos.filter(s => s.motoristaId === a.id && s.data === trip.servicos[0].data).length;
            const bLoad = (driverSessionServices[b.id] || 0) + existingServicos.filter(s => s.motoristaId === b.id && s.data === trip.servicos[0].data).length;

            return aLoad - bLoad;
        });

        const bestCandidate = candidates[0];
        trip.motoristaId = bestCandidate.id;

        // Update driver state
        driverSessionServices[bestCandidate.id] = (driverSessionServices[bestCandidate.id] || 0) + 1;
        driverLastState[bestCandidate.id] = {
            lastTime: trip.hora,
            lastDest: trip.destino
        };
    });

    return mutableTrips;
}

function timeToMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
}

export function generateAutoDispatchTrips(params: {
    services: Servico[];
    motoristas: Motorista[];
    viaturas: Viatura[];
    existingServicos: Servico[];
    locais: { nome: string; latitude: number; longitude: number }[];
    cartrackVehicles: CartrackVehicle[];
    selectedDate: string;
    selectedCentroCusto: string;
}): GroupedTrip[] {
    const {
        services,
        motoristas,
        viaturas,
        existingServicos,
        locais,
        cartrackVehicles,
        selectedDate,
        selectedCentroCusto
    } = params;

    const rawGroups = new Map<string, Servico[]>();

    services
        .filter(s => !s.motoristaId)
        .forEach(service => {
            const originKey = service.originLocationId || `origin:${normalizeText(service.origem)}`;
            const destinationKey = service.destinationLocationId || `destination:${normalizeText(service.destino)}`;
            const key = `${service.hora}::${originKey}::${destinationKey}`;
            const current = rawGroups.get(key) || [];
            current.push(service);
            rawGroups.set(key, current);
        });

    const trips: GroupedTrip[] = [];

    const vehicleByPlate = new Map<string, Viatura>(viaturas.map(v => [normalizePlate(v.matricula), v]));
    const locationByName = new Map<string, { latitude: number; longitude: number }>(
        locais.map(l => [normalizeText(l.nome), { latitude: l.latitude, longitude: l.longitude }])
    );

    const reservedByTime = new Map<string, { driverIds: Set<string>; vehicleIds: Set<string> }>();

    const reserveSlot = (hora: string, driverId?: string, vehicleId?: string) => {
        const entry = reservedByTime.get(hora) || { driverIds: new Set<string>(), vehicleIds: new Set<string>() };
        if (driverId) entry.driverIds.add(driverId);
        if (vehicleId) entry.vehicleIds.add(vehicleId);
        reservedByTime.set(hora, entry);
    };

    existingServicos
        .filter(s => (s.data || selectedDate) === selectedDate)
        .forEach(s => reserveSlot(s.hora, s.motoristaId || undefined, s.vehicleId || undefined));

    const getAvailableCandidates = (hora: string, origem: string) => {
        const slot = reservedByTime.get(hora) || { driverIds: new Set<string>(), vehicleIds: new Set<string>() };
        const originLoc = locationByName.get(normalizeText(origem));

        return motoristas
            .filter(driver => {
                if (!driver.id || slot.driverIds.has(driver.id)) return false;
                if (selectedCentroCusto !== 'all' && driver.centroCustoId !== selectedCentroCusto) return false;
                return true;
            })
            .map(driver => {
                const preferredVehicle = vehicleByPlate.get(normalizePlate(driver.currentVehicle || ''));

                let chosenVehicle = preferredVehicle && !slot.vehicleIds.has(preferredVehicle.id)
                    ? preferredVehicle
                    : viaturas.find(v => !slot.vehicleIds.has(v.id) && (selectedCentroCusto === 'all' || v.centro_custo_id === selectedCentroCusto));

                if (!chosenVehicle && preferredVehicle) chosenVehicle = preferredVehicle;

                if (!chosenVehicle) return null;

                const liveVehicle = cartrackVehicles.find(v =>
                    String(v.id) === String(chosenVehicle?.id) ||
                    normalizePlate(v.registration) === normalizePlate(chosenVehicle?.matricula)
                );

                let distance = Number.MAX_SAFE_INTEGER;
                if (originLoc && liveVehicle && Number.isFinite(liveVehicle.latitude) && Number.isFinite(liveVehicle.longitude)) {
                    distance = haversineMeters(originLoc.latitude, originLoc.longitude, liveVehicle.latitude, liveVehicle.longitude);
                }

                return {
                    driver,
                    vehicle: chosenVehicle,
                    distance
                };
            })
            .filter(Boolean)
            .sort((a: any, b: any) => {
                if (a.distance !== b.distance) return a.distance - b.distance;
                return (b.vehicle?.vehicleCapacity || 8) - (a.vehicle?.vehicleCapacity || 8);
            }) as Array<{ driver: Motorista; vehicle: Viatura; distance: number }>;
    };

    Array.from(rawGroups.entries())
        .sort(([keyA], [keyB]) => {
            const [horaA] = keyA.split('::');
            const [horaB] = keyB.split('::');
            return toMinutes(horaA) - toMinutes(horaB);
        })
        .forEach(([_, groupedServices]) => {
            const sample = groupedServices[0];
            const baseHour = sample.hora;
            const origem = sample.origem;
            const destino = sample.destino;
            const roundSpacingMinutes = 10;
            let roundIndex = 0;

            let remainingPassengers = [...groupedServices];

            while (remainingPassengers.length > 0) {
                const scheduledHour = addMinutesToTime(baseHour, roundIndex * roundSpacingMinutes);
                const candidates = getAvailableCandidates(scheduledHour, origem);
                const best = candidates[0];

                const vehicleCapacity = Math.max(1, Number(best?.vehicle?.vehicleCapacity || 8));
                const chunk = remainingPassengers.slice(0, vehicleCapacity);
                remainingPassengers = remainingPassengers.slice(vehicleCapacity);

                const passengerCount = chunk.length;
                const occupancyRate = Number(((passengerCount / vehicleCapacity) * 100).toFixed(2));

                trips.push({
                    id: crypto.randomUUID(),
                    hora: scheduledHour,
                    origem,
                    destino,
                    servicos: chunk,
                    motoristaId: best?.driver?.id,
                    vehicleId: best?.vehicle?.id,
                    vehicleCapacity,
                    passengerCount,
                    occupancyRate,
                    conflict: best ? undefined : 'Sem motorista/viatura disponível neste horário.'
                });

                reserveSlot(scheduledHour, best?.driver?.id, best?.vehicle?.id);
                roundIndex += 1;
            }
        });

    return trips;
}
