/** Fired after the local queue changes (a save offline, a flush), so lists reload (ZIG-I35). */
export const FIELD_JOBS_CHANGED_EVENT = 'zigzag:field-jobs-changed';

export const notifyFieldJobsChanged = (): void => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(FIELD_JOBS_CHANGED_EVENT));
  }
};
