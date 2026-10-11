import type { Page } from '@playwright/test';

/**
 * ZIG-I18-10: the audit's measurement as a regression check.
 * - share of visible characters rendered at 12px or smaller,
 * - interactive elements smaller than 44×44px,
 * - inputs under 16px (iOS zoom).
 * Runs inside the page, so it works on any screen a spec has navigated to.
 */
export type MobileMetrics = {
  totalChars: number;
  smallChars: number;
  /** 0..1 share of visible characters at 12px or less. */
  smallShare: number;
  smallTargets: Array<{ tag: string; label: string; width: number; height: number }>;
  smallInputs: Array<{ label: string; fontSize: number }>;
  /** Biggest offenders by text, for readable failures. */
  smallTextSamples: Array<{ text: string; fontSize: number }>;
};

export const SMALL_TEXT_SHARE_LIMIT = 0.1;
export const MIN_TARGET = 44;

/** Evaluated in the browser. Kept as a plain function so a fixture page can run it too. */
export const measureMobileMetrics = (opts: { minTarget: number }): MobileMetrics => {
  const isVisible = (el: Element): boolean => {
    let node: Element | null = el;
    while (node) {
      const style = getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) {
        return false;
      }
      if (node.getAttribute('aria-hidden') === 'true' && node.tagName !== 'BODY') {
        // decorative icons carry no text anyway; hidden text subtrees do not count
        return false;
      }
      node = node.parentElement;
    }
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };

  let totalChars = 0;
  let smallChars = 0;
  const samples = new Map<string, { text: string; fontSize: number; chars: number }>();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let current = walker.nextNode();
  while (current) {
    const text = (current.textContent ?? '').replace(/\s+/g, ' ').trim();
    const parent = current.parentElement;
    if (text && parent && !['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(parent.tagName) && isVisible(parent)) {
      const fontSize = Number.parseFloat(getComputedStyle(parent).fontSize);
      const chars = text.replace(/\s/g, '').length;
      totalChars += chars;
      if (fontSize <= 12) {
        smallChars += chars;
        const key = `${fontSize}:${text}`;
        samples.set(key, { text: text.slice(0, 60), fontSize, chars });
      }
    }
    current = walker.nextNode();
  }

  const labelOf = (el: Element): string =>
    (
      el.getAttribute('aria-label') ||
      (el as HTMLElement).innerText ||
      el.getAttribute('placeholder') ||
      el.getAttribute('href') ||
      el.tagName
    )
      .toString()
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 50);

  const interactive = Array.from(
    document.querySelectorAll(
      'a[href], button, input:not([type="hidden"]), select, textarea, [role="button"], [role="link"], [role="tab"], [role="radio"], [role="checkbox"], [role="switch"], [role="menuitem"]',
    ),
  ).filter(isVisible);

  const smallTargets = interactive
    .filter((el) => {
      // WCAG 2.5.8 exception: inline links inside a sentence.
      const inSentence =
        el.tagName === 'A' &&
        getComputedStyle(el).display === 'inline' &&
        Boolean(el.closest('p, li')) &&
        (el.parentElement?.textContent ?? '').trim().length > (el.textContent ?? '').trim().length + 10;
      if (inSentence) return false;
      // The current-page crumb is not a control.
      if (el.getAttribute('aria-disabled') === 'true' || el.getAttribute('aria-current') === 'page') return false;
      // Visually-hidden / sr-only skip links are not touch targets.
      const rect = el.getBoundingClientRect();
      if (rect.width <= 1 || rect.height <= 1) return false;
      return rect.width < opts.minTarget - 0.5 || rect.height < opts.minTarget - 0.5;
    })
    .map((el) => {
      const rect = el.getBoundingClientRect();
      return {
        tag: el.tagName.toLowerCase(),
        label: labelOf(el),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      };
    });

  const smallInputs = interactive
    .filter((el) => ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName))
    .map((el) => ({ label: labelOf(el), fontSize: Number.parseFloat(getComputedStyle(el).fontSize) }))
    .filter((item) => item.fontSize < 16);

  return {
    totalChars,
    smallChars,
    smallShare: totalChars === 0 ? 0 : smallChars / totalChars,
    smallTargets,
    smallInputs,
    smallTextSamples: Array.from(samples.values())
      .sort((a, b) => b.chars - a.chars)
      .slice(0, 8)
      .map(({ text, fontSize }) => ({ text, fontSize })),
  };
};

export const measurePage = (page: Page): Promise<MobileMetrics> =>
  page.evaluate(measureMobileMetrics, { minTarget: MIN_TARGET });

export const formatMetrics = (name: string, m: MobileMetrics): string =>
  [
    `${name}: ${(m.smallShare * 100).toFixed(1)}% of ${m.totalChars} chars ≤12px, ${m.smallTargets.length} targets <${MIN_TARGET}px, ${m.smallInputs.length} inputs <16px`,
    ...m.smallTextSamples.map((s) => `  text ${s.fontSize}px: ${s.text}`),
    ...m.smallTargets.slice(0, 12).map((t) => `  target ${t.width}×${t.height} <${t.tag}> ${t.label}`),
    ...m.smallInputs.slice(0, 5).map((i) => `  input ${i.fontSize}px ${i.label}`),
  ].join('\n');

/**
 * Asserts the goal metric. `softTargets` / `softShare` let a screen that is not
 * fixed yet pass with its current numbers while still printing them.
 */
export const assertMobileMetrics = (
  name: string,
  m: MobileMetrics,
  opts: { maxSmallShare?: number; maxSmallTargets?: number } = {},
): void => {
  const report = formatMetrics(name, m);
  const maxShare = opts.maxSmallShare ?? SMALL_TEXT_SHARE_LIMIT;
  const maxTargets = opts.maxSmallTargets ?? 0;
  const problems: string[] = [];
  if (m.smallShare > maxShare) problems.push(`small text share ${(m.smallShare * 100).toFixed(1)}% > ${(maxShare * 100).toFixed(0)}%`);
  if (m.smallTargets.length > maxTargets) problems.push(`${m.smallTargets.length} targets under ${MIN_TARGET}px (max ${maxTargets})`);
  if (m.smallInputs.length > 0) problems.push(`${m.smallInputs.length} inputs under 16px`);
  if (problems.length > 0) {
    throw new Error(`${problems.join('; ')}\n${report}`);
  }
  console.log(report);
};
