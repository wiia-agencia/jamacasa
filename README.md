# La Jamacasa

La app de la casa de los jamaos: quién limpia qué, quién debe qué y quién va ganando.

- **Limpieza**: rotación de los tres pisos por semanas (nadie repite piso), basura con sorteo de bolsa, marcar como hecho y nota de los otros dos (0–10, se aprueba con 5).
- **Cuentas**: alquiler que se apunta solo cada mes, facturas y compras comunes, saldo simplificado (dos Bizums como mucho).
- **Juego**: puntos, ranking del mes, niveles acrobáticos, medallas, títulos y racha de la casa.

## Cómo está hecha

- Web app instalable (PWA) con Vite + React + TypeScript, publicada en Vercel desde este repositorio.
- Base de datos compartida en Supabase (gratis): `supabase/esquema.sql`.
- Todo lo que pasa en la casa es un **evento** que no se borra nunca (`jc_eventos`). Puntos, notas, saldos y medallas se calculan en el móvil a partir de los eventos (`src/core/`), así que cambiar una norma no necesita tocar la base de datos.
- Seguridad: cada móvil entra con el **código de la casa** y el **PIN** de su persona. La base de datos solo deja leer y apuntar a los móviles que han entrado, y firma cada apunte con su autor y la hora del servidor.
- **En este repositorio no hay datos de la casa** (alquiler, código, fotos): viven solo en la base de datos. El repositorio es público porque Vercel gratis solo publica así los repositorios de una organización.

## Puesta en marcha (una vez)

1. **Supabase** → *New project* (región de Europa) → *SQL Editor*: pega `supabase/esquema.sql` y *Run*; después pega el archivo privado de la casa (`casa.sql`, no está en el repo) y *Run*.
2. **Supabase** → *Authentication* → *Sign In / Providers* → activa **Allow anonymous sign-ins**.
3. Copia la *Project URL* y la *Publishable key* en `src/conexion.ts` (son públicas por diseño).
4. **Vercel** → *Add New* → *Project* → importa `jamacasa` → *Deploy* (detecta Vite solo).
5. Cada uno abre la dirección en el móvil, entra con el código de la casa, crea su PIN y la instala con «Añadir a pantalla de inicio».

Supabase pausa los proyectos gratis tras 7 días sin uso; si pasa, se reactiva desde su panel.

## Desarrollo

```bash
npm install
npm test          # reglas de la casa (rotación, notas, puntos, cuentas…)
npm run dev       # en el navegador, en modo prueba
npm run build     # la app para Vercel
npm run vista     # vista previa en un solo HTML (modo prueba)
```
