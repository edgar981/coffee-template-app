import { test, beforeEach, afterEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/icono-tienda/route';
import { ENCABEZADO_VARIANTE_ICONO, huellaIcono } from '@/lib/config/metadata-tienda';
import { siteContentEditableSchema } from '@/lib/config/site-content-schema';
import { guardarBorrador, publicarSeccion } from '@/lib/config/site-content-write';
import { prisma } from './fixtures';

// EL PROBE CIEGO del navegador (§ FAVICON-RUTA-POR-TIENDA-1, cierra el open-followup
// `METADATA-FAVICON-PROBE-CIEGO-1`): `/favicon.ico`, `/apple-touch-icon.png` y
// `/apple-touch-icon-precomposed.png` se REESCRIBEN por `proxy.ts` hacia
// `GET /api/icono-tienda`, que decide contra `SiteContent` real. Contra Postgres efímero
// (no un mock) porque lo que se afirma es la DECISIÓN leyendo la fila, no la forma del objeto
// que arma `decidirIconoRuta` (eso ya lo prueba `lib/config/metadata-tienda.test.ts`, capa 1).
//
// § FAVICON-MISMO-ORIGEN-1: con ícono subido la ruta YA NO redirige a otro dominio — OBTIENE
// los bytes del blob (del lado del servidor) y los sirve ella misma. Acá no hay red real (el
// carril no tiene acceso a Internet, y tampoco debería depender de él): se STUBEA `global.fetch`,
// mismo patrón que `services/checkout.service.test.ts`/`lib/pagos/creacion-transaccion.test.ts`.

const LOGO_SCHEMA = siteContentEditableSchema.pick({ logo: true });

/** Publica `logo.icono` reusando la MISMA máquina que el panel (§ `encabezado-logo.test.ts`). */
async function publicarIcono(icono: string) {
  const parsed = LOGO_SCHEMA.parse({ logo: { icono } });
  await guardarBorrador(parsed);
  await publicarSeccion('logo');
}

/** La variante viaja por HEADER, como la pone `proxy.ts` para el probe ciego (§ el comentario de
 *  ese archivo — medido que el query param NO le llega a la ruta a través del rewrite). Un hit
 *  VERSIONADO (`?v=`, el que el `<link>`/manifest declaran, § `urlIconoVersionada`) nunca lleva
 *  este header — nadie lo rewritea, el navegador pega directo a esta URL. */
function requestDe(variante: 'favicon' | 'apple', opts: { v?: string } = {}) {
  const query = opts.v !== undefined ? `?v=${opts.v}` : '';
  return new NextRequest(`http://localhost/api/icono-tienda${query}`, {
    headers: { [ENCABEZADO_VARIANTE_ICONO]: variante },
  });
}

/** El hit DIRECTO desde `<link>`/manifest: `?v=<huella>`, SIN el header de variante — así es como
 *  `urlIconoVersionada` arma la URL y así la pide el navegador, sin pasar por `proxy.ts`. */
function requestVersionada(icono: string) {
  return new NextRequest(`http://localhost/api/icono-tienda?v=${huellaIcono(icono)}`);
}

const fetchOriginal = global.fetch;

function stubFetchIcono(bytes: Buffer, opts: { ok?: boolean; status?: number } = {}) {
  const ok = opts.ok ?? true;
  const status = opts.status ?? 200;
  global.fetch = (async () => ({
    ok,
    status,
    async arrayBuffer() {
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    },
  })) as unknown as typeof fetch;
}

function stubFetchFalla() {
  global.fetch = (async () => {
    throw new Error('network down (simulado)');
  }) as unknown as typeof fetch;
}

beforeEach(async () => { await prisma.siteContent.deleteMany({}); });
afterEach(() => { global.fetch = fetchOriginal; });
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

// ── CON ícono subido: la ruta SIRVE LOS BYTES, por el MISMO origen, SIN redirigir ──────────────

test('con logo.icono publicado, variante favicon: 200 con los bytes OBTENIDOS DEL BLOB, sin redirección', async () => {
  const icono = 'https://blob.example/contenido/icono-chamisas.png';
  await publicarIcono(icono);
  const bytesDelBlob = Buffer.from('bytes-del-icono-png-de-prueba');
  stubFetchIcono(bytesDelBlob);

  const res = await GET(requestDe('favicon'));
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('location'), null, 'nunca una redirección a otro dominio');
  assert.equal(res.headers.get('content-type'), 'image/png');
  const recibido = Buffer.from(await res.arrayBuffer());
  assert.ok(recibido.equals(bytesDelBlob), 'los bytes son los que el blob devolvió, servidos por este origen');
});

test('con logo.icono publicado, variante apple: 200 con los MISMOS bytes del blob (el ícono no cambia por variante)', async () => {
  const icono = 'https://blob.example/contenido/icono-chamisas.svg';
  await publicarIcono(icono);
  const bytesDelBlob = Buffer.from('<svg>bytes de prueba</svg>');
  stubFetchIcono(bytesDelBlob);

  const res = await GET(requestDe('apple'));
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('location'), null);
  assert.equal(res.headers.get('content-type'), 'image/svg+xml');
  const recibido = Buffer.from(await res.arrayBuffer());
  assert.ok(recibido.equals(bytesDelBlob));
});

test('con ícono subido, el hit VERSIONADO (?v=, el que declara el <link>/manifest) lleva cache LARGO e inmutable', async () => {
  const icono = 'https://blob.example/contenido/icono-chamisas.png';
  await publicarIcono(icono);
  stubFetchIcono(Buffer.from('bytes'));

  const res = await GET(requestVersionada(icono));
  assert.equal(res.status, 200);
  const cache = res.headers.get('cache-control') ?? '';
  assert.match(cache, /max-age=31536000/);
  assert.match(cache, /immutable/);
});

test('con ícono subido, el probe ciego vía proxy.ts (SIN ?v=) lleva cache CORTO — la URL es fija, no se puede versionar', async () => {
  const icono = 'https://blob.example/contenido/icono-chamisas.png';
  await publicarIcono(icono);
  stubFetchIcono(Buffer.from('bytes'));

  const res = await GET(requestDe('favicon'));
  const cache = res.headers.get('cache-control') ?? '';
  assert.match(cache, /max-age=300\b/, 'el probe ciego debe cachear menos que el estático de hoy');
  assert.doesNotMatch(cache, /immutable/);
});

test('con ícono subido pero el blob NO RESPONDE (fetch falla): cae al estático de la variante, nunca un 500', async () => {
  await publicarIcono('https://blob.example/contenido/icono-chamisas.png');
  stubFetchFalla();

  const res = await GET(requestDe('apple'));
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'image/png');

  const esperado = await readFile(path.join(process.cwd(), 'public', 'apple-icon.png'));
  const recibido = Buffer.from(await res.arrayBuffer());
  assert.ok(recibido.equals(esperado), 'cae al PNG estático de Nayoli para la variante apple');
});

test('con ícono subido pero el blob responde con error (ok:false): cae al estático de la variante, nunca un 500', async () => {
  await publicarIcono('https://blob.example/contenido/icono-chamisas.png');
  stubFetchIcono(Buffer.from('no importa'), { ok: false, status: 404 });

  const res = await GET(requestDe('favicon'));
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'image/vnd.microsoft.icon');

  const esperado = await readFile(path.join(process.cwd(), 'public', 'favicon.ico'));
  const recibido = Buffer.from(await res.arrayBuffer());
  assert.ok(recibido.equals(esperado), 'cae al .ico estático de Nayoli para la variante favicon');
});
