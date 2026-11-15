export const MEXICO_TIMEZONE = 'America/Mexico_City';

/**
 * Returns the UTC ISO timestamp for midnight (00:00:00) of the given date in
 * America/Mexico_City (permanently UTC-6 since Mexico abolished DST in 2023).
 */
export function getMexicoDayStartISO(date: Date = new Date()): string {
    const mexicoDateStr = date.toLocaleDateString('en-CA', { timeZone: MEXICO_TIMEZONE });
    return new Date(`${mexicoDateStr}T06:00:00.000Z`).toISOString();
}

/**
 * Returns the 0-23 hour in America/Mexico_City, or null if the date is invalid.
 */
export function getMexicoHour(date: Date): number | null {
    if (Number.isNaN(date.getTime())) return null;
    const hourStr = new Intl.DateTimeFormat('en-US', {
        timeZone: MEXICO_TIMEZONE,
        hour: '2-digit',
        hourCycle: 'h23',
    }).format(date);
    const hour = Number.parseInt(hourStr, 10);
    return Number.isInteger(hour) && hour >= 0 && hour < 24 ? hour : null;
}

export function formatMexicoDate(date: Date): string {
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('es-MX', {
        timeZone: MEXICO_TIMEZONE,
        day: '2-digit',
        month: 'long',
    });
}

export function formatMexicoTime(date: Date): string {
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleTimeString('es-MX', {
        timeZone: MEXICO_TIMEZONE,
        hour: '2-digit',
        minute: '2-digit',
    });
}

/**
 * Rounds currency values to 2 decimal places so IEEE-754 float drift
 * (e.g. 0.1 + 0.2 - 0.3) never breaks strict zero comparisons.
 */
export function roundCurrency(value: number): number {
    if (!Number.isFinite(value)) return 0;
    const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
    return Object.is(rounded, -0) ? 0 : rounded;
}

