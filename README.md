# PiliRun

Un runner de aventura local-first construido con Next.js App Router, TypeScript, Canvas 2D, Web Audio y SQLite WASM. No requiere cuentas ni servicios de datos externos.

## Desarrollo

Node.js 22.13 o posterior. `npm install`, `npm run dev`. Abrir http://localhost:3000. `npm run build` y `npm start` ejecutan la versión de producción. La preparación de assets instala SQLite y compila los workers locales. En una instalación reproducible, utilizar `npm ci` con el lockfile incluido.

## Arquitectura

- `src/app`: shell estático y estilos responsivos.
- `src/components`: menú, biblioteca de mundos, editor de sprites/fotos, constructor rápido, editor avanzado de escenarios, audio y estadísticas.
- `src/game`: simulación determinista a 120 Hz y render Canvas; sin estado React por frame.
- `src/lib`: interfaces compartidas, contratos y ZIP de escenarios, datos de mundos, cliente del worker y motor de audio persistente.
- `src/workers`: SQLite en OPFS, fallback SQLite en memoria con snapshots transaccionales en IndexedDB; normalización de fotos y assets de escenarios mediante OffscreenCanvas.
- `public/sw.js`: caché de aplicación de producción para uso offline después de la primera visita.
- `tests`: reglas de física, validación de pistas y flujos reales de navegador.

El worker serializa operaciones y confirma guardados sólo tras persistirlos. Un bloqueo exclusivo por pestaña evita snapshots en conflicto. Los archivos nunca salen del dispositivo. No se almacenan datos del usuario en localStorage.

## Experiencia y creación

Seis mundos, dos cámaras Canvas 2.5D, salto/doble salto/deslizamiento, monedas, checkpoints, potenciadores, pausa y resultados. La carrera ocupa el viewport completo también en portrait y conserva un botón explícito de fullscreen.

“Crear una pista” continúa como modo rápido. El Editor de escenarios añade capas, parallax, objetos incorporados o imágenes personalizadas, selección y transformación con Pointer Events, zoom/pan, cuadrícula, snap, undo/redo, inspector numérico y controles accesibles. Los borradores y assets permanecen localmente; los escenarios se importan y exportan como ZIP v1 sin imágenes base64 dentro del JSON.

## Verificación

`npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e`. Antes de la primera prueba de navegador, ejecutar `npx playwright install chromium firefox webkit`. Las pruebas de navegador necesitan una compilación de producción y levantan el servidor automáticamente si no está activo.

Consultar `docs/ARCHITECTURE.md` para decisiones y límites operativos, `docs/SCHEMA.sql` para tablas y `docs/GUIA_DE_ESTILO.md` para la experiencia visual.

## Controles

Espacio, W o flecha arriba: saltar; una segunda pulsación permite el doble salto. S o flecha abajo: deslizar. P o Escape: pausar/reanudar. En móvil se puede tocar la pista, deslizar hacia abajo o utilizar los botones grandes. Al cambiar de pestaña, la carrera se pausa.

## Guardados y audio

Todo se guarda en este navegador. Para evitar sobrescrituras, sólo una pestaña de PiliRun puede acceder a los guardados al mismo tiempo. Las fotos se recortan a 128×128; los archivos de música admiten hasta 100 MB sin límite de duración; la biblioteca depende del espacio disponible del navegador. La compatibilidad con códecs depende del navegador. Borrar los datos del sitio elimina las creaciones.

La aplicación no necesita cuentas ni una base de datos externa. El modo offline se prepara en producción; las funciones que requieren contexto seguro están disponibles en localhost o HTTPS.


## Controles y reglas nuevas

- En cada movimiento del editor, revisa, reordena, reemplaza y guarda sus fotogramas. Cada aparición tiene un tamaño independiente de 25–300 %, con deslizador, entrada numérica y restablecimiento. Reordenar conserva el tamaño; reemplazar conserva el ajuste; agregar empieza en 100 %. Los pies comparten el anclaje de la vista previa y del juego. Estos ajustes son visuales; el tamaño general del personaje sí modifica las colisiones.
- La música asignada al nivel tiene prioridad sobre el reproductor y la música predeterminada. La asignación del jefe se usa durante el encuentro; al vencerlo vuelve la música del nivel. Guarda ambas selecciones con **Guardar y Cerrar**. Pausar conserva la pista y su posición. Los errores de formato o espacio se muestran antes de confirmar el guardado.
- Normalmente el personaje corre automáticamente. Durante un jefe, mantén **A/D**, **←/→** o los controles táctiles para avanzar o retroceder; al soltarlos se detiene. Los ataques siguen la última dirección. Puedes retirarte sin reiniciar el encuentro ni repetir recompensas. La salida se abre al derrotar al jefe.
- Una victoria bloquea movimiento y daño inmediatamente. Tras tres segundos continúa el siguiente nivel con los poderes conservados; **Continuar ahora** adelanta el cambio y **Cancelar** lo detiene. El último nivel muestra la finalización de la aventura. Las pruebas del editor son independientes.
- La rama tiene 25 de salud y el tronco 60: fuego, hojas, rayos y luz estelar los dañan. La roca tiene 90 y sólo recibe daño de rayos o luz estelar. Agua no destruye obstáculos. El escudo conserva su destrucción al contacto. El editor de escenarios permite cambiar material y salud; estos valores se incluyen en el ZIP.

La música nueva se guarda como metadatos y Blob en una transacción de IndexedDB. La música antigua en SQLite sigue disponible sin importarla otra vez. Borrar una pista o restablecer los datos incluye ambos almacenes. Para conservar creaciones, no borres los datos del sitio.
