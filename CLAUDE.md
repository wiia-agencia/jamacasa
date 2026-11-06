# La Jamacasa · reglas para trabajar en este repo

App de Javi (wiia) para su casa con José y Josu. Hablar siempre en castellano de España y llamarle Javi.

## Cosas que no se rompen
- **Nada de datos de la casa en el código** (alquiler, código de la casa, fotos, apellidos). El repo es público. Los datos reales van en Supabase (`jc_casa.config`, `jc_miembros`) o, para la vista previa privada, en `src/demo/privado/` (está en `.gitignore`).
- **Los eventos no se editan ni se borran**: para corregir algo se apunta otro evento (`gasto_anulado`, `pago_anulado`…). Las reglas del juego viven en `src/core/` y se recalculan desde los eventos.
- Un tipo de evento nuevo no necesita tocar la base de datos (acepta cualquier `tipo` en minúsculas y guiones bajos). Un cambio de tablas o permisos sí: va en `supabase/esquema.sql` (que se puede volver a ejecutar) y Javi lo pega en el SQL Editor.
- Colores fijos: Javi naranja, José verde, Josu azul. Cada uno tiene su silueta del icono (`figura`).
- El menú de abajo es azul noche (`#13233a`) en modo claro y oscuro: en la app instalada, Chrome pinta la barra de gestos de Android con el `theme_color` del manifiesto (un solo color, se actualiza en el móvil en un día o dos). Si cambia el color del menú, cambian también `theme_color` y `background_color` en `public/manifest.webmanifest`. La barra de arriba sí sigue al `<meta name="theme-color">` (coral en Hoy). El service worker (`public/sw.js`) va siempre primero por red salvo `/assets/`; si guardara el manifiesto, el móvil no vería nunca los cambios.
- Las zonas se llaman Piso de abajo, Piso del medio y Piso de arriba.
- **Avisos al móvil**: a quién y cuándo se avisa está en `src/core/avisos.ts` (reglas puras, con tests). La base de datos llama a `/api/avisos` al apuntar cualquier cosa (disparador con pg_net) y cada hora a los :05 (pg_cron), con la clave de los avisos; la función pide los datos a Supabase con esa clave y manda con web-push. `api/avisos.js` es un archivo generado desde `servidor/avisos.ts` con `npm run servidor` (lleva src/core dentro): **si cambias algo de src/core, vuelve a generarlo y súbelo**. Las dos llaves (la clave de la app y la VAPID privada) solo viven en Vault de Supabase, nunca en el repo; la VAPID pública está en `src/conexion.ts`. Si se cambia la pública, cada móvil se vuelve a apuntar solo al abrir la app.

## Antes de dar algo por terminado
- `npm test` en verde y `npx tsc -p tsconfig.json` y `npx tsc -p tsconfig.servidor.json` sin errores (el test de `api/avisos.js` prueba el archivo generado: genéralo antes con `npm run servidor`).
- `npm run vista` y `node scripts/capturas.mjs <carpeta>` (y `oscuro`) para ver la app a tamaño de móvil.
- La vista previa privada se publica como artefacto desde `dist-vista/jamacasa.html` (sin doctype/html/head/body propios).

## Dónde está cada cosa
- `src/core/`: reglas puras (tiempo de Madrid, rotación, sorteo, notas, basura, cuentas, puntos, medallas, noticias). Tests en `tests/`.
- `src/datos/`: `prueba.ts` (modo prueba en el móvil, con un mes inventado) y `casa.ts` (Supabase).
- `src/ui/`: pantallas (Hoy, Limpieza, Cuentas, Juego), hojas de acción, sorteo y entrada.
- `src/datos/avisos.ts`: permiso y suscripción de avisos en el móvil; `public/sw.js` los pinta y abre la pantalla de cada aviso.
- `servidor/avisos.ts` → `api/avisos.js`: la función de Vercel que manda los avisos.
- Las normas con sus valores están en `src/core/calendario.ts` (`NORMAS_BASE`) y se ven en Juego → Las normas. El documento completo de reglas (con importes) lo tiene Javi; no va en el repo.
