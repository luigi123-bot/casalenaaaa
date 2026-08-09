/**
 * Genera un UUID v4 de forma compatible con todos los entornos.
 * - Usa crypto.randomUUID() si está disponible (navegadores modernos / HTTPS).
 * - Cae en una implementación manual basada en Math.random() como fallback.
 */
export function generateUUID(): string {
    if (
        typeof crypto !== 'undefined' &&
        typeof crypto.randomUUID === 'function'
    ) {
        return crypto.randomUUID();
    }

    // Fallback: UUID v4 manual (RFC 4122)
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}
