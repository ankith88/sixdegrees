import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SixDegrees — Curated Film & Series Lineage Atlas',
  description:
    'Explore how films and television series connect through shared directors, screenwriters, cast, composers, and narrative themes—with transparent reasoning and regional streaming availability.',
  icons: {
    icon: '/image_1.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Source+Sans+3:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Spectral:ital,wght@0,500;0,600;0,700;1,400;1,600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-[#F6F1E7] text-[#171412] antialiased selection:bg-[#B8292F]/15 selection:text-[#171412] caret-[#B8292F]">
        {children}
      </body>
    </html>
  );
}
