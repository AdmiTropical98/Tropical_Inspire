
export const parseNumber = (val: string | number | undefined | null): number => {
    if (val === undefined || val === null || val === '') return 0;
    if (typeof val === 'number') return val;

    // Handle string inputs
    const strVal = String(val).trim();
    if (strVal === '') return 0;

    // Detect format: if contains comma AND dot, assume dot is thousands separator OR comma is decimal
    // Standard European: 1.234,56 -> Remove dots, replace comma with dot
    // Standard US: 1,234.56 -> Remove commas
    let normalized = strVal;

    if (strVal.includes(',') && strVal.includes('.')) {
        if (strVal.indexOf('.') < strVal.indexOf(',')) {
            // 1.234,56 (European)
            normalized = strVal.replace(/\./g, '').replace(',', '.');
        } else {
            // 1,234.56 (US)
            normalized = strVal.replace(/,/g, '');
        }
    } else if (strVal.includes(',')) {
        // 1234,56 or 1,234 (Ambiguous, assume decimal comma for simple case unless it looks like thousands)
        // If multiple commas, it's thousands: 1,234,567 -> remove all but last? No, simplified:
        normalized = strVal.replace(',', '.');
    }

    // Remove any other non-numeric characters except dot and minus (and maybe e for exponent)
    // This handles currency symbols like '€' or 'km' if they sneaked in
    const cleanFn = normalized.replace(/[^0-9.-]/g, '');

    const parsed = parseFloat(cleanFn);
    return isNaN(parsed) ? 0 : parsed;
};
