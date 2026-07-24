import { SessionProvider } from 'next-auth/react';
import { PostHogProvider } from '@/components/posthog-provider';
import { ThemeHotkey } from '@/components/mode-toggle';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ThemeHotkey />
      <SessionProvider>
        <PostHogProvider>{children}</PostHogProvider>
      </SessionProvider>
    </>
  );
}
