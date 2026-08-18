import { useEffect, useRef } from 'react';

/**
 * USB barcode scanners behave like a keyboard typing very fast, followed
 * by Enter. This hook listens globally, buffers keystrokes, and fires
 * onScan(code) when it sees a burst of characters ending in Enter —
 * without interfering with normal typing in text inputs (a human typing
 * a barcode by hand is far slower than a scanner and won't trigger it).
 *
 * No hardware SDK or browser permission is needed for this class of
 * scanner — it's the standard "keyboard wedge" mode most USB/Bluetooth
 * barcode scanners ship in by default.
 */
const SCAN_CHAR_GAP_MS = 40; // scanners type each character within ~1-20ms; humans don't
const MIN_CODE_LENGTH = 3;

export function useBarcodeScanner(onScan: (code: string) => void, enabled = true) {
  const buffer = useRef('');
  const lastCharTime = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    function handleKeydown(e: KeyboardEvent) {
      const now = Date.now();

      // Don't hijack typing in a real input/textarea/select.
      const target = e.target as HTMLElement | null;
      const isFormField =
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (isFormField) return;

      if (now - lastCharTime.current > SCAN_CHAR_GAP_MS) {
        buffer.current = ''; // gap too long — this wasn't a scanner burst, start over
      }
      lastCharTime.current = now;

      if (e.key === 'Enter') {
        if (buffer.current.length >= MIN_CODE_LENGTH) {
          onScan(buffer.current);
        }
        buffer.current = '';
        return;
      }

      if (e.key.length === 1) {
        buffer.current += e.key;
      }
    }

    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [onScan, enabled]);
}
