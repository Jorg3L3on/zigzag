import { LoginForm } from '@/components/login-form';
import { LoginStage } from '@/components/login/login-stage';
import { auth } from '@/lib/auth';
import { isSessionCurrent } from '@/lib/session-revocation';
import {
  getSafeAppRedirectPath,
  isExpiredSessionReason,
} from '@/lib/login-redirect';
import { redirect } from 'next/navigation';

type LoginPageProps = {
  searchParams?: Promise<{
    callbackUrl?: string | string[];
    reason?: string | string[];
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const session = await auth();

  // Never bounce a revoked session to the dashboard: it would send it straight back here.
  if (session?.user && (await isSessionCurrent(session))) {
    redirect(session.user.company_is_system ? '/operator-console' : '/dashboard');
  }

  return (
    <LoginStage>
      <LoginForm
        callbackUrl={getSafeAppRedirectPath(resolvedSearchParams.callbackUrl) ?? undefined}
        sessionExpired={isExpiredSessionReason(resolvedSearchParams.reason)}
        supportWhatsapp={process.env.SUPPORT_WHATSAPP_NUMBER ?? null}
      />
    </LoginStage>
  );
}
