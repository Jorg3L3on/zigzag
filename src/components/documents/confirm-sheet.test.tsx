/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ConfirmSheet } from '@/components/documents/confirm-sheet';

const mockIsMobile = jest.fn();
jest.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => mockIsMobile() }));

const renderSheet = (props: Partial<React.ComponentProps<typeof ConfirmSheet>> = {}) => {
  const onConfirm = jest.fn();
  const onOpenChange = jest.fn();
  render(
    <ConfirmSheet
      open
      onOpenChange={onOpenChange}
      title="¿Eliminar el ticket #12?"
      description="Desaparece de tus tickets."
      summary={<p>Cliente Pérez · $1,200.00</p>}
      confirmLabel="Eliminar ticket"
      cancelLabel="Conservar"
      onConfirm={onConfirm}
      {...props}
    />,
  );
  return { onConfirm, onOpenChange };
};

describe.each([
  ['mobile bottom sheet', true],
  ['desktop dialog', false],
])('ConfirmSheet as %s (ZIG-I13-1)', (_label, mobile) => {
  beforeEach(() => mockIsMobile.mockReturnValue(mobile));

  it('names the action, shows the summary and confirms', async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderSheet();
    expect(screen.getByRole('dialog', { name: '¿Eliminar el ticket #12?' })).toBeInTheDocument();
    expect(screen.getByText('Cliente Pérez · $1,200.00')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Eliminar ticket' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('the secondary button only closes', async () => {
    const user = userEvent.setup();
    const { onConfirm, onOpenChange } = renderSheet();
    await user.click(screen.getByRole('button', { name: 'Conservar' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('disables both buttons while pending', () => {
    renderSheet({ pending: true });
    expect(screen.getByRole('button', { name: 'Eliminar ticket' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Conservar' })).toBeDisabled();
  });
});
