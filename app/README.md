# La Partida (nombre provisional)

Juego de cartas para el móvil inspirado en Manzanas con Manzanas.

- `src/` — la app (React + Vite, PWA).
- `../engine/` — reglas del juego (TypeScript puro). El servidor usa el mismo código.
- Backend: Supabase (proyecto `juego-31`), Edge Function `game`.

## Publicar
`npm install && npm run build` → sube la carpeta `dist/` a Vercel o Netlify.
En Vercel: importar el repositorio, framework "Vite", directorio raíz `app`.

## Cambiar el nombre
`src/config.ts` → `APP_NAME`, y el `<title>` de `index.html` y `public/manifest.webmanifest`.
