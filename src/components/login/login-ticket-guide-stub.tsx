'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { BookOpen } from 'lucide-react';
import {
  openOnboardingGuide,
  PUBLIC_ONBOARDING_GUIDE_LINKS,
  type OnboardingGuideLink,
} from '@/lib/onboarding-guides';
import { cn } from '@/lib/utils';

type LoginTicketGuideStubProps = {
  className?: string;
  guides?: OnboardingGuideLink[];
  onOpenGuide?: (href: string) => void;
};

/**
 * Perforated lower ticket stub for public onboarding guides.
 * Collapsed by default; unfolds via tear affordance (HTML prototype + PRD).
 */
export const LoginTicketGuideStub = ({
  className,
  guides = PUBLIC_ONBOARDING_GUIDE_LINKS,
  onOpenGuide = openOnboardingGuide,
}: LoginTicketGuideStubProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const panelId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isExpanded) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setIsExpanded(false);
        triggerRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isExpanded]);

  useEffect(() => {
    if (isExpanded) {
      panelRef.current?.querySelector<HTMLElement>('button')?.focus();
    }
  }, [isExpanded]);

  const handleToggle = () => {
    setIsExpanded((prev) => !prev);
  };

  return (
    <div className={cn(className)}>
      <div className="login-perforation">
        <span className="login-perforation-hole left-[-6px]" aria-hidden />
        <span className="login-perforation-hole right-[-6px]" aria-hidden />
      </div>

      <div className="login-ticket-section">
        <button
          ref={triggerRef}
          type="button"
          className="mb-1 w-full rounded-md py-2 text-left font-[family-name:var(--font-login-mono)] text-[10.5px] tracking-[0.08em] text-[color:var(--login-ink-faint)] uppercase transition-colors hover:text-[color:var(--login-ink-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--login-accent-blue)]"
          aria-expanded={isExpanded}
          aria-controls={panelId}
          onClick={handleToggle}
        >
          ¿Primera vez en ZigZag? Elige tu guía
          <span className="ml-2 normal-case tracking-normal" aria-hidden>
            {isExpanded ? '▴' : '▾'}
          </span>
        </button>

        <div
          id={panelId}
          ref={panelRef}
          role="region"
          aria-label="Guías de inicio"
          hidden={!isExpanded}
          className={cn(
            'overflow-hidden transition-[max-height,opacity] duration-300 ease-out',
            isExpanded ? 'max-h-[480px] opacity-100' : 'max-h-0 opacity-0',
          )}
        >
          <ul className="grid gap-1.5 pt-2">
            {guides.map((guide) => (
              <li key={guide.href}>
                <button
                  type="button"
                  onClick={() => onOpenGuide(guide.href)}
                  className="group flex w-full items-start gap-3 rounded-[10px] px-2.5 py-3 text-left transition-colors hover:bg-[color:var(--login-field-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--login-accent-blue)]"
                >
                  <span
                    className="login-guide-icon mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg text-white"
                    aria-hidden
                  >
                    <BookOpen className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="mb-0.5 block text-sm font-semibold text-[color:var(--login-ink)]">
                      {guide.label}
                    </span>
                    {guide.audienceLabel ? (
                      <span className="login-guide-link-text mb-0.5 block text-[12.5px] font-medium">
                        {guide.audienceLabel}
                      </span>
                    ) : null}
                    <span className="block text-[12.5px] leading-normal text-[color:var(--login-ink-muted)]">
                      {guide.description}
                    </span>
                  </span>
                  <span
                    className="mt-1.5 shrink-0 text-[15px] text-[color:var(--login-ink-faint)] transition-transform group-hover:translate-x-0.5 group-hover:text-[color:var(--login-ink)]"
                    aria-hidden
                  >
                    →
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};
