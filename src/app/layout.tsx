import type { Metadata, Viewport } from 'next';

import { Nav } from '@/components/nav';

import './globals.css';

export const metadata: Metadata = {
  title: 'World Cup Sweepstakes',
  description: 'Private World Cup sweepstakes leaderboard and bracket',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Nav />
        {children}
      </body>
    </html>
  );
}
