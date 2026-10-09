import { useId } from 'react';

import {
  ZIGZAG_GRADIENT_FROM,
  ZIGZAG_GRADIENT_TO,
  ZIGZAG_ICON_INSET_TRANSFORM,
  ZIGZAG_ICON_RADIUS,
  ZIGZAG_RECEIPT_PATH,
  ZIGZAG_Z_PATH,
  type ZigZagMarkVariant,
} from '@/components/brand/zigzag-mark-svg';

type ZigZagMarkProps = {
  /** Rendered width and height in px. */
  size?: number;
  variant?: ZigZagMarkVariant;
  /** Accessible name; omit when the mark sits next to the visible "ZigZag" text. */
  title?: string;
  className?: string;
};

/**
 * ZigZag brand mark as inline SVG: no network request (works on /offline) and
 * unique gradient/mask ids so several marks can share a page.
 */
export const ZigZagMark = ({
  size = 32,
  variant = 'rounded',
  title,
  className,
}: ZigZagMarkProps) => {
  const id = useId().replace(/:/g, '');
  const gradientId = `zigzag-g-${id}`;
  const maskId = `zigzag-m-${id}`;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
      data-testid="zigzag-mark"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={ZIGZAG_GRADIENT_FROM} />
          <stop offset="1" stopColor={ZIGZAG_GRADIENT_TO} />
        </linearGradient>
        <mask
          id={maskId}
          maskUnits="userSpaceOnUse"
          x="0"
          y="0"
          width="100"
          height="100"
        >
          <path
            d={ZIGZAG_RECEIPT_PATH}
            fill="#fff"
            stroke="#fff"
            strokeWidth="4"
            strokeLinejoin="round"
          />
          <path
            d={ZIGZAG_Z_PATH}
            fill="none"
            stroke="#000"
            strokeWidth="8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </mask>
      </defs>
      {variant === 'mark' ? (
        <rect
          width="100"
          height="100"
          fill={`url(#${gradientId})`}
          mask={`url(#${maskId})`}
        />
      ) : (
        <>
          <rect
            width="100"
            height="100"
            rx={variant === 'rounded' ? ZIGZAG_ICON_RADIUS : undefined}
            fill={`url(#${gradientId})`}
          />
          <g transform={ZIGZAG_ICON_INSET_TRANSFORM}>
            <rect
              width="100"
              height="100"
              fill="#fff"
              mask={`url(#${maskId})`}
            />
          </g>
        </>
      )}
    </svg>
  );
};
