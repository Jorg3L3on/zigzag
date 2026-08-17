import { render } from '@testing-library/react';

import { AppMobileChrome } from '@/components/app-mobile-chrome';

const mockPrefetch = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    prefetch: mockPrefetch,
  }),
  usePathname: () => '/dashboard',
}));

jest.mock('@/hooks/use-display-mode-standalone', () => ({
  useDisplayModeStandalone: () => false,
}));

jest.mock('@/components/mobile-bottom-tab-bar', () => ({
  MobileBottomTabBar: () => <div data-testid="mobile-bottom-tab-bar" />,
}));

jest.mock('@/components/operator-tenant-company-sync', () => ({
  OperatorTenantCompanySync: () => null,
}));

jest.mock('@/hooks/use-mobile', () => ({
  useIsMobile: jest.fn(),
}));

const mockUseIsMobile = jest.requireMock<{
  useIsMobile: jest.Mock;
}>('@/hooks/use-mobile').useIsMobile;

describe('AppMobileChrome idle prefetch', () => {
  beforeEach(() => {
    mockPrefetch.mockClear();
    mockUseIsMobile.mockReset();
    window.sessionStorage.clear();
    Object.defineProperty(window, 'requestIdleCallback', {
      configurable: true,
      value: jest.fn((callback: () => void) => {
        callback();
        return 1;
      }),
    });
    Object.defineProperty(window, 'cancelIdleCallback', {
      configurable: true,
      value: jest.fn(),
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(window, 'requestIdleCallback');
    Reflect.deleteProperty(window, 'cancelIdleCallback');
  });

  it('prefetches the primary mobile routes once per session after idle', () => {
    mockUseIsMobile.mockReturnValue(true);

    const { unmount } = render(
      <AppMobileChrome>
        <main />
      </AppMobileChrome>,
    );

    expect(window.requestIdleCallback).toHaveBeenCalled();
    expect(mockPrefetch).toHaveBeenCalledTimes(3);
    expect(mockPrefetch).toHaveBeenNthCalledWith(1, '/dashboard');
    expect(mockPrefetch).toHaveBeenNthCalledWith(2, '/tickets');
    expect(mockPrefetch).toHaveBeenNthCalledWith(3, '/clients');

    unmount();
    render(
      <AppMobileChrome>
        <main />
      </AppMobileChrome>,
    );

    expect(mockPrefetch).toHaveBeenCalledTimes(3);
  });

  it('skips idle prefetch on desktop widths', () => {
    mockUseIsMobile.mockReturnValue(false);

    render(
      <AppMobileChrome>
        <main />
      </AppMobileChrome>,
    );

    expect(window.requestIdleCallback).not.toHaveBeenCalled();
    expect(mockPrefetch).not.toHaveBeenCalled();
  });
});
