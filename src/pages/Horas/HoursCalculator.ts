/**
 * Utility to calculate work hours, including night shift and extra hours.
 */

export interface ShiftCalculation {
    totalMinutes: number;
    normalMinutes: number;
    nightMinutes: number;
    extraMinutes: number;
    totalHours: string;  // HH:mm
    nightHours: string;  // HH:mm
    extraHours: string;  // HH:mm
    status: 'complete' | 'incomplete' | 'conflict';
}

const toMinutes = (time: string): number => {
    if (!time) return 0;
    const [h, m] = time.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
};

const fromMinutes = (mins: number): string => {
    const h = Math.floor(Math.abs(mins) / 60);
    const m = Math.floor(Math.abs(mins) % 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

/**
 * Night window is 22:00 to 07:00
 */

export const calculateShift = (
    startTime: string,
    endTime: string,
    breakDuration: number = 0,
    dailyGoalMinutes: number = 480 // 8 hours
): ShiftCalculation => {
    if (!startTime || !endTime) {
        return {
            totalMinutes: 0,
            normalMinutes: 0,
            nightMinutes: 0,
            extraMinutes: 0,
            totalHours: '00:00',
            nightHours: '00:00',
            extraHours: '00:00',
            status: 'incomplete'
        };
    }

    const start = toMinutes(startTime);
    let end = toMinutes(endTime);

    // Support for midnight crossing
    if (end <= start) {
        end += 1440; // Add 24 hours
    }

    const grossMinutes = end - start;
    const totalMinutes = Math.max(0, grossMinutes - breakDuration);

    // Calculate Night Minutes (22:00 - 07:00)
    // We check the intersection of [start, end] and [22:00, 07:00 + 24:00 if needed]
    let nightMinutes = 0;

    // Shift spans multiple "night" segments?
    // Let's normalize everything into a 48h window to be safe for shifts starting one day and ending next
    // Segments: 
    // Day 0: [22:00, 31:00] (which is 22:00 to 07:00 next day)
    // Day -1: [-2:00, 7:00] (which is 22:00 previous day to 07:00 today)

    const nightWindows = [
        { s: -120, e: 420 },    // 22:00 (prev) to 07:00 (today)
        { s: 1320, e: 1860 },   // 22:00 (today) to 07:00 (tomorrow)
        { s: 2760, e: 3300 }    // 22:00 (tomorrow) to 07:00 (next)
    ];

    nightWindows.forEach(win => {
        const overlapStart = Math.max(start, win.s);
        const overlapEnd = Math.min(end, win.e);
        if (overlapEnd > overlapStart) {
            nightMinutes += (overlapEnd - overlapStart);
        }
    });

    // Note: Breaks are usually taken during day hours. 
    // If night shift, we might need a more complex break deduction.
    // For now, subtract break from total, and if nightMinutes > total, cap it.
    nightMinutes = Math.min(nightMinutes, totalMinutes);

    const extraMinutes = Math.max(0, totalMinutes - dailyGoalMinutes);
    const normalMinutes = totalMinutes - extraMinutes;

    return {
        totalMinutes,
        normalMinutes,
        nightMinutes,
        extraMinutes,
        totalHours: fromMinutes(totalMinutes),
        nightHours: fromMinutes(nightMinutes),
        extraHours: fromMinutes(extraMinutes),
        status: totalMinutes > 0 ? 'complete' : 'incomplete'
    };
};
