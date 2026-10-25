/**
 * A chosen filter is a state, not an action: a primary tint, never the solid blue
 * reserved for the page action (Nuevo ticket…). Same look in every list and width
 * (ZIG-I27-3, pinned decision eb0ff213). text-primary on primary/10 is 4.50:1 in light and
 * 4.96:1 in dark; a stronger tint drops light below 4.5:1, so hover keeps /10.
 */
export const FILTER_SELECTED_CLASS =
  'border-primary/40 bg-primary/10 font-semibold text-primary hover:bg-primary/10 hover:text-primary';
