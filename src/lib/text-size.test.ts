/**
 * @jest-environment jsdom
 */
import {
  applyTextSize,
  readTextSize,
  saveTextSize,
  TEXT_SIZE_INIT_SCRIPT,
} from '@/lib/text-size';

describe('text size (ZIG-I18-15)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute('data-text-size');
  });

  it('defaults to normal and remembers large', () => {
    expect(readTextSize()).toBe('normal');
    saveTextSize('large');
    expect(readTextSize()).toBe('large');
    saveTextSize('normal');
    expect(readTextSize()).toBe('normal');
  });

  it('sets and clears the root attribute', () => {
    applyTextSize('large');
    expect(document.documentElement.getAttribute('data-text-size')).toBe('large');
    applyTextSize('normal');
    expect(document.documentElement.hasAttribute('data-text-size')).toBe(false);
  });

  it('survives blocked storage', () => {
    const spy = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readTextSize()).toBe('normal');
    spy.mockRestore();
  });

  it('the pre-paint script applies a stored large choice', () => {
    window.localStorage.setItem('zigzag:text-size', 'large');
    new Function(TEXT_SIZE_INIT_SCRIPT)();
    expect(document.documentElement.getAttribute('data-text-size')).toBe('large');
  });
});
