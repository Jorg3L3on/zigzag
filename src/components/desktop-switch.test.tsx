import { render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';

import { DesktopSwitch } from '@/components/desktop-switch';
import { useIsDesktop } from '@/hooks/use-desktop';

const setWidth = (desktop: boolean) => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: jest.fn().mockImplementation((query: string) => ({
      matches: desktop,
      media: query,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    })),
  });
};

const Probe = ({ testId }: { testId: string }) => {
  const isDesktop = useIsDesktop();
  return <span data-testid={testId}>{isDesktop ? 'desktop' : 'phone'}</span>;
};

describe('DesktopSwitch (ZIG-28)', () => {
  it('server-renders both trees, each hidden by CSS on the other side', () => {
    const html = renderToString(
      <DesktopSwitch phone={<p>teléfono</p>} desktop={<p>escritorio</p>} />,
    );
    expect(html).toContain('class="lg:hidden" data-layout-pending=""><p>teléfono</p>');
    expect(html).toContain('class="hidden lg:block" data-layout-pending=""><p>escritorio</p>');
  });

  it('tells each tree its layout even on the server', () => {
    const html = renderToString(
      <DesktopSwitch phone={<Probe testId="p" />} desktop={<Probe testId="d" />} />,
    );
    expect(html).toContain('data-testid="p">phone<');
    expect(html).toContain('data-testid="d">desktop<');
  });

  it('keeps only the desktop tree on a wide client', () => {
    setWidth(true);
    render(<DesktopSwitch phone={<Probe testId="p" />} desktop={<Probe testId="d" />} />);
    expect(screen.getByTestId('d')).toHaveTextContent('desktop');
    expect(screen.queryByTestId('p')).not.toBeInTheDocument();
  });

  it('keeps only the phone tree on a narrow client', () => {
    setWidth(false);
    render(<DesktopSwitch phone={<Probe testId="p" />} desktop={<Probe testId="d" />} />);
    expect(screen.getByTestId('p')).toHaveTextContent('phone');
    expect(screen.queryByTestId('d')).not.toBeInTheDocument();
  });
});
