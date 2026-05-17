import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Toaster } from 'sonner';
import { Providers } from '@/components/providers';
import { NetworkStatusBanner } from '@/components/network-status-banner';
import './globals.css';
import { CompanyProvider } from '@/contexts/company-context';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'ZigZag',
  description: 'Gestión de tickets de servicio multi-empresa',
  appleWebApp: {
    capable: true,
    title: 'ZigZag',
    statusBarStyle: 'default',
  },
  themeColor: '#2563eb',
  icons: {
    icon: [
      { url: '/icon.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-icon.png', sizes: '180x180', type: 'image/png' }],
    shortcut: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <CompanyProvider>
          <Providers>
            <NetworkStatusBanner />
            {children}
            <Toaster />
          </Providers>
        </CompanyProvider>
      </body>
    </html>
  );
}
