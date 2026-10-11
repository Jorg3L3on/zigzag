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
});
