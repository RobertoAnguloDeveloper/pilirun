import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'PiliRun — Tu mundo, tu ritmo',
  description:
    'Un salto fuera de la rutina. Explora mundos, crea personajes y corre a tu manera en una aventura que se queda en tu dispositivo.',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon.svg', apple: '/icon-192.png' },
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'PiliRun' },
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
