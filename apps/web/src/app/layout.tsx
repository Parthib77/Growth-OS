import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Growth OS',
  description: 'A consent-aware daily workspace for appointment businesses.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
