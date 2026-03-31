import './globals.css';
import { ToastProvider } from '@/components/Toast';

export const metadata = {
  title: 'Hotel Service Manager',
  description: 'Internal hotel service request management dashboard',
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
