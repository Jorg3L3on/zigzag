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

  it('starts on Detallado and stores Compacto for the next visit', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<DocumentLinesDensitySwitch />);
    const detailed = screen.getByRole('button', { name: 'Detallado' });
    const compact = screen.getByRole('button', { name: 'Compacto' });
    expect(detailed).toHaveAttribute('aria-pressed', 'true');
    expect(compact).toHaveAttribute('aria-pressed', 'false');

    await user.click(compact);
    expect(compact).toHaveAttribute('aria-pressed', 'true');
    expect(detailed).toHaveAttribute('aria-pressed', 'false');
    expect(window.localStorage.getItem(DOCUMENT_LINES_DENSITY_KEY)).toBe('compact');

    unmount();
    render(<DocumentLinesDensitySwitch />);
    expect(screen.getByRole('button', { name: 'Compacto' })).toHaveAttribute('aria-pressed', 'true');
  });
});
