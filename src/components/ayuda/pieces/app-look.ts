/**
 * Rebuilt app pieces on the help pages (ZIG-I40-2) use the app look, not the
 * paper one: white, #E2E8F0 borders, app blue. The control to touch is ringed
 * in orange.
 */
export const APP_PIECE_CARD =
  'w-full max-w-[340px] rounded-2xl border border-[#E2E8F0] bg-white text-sm text-[#0B1220] shadow-[0_18px_36px_-24px_rgba(23,20,15,0.45)]';

/** Orange ring around the control the step asks you to touch. */
export const TOUCH_RING = 'shadow-[0_0_0_6px_rgba(242,112,42,0.35)]';
export const TOUCH_RING_SM = 'shadow-[0_0_0_5px_rgba(242,112,42,0.35)]';

export const APP_MUTED = 'text-[#556277]';

/** $2,250.00, as the composer shows totals. */
export const formatPieceMoney = (amount: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
