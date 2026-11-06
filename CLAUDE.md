# La Jamacasa · reglas para trabajar en este repo

App de Javi (wiia) para su casa con José y Josu. Hablar siempre en castellano de España y llamarle Javi.

## Cosas que no se rompen
- **Nada de datos de la casa en el código** (alquiler, código de la casa, fotos, apellidos). El repo es público. Los datos reales van en Supabase (`jc_casa.config`, `jc_miembros`) o, para la vista previa privada, en `src/demo/privado/` (está en `.gitignore`).
- **Los eventos no se editan ni se borran**: para corregir algo se apunta otro evento (`gasto_anulado`, `pago_anulado`…). Las reglas del juego viven en `src/core/` y se recalculan desde los eventos.
- Un tipo de evento nuevo no necesita tocar la base de datos (acepta cualquier `tipo` en minúsculas y guiones bajos). Un cambio de tablas o permisos sí: va en `supabase/esquema.sql` (que se puede volver a ejecutar) y Javi lo pega en el SQL Editor.
- Colores fijos: Javi naranja, José verde, Josu azul. Cada uno tiene su silueta del icono (`figura`).
- Las zonas se llaman Piso de abajo, Piso del medio y Piso de arriba.

## Antes de dar algo por terminado
- `npm test` en verde y `npx tsc -p tsconfig.json` sin errores.
- `npm run vista` y `node scripts/capturas.mjs <carpeta>` (y `oscuro`) para ver la app a tamaño de móvil.
- La vista previa privada se publica como artefacto desde `dist-vista/jamacasa.html` (sin doctype/html/head/body propios).

## Dónde está cada cosa
- `src/core/`: reglas puras (tiempo de Madrid, rotación, sorteo, notas, basura, cuentas, puntos, medallas, noticias). Tests en `tests/`.
- `src/datos/`: `prueba.ts` (modo prueba en el móvil, con un mes inventado) y `casa.ts` (Supabase).
- `src/ui/`: pantallas (Hoy, Limpieza, Cuentas, Juego), hojas de acción, sorteo y entrada.
- Las normas con sus valores están en `src/core/calendario.ts` (`NORMAS_BASE`) y se ven en Juego → Las normas. El documento completo de reglas (con importes) lo tiene Javi; no va en el repo.
