/**
 * Bottom inset that clears the mobile dock.
 * The length lives once in `globals.css` (`--dock-clearance` =
 * dock bar + max(safe-area-inset-bottom, float gap)).
 * The app shell uses these classes; pages must not add their own pb-* for the dock.
 */

/** Content and sheet bodies on viewports that show the dock. */
export const DOCK_CLEARANCE_PADDING_CLASS = 'pb-(--dock-clearance)';

/** Same inset, but only below the `md` breakpoint (dock is `md:hidden`). */
export const DOCK_CLEARANCE_PADDING_MOBILE_CLASS =
  'pb-(--dock-clearance) md:pb-0';

/** Spacer height that reserves the dock area at the end of the content column. */
export const DOCK_CLEARANCE_HEIGHT_CLASS = 'h-(--dock-clearance)';

/** Outer padding of the dock itself (safe area, at least the float gap). */
export const DOCK_FLOAT_PADDING_CLASS =
  'pb-[max(env(safe-area-inset-bottom,0px),var(--dock-float-gap))]';
