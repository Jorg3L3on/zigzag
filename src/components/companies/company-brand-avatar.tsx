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
      <Image
        src={trustedUrl}
        alt={`Logo de ${name}`}
        width={24}
        height={24}
        className={cn('size-6 rounded-sm object-contain', imageClassName, className)}
        unoptimized={trustedUrl.startsWith('/')}
        onError={() => setImageFailed(true)}
      />
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
