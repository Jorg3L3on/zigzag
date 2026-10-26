'use client';

import { usePathname } from 'next/navigation';
import { Check } from 'lucide-react';

import { CompanyBrandAvatar } from '@/components/companies/company-brand-avatar';
import { TripledMobileAppBar, TripledPageHeader } from '@/components/tripled';
import {
  COMPANY_HUB_PATH,
  getCompanyHubSubpage,
  getCompanyHubTabLabel,
} from '@/lib/company-hub';
import { cn } from '@/lib/utils';

/** Desktop breadcrumb: Mi empresa › <tab>. */
export const CompanyHubPageHeader = () => {
  const pathname = usePathname();
  const tabLabel = getCompanyHubTabLabel(pathname ?? '');

  return (
    <TripledPageHeader
      items={
        tabLabel
          ? [{ label: 'Mi empresa', href: COMPANY_HUB_PATH }, { label: tabLabel }]
          : [{ label: 'Mi empresa' }]
      }
      className="hidden md:flex"
    />
  );
};

/** Mobile app bar: Mi empresa on tabs, back + title on full-screen sub-pages. */
export const CompanyHubMobileAppBar = ({ companyName }: { companyName: string }) => {
  const pathname = usePathname();
  const subpage = getCompanyHubSubpage(pathname ?? '');

  return subpage ? (
    <TripledMobileAppBar
      title={subpage.title}
      subtitle={companyName}
      backHref={subpage.backHref}
      backLabel={subpage.backLabel}
      className="mb-3"
    />
  ) : (
    <TripledMobileAppBar title="Mi empresa" subtitle={companyName} className="mb-3" />
  );
};

type CompanyHubDesktopHeaderProps = {
  companyName: string;
  logo: string | null;
  /** Email · phone · RFC, only the parts that exist. */
  contact: string[];
  productionReady: boolean;
};

/** The hub's one header on md+ (ZIG-I32-1): logo or initial, name, readiness pill, contact. */
export const CompanyHubDesktopHeader = ({
  companyName,
  logo,
  contact,
  productionReady,
}: CompanyHubDesktopHeaderProps) => (
  <header
    className="hidden items-center gap-4 md:flex"
    data-testid="company-hub-header"
  >
    <CompanyBrandAvatar
      name={companyName}
      logoUrl={logo}
      className="size-14 shrink-0 rounded-2xl text-lg"
      imageSizes="56px"
    />
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
        <h1 className="truncate text-2xl font-semibold tracking-tight">{companyName}</h1>
        <span
          className={cn(
            'inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-sm font-semibold',
            productionReady
              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
              : 'bg-amber-500/15 text-amber-800 dark:text-amber-200',
          )}
          data-testid="company-readiness-pill"
        >
          {productionReady ? (
            <Check className="size-3.5" strokeWidth={2.5} aria-hidden />
          ) : (
            <span aria-hidden className="size-2 rounded-full bg-amber-500" />
          )}
          {productionReady ? 'Lista para operar' : 'Configuración pendiente'}
        </span>
      </div>
      {contact.length > 0 ? (
        <p className="truncate text-sm text-muted-foreground">{contact.join(' · ')}</p>
      ) : null}
    </div>
  </header>
);
