import type { KeyboardEventHandler, MouseEventHandler, ReactNode } from 'react';
import { buildTelHref } from '@/lib/phone-links';

type ClientPhoneLinkProps = {
  phone: string | null | undefined;
  fallback?: ReactNode;
  className?: string;
  textClassName?: string;
  children?: ReactNode;
  onClick?: MouseEventHandler;
  onKeyDown?: KeyboardEventHandler;
};

export const ClientPhoneLink = ({
  phone,
  fallback = '—',
  className,
  textClassName,
  children,
  onClick,
  onKeyDown,
}: ClientPhoneLinkProps) => {
  const displayPhone = phone?.trim();
  const href = buildTelHref(displayPhone);
  const content = children ?? displayPhone ?? fallback;

  if (!displayPhone || !href) {
    return (
      <span
        className={textClassName ?? className}
        onClick={onClick}
        onKeyDown={onKeyDown}
      >
        {content}
      </span>
    );
  }

  return (
    <a
      href={href}
      className={className}
      aria-label={`Llamar a ${displayPhone}`}
      onClick={onClick}
      onKeyDown={onKeyDown}
    >
      {content}
    </a>
  );
};
