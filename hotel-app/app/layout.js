import './globals.css';
import { ToastProvider } from '@/components/Toast';

export const metadata = {
  title: 'Regenta Resort | Hotel Management System',
  description: 'Developed by Nextverse — Advanced Guest Service Management and Internal Task Tracking System for Regenta Resort.',
  openGraph: {
    title: 'Regenta Resort | Hotel Management System',
    description: 'Developed by Nextverse — Advanced Guest Service Management and Internal Task Tracking System for Regenta Resort.',
    images: [
      {
        url: '/images/og-image.png',
        width: 1200,
        height: 1200,
        alt: 'Regenta Resort Logo - Nextverse',
      },
    ],
    siteName: 'Regenta Resort | Nextverse',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Regenta Resort | Hotel Management System',
    description: 'Developed by Nextverse — Advanced Hotel Management System provided for Regenta Resort.',
    images: ['/images/og-image.png'],
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Regenta Resort',
  },
};

export const viewport = {
  themeColor: '#1A3A5C',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: `console.log("Is PWA installed:", window.matchMedia('(display-mode: standalone)').matches)` }} />
      </head>
      <body className="w-full max-w-full">
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
