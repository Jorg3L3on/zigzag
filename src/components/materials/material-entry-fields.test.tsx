/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';

import {
  MaterialEntryFields,
  useMaterialEntry,
} from '@/components/materials/material-entry-fields';

jest.mock('@/actions/services', () => ({
  searchMaterials: jest.fn(async () => ({ success: true, data: [] })),
}));

const Harness = ({ initialCustom }: { initialCustom: boolean }) => {
  const entry = useMaterialEntry(
    'line',
    initialCustom
      ? {
          key: 'k',
          material_id: null,
          name: '',
          unit: null,
          quantity: 1,
          price: 0,
          save_to_catalog: false,
        }
      : null,
  );
  return <MaterialEntryFields idPrefix="t" entry={entry} />;
};

describe('MaterialEntryFields labels (ZIG-I12)', () => {
  it('labels the custom name, quantity and price inputs, not just their placeholders', () => {
    render(<Harness initialCustom />);

    expect(screen.getByLabelText('Nombre del material')).toHaveAttribute(
      'placeholder',
      expect.any(String),
    );
    expect(screen.getByLabelText('Cantidad')).toBeTruthy();
    expect(screen.getByLabelText(/^Precio/)).toHaveAttribute('placeholder', '0.00');
  });
});
