/** Full page navigation (kept in one place so tests can replace it). */
export const navigateTo = (path: string): void => {
  window.location.assign(path);
};
