import { LoginForm } from '@/components/login-form';
import { LoginStage } from '@/components/login/login-stage';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function LoginPage() {
  const session = await auth();

  if (session?.user) {
    redirect(session.user.company_is_system ? '/operator-console' : '/dashboard');
  }

  return (
    <LoginStage>
      <LoginForm />
    </LoginStage>
  );
}
