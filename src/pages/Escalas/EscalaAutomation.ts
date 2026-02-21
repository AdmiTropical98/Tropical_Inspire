import type { Servico, Motorista } from '../../types';
import * as XLSX from 'xlsx';

export interface GroupedTrip {
    id: string;
    hora: string;
    origem: string;
    destino: string;
    servicos: Servico[];
    motoristaId?: string;
    conflict?: string;
}

export const AUTO_CONFIG = {
    ALBUFEIRA_SHEET_URL: localStorage.getItem('auto_sheet_albufeira') || '',
    QUARTEIRA_SHEET_URL: localStorage.getItem('auto_sheet_quarteira') || '',
};

export async function fetchSheetCSV(url: string): Promise<any[]> {
    try {
        let csvUrl = url;
        if (url.includes('docs.google.com/spreadsheets')) {
            // Convert to CSV export URL
            if (url.includes('/edit')) {
                csvUrl = url.split('/edit')[0] + '/export?format=csv';
                // Keep the gid if present
                const gidMatch = url.match(/gid=(\d+)/);
                if (gidMatch) {
                    csvUrl += `&gid=${gidMatch[1]}`;
                }
            }
        }

        const response = await fetch(csvUrl);
        if (!response.ok) throw new Error('Falha ao aceder à Google Sheet. Verifique se está partilhada.');

        const data = await response.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const workbookSheet = workbook.Sheets[firstSheetName];
        return XLSX.utils.sheet_to_json(workbookSheet);
    } catch (error) {
        console.error('Error fetching sheet:', error);
        throw error;
    }
}

export function parseSheetToServices(rows: any[], selectedDate: string, centroCustoId: string): Servico[] {
    const services: Servico[] = [];

    rows.forEach((row: any) => {
        const nome = row['Nome do funcionário'] || row['Nome'] || row['NOME'] || '';
        if (!nome) return;

        const origem = row['Origem'] || row['ORIGEM'] || '';
        const destino = row['Destino'] || row['DESTINO'] || '';

        const parseTime = (val: any) => {
            if (!val) return null;
            if (typeof val === 'number') {
                const totalSeconds = Math.round(val * 86400);
                const hours = Math.floor(totalSeconds / 3600);
                const minutes = Math.floor((totalSeconds % 3600) / 60);
                return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
            }
            const str = String(val).trim();
            const match = str.match(/(\d{1,2}):(\d{2})/);
            if (match) {
                return `${match[1].padStart(2, '0')}:${match[2].padStart(2, '0')}`;
            }
            return null;
        };

        const horaEntrada = parseTime(row['Horário de apanhar transporte'] || row['ENTRADA'] || row['Entrada']);
        const horaSaida = parseTime(row['Horário de saída do serviço'] || row['SAÍDA'] || row['Saída']);

        if (horaEntrada) {
            services.push({
                id: crypto.randomUUID(),
                data: selectedDate,
                hora: horaEntrada,
                passageiro: nome,
                origem,
                destino,
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
                passageiro: nome,
                origem: destino, // Returning
                destino: origem,
                concluido: false,
                centroCustoId,
                tipo: 'saida',
                obs: 'Importação Automática'
            });
        }
    });

    return services;
}

export function groupServicesIntoTrips(services: Servico[]): GroupedTrip[] {
    const trips: GroupedTrip[] = [];

    services.forEach(s => {
        // Grouping key: Hour + Origin + Destination
        const time = s.hora;
        const from = s.origem.trim().toLowerCase();
        const to = s.destino.trim().toLowerCase();

        const existingTrip = trips.find(t =>
            t.hora === time &&
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
                servicos: [s]
            });
        }
    });

    // Sort by time
    return trips.sort((a, b) => a.hora.localeCompare(b.hora));
}

export function suggestDrivers(
    trips: GroupedTrip[],
    motoristas: Motorista[],
    existingServicos: Servico[]
): GroupedTrip[] {
    const mutableTrips = [...trips];

    // We'll track driver current "state" to avoid overlaps and favor return trips
    const driverState: Record<string, { lastTime: string, lastDest: string }> = {};

    mutableTrips.forEach(trip => {
        const tripHour = trip.hora;

        // Find best candidate
        const candidates = motoristas.filter(m => {
            // 1. Check Shift (Turno)
            if (m.turnoInicio && m.turnoFim) {
                if (tripHour < m.turnoInicio || tripHour > m.turnoFim) return false;
            }

            // 2. Check Overlap / Min Interval (30 mins)
            const driverTrips = existingServicos.filter(s => s.motoristaId === m.id && s.data === trip.servicos[0].data);
            // Also check assigned in this session
            const sessionTrips = mutableTrips.filter(t => t.motoristaId === m.id);

            const allDriverTimes = [
                ...driverTrips.map(s => s.hora),
                ...sessionTrips.map(t => t.hora)
            ];

            const hasConflict = allDriverTimes.some(time => {
                const diff = Math.abs(timeToMinutes(time) - timeToMinutes(tripHour));
                return diff < 30; // 30 minutes minimum interval
            });

            if (hasConflict) return false;

            return true;
        });

        if (candidates.length === 0) return;

        // Preference 1: Drivers with "Opposite Destination" optimization
        const bestCandidate = candidates.find(m => {
            const state = driverState[m.id];
            if (!state) return false;
            return state.lastDest.trim().toLowerCase() === trip.origem.trim().toLowerCase();
        }) || candidates[0];

        trip.motoristaId = bestCandidate.id;

        // Update driver state
        driverState[bestCandidate.id] = {
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
