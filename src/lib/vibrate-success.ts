/**
 * Light haptic feedback when the browser supports it (no-op otherwise).
 */
export const vibrateSuccess = (pattern: number | number[] = 10): void => {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') {
    return;
  }
  try {
    navigator.vibrate(pattern);
  } catch {
    // Ignore unsupported / blocked vibrate calls.
  }
};
