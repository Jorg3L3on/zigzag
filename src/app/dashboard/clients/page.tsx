import { Metadata } from 'next';
import { ClientList } from '@/components/clients/client-list';

export const metadata: Metadata = {
  title: 'Clientes',
  description: 'Administra tus clientes',
};

export default function ClientsPage() {
  return <ClientList />;
}
