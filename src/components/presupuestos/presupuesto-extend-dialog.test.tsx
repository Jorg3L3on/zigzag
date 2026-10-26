/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { extendPresupuestoVigencia } from '@/actions/presupuestos';
import {
  describeNewVigencia,
  extendBaseDate,
  PresupuestoExtendDialog,
} from '@/components/presupuestos/presupuesto-extend-dialog';

jest.mock('@/actions/presupuestos', () => ({
  extendPresupuestoVigencia: jest.fn(),
}));

jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const today = new Date('2026-10-25T15:00:00');

describe('Extender vigencia helpers (ZIG-I29-2)', () => {
  it('counts from today once expired or without a date, from the expiry otherwise', () => {
    expect(extendBaseDate('2026-10-20T12:00:00', today)).toEqual(new Date('2026-10-25T00:00:00'));
    expect(extendBaseDate(null, today)).toEqual(new Date('2026-10-25T00:00:00'));
    expect(extendBaseDate('2026-11-02T12:00:00', today)).toEqual(new Date('2026-11-02T00:00:00'));
  });

  it('describes the new validity', () => {
    expect(describeNewVigencia(new Date('2026-11-01T00:00:00'), today)).toBe(
      'Nueva vigencia: 1 de noviembre · quedan 7 días',
    );
    expect(describeNewVigencia(new Date('2026-10-26T00:00:00'), today)).toBe(
      'Nueva vigencia: 26 de octubre · queda 1 día',
    );
  });
});

describe('PresupuestoExtendDialog (ZIG-I29-2)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers({
      now: today,
      doNotFake: [
        'nextTick',
        'setImmediate',
        'clearImmediate',
        'setTimeout',
        'clearTimeout',
        'setInterval',
        'clearInterval',
        'queueMicrotask',
        'requestAnimationFrame',
        'cancelAnimationFrame',
        'requestIdleCallback',
        'cancelIdleCallback',
        'performance',
        'hrtime',
      ],
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('extends an expired quote by 7 days from today and reports the new date', async () => {
    const user = userEvent.setup();
    const onExtended = jest.fn();
    const onOpenChange = jest.fn();
    (extendPresupuestoVigencia as jest.Mock).mockResolvedValue({
      success: true,
      data: { id: '400', status: 'abierto' },
    });
    render(
      <PresupuestoExtendDialog
        open
        onOpenChange={onOpenChange}
        presupuestoId="400"
        folio="P-0004"
        ticketDate="2026-10-05T12:00:00"
        expiresAt="2026-10-20T12:00:00"
        companyId={4}
        onExtended={onExtended}
      />,
    );

    expect(screen.getByText(/Presupuesto P-0004 · venció el 20 de octubre/)).toBeTruthy();
    const confirm = screen.getByRole('button', { name: 'Extender vigencia' });
    expect(confirm).toBeDisabled();
    expect(screen.getByTestId('presupuesto-extend-preview')).toHaveTextContent(
      'Cuenta desde hoy, porque ya venció.',
    );

    await user.click(screen.getByRole('button', { name: '+7 días' }));
    expect(screen.getByRole('button', { name: '+7 días' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('presupuesto-extend-preview')).toHaveTextContent(
      'Nueva vigencia: 1 de noviembre · quedan 7 días',
    );
    await user.click(confirm);

    expect(extendPresupuestoVigencia).toHaveBeenCalledWith(400, new Date('2026-11-01T00:00:00'), 4);
    expect(onExtended).toHaveBeenCalledWith({ id: '400', status: 'abierto' });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('adds the days to the current expiry while it is still open', async () => {
    const user = userEvent.setup();
    render(
      <PresupuestoExtendDialog
        open
        onOpenChange={jest.fn()}
        presupuestoId="400"
        ticketDate="2026-10-05T12:00:00"
        expiresAt="2026-10-28T12:00:00"
        onExtended={jest.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: '+15 días' }));
    expect(screen.getByTestId('presupuesto-extend-preview')).toHaveTextContent(
      'Nueva vigencia: 12 de noviembre · quedan 18 días',
    );
  });
});
