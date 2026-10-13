/**
 * @jest-environment node
 */
import {
  buildNotificationDisplay,
  MAX_PUSH_ACTIONS,
  OVERDUE_VIBRATE_PATTERN,
  PUSH_BADGE_URL,
  resolveNotificationClickUrl,
  withNotificationParam,
  type PushPayload,
} from '@/lib/push/display';

const base: PushPayload = {
  title: 'Servicio atrasado',
  body: 'Mantenimiento para Cliente A',
  url: '/tickets/create?clientId=7&serviceId=9&notification=1',
  tag: 'zigzag-schedule-5',
  type: 'schedule_overdue',
  notificationId: 1,
  actions: [],
};

describe('push notification display (ZIG-I21)', () => {
  it('uses the monochrome badge for every notification', () => {
    expect(buildNotificationDisplay(base).options.badge).toBe(PUSH_BADGE_URL);
    expect(buildNotificationDisplay({}).options.badge).toBe(PUSH_BADGE_URL);
    expect(PUSH_BADGE_URL).toBe('/icons/badge-96.png');
  });

  it('overdue services vibrate and re-alert when they replace the same tag', () => {
    const { options } = buildNotificationDisplay(base);
    expect(options.vibrate).toEqual(OVERDUE_VIBRATE_PATTERN);
    expect(options.renotify).toBe(true);
    expect(options.tag).toBe('zigzag-schedule-5');
  });

  it.each(['schedule_due_soon', 'schedule_daily_digest', 'export_ready'])(
    '%s arrives quietly (no vibration, no re-alert)',
    (type) => {
      const { options } = buildNotificationDisplay({ ...base, type });
      expect(options).not.toHaveProperty('vibrate');
      expect(options).not.toHaveProperty('renotify');
    },
  );

  it('never sets renotify without a tag (Chrome rejects that)', () => {
    const { options } = buildNotificationDisplay({ ...base, tag: '' });
    expect(options).not.toHaveProperty('renotify');
  });

  it('falls back to a ZigZag title and the dashboard', () => {
    const { title, options } = buildNotificationDisplay({});
    expect(title).toBe('ZigZag');
    expect(options.data).toEqual({ url: '/dashboard', actions: {}, notificationId: null });
    expect(options).not.toHaveProperty('actions');
  });

  it('shows at most two action buttons and keeps their URLs in data', () => {
    const { options } = buildNotificationDisplay({
      ...base,
      actions: [
        { action: 'crear', title: 'Crear ticket', url: '/tickets/create?x=1' },
        { action: 'ver', title: 'Ver', url: '/service-schedules?filter=atrasados' },
        { action: 'descargar', title: 'Descargar', url: 'https://blob/x.json' },
      ],
    });
    expect(options.actions).toEqual([
      { action: 'crear', title: 'Crear ticket' },
      { action: 'ver', title: 'Ver' },
    ]);
    expect(options.actions).toHaveLength(MAX_PUSH_ACTIONS);
    expect((options.data as { actions: Record<string, string> }).actions).toEqual({
      crear: '/tickets/create?x=1',
      ver: '/service-schedules?filter=atrasados',
    });
  });

  it('a tap opens the payload URL and an action opens its own URL', () => {
    const data = {
      url: '/tickets/create?clientId=7',
      actions: { ver: '/service-schedules?filter=atrasados' },
      notificationId: 1,
    };
    expect(resolveNotificationClickUrl(data, '')).toBe('/tickets/create?clientId=7');
    expect(resolveNotificationClickUrl(data, 'ver')).toBe('/service-schedules?filter=atrasados');
    expect(resolveNotificationClickUrl(data, 'unknown')).toBe('/tickets/create?clientId=7');
    expect(resolveNotificationClickUrl(undefined, '')).toBe('/dashboard');
  });

  it('adds the notification id to in-app paths only', () => {
    expect(withNotificationParam('/company', 4)).toBe('/company?notification=4');
    expect(withNotificationParam('/tickets/create?clientId=7', 4)).toBe(
      '/tickets/create?clientId=7&notification=4',
    );
    expect(withNotificationParam('/tickets/9#pagos', 4)).toBe('/tickets/9?notification=4#pagos');
    expect(withNotificationParam('https://blob/x.json', 4)).toBe('https://blob/x.json');
  });
});
