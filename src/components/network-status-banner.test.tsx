import { render, screen } from '@testing-library/react';
import {
  NETWORK_STATUS_BANNER_ROW_HEIGHT,
  NetworkStatusBanner,
} from '@/components/network-status-banner';

jest.mock('@/hooks/use-network-status');

const mockUseNetworkStatus = jest.requireMock<{
  useNetworkStatus: jest.Mock;
}>('@/hooks/use-network-status').useNetworkStatus;

describe('NetworkStatusBanner', () => {
  beforeEach(() => {
    document.documentElement.style.removeProperty(
      '--network-status-banner-offset',
    );
    delete document.documentElement.dataset.networkStatusBanner;
  });

  it('exports banner row height for layout coordination', () => {
    expect(NETWORK_STATUS_BANNER_ROW_HEIGHT).toBe('2.5rem');
  });

  it('renders offline banner with status live region', () => {
    mockUseNetworkStatus.mockReturnValue({ isOnline: false });

    render(<NetworkStatusBanner />);

    const banner = screen.getByRole('status');
    expect(banner).toHaveAttribute('aria-live', 'assertive');
    expect(banner).toHaveAttribute('aria-atomic', 'true');
    expect(
      screen.getByText(/Sin conexión a internet/i),
    ).toBeInTheDocument();
  });

  it('sets document offset when offline banner is visible', () => {
    mockUseNetworkStatus.mockReturnValue({ isOnline: false });

    render(<NetworkStatusBanner />);

    expect(document.documentElement.dataset.networkStatusBanner).toBe(
      'visible',
    );
    expect(
      document.documentElement.style.getPropertyValue(
        '--network-status-banner-offset',
      ),
    ).toContain(NETWORK_STATUS_BANNER_ROW_HEIGHT);
  });

  it('clears document offset when online and never offline', () => {
    mockUseNetworkStatus.mockReturnValue({ isOnline: true });

    const { container } = render(<NetworkStatusBanner />);

    expect(container).toBeEmptyDOMElement();
    expect(document.documentElement.dataset.networkStatusBanner).toBeUndefined();
    expect(
      document.documentElement.style.getPropertyValue(
        '--network-status-banner-offset',
      ),
    ).toBe('');
  });
});
