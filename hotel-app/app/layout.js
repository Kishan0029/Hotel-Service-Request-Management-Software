import './globals.css';
import { ToastProvider } from '@/components/Toast';

export const metadata = {
  title: 'Regenta Resort | Hotel Management System',
  description: 'Advanced Guest Service Management and Internal Task Tracking System for Regenta Resort.',
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
