'use client';

import { BookOpen } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { EMPRESA_GUIDE_LINK, HELP_GUIDE_LABEL } from '@/lib/onboarding-guides';

/**
 * ¿Cómo se usa? in the Más sheet (ZIG-I18-12): one tap to the guide, no avatar
 * menu in between. System users keep their Guías submenu in the avatar menu.
 */
export const NavHelpLink = () => {
  const { data: session } = useSession();
  if (!session?.user || session.user.company_is_system) return null;

  return (
    <a
      href={EMPRESA_GUIDE_LINK.href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex min-h-11 items-center gap-2 rounded-md px-2 text-base font-medium hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring group-data-[collapsible=icon]:justify-center"
    >
      <BookOpen className="size-5 shrink-0" aria-hidden />
      <span className="group-data-[collapsible=icon]:hidden">{HELP_GUIDE_LABEL}</span>
    </a>
  );
};
