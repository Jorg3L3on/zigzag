import { redirect } from 'next/navigation';

export default async function OperatorCompanyIndex({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/operator-console/${encodeURIComponent(id)}/resumen`);
}
