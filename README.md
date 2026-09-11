# PiliRun

Un runner de aventura local-first construido con Next.js App Router, TypeScript, Canvas 2D, Web Audio y SQLite WASM. No requiere cuentas ni servicios de datos externos.

## Desarrollo

Node.js 22.13 o posterior. `npm install`, `npm run dev`. Abrir http://localhost:3000. `npm run build` y `npm start` ejecutan la versión de producción. La preparación de assets instala SQLite y compila los workers locales. En una instalación reproducible, utilizar `npm ci` con el lockfile incluido.

## Arquitectura

- `src/app`: shell estático y estilos responsivos.
- `src/components`: menú, biblioteca de mundos, editor de sprites/fotos, constructor de pistas, audio y estadísticas.
- `src/game`: simulación determinista a 120 Hz y render Canvas; sin estado React por frame.
- `src/lib`: interfaces compartidas, datos de mundos, cliente del worker y motor de audio persistente.
- `src/workers`: SQLite en OPFS, fallback SQLite en memoria con snapshots transaccionales en IndexedDB; procesamiento de fotos mediante OffscreenCanvas.
- `public/sw.js`: caché de aplicación de producción para uso offline después de la primera visita.
- `tests`: reglas de física, validación de pistas y flujos reales de navegador.

El worker serializa operaciones y confirma guardados sólo tras persistirlos. Un bloqueo exclusivo por pestaña evita snapshots en conflicto. Los archivos nunca salen del dispositivo. No se almacenan datos del usuario en localStorage.

## Alcance de la primera versión

Tres mundos, salto/doble salto/deslizamiento, monedas, checkpoints, escudo por obstáculos perfectos, potenciadores, pausa y resultados; pixel art de 16×16 y recorte de fotos; pistas personalizadas; biblioteca de audio con bucles; preferencias y estadísticas persistidas. Teclado, ratón y controles táctiles.

## Verificación

`npm run typecheck`, `npm test`, `npm run test:e2e`. Antes de la primera prueba de navegador, ejecutar `npx playwright install chromium`. Las pruebas de navegador necesitan una compilación de producción (`npm run build`) y levantan el servidor automáticamente si no está activo.

Consultar `docs/ARCHITECTURE.md` para decisiones y límites operativos, `docs/SCHEMA.sql` para tablas y `docs/GUIA_DE_ESTILO.md` para la experiencia visual.

## Controles

Espacio, W o flecha arriba: saltar; una segunda pulsación permite el doble salto. S o flecha abajo: deslizar. P o Escape: pausar/reanudar. En móvil se puede tocar la pista, deslizar hacia abajo o utilizar los botones grandes. Al cambiar de pestaña, la carrera se pausa.

## Guardados y audio

Todo se guarda en este navegador. Para evitar sobrescrituras, sólo una pestaña de PiliRun puede acceder a los guardados al mismo tiempo. Las fotos se recortan a 128×128; los archivos de música admiten hasta 20 MB y 3 minutos, y la biblioteca completa hasta 60 MB. La compatibilidad con códecs depende del navegador. Borrar los datos del sitio elimina las creaciones.

La aplicación no necesita cuentas ni una base de datos externa. El modo offline se prepara en producción; las funciones que requieren contexto seguro están disponibles en localhost o HTTPS.
