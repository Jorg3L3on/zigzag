/**
 * Client-safe actor display helpers (no DB imports).
 */
export const actorDisplayName = (
  actorUserId: string | null | undefined,
  actorName: string | null | undefined,
): string => {
  const name = actorName?.trim();
  if (name) {
    return name;
  }
  if (actorUserId) {
    return actorUserId;
  }
  return '—';
};
