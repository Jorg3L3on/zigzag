import { SessionProvider } from 'next-auth/react';
import { PostHogProvider } from '@/components/posthog-provider';
import { ThemeHotkey } from '@/components/mode-toggle';
import { SessionKeepAlive } from '@/components/session-keep-alive';
import { OperatorTenantCompanySync } from '@/components/operator-tenant-company-sync';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ThemeHotkey />
      <SessionProvider>
        <SessionKeepAlive />
        <OperatorTenantCompanySync />
        <PostHogProvider>{children}</PostHogProvider>
      </SessionProvider>
    </>
  );
}
