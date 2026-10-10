/**
 * @jest-environment jsdom
 */
import axe from 'axe-core';
import { render } from '@testing-library/react';

import {
  ConfirmSheet,
  DocumentLineRow,
  DocumentSummaryRows,
  MoneyFigure,
} from '@/components/documents';

jest.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => true }));

// jsdom has no layout or paint: colour contrast is covered by the e2e axe runs.
const runAxe = (node: Element) =>
  axe.run(node, { rules: { 'color-contrast': { enabled: false } } });

describe('documents components, axe (ZIG-I13-1)', () => {
  it('line rows, money figures and summary rows have no violations', async () => {
    const { container } = render(
      <main>
        <ul aria-label="Servicios">
          <li>
            <DocumentLineRow
              name={'x'.repeat(100)}
              quantity={2}
              price={1_234_567.89}
              amount={9_999_999_999.99}
              materialCount={21}
              onClick={() => undefined}
            />
          </li>
          <li>
            <DocumentLineRow name="Sin menú" quantity={1} price={10} amount={10} changed error="Revisa el precio" />
          </li>
        </ul>
        <MoneyFigure amount={0} size="hero" />
        <DocumentSummaryRows
          lines={Array.from({ length: 5 }, (_, i) => ({
            id: i,
            name: `Servicio ${i}`,
            quantity: 1,
            amount: 10,
            materials: [{ id: 'm', name: 'Filtro', quantity: 1, price: 5, amount: 5 }],
          }))}
        />
      </main>,
    );
    const { violations } = await runAxe(container);
    expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });

  it('the confirm sheet has no violations', async () => {
    render(
      <ConfirmSheet
        open
        onOpenChange={() => undefined}
        title="¿Eliminar el ticket #12?"
        description="Desaparece de tus tickets."
        confirmLabel="Eliminar ticket"
        cancelLabel="Conservar"
        onConfirm={() => undefined}
      />,
    );
    const { violations } = await runAxe(document.body);
    expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
});
