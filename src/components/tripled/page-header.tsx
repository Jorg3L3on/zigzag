'use client';

import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { TripledMotionDiv, tripledFadeInUp } from '@/components/tripled/motion';
import { cn } from '@/lib/utils';

type BreadcrumbItemType = {
  label: string;
  href?: string;
};

type TripledPageHeaderProps = {
  items: BreadcrumbItemType[];
  className?: string;
};

export const TripledPageHeader = ({ items, className }: TripledPageHeaderProps) => {
  return (
    <header
      data-testid="page-header"
      className={cn(
        'sticky top-[var(--network-status-banner-offset,0px)] z-40 shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80',
        className,
      )}
    >
      <TripledMotionDiv
        variants={tripledFadeInUp}
        initial="hidden"
        animate="visible"
        className="flex h-16 items-center gap-2"
      >
        <div className="flex items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              {items.map((item, index) => {
                const isLast = index === items.length - 1;

                return (
                  <div className="flex items-center" key={`${item.label}-${index}`}>
                    <BreadcrumbItem className={isLast ? '' : 'hidden md:block'}>
                      {isLast ? (
                        <BreadcrumbPage>{item.label}</BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink href={item.href ?? '#'}>{item.label}</BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                    {!isLast ? (
                      <BreadcrumbSeparator className="hidden md:block" />
                    ) : null}
                  </div>
                );
              })}
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </TripledMotionDiv>
    </header>
  );
};
