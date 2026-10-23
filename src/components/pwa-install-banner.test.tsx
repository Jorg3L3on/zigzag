import { act, fireEvent, render, screen } from '@testing-library/react';
import { PwaInstallBanner } from '@/components/pwa-install-banner';

jest.mock('@/hooks/use-pwa-install-prompt', () => ({
  usePwaInstallPrompt: () => ({
    canPrompt: true,
    isInstalling: false,
    promptInstall: jest.fn(),
    dismiss: jest.fn(),
  }),
}));

let mockPathname = '/dashboard';
jest.mock('next/navigation', () => ({ usePathname: () => mockPathname }));

describe('PwaInstallBanner', () => {
  beforeEach(() => {
    mockPathname = '/dashboard';
  });

  it('waits for the first interaction so it never becomes the LCP element', () => {
    render(<PwaInstallBanner />);

    expect(screen.queryByTestId('pwa-install-banner')).not.toBeInTheDocument();

    act(() => {
      fireEvent.pointerDown(window);
    });

    expect(screen.getByTestId('pwa-install-banner')).toBeInTheDocument();
    expect(document.documentElement.style.getPropertyValue('--pwa-install-banner-offset')).toBe(
      '3.75rem',
    );
  });

  it('stays away from Mi cuenta, which has its own install card (ZIG-I21-4)', () => {
    mockPathname = '/account';
    render(<PwaInstallBanner />);
    act(() => {
      fireEvent.pointerDown(window);
    });
    expect(screen.queryByTestId('pwa-install-banner')).not.toBeInTheDocument();
  });
});
