/**
 * @jest-environment jsdom
 */
import { act, fireEvent, render, screen } from '@testing-library/react';

import {
  THEME_VT_ATTRIBUTE,
  THEME_VT_ORIGIN_PROPERTY,
  ThemeHotkey,
  ThemeToggle,
  runThemeTransition,
} from '@/components/theme-toggle';

let mockResolvedTheme = 'light';
const mockSetTheme = jest.fn((theme: string) => {
  mockResolvedTheme = theme;
});

jest.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme: mockResolvedTheme, setTheme: mockSetTheme }),
}));

type VtDocument = Document & {
  startViewTransition?: (update: () => void) => { finished: Promise<void> };
};

const root = () => document.documentElement;

const setReducedMotion = (reduce: boolean) => {
  window.matchMedia = jest.fn().mockImplementation((query: string) => ({
    matches: reduce && query.includes('reduce'),
    media: query,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    addListener: jest.fn(),
    removeListener: jest.fn(),
  }));
};

/** Fake View Transitions: runs the update, then resolves `finished` on demand. */
const installViewTransitions = () => {
  let finish: () => void = () => undefined;
  let fail: (error: Error) => void = () => undefined;
  const startViewTransition = jest.fn((update: () => void) => {
    const attributeDuringUpdate = root().getAttribute(THEME_VT_ATTRIBUTE);
    const originDuringUpdate = root().style.getPropertyValue(THEME_VT_ORIGIN_PROPERTY);
    update();
    return {
      finished: new Promise<void>((resolve, reject) => {
        finish = resolve;
        fail = reject;
      }),
      attributeDuringUpdate,
      originDuringUpdate,
    };
  });
  (document as VtDocument).startViewTransition = startViewTransition;
  return {
    startViewTransition,
    finish: () => finish(),
    fail: (error: Error) => fail(error),
  };
};

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('runThemeTransition', () => {
  beforeEach(() => {
    mockSetTheme.mockClear();
    mockResolvedTheme = 'light';
    setReducedMotion(false);
    root().className = '';
    root().removeAttribute(THEME_VT_ATTRIBUTE);
    root().style.removeProperty(THEME_VT_ORIGIN_PROPERTY);
    delete (document as VtDocument).startViewTransition;
  });

  it('switches instantly when View Transitions are unsupported', () => {
    runThemeTransition({ next: 'dark', setTheme: mockSetTheme });

    expect(mockSetTheme).toHaveBeenCalledWith('dark');
    expect(root().hasAttribute(THEME_VT_ATTRIBUTE)).toBe(false);
  });

  it('switches instantly with reduced motion even when supported', () => {
    const vt = installViewTransitions();
    setReducedMotion(true);

    runThemeTransition({ next: 'dark', setTheme: mockSetTheme });

    expect(vt.startViewTransition).not.toHaveBeenCalled();
    expect(mockSetTheme).toHaveBeenCalledWith('dark');
    expect(root().hasAttribute(THEME_VT_ATTRIBUTE)).toBe(false);
  });

  it('reveals from the origin and cleans up once the transition finishes', async () => {
    const vt = installViewTransitions();

    runThemeTransition({
      next: 'dark',
      setTheme: mockSetTheme,
      origin: { x: 40, y: 600 },
      variant: 'circle',
    });

    const result = vt.startViewTransition.mock.results[0]?.value;
    expect(result.attributeDuringUpdate).toBe('circle');
    expect(result.originDuringUpdate).toBe('40px 600px');
    expect(root().classList.contains('dark')).toBe(true);
    expect(mockSetTheme).toHaveBeenCalledWith('dark');
    expect(root().getAttribute(THEME_VT_ATTRIBUTE)).toBe('circle');

    vt.finish();
    await flushPromises();

    expect(root().hasAttribute(THEME_VT_ATTRIBUTE)).toBe(false);
    expect(root().style.getPropertyValue(THEME_VT_ORIGIN_PROPERTY)).toBe('');
  });

  it('cleans up when the transition is skipped or rejected', async () => {
    const vt = installViewTransitions();

    runThemeTransition({ next: 'light', setTheme: mockSetTheme });
    vt.fail(new Error('skipped'));
    await flushPromises();

    expect(mockSetTheme).toHaveBeenCalledWith('light');
    expect(root().hasAttribute(THEME_VT_ATTRIBUTE)).toBe(false);
    expect(root().style.getPropertyValue(THEME_VT_ORIGIN_PROPERTY)).toBe('');
  });

  it('falls back to an instant switch if startViewTransition throws', () => {
    (document as VtDocument).startViewTransition = () => {
      throw new Error('InvalidStateError');
    };

    runThemeTransition({ next: 'dark', setTheme: mockSetTheme });

    expect(mockSetTheme).toHaveBeenCalledWith('dark');
    expect(root().hasAttribute(THEME_VT_ATTRIBUTE)).toBe(false);
  });
});

describe('ThemeToggle', () => {
  beforeEach(() => {
    mockSetTheme.mockClear();
    mockResolvedTheme = 'light';
    setReducedMotion(true);
    delete (document as VtDocument).startViewTransition;
  });

  it('labels the action and toggles to dark', async () => {
    render(<ThemeToggle />);

    const button = await screen.findByRole('button', { name: 'Activar modo oscuro' });
    act(() => {
      fireEvent.click(button);
    });

    expect(mockSetTheme).toHaveBeenCalledWith('dark');
  });

  it('offers light mode when dark is active', async () => {
    mockResolvedTheme = 'dark';
    render(<ThemeToggle />);

    expect(
      await screen.findByRole('button', { name: 'Activar modo claro' }),
    ).toBeInTheDocument();
  });
});

describe('ThemeHotkey', () => {
  beforeEach(() => {
    mockSetTheme.mockClear();
    mockResolvedTheme = 'light';
    setReducedMotion(true);
  });

  it('toggles on Cmd/Ctrl+Shift+D', () => {
    render(<ThemeHotkey />);

    fireEvent.keyDown(window, { key: 'D', ctrlKey: true, shiftKey: true });

    expect(mockSetTheme).toHaveBeenCalledWith('dark');
  });

  it('ignores keys typed into fields', () => {
    render(
      <>
        <ThemeHotkey />
        <input aria-label="campo" />
      </>,
    );

    fireEvent.keyDown(screen.getByLabelText('campo'), { key: 'd' });

    expect(mockSetTheme).not.toHaveBeenCalled();
  });
});
