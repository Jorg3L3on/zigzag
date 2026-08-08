'use client';

import type { ReactNode } from 'react';
import { ModeToggle } from '@/components/mode-toggle';
import {
  loginDisplay,
  loginMono,
  loginSans,
} from '@/components/login/login-fonts';
import { cn } from '@/lib/utils';

type LoginStageProps = {
  children: ReactNode;
  className?: string;
};

/**
 * Public login atmosphere from the ticket redesign prototype:
 * ambient blobs, grain, fixed theme toggle, centered stage.
 */
export const LoginStage = ({ children, className }: LoginStageProps) => {
  return (
    <div
      className={cn(
        'login-surface relative flex min-h-svh flex-col items-center justify-center overflow-x-hidden px-5 py-12',
        loginDisplay.variable,
        loginSans.variable,
        loginMono.variable,
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div
          className="login-ambient-blob"
          style={{
            width: 420,
            height: 420,
            background: 'var(--login-accent-blue)',
            top: -140,
            left: -120,
          }}
        />
        <div
          className="login-ambient-blob login-ambient-blob-b"
          style={{
            width: 380,
            height: 380,
            background: 'var(--login-accent-teal)',
            bottom: -160,
            right: -100,
          }}
        />
      </div>
      <div className="login-grain absolute inset-0 z-[1]" aria-hidden />

      <ModeToggle
        className="fixed top-6 right-6 z-10 h-10 w-10 rounded-full border border-[color:var(--login-line)] bg-[color:var(--login-field-bg)] text-[color:var(--login-ink-muted)] hover:border-[color:var(--login-line-strong)] hover:bg-[color:var(--login-field-bg)] hover:text-[color:var(--login-ink)] focus-visible:ring-[color:var(--login-accent-blue)]"
      />

      <div className="relative z-[2] flex w-full max-w-[420px] flex-col items-center gap-[18px]">
        {children}
        <p
          className="flex items-center gap-1.5 font-[family-name:var(--font-login-mono)] text-[11px] tracking-[0.04em] text-[color:var(--login-ink-faint)]"
        >
          Powered by{' '}
          <strong className="font-semibold text-[color:var(--login-ink-muted)]">
            ZigZag
          </strong>
        </p>
      </div>
    </div>
  );
};
