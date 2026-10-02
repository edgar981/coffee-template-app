import type { Metadata } from 'next';

// LA IDENTIDAD "FUERA DE LA PÁGINA" del storefront — título, descripción e íconos — centralizada
// (§ METADATA-ICONOS-Y-LANG-POR-TIENDA-1). Antes del commit de hero (§ Config del contenido,
// CLAUDE.md) sólo `app/(storefront)/layout.tsx` la resolvía; el 404 global (§ `app/not-found.tsx`,
// nuevo en este slice) necesita EXACTAMENTE la misma resolución, y una segunda copia inline sería la
// misma trampa de siempre (§ `razonDelServidor`/`cruzoMinimo`, CLAUDE.md): dos definiciones del
// mismo hecho divergiendo la primera vez que alguien edite una sin la otra. Puro: sin `next/headers`,
// sin Prisma — toma los datos YA resueltos (SiteSetting + `content.logo.icono`) y devuelve objetos
// de `Metadata`.

/** Los íconos ESTÁTICOS de hoy — Nayoli, assets por-despliegue (§ Identidad, CLAUDE.md). Es el
 *  FALLBACK cuando la tienda no subió su propio ícono de pestaña: el MISMO literal que
 *  `(storefront)/layout.tsx` ya declaraba inline antes de este slice, movido acá para que el 404
 *  global lo comparta sin repetirlo. */
export const ICONOS_ESTATICOS_POR_DEFECTO: NonNullable<Metadata['icons']> = {
  icon: [
    { url: '/icon.svg', type: 'image/svg+xml' },
    { url: '/favicon.ico', sizes: 'any' },
  ],
  apple: { url: '/apple-icon.png', type: 'image/png', sizes: '180x180' },
  shortcut: '/favicon.ico',
};

/** El contrato de un ícono del manifest PWA (`GET /api/manifest`): no es `Metadata['icons']` —ese
 *  shape es de `<link>` tags—, es el array `icons` del JSON de manifest (`src`/`sizes`/`type`
 *  [+`purpose`]). */
export interface IconoManifest {
  src: string;
  sizes: string;
  type: string;
  purpose?: 'maskable';
}

/** Los íconos del manifest de hoy — Nayoli, los mismos tres PNG que `app/api/manifest/route.ts` ya
 *  servía antes de este slice (192 · 512 · 512 maskable), movidos acá por la MISMA razón que
 *  `ICONOS_ESTATICOS_POR_DEFECTO`. */
export const ICONOS_MANIFEST_POR_DEFECTO: IconoManifest[] = [
  { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
  { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
  { src: '/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
];

/** El `type` de un ícono subido, por EXTENSIÓN — el mismo set cerrado que la subida admite
 *  (`TIPOS_LOGO`, constants/upload.ts: sólo SVG o PNG), así que basta mirar `.svg` vs. cualquier
 *  otra cosa. No hay tercer caso: `constants/upload.ts` no deja subir nada más por este campo. */
function tipoDeIconoSubido(url: string): 'image/svg+xml' | 'image/png' {
  return url.toLowerCase().endsWith('.svg') ? 'image/svg+xml' : 'image/png';
}

/**
 * Los íconos del `<head>` (favicon · apple-touch-icon · shortcut): el ÍCONO SUBIDO por el tenant
 * (`content.logo.icono`, § METADATA-ICONOS-Y-LANG-POR-TIENDA-1) si lo hay, o los estáticos de Nayoli
 * si no — mismo patrón que el logo de nav (§ `logoParaVariante`, `lib/config/marca-logo.ts`): vacío
 * cae al default de código, nunca una URL rota. Es DISTINTO del logo de nav: ESE es el wordmark/mark
 * (típicamente rectangular), esto es un ícono CUADRADO dedicado — usar el logo acá lo recortaría mal
 * a 16×16.
 */
export function iconosDeTienda(icono: string): NonNullable<Metadata['icons']> {
  const url = icono.trim();
  if (url === '') return ICONOS_ESTATICOS_POR_DEFECTO;
  const type = tipoDeIconoSubido(url);
  return {
    icon: [{ url, type }],
    apple: { url, type },
    shortcut: url,
  };
}

/** El gemelo de `iconosDeTienda` para el manifest PWA (§ `GET /api/manifest`): mismo ícono subido si
 *  existe (con `sizes: 'any'` — no conocemos sus dimensiones reales, y `'any'` es válido para SVG
 *  **y** aceptable para un PNG cuadrado dedicado), o los tres PNG de Nayoli si no. */
export function iconosManifestDeTienda(icono: string): IconoManifest[] {
  const url = icono.trim();
  if (url === '') return ICONOS_MANIFEST_POR_DEFECTO;
  return [{ src: url, sizes: 'any', type: tipoDeIconoSubido(url) }];
}

/**
 * Título + descripción de la tienda, en la forma `absolute`+`template` que evita la trampa ya
 * documentada (§ Identidad, CLAUDE.md): un `title.default` de segmento hijo SIGUE pasando por el
 * `template` de la raíz (Nayoli), así que la home salía duplicada "Café Nayoli · Café Nayoli".
 * `absolute` ignora el template heredado; el `template` de esta misma función es el que aplican los
 * hijos (p. ej. `/nosotros`, que pasaría a "Nosotros · {nombre}").
 */
export function tituloYDescripcionDeTienda(nombre: string, descripcion: string): Pick<Metadata, 'title' | 'description'> {
  return {
    title: { absolute: nombre, template: `%s · ${nombre}` },
    description: descripcion,
  };
}
