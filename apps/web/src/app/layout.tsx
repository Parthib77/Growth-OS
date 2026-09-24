import type { Metadata } from 'next';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-sans/700.css';
import '@fontsource/manrope/400.css';
import '@fontsource/manrope/500.css';
import '@fontsource/manrope/600.css';
import '@fontsource/manrope/700.css';
import '@fontsource/manrope/800.css';
import './globals.css';
import './workspace.css';
import './theme.css';
import { ThemeToggle } from './theme-toggle';
import { LoadingWave } from './loading-wave';

export const metadata: Metadata = {
  title: 'Growth OS',
  description: 'A consent-aware daily workspace for appointment businesses.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{const saved=localStorage.getItem('growthos-theme');document.documentElement.dataset.theme=saved==='dark'||saved==='light'?saved:matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}catch{document.documentElement.dataset.theme='light'}`,
          }}
        />
      </head>
      <body>
        {children}
        <LoadingWave />
        <ThemeToggle />
      </body>
    </html>
  );
}
