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
};

export const CompanyBrandAvatar = ({
  name,
  logoUrl,
  className,
  imageClassName,
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
          sizes="24px"
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
        'inline-flex size-6 items-center justify-center rounded-sm text-[10px] font-semibold text-white',
        className,
      )}
      style={{ backgroundColor: `hsl(${hue} 65% 42%)` }}
      aria-hidden
    >
      {initials}
    </span>
  );
};
