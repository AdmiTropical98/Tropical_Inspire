
export const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('pt-PT', {
        style: 'currency',
        currency: 'EUR'
    }).format(amount);
};

export const excelDateToJSDate = (serial: number | string): Date | null => {
    // If it's already a date string like "2023-10-27", let Date parse it
    if (typeof serial === 'string' && serial.includes('-')) {
        const d = new Date(serial);
        return isNaN(d.getTime()) ? null : d;
    }

    // If it's a serial number (Excel dates are days since Dec 30 1899)
    const num = Number(serial);
    if (isNaN(num)) return null;

    // Excel leap year bug: 1900 is treated as leap year.
    // Days > 60 need correction if we base on 1899-12-30?
    // JS standard approach:
    // (Serial - 25569) * 86400 * 1000
    // 25569 is offset between 1900-01-01 and 1970-01-01

    // Easier approximate:
    // Excel base date: Dec 30, 1899
    const utc_days = Math.floor(num - 25569);
    const utc_value = utc_days * 86400;
    const date_info = new Date(utc_value * 1000);

    // Get fractional day for time
    const fractional_day = num - Math.floor(num) + 0.0000001;
    const total_seconds = Math.floor(86400 * fractional_day);
    const seconds = total_seconds % 60;

    const hours = Math.floor(total_seconds / (60 * 60));
    const minutes = Math.floor(total_seconds / 60) % 60;

    const date = new Date(date_info.getFullYear(), date_info.getMonth(), date_info.getDate(), hours, minutes, seconds);

    return date;
};
