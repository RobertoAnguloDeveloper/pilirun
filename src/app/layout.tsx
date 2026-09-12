import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata: Metadata = {
  applicationName: 'PiliRun',
  title: 'PiliRun — Tu mundo, tu ritmo',
  description:
    'Un salto fuera de la rutina. Explora mundos, crea personajes y corre a tu manera en una aventura que se queda en tu dispositivo.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'PiliRun',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
};
export const viewport: Viewport = {
  themeColor: '#183f35',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>
        <a className="skip-link" href="#main-content">
          Saltar al contenido
        </a>
        {children}
      </body>
    </html>
  );
}
