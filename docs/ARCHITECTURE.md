# PiliRun: arquitectura y operación

## Integración

Next.js App Router genera estáticamente el shell. React controla navegación, formularios y HUD; `GameEngine` posee la simulación y Canvas sin actualizaciones React por frame. Un worker dedicado es el único propietario de SQLite WASM y otro procesa las fotografías; Web Audio mantiene una única instancia mientras el usuario cambia de pantalla.

## Capas y contratos

| Capa         | Archivo de entrada              | Responsabilidad                                      |
| ------------ | ------------------------------- | ---------------------------------------------------- |
| Aplicación   | `src/components/pilirun.tsx`    | Datos, selección, navegación y resultados            |
| Simulación   | `src/game/simulation.ts`        | Física, colisiones, temporizadores y estados         |
| Ejecución    | `src/game/engine.ts`            | requestAnimationFrame, acumulador y ResizeObserver   |
| Render       | `src/game/renderer.ts`          | Mundos, sprites y objetos visibles                   |
| Persistencia | `src/workers/storage.worker.ts` | SQLite, transacciones, fallback y BLOBs              |
| Contratos    | `src/lib/types.ts`              | Track, Character, RunResult, Preferences y protocolo |
| Audio        | `src/lib/audio.ts`              | Contexto, mezcla, crossfade, bucles y efectos        |
| Fotografía   | `src/workers/image.worker.ts`   | Recorte OffscreenCanvas a 128×128                    |

Los estados de simulación son MENU, PLAYING, PAUSED y GAME_OVER. EDITING pertenece al contrato compartido; los editores funcionan como pantallas de la aplicación con el motor de carrera desmontado. Probar una pista utiliza una nueva simulación independiente de su formulario.

## Física y energía

- Paso fijo de 1/120 s con acumulador. Se limita el delta a 50 ms para evitar saltos y acumulación de trabajo tras una interrupción; por debajo de 20 FPS sostenidos, la simulación reduce su velocidad efectiva.
- Coordenadas de pista en unidades de mundo, 10 unidades = 1 metro mostrado. Velocidad base: 280 unidades/s. La escala visual nunca modifica física ni colisiones.
- Dos saltos antes de aterrizar, impulso vertical 700 y gravedad 1900 unidades/s². Deslizamiento de 0,8 s en suelo.
- Tres corazones; daño con 1,6 s de inmunidad. Tres obstáculos seguidos sin daño conceden escudo. Los perfectos totales se conservan como estadística aunque una colisión reinicie la racha.
- Checkpoints cada 300 m añaden 5 s. Escudo, impulso y tiempo aparecen como objetos. La duración del nivel parte de distancia/velocidad más un margen de 12 s.
- El HUD se publica a React a un máximo aproximado de 10 Hz. Canvas tiene DPR limitado a 2, descarta objetos fuera de pantalla y deja de solicitar frames durante pausa y al finalizar.
- Perder visibilidad pausa el juego. La música conserva el comportamiento que el usuario haya elegido; las restricciones de suspensión del sistema operativo siguen aplicándose.

## Persistencia

SQLite oficial se sirve desde el mismo origen. Los headers COOP `same-origin` y COEP `require-corp` habilitan el VFS OPFS. No hay peticiones a una base de datos, CDN o servicio de archivos externo.

El worker abre `/pilirun.sqlite3` mediante `oo1.OpfsDb`. Cuando no está disponible, mantiene SQLite en memoria y persiste snapshots en IndexedDB (`pilirun-sqlite` / `snapshots` / `database`). Si existe un snapshot previo, se sigue utilizando ese backend: una actualización del navegador no debe ocultar los guardados anteriores. Un error al abrir OPFS se comunica y no provoca el cambio silencioso a una base vacía.

El protocolo usa `requestId` y una cola serial. Cada mutación se realiza dentro de una transacción; el fallback persiste antes de responder. Los formularios sólo anuncian éxito después de recibir confirmación. Un Web Lock exclusivo impide que otra pestaña sobrescriba el snapshot. En navegadores sin Web Locks no se garantiza la protección multi-pestaña; deben usarse con una sola pestaña.

El esquema v1 se encuentra en `docs/SCHEMA.sql` y en el worker. Las colecciones pequeñas usan JSON validado por SQLite y una clave compuesta. Las pistas musicales usan BLOBs separados de su metadata, por lo que iniciar la interfaz no transfiere todos los audios al hilo principal.

Límites deliberados para esta versión: foto de hasta 8 MB y 40 megapíxeles, salida de 128×128; música de hasta 20 MB/3 minutos por pista y 60 MB por biblioteca; pista de 300–3.000 m y 200 elementos; obstáculos separados al menos 42 m. El fallback tiene mayor coste de copia al escribir porque exporta el SQLite completo. La cuota real y la permanencia dependen del navegador; los errores se muestran sin inventar un guardado exitoso.

Las preferencias se agrupan con un debounce de 150 ms. Cerrar abruptamente el proceso antes de confirmar esa escritura puede perder el último ajuste; los guardados explícitos de creaciones esperan confirmación. Solicitar almacenamiento persistente reduce el riesgo de limpieza automática si el navegador concede el permiso. Borrar datos del navegador elimina también la base; esta versión no ofrece sincronización ni exportación de respaldo.

## Audio

Un AudioContext de baja latencia se activa después de un gesto. Dos GainNodes permiten hacer crossfade de 0,7 s entre pistas. `AudioBufferSourceNode.loopStart/loopEnd` realiza los bucles; la validez de los límites se comprueba antes de guardar. Web Audio decodifica los formatos que admita el navegador, incluido el audio de MP4 cuando el códec sea compatible. Los efectos usan osciladores de vida corta, volumen y tono personalizables. Cambiar la pestaña interna de React no desmonta el grafo de audio.

## Offline e instalación

El build genera iconos PNG y un service worker con el identificador de compilación. Precarga el documento, SQLite, workers y todos los bundles de producción, incluidos los editores dinámicos. Sólo elimina cachés propias de versiones anteriores. No almacena respuestas RSC como documentos y no reemplaza el shell de una versión con HTML de otra al guardar en caché.

En localhost funciona como contexto seguro. Para utilizarlo desde otro dispositivo se necesita un origen HTTPS; una IP de la red local mediante HTTP no habilita todas las APIs. No hay despliegue público configurado. Tras la primera carga de producción y la instalación del service worker, funciona sin red. El navegador decide si ofrece la instalación PWA.

## Verificación y alcance

`npm run typecheck`: TypeScript estricto. `npm test`: reglas deterministas y validación de pistas. `npm run test:e2e`: Chromium de Playwright, controles, recarga, ambos backends, fotos/audio, resultados, offline, aislamiento entre pestañas y auditoría automatizada de accesibilidad.

Las capturas de escritorio y móvil se generan en `test-results`. Las pruebas móviles emulan un viewport: no equivalen a mediciones de batería/FPS en hardware real ni a validación manual en Safari o Android. La auditoría automatizada no demuestra por sí sola conformidad WCAG completa; Canvas requiere controles accesibles complementarios y una revisión manual de la experiencia del juego.

## Referencias oficiales

- [Next.js App Router e instalación](https://nextjs.org/docs/app/getting-started/installation)
- [Persistencia de SQLite WASM](https://sqlite.org/wasm/doc/tip/persistence.md)
- [API SQLite OO1](https://sqlite.org/wasm/doc/tip/api-oo1.md)

## Próximas ampliaciones posibles

Exportación/importación de guardados, checkpoints colocables, accesorios por capas, streaming de audio largo y verificación en dispositivos físicos. Cada ampliación debe conservar la separación del motor, las migraciones explícitas y el guardado local.
