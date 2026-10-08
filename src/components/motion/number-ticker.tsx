'use client';

import * as React from 'react';
import { animate, useReducedMotion } from 'framer-motion';

import { cn } from '@/lib/utils';

const defaultFormat = (value: number) =>
  value.toLocaleString('es-MX', { maximumFractionDigits: 2 });

export type NumberTickerProps = {
  value: number;
  /** Formats every frame, e.g. money. Must be pure. */
  format?: (value: number) => string;
  /** Seconds a change takes to count. */
  duration?: number;
  /** Count up from this value on mount; omit to show `value` immediately (SSR-safe). */
  from?: number;
  className?: string;
  'data-testid'?: string;
};

/**
 * Animated number (magicui Number Ticker): counts from the previous value to the
 * new one whenever `value` changes. Tabular figures keep the width steady.
 * Reduced motion jumps straight to the new value.
 */
export const NumberTicker = ({
  value,
  format = defaultFormat,
  duration = 0.6,
  from,
  className,
  'data-testid': testId,
}: NumberTickerProps) => {
  const reduceMotion = useReducedMotion();
  const [display, setDisplay] = React.useState(from ?? value);
  const displayRef = React.useRef(display);

  React.useEffect(() => {
    if (reduceMotion || displayRef.current === value) {
      displayRef.current = value;
      setDisplay(value);
      return;
    }

    const controls = animate(displayRef.current, value, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (latest) => {
        displayRef.current = latest;
        setDisplay(latest);
      },
      onComplete: () => {
        displayRef.current = value;
        setDisplay(value);
      },
    });

    return () => controls.stop();
  }, [value, duration, reduceMotion]);

  return (
    <span
      data-testid={testId}
      data-value={value}
      className={cn('tabular-nums', className)}
    >
      {format(display)}
    </span>
  );
};
