import type { Metadata } from 'next';
import { getHelpCards } from '@/components/ayuda/guide-registry';
import { HelpHome } from '@/components/ayuda/help-home';
import { MARKETING_INDEXABLE_METADATA } from '@/lib/marketing-routes';
import { buildHelpWhatsAppHref } from '@/lib/support-whatsapp';

export const metadata: Metadata = {
  title: 'Ayuda | ZigZag',
  description:
    'Guías cortas, paso a paso, para usar ZigZag: tickets, cobro, presupuestos, clientes y tu equipo.',
  robots: MARKETING_INDEXABLE_METADATA,
};

/** Help centre home (ZIG-I40-1): public, no session needed. */
export default function AyudaPage() {
  return (
    <HelpHome
      cards={getHelpCards()}
      whatsappHref={buildHelpWhatsAppHref(process.env.SUPPORT_WHATSAPP_NUMBER)}
    />
  );
}
