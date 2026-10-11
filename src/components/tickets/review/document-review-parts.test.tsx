/**
 * @jest-environment jsdom
 */
import { render, renderHook, screen, within } from '@testing-library/react';

import {
  QuoteSummary,
  ReviewLinesSection,
  usePdfViewerEnabled,
  type ReviewLine,
} from '@/components/tickets/review/document-review-parts';

const LONG_NAME = 'x'.repeat(100);

const bigLine: ReviewLine = {
  id: 1,
  serviceId: null,
  name: LONG_NAME,
  quantity: 99,
  price: 99_999_990,
  materials: [
    {
      id: 11,
      name: 'M'.repeat(100),
      unit: null,
      quantity: 9_999.99,
      price: 1,
      inline: true,
    },
  ],
};

describe('ReviewLinesSection layout (ZIG-I12)', () => {
  it('wraps a 100-char unbroken name and keeps amounts in their own column', () => {
    render(
      <ReviewLinesSection lines={[bigLine]} total={9_900_124_059.38} linesLabel="Servicios" />,
    );

    const name = screen.getByText(LONG_NAME);
    expect(name.className).toContain('[overflow-wrap:anywhere]');

    const item = screen.getByTestId('review-line-amount').closest('li') as HTMLElement;
    expect(item.className).toContain('grid');
    const materials = within(item).getByTestId('review-line-materials');
    // Materials span both grid columns, so their amounts share the line amount's right edge.
    expect(materials.parentElement?.className).toContain('col-span-2');
    expect(screen.getByTestId('review-line-amount').className).toContain('text-right');
  });

  it('shows the full total without truncation', () => {
    render(
      <ReviewLinesSection lines={[bigLine]} total={9_900_124_059.38} linesLabel="Servicios" />,
    );

    expect(screen.getByTestId('review-total').className).not.toContain('truncate');
  });
});

describe('QuoteSummary', () => {
  it('wraps long concept names instead of truncating them', () => {
    render(
      <QuoteSummary
        presupuestoId="1117"
        clientName={"C".repeat(100)}
        dateLabel={null}
        expiresLabel={null}
        lines={[bigLine]}
        total={1}
      />,
    );

    expect(screen.getByText(new RegExp(LONG_NAME)).className).not.toContain('truncate');
  });
});

describe('usePdfViewerEnabled', () => {
  const setNavigator = (userAgent: string, pdfViewerEnabled: boolean) => {
    Object.defineProperty(window.navigator, 'userAgent', {
      value: userAgent,
      configurable: true,
    });
    Object.defineProperty(window.navigator, 'pdfViewerEnabled', {
      value: pdfViewerEnabled,
      configurable: true,
    });
  };

  it('is on for a desktop browser with a PDF viewer', () => {
    setNavigator('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/130', true);
    const { result } = renderHook(() => usePdfViewerEnabled());
    expect(result.current).toBe(true);
  });

  it('is off on a touch device even when the browser claims a PDF viewer', () => {
    setNavigator('Mozilla/5.0 (Linux; Android 13; Pixel 5) Chrome/130 Mobile', true);
    const { result } = renderHook(() => usePdfViewerEnabled());
    expect(result.current).toBe(false);
  });
});
