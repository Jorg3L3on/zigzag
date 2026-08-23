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
