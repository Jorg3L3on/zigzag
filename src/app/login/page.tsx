import { LoginForm } from '@/components/login-form';
import { LoginStage } from '@/components/login/login-stage';
import { auth } from '@/lib/auth';
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

  if (session?.user) {
    redirect(session.user.company_is_system ? '/operator-console' : '/dashboard');
  }

  return (
    <LoginStage>
      <LoginForm
        callbackUrl={getSafeAppRedirectPath(resolvedSearchParams.callbackUrl) ?? undefined}
        sessionExpired={isExpiredSessionReason(resolvedSearchParams.reason)}
      />
    </LoginStage>
  );
}
