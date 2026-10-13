'use client';

import * as React from 'react';
import { Moon, Sun } from 'lucide-react';
import { ActionSwap } from '@/components/motion';
import { Button } from '@/components/ui/button';
import {
  useThemeToggle,
  type ThemeRevealVariant,
} from '@/components/theme-transition';
import { cn } from '@/lib/utils';

export {
  runThemeTransition,
  THEME_VT_ATTRIBUTE,
  THEME_VT_ORIGIN_PROPERTY,
  useThemeToggle,
  type ThemeRevealVariant,
} from '@/components/theme-transition';
export { ThemeHotkey } from '@/components/theme-hotkey';

type ThemeToggleProps = {
  className?: string;
  variant?: ThemeRevealVariant;
};

export const ThemeToggle = ({
  className,
  variant = 'circle-blur',
}: ThemeToggleProps) => {
  const { isDark, mounted, toggle } = useThemeToggle(variant);

  // Same-size button before mount; the icon appears once the theme is known.
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn('shrink-0', className)}
      aria-label={
        mounted
          ? isDark
            ? 'Activar modo claro'
            : 'Activar modo oscuro'
          : 'Cambiar tema'
      }
      onClick={(event) => toggle(event.currentTarget)}
    >
      {mounted ? (
        <ActionSwap swapKey={isDark ? 'dark' : 'light'}>
          {isDark ? (
            <Moon className="h-4 w-4" aria-hidden />
          ) : (
            <Sun className="h-4 w-4" aria-hidden />
          )}
        </ActionSwap>
      ) : (
        <span className="h-4 w-4" aria-hidden />
      )}
    </Button>
  );
};
