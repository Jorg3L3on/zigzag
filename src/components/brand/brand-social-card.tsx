import { zigzagMarkDataUrl } from '@/components/brand/zigzag-mark-svg';

/**
 * Shared 1200×630 card for `opengraph-image` and `twitter-image`: the rounded
 * mark above the wordmark on the blue gradient. The mark goes in as an SVG data
 * URL because next/og (Satori) does not render inline SVG masks.
 */
export const BrandSocialCard = () => (
  <div
    style={{
      height: '100%',
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
      justifyContent: 'center',
      background:
        'linear-gradient(135deg, #0f172a 0%, #1e3a8a 55%, #2563eb 100%)',
      color: '#f8fafc',
      padding: '72px',
      fontFamily: 'sans-serif',
    }}
  >
    {/* eslint-disable-next-line @next/next/no-img-element -- next/og renders plain img only */}
    <img
      src={zigzagMarkDataUrl('rounded')}
      width={120}
      height={120}
      alt=""
      style={{ marginBottom: 32 }}
    />
    <div
      style={{
        fontSize: 72,
        fontWeight: 700,
        letterSpacing: '-0.04em',
        marginBottom: 16,
      }}
    >
      ZigZag
    </div>
    <div style={{ fontSize: 32, opacity: 0.9, maxWidth: 820 }}>
      Gestión de tickets de servicio multi-empresa
    </div>
  </div>
);
