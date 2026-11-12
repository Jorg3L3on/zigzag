import { ListLoading } from '@/components/list-page';

/** Tab switches keep the header; only the tab body shows a placeholder (ZIG-I38-2). */
export default function Loading() {
  return <ListLoading label="Cargando sección" columns={4} />;
}
