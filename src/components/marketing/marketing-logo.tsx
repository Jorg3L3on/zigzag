import Link from 'next/link';
import { ZigZagMark } from '@/components/brand/zigzag-mark';

type MarketingLogoProps = {
  /** When set, the logo is a link with an accessible name ("ZigZag, inicio"). */
  href?: string;
  /** Mark size in px; the wordmark scales with it. */
  size?: 'md' | 'sm';
  className?: string;
};

const SIZES = {
  md: { mark: 36, text: 'text-[22px] sm:text-2xl' },
  sm: { mark: 32, text: 'text-[22px]' },
} as const;

/**
 * ZigZag mark + wordmark in the "Papel y tinta" display face. Shared by the
 * marketing top bar and footer (and later public pages such as /ayuda).
 */
export const MarketingLogo = ({
  href,
  size = 'md',
  className = '',
}: MarketingLogoProps) => {
  const { mark, text } = SIZES[size];
  const body = (
    <>
      <ZigZagMark size={mark} className="block shrink-0" />
      <span
        className={`font-[family-name:var(--font-marketing-display)] font-extrabold tracking-[-0.03em] ${text}`}
      >
        ZigZag
      </span>
    </>
  );
  const base = `flex shrink-0 items-center gap-2.5 whitespace-nowrap text-[var(--pt-ink)] no-underline ${className}`;

  if (!href) {
    return <span className={base}>{body}</span>;
  }
  return (
    <Link href={href} aria-label="ZigZag, inicio" className={`${base} min-h-11`}>
      {body}
    </Link>
  );
};
