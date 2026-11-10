import * as React from 'react';
import { renderHook } from '@testing-library/react';

import { DesktopLayoutContext } from '@/hooks/use-desktop';
import { useInvoiceDeliveryMode } from '@/hooks/use-invoice-delivery-mode';

const originalMatchMedia = window.matchMedia;

const mockDesktopWidth = (desktop: boolean) => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: desktop && query === '(min-width: 1024px)',
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
};

describe('useInvoiceDeliveryMode (ZIG-I37-2)', () => {
  afterEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: originalMatchMedia,
    });
  });

  it('downloads from 1024 px', () => {
    mockDesktopWidth(true);
    const { result } = renderHook(() => useInvoiceDeliveryMode());
    expect(result.current).toBe('download');
  });

  it('keeps share-or-download below 1024 px', () => {
    mockDesktopWidth(false);
    const { result } = renderHook(() => useInvoiceDeliveryMode());
    expect(result.current).toBe('share-or-download');
  });

  it('follows the DesktopSwitch tree it renders in', () => {
    mockDesktopWidth(false);
    const desktopTree = ({ children }: { children: React.ReactNode }) => (
      <DesktopLayoutContext.Provider value>{children}</DesktopLayoutContext.Provider>
    );
    expect(renderHook(() => useInvoiceDeliveryMode(), { wrapper: desktopTree }).result.current).toBe(
      'download',
    );

    mockDesktopWidth(true);
    const phoneTree = ({ children }: { children: React.ReactNode }) => (
      <DesktopLayoutContext.Provider value={false}>{children}</DesktopLayoutContext.Provider>
    );
    expect(renderHook(() => useInvoiceDeliveryMode(), { wrapper: phoneTree }).result.current).toBe(
      'share-or-download',
    );
  });
});
