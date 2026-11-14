import './globals.css';
import type { Metadata } from 'next';
import Navigation from '@/components/Navigation';

export const metadata: Metadata = {
  title: 'RADAR BUSINESS ROMÂNIA — National Intelligence & Insurance Leads',
  description: 'Autonomous National Business Intelligence, Company Discovery & Insurance Lead Generation Platform for Romania',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ro" className="dark">
      <body className="bg-titanium-950 text-titanium-100 flex min-h-screen">
        <Navigation />
        <main className="flex-1 overflow-y-auto h-screen bg-titanium-950 flex flex-col">
          {children}
        </main>
      </body>
    </html>
  );
}
