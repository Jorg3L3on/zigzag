/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DocumentLinesDensitySwitch } from '@/components/documents/document-lines-density-switch';
import { DOCUMENT_LINES_DENSITY_KEY } from '@/lib/document-lines-density';

describe('DocumentLinesDensitySwitch (ZIG-I28-1)', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('lists Compacto first, starts on it and stores Detallado for the next visit', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<DocumentLinesDensitySwitch />);
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Compacto', 'Detallado']);
    const detailed = screen.getByRole('button', { name: 'Detallado' });
    const compact = screen.getByRole('button', { name: 'Compacto' });
    expect(compact).toHaveAttribute('aria-pressed', 'true');
    expect(detailed).toHaveAttribute('aria-pressed', 'false');

    await user.click(detailed);
    expect(detailed).toHaveAttribute('aria-pressed', 'true');
    expect(compact).toHaveAttribute('aria-pressed', 'false');
    expect(window.localStorage.getItem(DOCUMENT_LINES_DENSITY_KEY)).toBe('detailed');

    unmount();
    render(<DocumentLinesDensitySwitch />);
    expect(screen.getByRole('button', { name: 'Detallado' })).toHaveAttribute('aria-pressed', 'true');
  });
});
