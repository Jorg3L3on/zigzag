import { vibrateSuccess } from '@/lib/vibrate-success';

describe('vibrateSuccess', () => {
  const originalNavigator = global.navigator;

  afterEach(() => {
    Object.defineProperty(global, 'navigator', {
      configurable: true,
      value: originalNavigator,
    });
  });

  it('does not throw when vibration is unavailable', () => {
    Object.defineProperty(global, 'navigator', {
      configurable: true,
      value: {},
    });

    expect(() => vibrateSuccess()).not.toThrow();
  });

  it('vibrates for a short success pulse when supported', () => {
    const vibrate = jest.fn();
    Object.defineProperty(global, 'navigator', {
      configurable: true,
      value: { vibrate },
    });

    vibrateSuccess();

    expect(vibrate).toHaveBeenCalledWith(10);
  });
});
