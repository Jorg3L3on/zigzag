import { render, screen, waitFor } from '@testing-library/react';
import { DashboardPageIntro } from '@/components/dashboard/dashboard-page-intro';

describe('DashboardPageIntro', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('uses the browser local hour for the greeting after mount', async () => {
    jest.spyOn(Date.prototype, 'getHours').mockReturnValue(13);

    render(<DashboardPageIntro userName="jorg" subtitle="Resumen de tu operación" />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
        'Buenas tardes, jorg',
      );
    });
  });

  it('shows Buenas noches only for local evening hours', async () => {
    jest.spyOn(Date.prototype, 'getHours').mockReturnValue(21);

    render(<DashboardPageIntro userName="Ana" />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
        'Buenas noches, Ana',
      );
    });
  });
});
