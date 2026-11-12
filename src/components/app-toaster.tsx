'use client';

import { Toaster, toast } from 'sonner';
import { splitErrorCode } from '@/lib/error-code-display';
import { logSupportCode } from '@/lib/support-code-log';
import { useTheme } from 'next-themes';
import { useIsMobile } from '@/hooks/use-mobile';

/**
 * Support codes stay out of error toasts (ZIG-24). Call sites may still pass
 * "Código: XX000" in the title or the description; it is logged and removed.
 */
const stripSupportCode = (
  value: unknown,
): { text: string; code: string | null } | null => {
  if (typeof value !== 'string') return null;
  const split = splitErrorCode(value);
  return { text: split.message, code: split.code };
};

const patchToastErrorCodes = () => {
  const target = toast as unknown as Record<string, unknown> & {
    __codeSplit?: boolean;
  };
  if (target.__codeSplit) return;
  target.__codeSplit = true;
  for (const kind of ['error', 'warning'] as const) {
    const original = target[kind] as (message: unknown, data?: Record<string, unknown>) => unknown;
    target[kind] = (message: unknown, data?: Record<string, unknown>) => {
      const title = stripSupportCode(message);
      const description = stripSupportCode(data?.description);
      const codes = [title?.code, description?.code].filter(
        (code): code is string => Boolean(code),
      );
      for (const code of new Set(codes)) {
        logSupportCode(code);
      }
      const nextMessage = title ? title.text : message;
      if (!description?.code) return original(nextMessage, data);
      const cleaned = description.text.trim();
      return original(nextMessage, { ...data, description: cleaned || undefined });
    };
  }
};
patchToastErrorCodes();

/**
 * Toast placement:
 * - Mobile (< md): top-center, offset below safe-area and offline banner (--network-status-banner-offset).
 * - Desktop (≥ md): bottom-center with safe-area bottom inset on narrow viewports (Sonner mobileOffset).
 */
export const AppToaster = () => {
  const isMobile = useIsMobile();
  const { resolvedTheme } = useTheme();

  return (
    <Toaster
      // Radix modals (sheets, dialogs) make the rest of the page inert, and the
      // toaster inherits that: without this a Deshacer inside an open sheet
      // cannot be tapped (ZIG-I13-2).
      style={{ pointerEvents: 'auto' }}
      theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
      position={isMobile ? 'top-center' : 'bottom-center'}
      offset={16}
      toastOptions={{ classNames: { description: '!text-sm' } }}
      mobileOffset={
        isMobile
          ? {
              top: 'max(1rem, calc(env(safe-area-inset-top, 0px) + var(--network-status-banner-offset, 0px)))',
            }
          : {
              bottom: 'max(1rem, env(safe-area-inset-bottom, 0px))',
            }
      }
    />
  );
};
