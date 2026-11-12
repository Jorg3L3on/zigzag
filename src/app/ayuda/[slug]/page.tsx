import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getWrittenGuide, getWrittenGuides } from '@/components/ayuda/guide-registry';
import { GuidePage } from '@/components/ayuda/guide-page';
import { MARKETING_INDEXABLE_METADATA } from '@/lib/marketing-routes';
import { buildHelpWhatsAppHref } from '@/lib/support-whatsapp';

type AyudaGuideRouteProps = { params: Promise<{ slug: string }> };

/** Only written guides exist; any other slug is a 404 (ZIG-I40-2). */
export const dynamicParams = false;

export const generateStaticParams = () =>
  getWrittenGuides().map((guide) => ({ slug: guide.slug }));

export const generateMetadata = async ({ params }: AyudaGuideRouteProps): Promise<Metadata> => {
  const guide = getWrittenGuide((await params).slug);
  if (!guide) return {};
  return {
    title: `${guide.title} | Ayuda ZigZag`,
    description: guide.content.description,
    robots: MARKETING_INDEXABLE_METADATA,
  };
};

export default async function AyudaGuideRoute({ params }: AyudaGuideRouteProps) {
  const guide = getWrittenGuide((await params).slug);
  if (!guide) notFound();
  return (
    <GuidePage
      guide={guide}
      whatsappHref={buildHelpWhatsAppHref(process.env.SUPPORT_WHATSAPP_NUMBER)}
    />
  );
}
