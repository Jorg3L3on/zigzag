import { render, screen } from '@testing-library/react';

import { ListStatusPill, type ListStatusTone } from '@/components/list-page/list-status-pill';

const TONES: ListStatusTone[] = ['emerald', 'amber', 'red', 'slate', 'blue', 'violet'];

describe('ListStatusPill', () => {
  it.each(TONES)('tints %s at /15 with a readable text in both themes', (tone) => {
    render(<ListStatusPill tone={tone}>Estado</ListStatusPill>);
    const pill = screen.getByText('Estado');
    expect(pill).toHaveAttribute('data-tone', tone);
    expect(pill.className).toContain(`bg-${tone}-500/15`);
    expect(pill.className).toContain(`text-${tone}-700`);
    expect(pill.className).toContain(`dark:text-${tone}-300`);
    expect(pill.className).toContain('rounded-full');
    expect(pill.className).toContain('text-caption');
  });
});
