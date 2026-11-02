/**
 * @jest-environment jsdom
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { SearchableSelect } from '@/components/ui/searchable-select';

const options = [
  {
    value: '1',
    label: `${'A'.repeat(100)} · 998 100 0000`,
    title: 'A'.repeat(100),
    detail: '998 100 0000',
  },
  { value: '2', label: 'Beta' },
];

const renderSelect = () =>
  render(
    <SearchableSelect
      aria-label="Cliente"
      options={options}
      value=""
      onValueChange={() => {}}
      searchPlaceholder="Buscar…"
    />,
  );

describe('SearchableSelect (ZIG-I12)', () => {
  it('shows the phone on its own line even for a very long name', async () => {
    const user = userEvent.setup();
    renderSelect();

    await user.click(screen.getByRole('combobox'));
    const listbox = screen.getByRole('listbox');

    expect(within(listbox).getByText('998 100 0000')).toBeTruthy();
    expect(within(listbox).getByText('A'.repeat(100)).className).toContain(
      '[overflow-wrap:anywhere]',
    );
  });

  it('gives every row a 44px touch target', async () => {
    const user = userEvent.setup();
    renderSelect();

    await user.click(screen.getByRole('combobox'));

    for (const row of within(screen.getByRole('listbox')).getAllByRole('button')) {
      expect(row.className).toContain('min-h-11');
    }
  });

  it('starts with an empty search every time it opens', async () => {
    const user = userEvent.setup();
    renderSelect();

    await user.click(screen.getByRole('combobox'));
    await user.type(screen.getByPlaceholderText('Buscar…'), 'bet');
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('combobox'));

    expect(screen.getByPlaceholderText('Buscar…')).toHaveValue('');
  });

  it('moves with the arrow keys, rings the active option and picks with Enter (ZIG-I36 M-15)', async () => {
    const user = userEvent.setup();
    const onValueChange = jest.fn();
    render(
      <SearchableSelect
        aria-label="Cliente"
        options={options}
        value=""
        onValueChange={onValueChange}
        searchPlaceholder="Buscar…"
      />,
    );

    await user.click(screen.getByRole('combobox', { name: 'Cliente' }));
    const search = screen.getByRole('combobox', { name: 'Buscar…' });
    const rows = within(screen.getByRole('listbox')).getAllByRole('option');
    expect(rows[0]).toHaveAttribute('data-active', 'true');
    expect(search).toHaveAttribute('aria-activedescendant', rows[0].id);

    await user.keyboard('{ArrowDown}');
    expect(rows[1]).toHaveAttribute('data-active', 'true');
    expect(rows[1].querySelector('button')?.className).toContain('ring-2');
    expect(search).toHaveAttribute('aria-activedescendant', rows[1].id);

    await user.keyboard('{ArrowDown}');
    expect(rows[0]).toHaveAttribute('data-active', 'true');
    await user.keyboard('{ArrowUp}{Enter}');
    expect(onValueChange).toHaveBeenCalledWith('2');
  });

  it('dims the old list while a search runs and ignores taps on it (ZIG-I36 M-21)', async () => {
    const user = userEvent.setup();
    const onValueChange = jest.fn();
    const { rerender } = render(
      <SearchableSelect
        aria-label="Cliente"
        options={options}
        value=""
        onValueChange={onValueChange}
        onSearchChange={() => {}}
        isLoading
        footerHint="Escribe para buscar entre los 1,000 clientes"
      />,
    );

    await user.click(screen.getByRole('combobox', { name: 'Cliente' }));
    const listbox = screen.getByRole('listbox');
    expect(within(listbox).getByText('Buscando…')).toBeInTheDocument();
    const rows = within(listbox).getAllByRole('option');
    expect(rows).toHaveLength(2);
    expect(rows[1].className).toContain('opacity-50');
    expect(rows[1]).toHaveAttribute('aria-disabled', 'true');
    await user.click(within(rows[1]).getByRole('button'));
    await user.keyboard('{Enter}');
    expect(onValueChange).not.toHaveBeenCalled();
    expect(screen.queryByText(/Escribe para buscar/)).toBeNull();

    rerender(
      <SearchableSelect
        aria-label="Cliente"
        options={options}
        value=""
        onValueChange={onValueChange}
        onSearchChange={() => {}}
        footerHint="Escribe para buscar entre los 1,000 clientes"
      />,
    );
    expect(screen.queryByText('Buscando…')).toBeNull();
    expect(screen.getByText('Escribe para buscar entre los 1,000 clientes')).toBeInTheDocument();
  });
});
