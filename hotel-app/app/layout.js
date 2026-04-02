import './globals.css';
import { ToastProvider } from '@/components/Toast';

export const metadata = {
  title: 'Regenta Resort | Hotel Management System',
  description: 'Advanced Guest Service Management and Internal Task Tracking System for Regenta Resort. Developed by Nextverse.',
  openGraph: {
    title: 'Regenta Resort | Hotel Management System',
    description: 'Advanced Guest Service Management and Internal Task Tracking System for Regenta Resort. Developed by Nextverse.',
    images: [
      {
        url: '/images/regenta_logo.png',
        width: 800,
        height: 600,
        alt: 'Regenta Resort Logo',
      },
    ],
    siteName: 'Regenta Resort',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Regenta Resort — Developed by Nextverse',
    description: 'Advanced Hotel Management System provided by Nextverse.',
    images: ['/images/regenta_logo.png'],
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
