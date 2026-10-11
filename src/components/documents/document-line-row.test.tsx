/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DocumentLineRow } from '@/components/documents/document-line-row';

const LONG_NAME = 'Mantenimiento'.repeat(8) + 'x'.repeat(10); // 114 chars, no spaces

describe('DocumentLineRow (ZIG-I13-1)', () => {
  it('gives the name the full width and keeps the amount unsqueezed', () => {
    render(
      <DocumentLineRow
        name={LONG_NAME}
        quantity={2}
        price={1_234_567.89}
        amount={9_999_999_999.99}
        onClick={() => undefined}
      />,
    );
    expect(screen.getByText(LONG_NAME).className).toContain('[overflow-wrap:anywhere]');
    const amount = screen.getByTestId('document-line-amount');
    expect(amount).toHaveTextContent('$9,999,999,999.99');
    expect(amount.parentElement?.className).toContain('shrink-0');
    expect(screen.getByTestId('document-line-meta')).toHaveTextContent('2 × $1,234,567.89');
  });

  it('pluralises materials and omits the count at 0', () => {
    const { rerender } = render(
      <DocumentLineRow name="A" quantity={1} price={10} amount={10} materialCount={0} />,
    );
    expect(screen.getByTestId('document-line-meta')).toHaveTextContent(/^1 × \$10\.00$/);
    rerender(<DocumentLineRow name="A" quantity={1} price={10} amount={10} materialCount={1} />);
    expect(screen.getByTestId('document-line-meta')).toHaveTextContent('1 × $10.00 · 1 material');
    rerender(<DocumentLineRow name="A" quantity={1} price={10} amount={10} materialCount={21} />);
    expect(screen.getByTestId('document-line-meta')).toHaveTextContent('· 21 materiales');
  });

  it('is one tap target whose accessible name includes the line, with no menu', async () => {
    const user = userEvent.setup();
    const onClick = jest.fn();
    render(<DocumentLineRow name="Carga de gas" quantity={1} price={10} amount={10} onClick={onClick} />);
    const row = screen.getByRole('button', { name: /Carga de gas/ });
    expect(screen.getAllByRole('button')).toHaveLength(1);
    await user.click(row);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders a link when given an href, and a plain row otherwise', () => {
    const { rerender } = render(
      <DocumentLineRow name="A" quantity={1} price={1} amount={1} href="/tickets/1" />,
    );
    expect(screen.getByRole('link', { name: /A/ })).toHaveAttribute('href', '/tickets/1');
    rerender(<DocumentLineRow name="A" quantity={1} price={1} amount={1} />);
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows the changed marker and the server error, and never a Nuevo pill', () => {
    render(
      <DocumentLineRow
        name="A"
        quantity={1}
        price={1}
        amount={1}
        changed
        error="El precio es demasiado alto"
        onClick={() => undefined}
      />,
    );
    expect(screen.getByTestId('document-line-changed')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('El precio es demasiado alto');
    expect(screen.queryByText('Nuevo')).toBeNull();
  });
});
