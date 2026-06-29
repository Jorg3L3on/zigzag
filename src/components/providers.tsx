import { SessionProvider } from 'next-auth/react';
import { PostHogProvider } from '@/components/posthog-provider';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <PostHogProvider>{children}</PostHogProvider>
    </SessionProvider>
  );
}
