import './globals.css';
import type { Metadata, Viewport } from 'next';
import Navigation from '@/components/Navigation';

export const metadata: Metadata = {
  title: 'RADAR BUSINESS ROMÂNIA — National Intelligence & Insurance Leads',
  description: 'Autonomous National Business Intelligence, Company Discovery & Insurance Lead Generation Platform for Romania',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ro" className="dark">
      <body className="bg-titanium-950 text-titanium-100 min-h-screen flex flex-col lg:flex-row antialiased selection:bg-radar-green/20 selection:text-radar-green">
        <Navigation />
        <main className="flex-1 min-w-0 bg-titanium-950 flex flex-col overflow-y-auto lg:h-screen">
          {children}
        </main>
      </body>
    </html>
  );
}
