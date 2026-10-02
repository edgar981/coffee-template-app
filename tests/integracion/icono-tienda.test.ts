import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/icono-tienda/route';
import { ENCABEZADO_VARIANTE_ICONO } from '@/lib/config/metadata-tienda';
import { siteContentEditableSchema } from '@/lib/config/site-content-schema';
import { guardarBorrador, publicarSeccion } from '@/lib/config/site-content-write';
import { prisma } from './fixtures';

// EL PROBE CIEGO del navegador (§ FAVICON-RUTA-POR-TIENDA-1, cierra el open-followup
// `METADATA-FAVICON-PROBE-CIEGO-1`): `/favicon.ico`, `/apple-touch-icon.png` y
// `/apple-touch-icon-precomposed.png` se REESCRIBEN por `proxy.ts` hacia
// `GET /api/icono-tienda`, que decide contra `SiteContent` real. Contra Postgres efímero
// (no un mock) porque lo que se afirma es la DECISIÓN leyendo la fila, no la forma del objeto
// que arma `decidirIconoRuta` (eso ya lo prueba `lib/config/metadata-tienda.test.ts`, capa 1).

const LOGO_SCHEMA = siteContentEditableSchema.pick({ logo: true });

/** Publica `logo.icono` reusando la MISMA máquina que el panel (§ `encabezado-logo.test.ts`). */
async function publicarIcono(icono: string) {
  const parsed = LOGO_SCHEMA.parse({ logo: { icono } });
  await guardarBorrador(parsed);
  await publicarSeccion('logo');
}

/** La variante viaja por HEADER, como la pone `proxy.ts` (§ el comentario de ese archivo —
 *  medido que el query param NO le llega a la ruta a través del rewrite). */
function requestDe(variante: 'favicon' | 'apple') {
  return new NextRequest('http://localhost/api/icono-tienda', {
    headers: { [ENCABEZADO_VARIANTE_ICONO]: variante },
  });
}

beforeEach(async () => { await prisma.siteContent.deleteMany({}); });
after(async () => { await prisma.siteContent.deleteMany({}); await prisma.$disconnect(); });

// ── SIN ícono subido: los MISMOS bytes y content-type que el estático de hoy ───────────────────

test('sin fila guardada, variante favicon: 200 con los bytes exactos de public/favicon.ico', async () => {
  const res = await GET(requestDe('favicon'));
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'image/vnd.microsoft.icon');

  const esperado = await readFile(path.join(process.cwd(), 'public', 'favicon.ico'));
  const recibido = Buffer.from(await res.arrayBuffer());
  assert.ok(recibido.equals(esperado), 'los bytes deben ser IDÉNTICOS al estático de Nayoli');
});

test('sin fila guardada, variante apple: 200 con los bytes exactos de public/apple-icon.png', async () => {
  const res = await GET(requestDe('apple'));
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'image/png');

  const esperado = await readFile(path.join(process.cwd(), 'public', 'apple-icon.png'));
  const recibido = Buffer.from(await res.arrayBuffer());
  assert.ok(recibido.equals(esperado), 'los bytes deben ser IDÉNTICOS al estático de Nayoli');
});

test('logo.icono publicado en vacío (fila existe, campo vacío): mismo fallback que sin fila', async () => {
  await publicarIcono('');
  const res = await GET(requestDe('favicon'));
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'image/vnd.microsoft.icon');
});

// ── CON ícono subido: la ruta REDIRIGE al ícono real, sin importar la variante pedida ───────────

test('con logo.icono publicado, variante favicon: 307 al ícono subido', async () => {
  await publicarIcono('https://blob.example/contenido/icono-chamisas.png');

  const res = await GET(requestDe('favicon'));
  assert.equal(res.status, 307);
  assert.equal(res.headers.get('location'), 'https://blob.example/contenido/icono-chamisas.png');
});

test('con logo.icono publicado, variante apple: 307 al MISMO ícono subido', async () => {
  await publicarIcono('https://blob.example/contenido/icono-chamisas.svg');

  const res = await GET(requestDe('apple'));
  assert.equal(res.status, 307);
  assert.equal(res.headers.get('location'), 'https://blob.example/contenido/icono-chamisas.svg');
});

test('con ícono subido, el redirect lleva un cache CORTO (no el 3600 del estático)', async () => {
  await publicarIcono('https://blob.example/contenido/icono-chamisas.png');

  const res = await GET(requestDe('favicon'));
  const cache = res.headers.get('cache-control') ?? '';
  assert.match(cache, /max-age=300\b/, 'el redirect debe cachear menos que el estático de hoy');
});
