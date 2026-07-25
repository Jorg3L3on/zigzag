'use client';

import { useEffect } from 'react';
import { useTheme } from 'next-themes';

/** Matches `:root` / `.dark` --background for browser chrome / PWA. */
const LIGHT_THEME_COLOR = '#ffffff';
const DARK_THEME_COLOR = '#020817';

/**
 * Keeps `<meta name="theme-color">` in sync with next-themes.
 * Static viewport.themeColor in root layout is the light-mode default.
 */
export const ThemeColorMeta = () => {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const color =
      resolvedTheme === 'dark' ? DARK_THEME_COLOR : LIGHT_THEME_COLOR;
    const metas = document.querySelectorAll('meta[name="theme-color"]');
    if (metas.length === 0) {
      const meta = document.createElement('meta');
      meta.name = 'theme-color';
      meta.content = color;
      document.head.appendChild(meta);
      return;
    }
    metas.forEach((meta) => {
      meta.setAttribute('content', color);
    });
  }, [resolvedTheme]);

  return null;
};
