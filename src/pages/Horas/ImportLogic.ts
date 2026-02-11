import type { CartrackTrip } from '../../utils/pdfParser';

export interface DailyWorkSuggestion {
    date: string;       // YYYY-MM-DD
    plate: string;
    startTime: string;  // HH:MM
    endTime: string;    // HH:MM
    breakDuration: number; // Minutes
    workingMinutes: number;
    log: string[];      // Explanations for pauses
}

/**
 * Calculates working hours based on Option B + C:
 * B: Auto-fill Start/End based on First/Last trip.
 * C: Deduct Gaps > threshold as unpaid breaks.
 */
export const calculateWorkHoursFromTrips = (
    trips: CartrackTrip[],
    gapThresholdMinutes: number = 60 // Default 1 hour gap counts as break
): DailyWorkSuggestion[] => {

    // 1. Group by Plate + Date
    const grouped = new Map<string, CartrackTrip[]>();

    trips.forEach(t => {
        // Normalize Date from YYYY/MM/DD to YYYY-MM-DD
        const isoDate = t.date.replace(/\//g, '-');
        const key = `${t.matricula}_${isoDate}`;
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)?.push(t);
    });

    const suggestions: DailyWorkSuggestion[] = [];

    grouped.forEach((dayTrips, key) => {
        // Sort by Time
        dayTrips.sort((a, b) => a.startTime.localeCompare(b.startTime));

        const [plate, date] = key.split('_');

        const firstTrip = dayTrips[0];
        const lastTrip = dayTrips[dayTrips.length - 1];

        // Helper: Time to Minutes
        const toMin = (t: string) => {
            const [h, m] = t.split(':').map(Number);
            return h * 60 + m;
        };

        // Shift Start / End
        const startMin = toMin(firstTrip.startTime);
        const endLastMin = toMin(lastTrip.endTime);
        // lastTripStartMin removed as unused.

        let totalShiftMinutes = endLastMin - startMin;

        // Calculate Gaps (Option C)
        let totalBreakMinutes = 0;
        const log: string[] = [];

        for (let i = 0; i < dayTrips.length - 1; i++) {
            const currentTripEnd = toMin(dayTrips[i].endTime);
            const nextTripStart = toMin(dayTrips[i + 1].startTime);

            const gap = nextTripStart - currentTripEnd;

            if (gap > gapThresholdMinutes) {
                totalBreakMinutes += gap;
                log.push(`Gap of ${gap}m detected between ${dayTrips[i].endTime} and ${dayTrips[i + 1].startTime}`);
            }
        }

        // Apply Logic:
        // If NO gaps found but shift is long (>6h), should we force a lunch break deduction?
        // User requested B+C (Import + logic). Let's stick to strict gap deduction for now.
        // If gap is effectively 0, breakDuration = 0.

        // Rounding:
        // Convert Start/End to nearest 5 mins? Optional.
        // For Payroll, strict times are okay, or we can round. Let's keep strict.

        suggestions.push({
            date,
            plate,
            startTime: firstTrip.startTime.substring(0, 5), // HH:MM
            endTime: lastTrip.endTime.substring(0, 5),      // HH:MM
            breakDuration: totalBreakMinutes,
            workingMinutes: totalShiftMinutes - totalBreakMinutes,
            log
        });
    });

    return suggestions;
};
