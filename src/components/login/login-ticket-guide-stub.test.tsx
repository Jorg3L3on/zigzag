/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { LoginTicketGuideStub } from '@/components/login/login-ticket-guide-stub';
import { HELP_CENTER_LINK } from '@/lib/onboarding-guides';

describe('LoginTicketGuideStub', () => {
  it('is collapsed by default and expands to show the help centre only', () => {
    render(<LoginTicketGuideStub onOpenGuide={jest.fn()} />);

    const trigger = screen.getByRole('button', {
      name: /primera vez en zigzag/i,
    });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const region = screen.getByRole('region', { name: 'Guías de inicio' });
    const options = region.querySelectorAll('button');
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent(HELP_CENTER_LINK.label);
    expect(screen.queryByText(/Resumen ejecutivo/)).not.toBeInTheDocument();
  });

  it('opens /ayuda via the injected opener and collapses on Escape', () => {
    const onOpenGuide = jest.fn();
    render(<LoginTicketGuideStub onOpenGuide={onOpenGuide} />);

    const trigger = screen.getByRole('button', {
      name: /primera vez en zigzag/i,
    });
    fireEvent.click(trigger);

    fireEvent.click(
      screen.getByRole('button', { name: new RegExp(HELP_CENTER_LINK.label) }),
    );
    expect(onOpenGuide).toHaveBeenCalledWith('/ayuda');

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });
});
