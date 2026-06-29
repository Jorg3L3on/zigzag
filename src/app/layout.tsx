import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { AppToaster } from '@/components/app-toaster';
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

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#2563eb',
};

export const metadata: Metadata = {
  title: 'ZigZag',
  description: 'Gestión de tickets de servicio multi-empresa',
  appleWebApp: {
    capable: true,
    title: 'ZigZag',
    statusBarStyle: 'default',
  },
  icons: {
    icon: [
      { url: '/icon.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      {
        url: '/icons/icon-512-maskable.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
    apple: [{ url: '/apple-icon.png', sizes: '180x180', type: 'image/png' }],
    shortcut: '/favicon.ico',
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <NextIntlClientProvider locale={locale} messages={messages}>
          <CompanyProvider>
            <Providers>
              <NetworkStatusBanner />
              {children}
              <AppToaster />
            </Providers>
          </CompanyProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
