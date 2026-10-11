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

describe('PwaInstallBanner', () => {
  it('waits for the first interaction so it never becomes the LCP element', () => {
    render(<PwaInstallBanner />);

    expect(screen.queryByTestId('pwa-install-banner')).not.toBeInTheDocument();

    act(() => {
      fireEvent.pointerDown(window);
    });

    expect(screen.getByTestId('pwa-install-banner')).toBeInTheDocument();
  });
});
