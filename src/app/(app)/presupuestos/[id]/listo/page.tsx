import { redirect } from 'next/navigation';

/**
 * The creation review is gone (ZIG-I24-4): Guardar presupuesto lands on the
 * detail, which has the PDF, Compartir and Convertir. Old links go there too.
 */
export default async function PresupuestoReadyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/presupuestos/${encodeURIComponent(id)}`);
}
