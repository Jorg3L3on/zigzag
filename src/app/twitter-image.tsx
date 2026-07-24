import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'ZigZag — Gestión de tickets de servicio multi-empresa';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default function TwitterImage() {
  return new ImageResponse(
    (
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
    ),
    { ...size },
  );
}
