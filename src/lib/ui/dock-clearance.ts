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

/**
 * While a sticky action bar is on screen the dock is hidden (ZIG-I18-6): two
 * bars stacked at the bottom covered the payment choices and the Pagos section.
 * The bar takes the dock's place and the content clears only the bar.
 */
export const STICKY_ACTION_CLEARANCE_HEIGHT_CLASS =
  'h-[calc(var(--sticky-action-clearance)+max(env(safe-area-inset-bottom,0px),var(--dock-float-gap)))]';

/** Bottom offset of the sticky action bar: the dock's slot, above the safe area. */
export const STICKY_ACTION_BOTTOM_CLASS =
  'bottom-[max(env(safe-area-inset-bottom,0px),var(--dock-float-gap))]';

/** Outer padding of the dock itself (safe area, at least the float gap). */
export const DOCK_FLOAT_PADDING_CLASS =
  'pb-[max(env(safe-area-inset-bottom,0px),var(--dock-float-gap))]';
