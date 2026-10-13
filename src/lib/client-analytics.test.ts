import { PWA_INSTALL_EVENTS, trackClientEvent } from '@/lib/client-analytics';

jest.mock('posthog-js', () => {
  throw new Error('posthog-js must not load without NEXT_PUBLIC_POSTHOG_KEY');
});

describe('client analytics (ZIG-I21-4)', () => {
  it('uses fixed PWA install event names', () => {
    expect(PWA_INSTALL_EVENTS).toEqual({
      prompt: 'pwa_install_prompt',
      accepted: 'pwa_install_accepted',
      dismissed: 'pwa_install_dismissed',
      installed: 'pwa_installed',
    });
  });

  it('does nothing without PostHog configured', () => {
    expect(() => trackClientEvent(PWA_INSTALL_EVENTS.prompt, { surface: 'account' })).not.toThrow();
  });
});
