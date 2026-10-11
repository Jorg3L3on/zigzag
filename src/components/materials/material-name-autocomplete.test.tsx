/**
 * @jest-environment jsdom
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { MaterialNameAutocomplete } from '@/components/materials/material-name-autocomplete';

const mockSearchMaterials = jest.fn();
jest.mock('@/actions/services', () => ({
  searchMaterials: (...args: unknown[]) => mockSearchMaterials(...args),
}));

const renderField = (value = '') =>
  render(
    <>
      <MaterialNameAutocomplete
        id="m"
        value={value}
        onValueChange={() => {}}
        onPick={() => {}}
        emptyText="Sin materiales que coincidan. Usa Nuevo para escribirlo."
        emptyCatalogText="Tu catálogo está vacío. Usa Nuevo para agregar uno."
      />
      <button type="button">Nuevo</button>
    </>,
  );

describe('MaterialNameAutocomplete empty hint (ZIG-I12)', () => {
  beforeEach(() => {
    mockSearchMaterials.mockReset();
    mockSearchMaterials.mockResolvedValue({ success: true, data: [] });
  });

  it('says the catalog is empty when nothing is typed', async () => {
    const user = userEvent.setup();
    renderField('');

    await user.click(screen.getByRole('combobox'));

    expect(
      await screen.findByText('Tu catálogo está vacío. Usa Nuevo para agregar uno.'),
    ).toBeTruthy();
  });

  it('says no match only for typed text', async () => {
    const user = userEvent.setup();
    renderField('zzz');

    await user.click(screen.getByRole('combobox'));

    expect(
      await screen.findByText('Sin materiales que coincidan. Usa Nuevo para escribirlo.'),
    ).toBeTruthy();
  });

  it('keeps the hint after blur so the layout does not shift under the next tap', async () => {
    const user = userEvent.setup();
    renderField('');

    await user.click(screen.getByRole('combobox'));
    await screen.findByText(/Tu catálogo está vacío/);
    await user.click(screen.getByRole('button', { name: 'Nuevo' }));

    await waitFor(() => expect(screen.getByRole('combobox')).not.toHaveFocus());
    expect(screen.getByText(/Tu catálogo está vacío/)).toBeTruthy();
  });
});
