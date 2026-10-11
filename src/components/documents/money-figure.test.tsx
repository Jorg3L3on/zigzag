/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';

import { MoneyFigure } from '@/components/documents/money-figure';

describe('MoneyFigure (ZIG-I13-1)', () => {
  it('prints the whole amount and never truncates', () => {
    render(<MoneyFigure amount={9_999_999_999.99} data-testid="m" />);
    const el = screen.getByTestId('m');
    expect(el).toHaveTextContent('$9,999,999,999.99');
    expect(el.className).toContain('[overflow-wrap:anywhere]');
    expect(el.className).toContain('tabular-nums');
    expect(el.className).not.toContain('truncate');
    expect(el.className).not.toContain('text-ellipsis');
  });

  it('steps the font down at 10+ and 12+ digits', () => {
    const { rerender } = render(<MoneyFigure amount={1250} size="hero" data-testid="m" />);
    expect(screen.getByTestId('m').className).toContain('text-4xl');
    rerender(<MoneyFigure amount={1_342_504.79} size="hero" data-testid="m" />);
    expect(screen.getByTestId('m').className).toContain('text-4xl'); // 9 digits
    rerender(<MoneyFigure amount={12_342_504.79} size="hero" data-testid="m" />);
    expect(screen.getByTestId('m').className).toContain('text-3xl'); // 10 digits
    rerender(<MoneyFigure amount={9_999_999_999.99} size="hero" data-testid="m" />);
    expect(screen.getByTestId('m').className).toContain('text-2xl'); // 12 digits
  });

  it('formats 0 and negative amounts', () => {
    const { rerender } = render(<MoneyFigure amount={0} data-testid="m" />);
    expect(screen.getByTestId('m')).toHaveTextContent('$0.00');
    rerender(<MoneyFigure amount={-50} tone="destructive" data-testid="m" />);
    expect(screen.getByTestId('m').className).toContain('text-destructive');
  });
});
