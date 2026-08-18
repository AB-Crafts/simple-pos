/** A random-enough local ID for offline-created records (UUID v4-ish). */
export function generateId(): string {
  if ('randomUUID' in crypto) return crypto.randomUUID();
  // Fallback for older browsers/webviews without crypto.randomUUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Builds a human-facing sale number like SALE-20260811-001.
 * `sequenceToday` is the count of sales already made today (0-based),
 * so pass the current count of today's sales before incrementing.
 */
export function generateSaleDisplayId(date: Date, sequenceToday: number): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const seq = String(sequenceToday + 1).padStart(3, '0');
  return `SALE-${y}${m}${d}-${seq}`;
}
