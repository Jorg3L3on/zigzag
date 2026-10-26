'use client';

import React from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import {
  getCompanyBrandFallbackHue,
  getCompanyBrandInitials,
} from '@/lib/company-logo-branding-shared';
import { resolveCompanyLogoUrl } from '@/lib/company-logo-storage';

type CompanyBrandAvatarProps = {
  name: string;
  logoUrl: string | null | undefined;
  className?: string;
  imageClassName?: string;
  /** `sizes` for the logo image; defaults to the 24 px sidebar avatar. */
  imageSizes?: string;
  /**
   * Initial without a logo: 'brand' (default) is the per-company hue;
   * 'primary' is the canvas's blue for the Mi empresa header and logo card,
   * where the initial is large page text and needs 4.5:1 (ZIG-I32).
   */
  fallbackTone?: 'brand' | 'primary';
};

export const CompanyBrandAvatar = ({
  name,
  logoUrl,
  className,
  imageClassName,
  imageSizes = '24px',
  fallbackTone = 'brand',
}: CompanyBrandAvatarProps) => {
  const trustedUrl = resolveCompanyLogoUrl(logoUrl);
  const [imageFailed, setImageFailed] = React.useState(false);
  const showImage = Boolean(trustedUrl) && !imageFailed;
  const initials = getCompanyBrandInitials(name);
  const hue = getCompanyBrandFallbackHue(name);

  React.useEffect(() => {
    setImageFailed(false);
  }, [trustedUrl]);

  if (showImage && trustedUrl) {
    return (
      <span
        className={cn(
          'relative inline-flex size-6 overflow-hidden rounded-sm',
          className,
        )}
      >
        <Image
          src={trustedUrl}
          alt={`Logo de ${name}`}
          fill
          sizes={imageSizes}
          className={cn('object-contain', imageClassName)}
          unoptimized={trustedUrl.startsWith('/')}
          onError={() => setImageFailed(true)}
        />
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex size-6 items-center justify-center rounded-sm text-caption font-semibold text-white',
        fallbackTone === 'primary' && 'bg-primary text-primary-foreground',
        className,
      )}
      style={fallbackTone === 'primary' ? undefined : { backgroundColor: `hsl(${hue} 65% 42%)` }}
      aria-hidden
    >
      {initials}
    </span>
  );
};
