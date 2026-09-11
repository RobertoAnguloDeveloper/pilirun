# Verificación de la primera versión

Fecha: 11 de septiembre de 2026. Entorno: Windows, Node 24 y Chromium de Playwright; servidor de producción de Next.js en localhost.

| Comprobación                           | Resultado                                                      |
| -------------------------------------- | -------------------------------------------------------------- |
| Compilación de producción              | Correcta, ruta principal prerenderizada                        |
| TypeScript estricto                    | Sin errores                                                    |
| Pruebas del motor y validación         | 13 aprobadas                                                   |
| Flujos de navegador                    | 8 aprobados                                                    |
| Auditoría Axe WCAG A/AA                | Sin infracciones detectadas en cinco pantallas a 1440 y 390 px |
| Desbordamiento horizontal              | No detectado en las pantallas auditadas                        |
| Dependencias, npm audit de instalación | 0 vulnerabilidades reportadas                                  |

## Flujos comprobados

1. Inicio de carrera, salto, pausa y reanudación; guardado y recuperación de personaje y pista.
2. Recorte de fotografía, guardado, importación de WAV, reproducción y recuperación de ambos después de recargar.
3. Recarga completamente offline y apertura de editores y motor que no se habían visitado antes.
4. Fin de una carrera y conservación del resultado en el diario tras recargar.
5. Accesibilidad automatizada en Campamento, Mis personajes, Crear una pista, Mi música y Mis aventuras, en escritorio y móvil.
6. SQLite con OPFS desactivado en el worker: persistencia efectiva y restauración mediante IndexedDB.
7. Pantalla móvil de 390×844, controles táctiles y ausencia de desbordamiento horizontal.
8. Segunda pestaña bloqueada mientras la primera es propietaria del guardado; acceso restaurado al cerrar la primera.

Las capturas se generan en `test-results/` al ejecutar la suite completa. Las pruebas usan contextos aislados y no modifican los guardados del navegador habitual del usuario.

## Límites de la evidencia

No se midió consumo de batería ni rendimiento en un teléfono físico. No se certificó compatibilidad con todos los códecs, Safari o Firefox. La auditoría automática no sustituye una evaluación WCAG manual completa. Los archivos de audio grandes y la presión de cuota requieren pruebas adicionales antes de una distribución amplia.
