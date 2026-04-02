import './globals.css';
import { ToastProvider } from '@/components/Toast';

export const metadata = {
  title: 'Regenta Resort | by Nextverse',
  description: 'Developed by Nextverse — Advanced Guest Service Management and Internal Task Tracking System for Regenta Resort.',
  openGraph: {
    title: 'Regenta Resort | by Nextverse',
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
    title: 'Regenta Resort | by Nextverse',
    description: 'Developed by Nextverse — Advanced Hotel Management System provided for Regenta Resort.',
    images: ['/images/og-image.png'],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
