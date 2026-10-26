export type CollapsedActivityItem<T> = { entry: T; title: string; count: number };

/**
 * The desktop Actividad cards (ticket and presupuesto): consecutive events that
 * read the same, by the same person, become one row («Servicios editados ×2»)
 * with the latest one's time. Entries come newest first.
 */
export const collapseActivity = <T extends { actorName: string | null }>(
  entries: ReadonlyArray<T>,
  titleOf: (entry: T) => string,
): CollapsedActivityItem<T>[] => {
  const items: CollapsedActivityItem<T>[] = [];
  for (const entry of entries) {
    const title = titleOf(entry);
    const last = items[items.length - 1];
    if (last && last.title === title && last.entry.actorName === entry.actorName) {
      last.count += 1;
    } else {
      items.push({ entry, title, count: 1 });
    }
  }
  return items;
};
