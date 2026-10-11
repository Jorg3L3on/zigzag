/** Spanish time-of-day greeting for a local hour (0–23). */
export const getTimeOfDayGreeting = (hour: number): string => {
  if (hour < 12) {
    return 'Buenos días';
  }
  if (hour < 19) {
    return 'Buenas tardes';
  }
  return 'Buenas noches';
};

export const NEUTRAL_TIME_GREETING = 'Hola';

/** Cookie holding the browser's IANA time zone so the server can greet in local time. */
export const TIME_ZONE_COOKIE = 'zz_tz';

/**
 * Local hour (0–23) in an IANA time zone, or null when the zone is missing or
 * unknown. Lets the server render the final greeting instead of swapping it in
 * after hydration (the greeting is the dashboard's LCP element).
 */
export const getHourInTimeZone = (
  timeZone: string | null | undefined,
  now: Date = new Date(),
): number | null => {
  if (!timeZone) {
    return null;
  }
  try {
    const hour = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: 'numeric',
      hourCycle: 'h23',
    }).format(now);
    const parsed = Number.parseInt(hour, 10);
    return Number.isNaN(parsed) ? null : parsed % 24;
  } catch {
    return null;
  }
};

/** Server greeting from the time zone cookie, or null to keep the client swap. */
export const getGreetingFromTimeZoneCookie = (
  cookieValue: string | null | undefined,
  now: Date = new Date(),
): string | null => {
  if (!cookieValue) {
    return null;
  }
  let timeZone: string;
  try {
    timeZone = decodeURIComponent(cookieValue);
  } catch {
    return null;
  }
  const hour = getHourInTimeZone(timeZone, now);
  return hour == null ? null : getTimeOfDayGreeting(hour);
};

/** Store the browser time zone for the next server render (client only). */
export const rememberBrowserTimeZone = (): void => {
  try {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!timeZone) {
      return;
    }
    document.cookie = `${TIME_ZONE_COOKIE}=${encodeURIComponent(timeZone)}; path=/; max-age=31536000; samesite=lax`;
  } catch {
    // Cookies disabled: the greeting falls back to the client-side swap.
  }
};
