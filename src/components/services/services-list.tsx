import { getServices } from '@/actions/services';
import { ServicesListClient } from '@/components/services/services-list-client';

export async function ServicesList() {
  const result = await getServices();

  if (!result.success) {
    throw new Error(result.error || 'Error al cargar los servicios');
  }

  return <ServicesListClient initialServices={result.data!} />;
}
