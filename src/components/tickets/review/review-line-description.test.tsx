/**
 * @jest-environment jsdom
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  ReviewLinesSection,
  type ReviewLine,
} from '@/components/tickets/review/document-review-parts';

const baseLine: ReviewLine = {
  id: 1,
  serviceId: null,
  name: 'Servicio',
  quantity: 1,
  price: 100,
};

describe('ReviewLineDescription (ZIG-I12)', () => {
  it('shows a short description in full and folds a long one behind Ver más', async () => {
    const user = userEvent.setup();
    render(
      <ReviewLinesSection
        linesLabel="Servicios"
        total={1}
        lines={[
          { ...baseLine, id: 1, name: 'Corta', description: 'Con nitrógeno' },
          { ...baseLine, id: 2, name: 'Larga', description: 'd'.repeat(300) },
        ]}
      />,
    );

    const [short, long] = screen.getAllByTestId('review-line-description');
    expect(within(short).queryByRole('button')).toBeNull();
    expect(within(short).getByText('Con nitrógeno').className).not.toContain('line-clamp-3');

    const more = within(long).getByRole('button', { name: 'Ver más' });
    expect(within(long).getByText('d'.repeat(300)).className).toContain('line-clamp-3');
    await user.click(more);
    expect(within(long).getByRole('button', { name: 'Ver menos' })).toBeTruthy();
    expect(within(long).getByText('d'.repeat(300)).className).not.toContain('line-clamp-3');
  });
});
