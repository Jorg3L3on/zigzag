/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { LoginTicketGuideStub } from '@/components/login/login-ticket-guide-stub';
import {
  EMPRESA_GUIDE_LINK,
  EXECUTIVE_SUMMARY_LINK,
  PUBLIC_ONBOARDING_GUIDE_LINKS,
} from '@/lib/onboarding-guides';

describe('LoginTicketGuideStub', () => {
  it('is collapsed by default and expands to show public guides only', () => {
    const onOpenGuide = jest.fn();
    render(
      <LoginTicketGuideStub
        guides={PUBLIC_ONBOARDING_GUIDE_LINKS}
        onOpenGuide={onOpenGuide}
      />,
    );

    const trigger = screen.getByRole('button', {
      name: /primera vez en zigzag/i,
    });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(
      screen.queryByRole('button', { name: EXECUTIVE_SUMMARY_LINK.label }),
    ).not.toBeInTheDocument();

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(
      screen.getByRole('button', { name: new RegExp(EXECUTIVE_SUMMARY_LINK.label) }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: new RegExp(EMPRESA_GUIDE_LINK.label) }),
    ).toBeInTheDocument();
  });

  it('opens a guide via the injected opener and collapses on Escape', () => {
    const onOpenGuide = jest.fn();
    render(
      <LoginTicketGuideStub
        guides={PUBLIC_ONBOARDING_GUIDE_LINKS}
        onOpenGuide={onOpenGuide}
      />,
    );

    const trigger = screen.getByRole('button', {
      name: /primera vez en zigzag/i,
    });
    fireEvent.click(trigger);

    fireEvent.click(
      screen.getByRole('button', {
        name: new RegExp(EXECUTIVE_SUMMARY_LINK.label),
      }),
    );
    expect(onOpenGuide).toHaveBeenCalledWith(EXECUTIVE_SUMMARY_LINK.href);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });
});
