/**
 * Focus the first meaningful control when a Radix Dialog/Sheet opens.
 * Skips decorative close buttons marked with `data-overlay-close`.
 */
export const focusInitialOverlayTarget = (
  event: Event,
  container: HTMLElement | null | undefined,
) => {
  event.preventDefault();

  if (!container) {
    return;
  }

  const preferred = container.querySelector<HTMLElement>('[data-initial-focus]');
  if (preferred) {
    if (!preferred.hasAttribute('tabindex')) {
      preferred.tabIndex = -1;
    }
    preferred.focus();
    return;
  }

  const selector =
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  const candidates = Array.from(
    container.querySelectorAll<HTMLElement>(selector),
  ).filter(
    (element) =>
      !element.hasAttribute('data-overlay-close') &&
      element.getAttribute('aria-hidden') !== 'true' &&
      element.tabIndex !== -1,
  );

  // Content still loading has no control yet: focus the panel itself, as Radix would,
  // so focus never stays on the row that opened it.
  (candidates[0] ?? container).focus();
};
