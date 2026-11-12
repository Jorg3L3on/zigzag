import { render, screen } from '@testing-library/react';
import { ButtonFilterGroup } from '@/components/list-page/button-filter-group';

describe('ButtonFilterGroup', () => {
  it('marks the chosen option pressed and tints it, never the solid primary (ZIG-I27-3)', () => {
    render(
      <ButtonFilterGroup
        label="Estado"
        layout="desktop"
        value="active"
        onChange={jest.fn()}
        options={[
          { value: 'all', label: 'Todos' },
          { value: 'active', label: 'Activos' },
        ]}
      />,
    );

    const chosen = screen.getByRole('button', { name: 'Activos' });
    const other = screen.getByRole('button', { name: 'Todos' });
    expect(chosen).toHaveAttribute('aria-pressed', 'true');
    expect(other).toHaveAttribute('aria-pressed', 'false');
    expect(chosen.className).toContain('bg-primary/10');
    expect(chosen.className).toContain('text-primary');
    expect(chosen.className).not.toMatch(/(^|\s)bg-primary(\s|$)/);
  });
});
