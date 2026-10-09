import { ImageResponse } from 'next/og';

import { BrandSocialCard } from '@/components/brand/brand-social-card';

export const runtime = 'edge';
export const alt = 'ZigZag - Gestión de tickets de servicio multi-empresa';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(<BrandSocialCard />, { ...size });
}
