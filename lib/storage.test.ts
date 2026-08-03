import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  envPrefix, buildPathname, sanitizeFilename, isManaged, isDeletable, DEFAULT_PREFIX,
} from './storage';

// El store de Blob es UNO SOLO para todos los entornos (no tiene ramas como
// Neon), así que el aislamiento entre producción y pruebas es enteramente este
// cálculo de prefijo. Si se equivoca, un upload de prueba aterriza junto a los
// reales y una limpieza de pruebas puede borrar catálogo. De ahí los tests.

const env = (v: Record<string, string | undefined>) => v as NodeJS.ProcessEnv;

// ─── envPrefix ────────────────────────────────────────────────────────────────

test('solo la producción de Vercel escribe sin prefijo', () => {
  assert.equal(envPrefix(env({ VERCEL_ENV: 'production' })), '');
});

test('preview y development de Vercel van a dev/', () => {
  assert.equal(envPrefix(env({ VERCEL_ENV: 'preview' })), 'dev/');
  assert.equal(envPrefix(env({ VERCEL_ENV: 'development' })), 'dev/');
});

test('sin VERCEL_ENV se asume NO producción — el fallo posible ensucia dev/, no el prefijo real', () => {
  assert.equal(envPrefix(env({})), 'dev/');
  // Un `next start` local pone NODE_ENV=production; eso NO alcanza para escribir
  // en el prefijo real: la única evidencia válida es VERCEL_ENV.
  assert.equal(envPrefix(env({ NODE_ENV: 'production' })), 'dev/');
});

test('un VERCEL_ENV desconocido no se interpreta como producción', () => {
  assert.equal(envPrefix(env({ VERCEL_ENV: 'PRODUCTION' })), 'dev/');
  assert.equal(envPrefix(env({ VERCEL_ENV: '' })), 'dev/');
});

// ─── buildPathname ────────────────────────────────────────────────────────────

test('la ruta es [dev/]<prefix>/<archivo>', () => {
  const prod = env({ VERCEL_ENV: 'production' });
  assert.equal(buildPathname('cafe.jpg', DEFAULT_PREFIX, prod), 'productos/cafe.jpg');
  assert.equal(buildPathname('cafe.jpg', DEFAULT_PREFIX, env({})), 'dev/productos/cafe.jpg');
});

test('el prefijo es parametrizable — es el futuro scope por tienda', () => {
  assert.equal(
    buildPathname('logo.png', 'tienda-123/productos', env({ VERCEL_ENV: 'production' })),
    'tienda-123/productos/logo.png',
  );
});

test('el default del prefijo es productos/', () => {
  assert.equal(buildPathname('x.webp', undefined, env({ VERCEL_ENV: 'production' })), 'productos/x.webp');
});

// ─── sanitizeFilename ─────────────────────────────────────────────────────────

test('el nombre no puede escaparse de su carpeta', () => {
  assert.equal(sanitizeFilename('../../etc/passwd'), 'passwd');
  assert.equal(sanitizeFilename('C:\\temp\\foto.png'), 'foto.png');
  // Y ya dentro de la ruta completa, el prefijo se conserva intacto.
  assert.equal(
    buildPathname('../../secreto.png', DEFAULT_PREFIX, env({ VERCEL_ENV: 'production' })),
    'productos/secreto.png',
  );
});

test('tildes, espacios y símbolos se normalizan conservando la extensión', () => {
  assert.equal(sanitizeFilename('Café Molido 500g.JPG'), 'Cafe-Molido-500g.JPG');
  assert.equal(sanitizeFilename('foto (1).png'), 'foto-1-.png');
});

test('un nombre que se queda en nada cae a un default utilizable', () => {
  assert.equal(sanitizeFilename('...'), 'archivo');
  assert.equal(sanitizeFilename(''), 'archivo');
});

// ─── isManaged — la guarda del borrado ────────────────────────────────────────

test('solo las URLs del store propio son borrables', () => {
  assert.equal(isManaged('https://abc123.public.blob.vercel-storage.com/productos/x-9f2.jpg'), true);
});

test('las imágenes estáticas de public/ NO las administra el adaptador', () => {
  // Regla de inmutabilidad de public/ (CLAUDE.md): el admin no puede borrarlas
  // ni por accidente al reemplazar la imagen de un producto viejo.
  assert.equal(isManaged('/images/cafe-grano-v2.jpg'), false);
  assert.equal(isManaged(''), false);
});

test('una URL externa tampoco se toca', () => {
  assert.equal(isManaged('https://images.unsplash.com/photo-123'), false);
  // Ojo con el sufijo: un host que solo TERMINA parecido no basta si no lo es.
  assert.equal(isManaged('https://evil.com/x.public.blob.vercel-storage.com'), false);
});

// ─── isDeletable — la guarda de "dev no borra blobs de producción" ────────────
// La base `development` se re-crea por reset desde `production`, así que sus
// filas apuntan a los blobs REALES que producción sirve. Probar un reemplazo de
// imagen en local no puede tumbar la imagen del catálogo en vivo.

const STORE = 'https://bh1msk3nadhfmyob.public.blob.vercel-storage.com';
const REAL = `${STORE}/productos/cafe-aBc123.webp`;
const DEV  = `${STORE}/dev/productos/cafe-aBc123.webp`;

test('en dev, borrar un blob del prefijo REAL es un no-op', () => {
  assert.equal(isDeletable(REAL, env({})), false);
  assert.equal(isDeletable(REAL, env({ VERCEL_ENV: 'preview' })), false);
  assert.equal(isDeletable(REAL, env({ VERCEL_ENV: 'development' })), false);
});

test('en dev, borrar bajo dev/ sí se ejecuta', () => {
  assert.equal(isDeletable(DEV, env({})), true);
  assert.equal(isDeletable(DEV, env({ VERCEL_ENV: 'preview' })), true);
});

test('producción borra sin restricción de prefijo — sus blobs son suyos', () => {
  const prod = env({ VERCEL_ENV: 'production' });
  assert.equal(isDeletable(REAL, prod), true);
  // Y también puede limpiar lo que quedó bajo dev/ (mismo store).
  assert.equal(isDeletable(DEV, prod), true);
});

test('la guarda de prefijo no rescata a una URL que ni siquiera es del store', () => {
  assert.equal(isDeletable('/images/cafe-nayoli-500g-molido-v2.webp', env({})), false);
  assert.equal(isDeletable('https://images.unsplash.com/dev/productos/x.jpg', env({})), false);
});

test('un prefijo que solo EMPIEZA parecido no cuenta como dev/', () => {
  // `devastador/` no es `dev/`: la comparación es por segmento de ruta completo.
  assert.equal(isDeletable(`${STORE}/devastador/productos/x.webp`, env({})), false);
});
