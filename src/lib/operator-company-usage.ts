/**
 * Usage of a company for the console's Resumen (ZIG-I38-4): the last 7 days
 * against the 7 before. Pure helpers; the queries live in the action.
 */
export type OperatorCompanyPerson = {
  id: string;
  name: string;
  email: string;
  roleName: string | null;
  createdAt: string;
  lastSignedInAt: string | null;
};

export type OperatorCompanyUsage = {
  people: OperatorCompanyPerson[];
  lastSignIn: { at: string; name: string } | null;
  activePeople: number;
  ticketsCreated: { current: number; previous: number };
  paymentsRecorded: { current: number; previous: number };
};

export const USAGE_WINDOW_DAYS = 7;

/** «3 más que la semana anterior», «Igual que la semana anterior»… */
export const describeWeekDelta = (current: number, previous: number): string => {
  const diff = current - previous;
  if (diff === 0) return 'Igual que la semana anterior';
  const abs = Math.abs(diff);
  return `${abs} ${diff > 0 ? 'más' : 'menos'} que la semana anterior`;
};

export const weekDeltaTone = (current: number, previous: number): 'up' | 'down' | 'flat' =>
  current > previous ? 'up' : current < previous ? 'down' : 'flat';

/** Sort people by last sign-in (newest first, never last), then by name. */
export const sortPeopleBySignIn = (
  people: OperatorCompanyPerson[],
): OperatorCompanyPerson[] =>
  [...people].sort((a, b) => {
    if (a.lastSignedInAt && b.lastSignedInAt) {
      const byDate = b.lastSignedInAt.localeCompare(a.lastSignedInAt);
      if (byDate !== 0) return byDate;
    } else if (a.lastSignedInAt) {
      return -1;
    } else if (b.lastSignedInAt) {
      return 1;
    }
    return a.name.localeCompare(b.name, 'es');
  });
