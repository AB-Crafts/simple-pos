import type { Paisa } from '../types';

/** Convert a rupee amount (e.g. from a form input) into integer paisa. */
export function toPaisa(rupees: number): Paisa {
  return Math.round(rupees * 100);
}

/** Convert integer paisa into a rupee number, for editing in a form. */
export function toRupees(paisa: Paisa): number {
  return paisa / 100;
}

/** Format paisa as a display string, e.g. 15000 -> "Rs.150" or "Rs.150.50". */
export function formatMoney(paisa: Paisa): string {
  const rupees = paisa / 100;
  const hasCents = paisa % 100 !== 0;
  return `Rs.${rupees.toLocaleString('en-PK', {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
}

/** Sum an array of paisa amounts safely (integer addition, no float drift). */
export function sumPaisa(amounts: Paisa[]): Paisa {
  return amounts.reduce((total, amount) => total + amount, 0);
}
