/**
 * Security alert rule for the operator console (ZIG-I38, Jorge 2026-11-11):
 * an alert is a burst of failed sign-ins (5 or more for one account within 15
 * minutes) or a permission denied, in the last 7 days. A single failed
 * password is not an alert.
 */
export const SIGN_IN_BURST_THRESHOLD = 5;
export const SIGN_IN_BURST_WINDOW_MINUTES = 15;
export const OPERATOR_ALERT_LOOKBACK_DAYS = 7;

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

export type FailedSignInLike = {
  account: string;
  occurredAt: Date;
};

export type SignInBurst = {
  account: string;
  /** When the burst reached the threshold (latest qualifying failure). */
  at: Date;
  /** Failures inside the 15-minute window ending at `at`. */
  count: number;
};

/**
 * Pure mirror of the SQL in the fleet loader: for each account, slide a
 * 15-minute window over its failures and report the latest moment the window
 * held 5 or more. Returns the most recent burst across accounts.
 */
export const detectSignInBurst = (
  failures: FailedSignInLike[],
  options: { threshold?: number; windowMinutes?: number } = {},
): SignInBurst | null => {
  const threshold = options.threshold ?? SIGN_IN_BURST_THRESHOLD;
  const windowMs =
    (options.windowMinutes ?? SIGN_IN_BURST_WINDOW_MINUTES) * MINUTE_MS;

  const byAccount = new Map<string, number[]>();
  for (const failure of failures) {
    const time = failure.occurredAt.getTime();
    if (!Number.isFinite(time)) {
      continue;
    }
    const list = byAccount.get(failure.account) ?? [];
    list.push(time);
    byAccount.set(failure.account, list);
  }

  let best: SignInBurst | null = null;
  for (const [account, times] of byAccount) {
    times.sort((a, b) => a - b);
    let start = 0;
    for (let end = 0; end < times.length; end += 1) {
      while (times[end] - times[start] > windowMs) {
        start += 1;
      }
      const count = end - start + 1;
      if (count >= threshold && (!best || times[end] >= best.at.getTime())) {
        best = { account, at: new Date(times[end]), count };
      }
    }
  }
  return best;
};

export type OperatorSecurityAlert =
  | {
      kind: 'sign_in_burst';
      at: string;
      account: string;
      count: number;
      label: string;
    }
  | {
      kind: 'permission_denied';
      at: string;
      account: string | null;
      count: number;
      label: string;
    };

export const buildOperatorSecurityAlert = (input: {
  burst: SignInBurst | null;
  permissionDenied: { at: Date; account: string | null; count: number } | null;
  now?: Date;
  lookbackDays?: number;
}): OperatorSecurityAlert | null => {
  const now = input.now ?? new Date();
  const cutoff =
    now.getTime() - (input.lookbackDays ?? OPERATOR_ALERT_LOOKBACK_DAYS) * DAY_MS;

  const burst =
    input.burst && input.burst.at.getTime() >= cutoff ? input.burst : null;
  const denied =
    input.permissionDenied && input.permissionDenied.at.getTime() >= cutoff
      ? input.permissionDenied
      : null;

  if (burst && (!denied || burst.at >= denied.at)) {
    return {
      kind: 'sign_in_burst',
      at: burst.at.toISOString(),
      account: burst.account,
      count: burst.count,
      label: `${burst.count} inicios fallidos en ${SIGN_IN_BURST_WINDOW_MINUTES} min`,
    };
  }
  if (denied) {
    return {
      kind: 'permission_denied',
      at: denied.at.toISOString(),
      account: denied.account,
      count: denied.count,
      label:
        denied.count > 1
          ? `${denied.count} permisos denegados`
          : 'Permiso denegado',
    };
  }
  return null;
};
