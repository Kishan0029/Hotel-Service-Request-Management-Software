import './globals.css';

export const metadata = {
  title: 'Hotel Service Manager',
  description: 'Internal hotel service request management dashboard',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
