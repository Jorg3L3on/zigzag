import { redirect } from 'next/navigation';

import { ForcedPasswordChangeForm } from '@/components/forced-password-change-form';
import { auth } from '@/lib/auth';
import { getExpiredLoginPath } from '@/lib/login-redirect';
import { isPasswordChangePending } from '@/lib/password-change-server';

export const dynamic = 'force-dynamic';

/** Where a temporary password leads before anything else (ZIG-I18-11). */
export default async function ChangePasswordPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(getExpiredLoginPath());
  }

  if (!(await isPasswordChangePending(session.user.id))) {
    redirect(session.user.company_is_system ? '/operator-console' : '/dashboard');
  }

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col justify-center px-5 py-10">
      <ForcedPasswordChangeForm
        homePath={session.user.company_is_system ? '/operator-console' : '/dashboard'}
      />
    </main>
  );
}
