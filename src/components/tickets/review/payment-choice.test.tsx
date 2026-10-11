/**
 * @jest-environment jsdom
 */
import { render, screen, renderHook, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  PaymentChoice,
  parsePaymentAmount,
  usePaymentChoice,
} from '@/components/tickets/review/payment-choice';

const Harness = ({ total }: { total: number }) => {
  const choice = usePaymentChoice(total);
  return (
    <>
      <PaymentChoice choice={choice} idPrefix="t" />
      <output data-testid="paid">{choice.chosenPaid}</output>
      <output data-testid="ready">{String(choice.hasPayChoice)}</output>
    </>
  );
};

describe('PaymentChoice (ZIG-I13-4)', () => {
  it('starts with nothing chosen', () => {
    render(<Harness total={500} />);
    for (const radio of screen.getAllByRole('radio')) {
      expect(radio).toHaveAttribute('aria-checked', 'false');
    }
    expect(screen.getByTestId('ready')).toHaveTextContent('false');
    expect(screen.getByTestId('paid')).toHaveTextContent('0');
  });

  it('Todo pays the total, Nada aún pays nothing, Una parte needs an amount', async () => {
    const user = userEvent.setup();
    render(<Harness total={500} />);

    await user.click(screen.getByRole('radio', { name: 'Todo' }));
    expect(screen.getByTestId('paid')).toHaveTextContent('500');
    await user.click(screen.getByRole('radio', { name: 'Nada aún' }));
    expect(screen.getByTestId('paid')).toHaveTextContent('0');
    expect(screen.getByTestId('ready')).toHaveTextContent('true');

    await user.click(screen.getByRole('radio', { name: 'Una parte' }));
    expect(screen.getByTestId('ready')).toHaveTextContent('false');
    await user.type(screen.getByLabelText('Cuánto pagó'), '120.5');
    expect(screen.getByTestId('paid')).toHaveTextContent('120.5');
    expect(screen.getByTestId('ready')).toHaveTextContent('true');
  });

  it('flags a partial amount above the total', async () => {
    const { result } = renderHook(() => usePaymentChoice(100));
    act(() => {
      result.current.setPayMode('partial');
      result.current.setPartialInput('150');
    });
    expect(result.current.partialTooHigh).toBe(true);
  });

  it('parses money without float noise and never goes negative', () => {
    expect(parsePaymentAmount('1234.567')).toBe(1234.57);
    expect(parsePaymentAmount('-5')).toBe(0);
    expect(parsePaymentAmount('abc')).toBe(0);
  });
});
