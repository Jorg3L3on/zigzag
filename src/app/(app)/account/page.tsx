'use client';

import { useSession } from 'next-auth/react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AccountFormDialog } from '@/components/account/account-form-dialog';
import { TwoFactorSection } from '@/components/account/two-factor-section';
import {
  TripledDashboardShell,
  TripledMobileAppBar,
  TripledPageHeader,
  TripledResourceCard,
} from '@/components/tripled';
import { UserRound } from 'lucide-react';

export default function AccountPage() {
  const { data: session } = useSession();

  if (!session?.user) return null;

  return (
    <>
      <TripledPageHeader items={[{ label: 'Mi cuenta' }]} className="hidden md:flex" />
      <TripledDashboardShell maxWidthClassName="max-w-3xl">
        <TripledMobileAppBar title="Mi cuenta" subtitle="Perfil y empresa" className="mb-3" />
        <TripledResourceCard
          title="Mi cuenta"
          description="Perfil, empresa y datos de acceso."
          icon={<UserRound className="size-5" aria-hidden />}
        >
          <Card className="border-border/60 shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage
                    src={session.user.image || ''}
                    alt={session.user.name || ''}
                  />
                  <AvatarFallback className="text-lg">
                    {session.user.name?.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle className="text-xl">{session.user.name}</CardTitle>
                  <CardDescription>{session.user.email}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">
                    Empresa
                  </h3>
                  <p className="mt-1">{session.user.company_name}</p>
                </div>
                <div className="pt-4">
                  <AccountFormDialog />
                </div>
                <div className="pt-2">
                  <TwoFactorSection />
                </div>
              </div>
            </CardContent>
          </Card>
        </TripledResourceCard>
      </TripledDashboardShell>
    </>
  );
}
