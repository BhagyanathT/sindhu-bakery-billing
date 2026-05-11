// src/app/layout.tsx
import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Toaster } from 'react-hot-toast';

export const metadata: Metadata = {
  title: 'Sindhu Bakery — Billing & POS System',
  description: 'Fast POS billing system for Sindhu Bakery, Marayamuttam. GST invoicing, inventory management, daily sales reports.',
  keywords: 'sindhu bakery, bakery billing, POS, GST invoicing, Marayamuttam, Kerala bakery',
  authors: [{ name: 'Sindhu Bakery' }],
};

export const viewport: Viewport = {
  themeColor: '#d97706',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

import { ThemeProvider } from '@/components/ThemeProvider';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 3500,
              style: {
                background: '#1c1917',
                color: '#fef3c7',
                border: '1px solid #44403c',
                borderRadius: '12px',
                fontSize: '14px',
                fontWeight: '500',
              },
              success: { iconTheme: { primary: '#d97706', secondary: '#fff' } },
              error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
