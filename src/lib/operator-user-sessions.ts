export type OperatorUserSessionRow = {
  id: string;
  name: string;
  email: string;
  lastSignedInAt: Date | null;
};

export type OperatorUserSessionInput = {
  id: string | number | bigint;
  name: string;
  email: string;
  lastSignedInAt: Date | string | null;
};

const toDateOrNull = (value: Date | string | null): Date | null => {
  if (value == null) {
    return null;
  }
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
};

/**
 * Normalize and sort company users by most recent sign-in (nulls last).
 */
export const buildOperatorUserSessionRows = (
  rows: OperatorUserSessionInput[],
): OperatorUserSessionRow[] => {
  const mapped = rows.map((row) => ({
    id: String(row.id),
    name: row.name,
    email: row.email,
    lastSignedInAt: toDateOrNull(row.lastSignedInAt),
  }));

  mapped.sort((a, b) => {
    if (a.lastSignedInAt == null && b.lastSignedInAt == null) {
      return a.name.localeCompare(b.name, 'es');
    }
    if (a.lastSignedInAt == null) {
      return 1;
    }
    if (b.lastSignedInAt == null) {
      return -1;
    }
    const byDate = b.lastSignedInAt.getTime() - a.lastSignedInAt.getTime();
    if (byDate !== 0) {
      return byDate;
    }
    return a.name.localeCompare(b.name, 'es');
  });

  return mapped;
};
