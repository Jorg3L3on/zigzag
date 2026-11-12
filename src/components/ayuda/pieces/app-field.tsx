import type { ReactNode } from 'react';
import { APP_MUTED, TOUCH_RING_SM } from '@/components/ayuda/pieces/app-look';

/** A labelled app input as the forms draw it (label above, 44px box). */
export const AppField = ({
  label,
  value,
  placeholder,
  ringed = false,
}: {
  label: string;
  value?: string;
  placeholder?: string;
  ringed?: boolean;
}) => (
  <span className="flex flex-col gap-1.5">
    <span className="font-medium">{label}</span>
    <span
      className={`flex min-h-11 items-center rounded-[10px] border border-[#CBD5E1] bg-white px-3 [overflow-wrap:anywhere] ${
        value ? '' : APP_MUTED
      } ${ringed ? TOUCH_RING_SM : ''}`}
    >
      {value || placeholder}
    </span>
  </span>
);

/** App primary (blue) or outline button. */
export const AppButton = ({
  children,
  primary = false,
  ringed = false,
  className = '',
}: {
  children: ReactNode;
  primary?: boolean;
  ringed?: boolean;
  className?: string;
}) => (
  <span
    className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[10px] px-4 font-semibold ${
      primary ? 'bg-[#2563EB] text-white' : 'border border-[#CBD5E1] bg-white text-[#0B1220]'
    } ${ringed ? TOUCH_RING_SM : ''} ${className}`}
  >
    {children}
  </span>
);
