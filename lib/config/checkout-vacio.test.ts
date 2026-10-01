import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// § CHECKOUT-VACIO-A-TIENDA-1 — gate del owner, 2026-09-30: en /checkout con el carrito vacío, el
// enlace "Explorar productos" llevaba a "/" (la home) en vez de "/tienda" (el catálogo), para
// todos los presets (Nayoli incluida — es la misma página).
//
// MÉTODO: source-grep, no render. `app/(storefront)/checkout/page.tsx` es `'use client'` y cuelga
// de `useCartStore()`/`useSiteSettings()`/`useSiteContent()` (contexts que revientan sin su
// Provider, § CLAUDE.md "Montar un componente en OTRO árbol de providers…"), y el repo no tiene
// jsdom para montar un `.tsx` de componente (§ CLAUDE.md, "El glob NO incluye *.test.tsx"). Mismo
// mecanismo que `cta-primario.test.ts` usa para la misma familia de archivos.

const RAIZ = path.join(__dirname, '..', '..');
const ARCHIVO = 'app/(storefront)/checkout/page.tsx';
const leer = () => readFileSync(path.join(RAIZ, ARCHIVO), 'utf8');

test('checkout vacío: "Explorar productos" apunta a /tienda, no a la home', () => {
  const src = leer();
  assert.match(
    src,
    /Tu carrito está vacío[\s\S]{0,400}?<Link href="\/tienda"[^>]*>← Explorar productos<\/Link>/,
    `${ARCHIVO}: el enlace de carrito vacío debería apuntar a /tienda`,
  );
});

test('checkout vacío: ya no queda un href="/" seguido de "Explorar productos" (el defecto original)', () => {
  const src = leer();
  assert.doesNotMatch(
    src,
    /<Link href="\/"[^>]*>← Explorar productos<\/Link>/,
    `${ARCHIVO}: el enlace de carrito vacío sigue apuntando a la home ("/")`,
  );
});
