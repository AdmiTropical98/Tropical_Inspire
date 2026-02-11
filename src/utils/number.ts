
export const parseNumber = (val: string | number | undefined | null): number => {
    if (val === undefined || val === null || val === '') return 0;
    if (typeof val === 'number') return val;

    // Handle string inputs
    const strVal = String(val).trim();
    if (strVal === '') return 0;

    // Replace comma with dot for decimal parsing
    const normalized = strVal.replace(/,/g, '.');

    // Remove any other non-numeric characters except dot and minus
    // This handles currency symbols like '€' or 'km' if they sneaked in
    const cleanFn = normalized.replace(/[^0-9.-]/g, '');

    const parsed = parseFloat(cleanFn);
    return isNaN(parsed) ? 0 : parsed;
};
