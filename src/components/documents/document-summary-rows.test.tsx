/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  DocumentSummaryRows,
  summaryToggleLabel,
  summaryToggleLabelFor,
  type DocumentSummaryLine,
} from '@/components/documents/document-summary-rows';

const makeLines = (count: number, materialsPerLine = 0): DocumentSummaryLine[] =>
  Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    name: `Servicio ${index + 1}`,
    quantity: 1,
    amount: 100 * (index + 1),
    materials: Array.from({ length: materialsPerLine }, (__, m) => ({
      id: `${index}-${m}`,
      name: `Material ${index + 1}.${m + 1}`,
      quantity: 2,
      unit: 'pza',
      price: 5,
      amount: 10,
    })),
  }));

describe('summaryToggleLabel', () => {
  it.each([
    [1, 0, 'Ver el servicio'],
    [1, 1, 'Ver el servicio y 1 material'],
    [1, 3, 'Ver el servicio y 3 materiales'],
    [3, 0, 'Ver los 3 servicios'],
    [3, 1, 'Ver los 3 servicios y 1 material'],
    [3, 2, 'Ver los 3 servicios y 2 materiales'],
    [8, 21, 'Ver los 8 servicios y 21 materiales'],
  ])('services %i, materials %i → %s', (services, materials, expected) => {
    expect(summaryToggleLabel(services, materials)).toBe(expected);
  });

  it.each([
    [1, 0, 'Ver el concepto'],
    [1, 1, 'Ver el concepto y 1 material'],
    [1, 3, 'Ver el concepto y 3 materiales'],
    [3, 0, 'Ver los 3 conceptos'],
    [3, 1, 'Ver los 3 conceptos y 1 material'],
    [3, 2, 'Ver los 3 conceptos y 2 materiales'],
  ])('conceptos %i, materials %i → %s', (concepts, materials, expected) => {
    expect(summaryToggleLabelFor(concepts, 'concepto', 'conceptos', materials)).toBe(expected);
  });
});

describe('DocumentSummaryRows (ZIG-I13-1)', () => {
  it('shows the first 3 rows, then expands in place with materials', async () => {
    const user = userEvent.setup();
    render(<DocumentSummaryRows lines={makeLines(8, 3)} />);
    expect(screen.getAllByRole('listitem').filter((li) => li.textContent?.startsWith('1 ×'))).toHaveLength(3);
    expect(screen.queryByText(/Servicio 4/)).toBeNull();

    const toggle = screen.getByRole('button', { name: /Ver los 8 servicios y 24 materiales/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);

    expect(screen.getByText(/Servicio 8/)).toBeInTheDocument();
    expect(screen.getByText(/Material 8\.3/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ver menos/ })).toHaveAttribute('aria-expanded', 'true');
  });

  it('has no toggle for a short list without materials', () => {
    render(<DocumentSummaryRows lines={makeLines(2)} />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('with 0 materials offers the toggle only past the visible rows', () => {
    render(<DocumentSummaryRows lines={makeLines(4)} />);
    expect(screen.getByRole('button', { name: 'Ver los 4 servicios' })).toBeInTheDocument();
  });

  it('truncates a long name but never the amount', () => {
    const name = 'N'.repeat(120);
    render(
      <DocumentSummaryRows
        lines={[{ id: 1, name, quantity: 3, amount: 9_999_999_999.99 }]}
      />,
    );
    const nameEl = screen.getByText(name);
    expect(nameEl.className).toContain('truncate');
    const amount = screen.getByText('$9,999,999,999.99');
    expect(amount.className).toContain('shrink-0');
    expect(amount.className).not.toContain('truncate');
  });
});
