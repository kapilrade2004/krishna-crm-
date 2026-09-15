import type { Metadata } from 'next';
import { Toaster } from 'react-hot-toast';
import Providers from './providers';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'Khrisha Enterprises — Enterprise Management Suite',
  description: 'Khrisha Enterprises — Order Processing & Business Management Platform',
  icons: {
    icon: [
      { url: '/favicon.ico?v=2', sizes: 'any' },
      { url: '/icon.png?v=2', type: 'image/png' },
    ],
    shortcut: '/favicon.ico?v=2',
    apple: '/icon.png?v=2',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico?v=2" sizes="any" />
        <link rel="icon" href="/icon.png?v=2" type="image/png" />
        <link rel="apple-touch-icon" href="/icon.png?v=2" />
      </head>
      <body className="antialiased" suppressHydrationWarning>
        <Providers>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 3500,
              style: { fontSize: '14px', fontFamily: 'Inter, sans-serif', maxWidth: '380px' },
              success: { iconTheme: { primary: '#1A8F7A', secondary: '#fff' } },
              error: { iconTheme: { primary: '#E24B4A', secondary: '#fff' } },
            }}
          />
        </Providers>
      </body>
    </html>
  );
}
