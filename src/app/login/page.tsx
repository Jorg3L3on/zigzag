import { LoginForm } from '@/components/login-form';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function LoginPage() {
  const session = await auth();

  if (session?.user) {
    redirect(session.user.company_is_system ? '/operator-console' : '/dashboard');
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-gradient-to-b from-background via-background to-muted/40 p-6 md:p-10">
      <div className="w-full max-w-sm">
        <LoginForm />
      </div>
    </div>
  );
}
