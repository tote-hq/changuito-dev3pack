import type { Metadata } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: 'Changuito Pay',
  description: 'Pay a friend\'s supermarket cart.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
