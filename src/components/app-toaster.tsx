'use client';

import { Toaster, toast } from 'sonner';
import { splitErrorCode } from '@/lib/error-code-display';
import { useTheme } from 'next-themes';
import { useIsMobile } from '@/hooks/use-mobile';

/**
 * Error toasts keep the support code off the sentence (ZIG-I18-3): the message
 * is the title, "Código: XX000" the description underneath. Patched once here
 * so the ~50 call sites keep passing a single string.
 */
const patchToastErrorCodes = () => {
  const target = toast as unknown as Record<string, unknown> & {
    __codeSplit?: boolean;
  };
  if (target.__codeSplit) return;
  target.__codeSplit = true;
  for (const kind of ['error', 'warning'] as const) {
    const original = target[kind] as (message: unknown, data?: Record<string, unknown>) => unknown;
    target[kind] = (message: unknown, data?: Record<string, unknown>) => {
      if (typeof message === 'string' && !data?.description) {
        const { message: text, code } = splitErrorCode(message);
        if (code) return original(text, { ...data, description: `Código: ${code}` });
      }
      return original(message, data);
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
