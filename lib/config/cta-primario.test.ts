import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

// § CTA-PRIMARIO-COLOR-Y-HOVER-1 — censo de los CONSUMIDORES del par CTA-primario del storefront.
//
// `palette-derive.test.ts` ya afirma la LÓGICA pura (`accion-txt`/`accion-hover`: byte-idéntica sin
// el eje, y el rojo oscurecido sin desviar el hue con `origenAccion:'acento'`). Ese test NO puede
// ver el hueco que este slice existía para cerrar: un token bien derivado que ningún componente
// consume deja la pantalla exactamente igual de rota. Éste es el test que falla si alguien migra
// `palette-derive.ts` pero se olvida un botón, o si un botón nuevo nace con el patrón VIEJO.
//
// MÉTODO: source-grep, no render — la mayoría de estos componentes cuelgan de `useSiteContent()`/
// `useCartStore()` (contexts que revientan sin su Provider, § CLAUDE.md "Montar un componente en
// OTRO árbol de providers…") y no tienen forma barata de montarse aislados como hizo
// `cromo-carrito.test.ts` (que tuvo que EXTRAER `CartTitulo`/`CartCTA` a componentes sin contexto
// para poder montarlos). Extraer los 9 CTA de esta familia a sub-componentes sería un refactor de
// nueve archivos fuera del alcance de este slice — el mismo criterio que ya vetó tocar
// `lib/storefront/pdp-botones.ts` (afuera de `touches:`). El source-grep es el mecanismo que el
// propio repo ya usa cuando montar de verdad no es barato (§ CLAUDE.md, el grep de
// `reference.html`, el censo por contenido de `guarda-color.ts`).

const RAIZ = path.join(__dirname, '..', '..');
const leer = (rel: string) => readFileSync(path.join(RAIZ, rel), 'utf8');

// Los 9 CTA primarios de la familia (§ el gate visual del owner: "el 'Comprar' de 'Elige tu
// presentación', el botón de volver arriba y el resto de la familia") — el conjunto EXACTO que
// tenía el patrón viejo (`bg-[var(--sf-accion,var(--sf-tostado))]` + `text-[var(--sf-tinta)]` +
// `hover:bg-[var(--sf-tostado-4)]`) antes de este slice, medido con
// `grep -rln "hover:bg-\[var(--sf-tostado-4)\]"` contra el repo completo. `CartDrawer.tsx` aporta
// DOS de los usos de `--sf-accion` (la barra de envío gratis Y el CTA "Ir al Checkout") pero sólo
// el CTA es parte de esta familia — la barra no lleva texto ni hover, es un relleno.
const CONSUMIDORES = [
  'components/storefront/BackToTop.tsx',
  'components/storefront/CartDrawer.tsx',
  'components/storefront/home/GrindChooserRiel.tsx',
  'components/storefront/home/BrandStoryCentrada.tsx',
  'components/storefront/home/SubscriptionCTABloque.tsx',
  'components/storefront/home/SubscriptionCTALinea.tsx',
  'components/storefront/home/HeroMedia.tsx',
  'components/storefront/home/HeroCurtina.tsx',
  'components/storefront/home/HeroFicha.tsx',
  'components/storefront/nosotros/NosotrosCierre.tsx',
] as const;

for (const archivo of CONSUMIDORES) {
  test(`${archivo}: el CTA primario usa --sf-accion-txt (texto) con fallback a --sf-tinta`, () => {
    const src = leer(archivo);
    assert.match(
      src,
      /text-\[var\(--sf-accion-txt,var\(--sf-tinta\)\)\]/,
      `${archivo} no migró el texto/ícono del CTA a --sf-accion-txt`,
    );
  });

  test(`${archivo}: el CTA primario usa --sf-accion-hover (hover) con fallback a --sf-tostado-4`, () => {
    const src = leer(archivo);
    assert.match(
      src,
      /hover:bg-\[var\(--sf-accion-hover,var\(--sf-tostado-4\)\)\]/,
      `${archivo} no migró el hover del CTA a --sf-accion-hover`,
    );
  });

  test(`${archivo}: sigue leyendo --sf-accion para el fondo (sin tocar) — el rol no cambió, sólo texto/hover`, () => {
    const src = leer(archivo);
    assert.match(src, /bg-\[var\(--sf-accion,var\(--sf-tostado\)\)\]/, `${archivo} debería seguir pintando el fondo con --sf-accion`);
  });
}

// ── El barrido: ningún .tsx del storefront conserva el patrón VIEJO ──────────────────────────────
// `hover:bg-[var(--sf-tostado-4)]` A SECAS (sin el fallback de `--sf-accion-hover` delante) es
// justo el literal que esta familia tenía. Si reaparece en cualquier .tsx del storefront —un CTA
// nuevo copiado del patrón viejo, o una reversión parcial— este barrido lo atrapa sin tener que
// mantener la lista de arriba actualizada a mano.
function* walkTsx(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules') continue;
    const full = path.join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      yield* walkTsx(full);
    } else if (entry.endsWith('.tsx')) {
      yield full;
    }
  }
}

const RAICES_STOREFRONT = ['components/storefront', 'app/(storefront)'];

test('barrido: ningún .tsx de components/storefront/ o app/(storefront)/ conserva `hover:bg-[var(--sf-tostado-4)]` SIN el fallback de --sf-accion-hover delante', () => {
  const ofensores: string[] = [];
  for (const raiz of RAICES_STOREFRONT) {
    for (const archivo of walkTsx(path.join(RAIZ, raiz))) {
      const src = readFileSync(archivo, 'utf8');
      if (/hover:bg-\[var\(--sf-tostado-4\)\]/.test(src)) {
        ofensores.push(path.relative(RAIZ, archivo));
      }
    }
  }
  assert.deepEqual(ofensores, [], `patrón viejo aún presente en: ${ofensores.join(', ')}`);
});

test('barrido: la lista `CONSUMIDORES` de arriba es EXHAUSTIVA — ningún .tsx del storefront usa `--sf-accion-hover` fuera de esos 9 archivos + palette-derive.ts', () => {
  const conAccionHover: string[] = [];
  for (const raiz of RAICES_STOREFRONT) {
    for (const archivo of walkTsx(path.join(RAIZ, raiz))) {
      const src = readFileSync(archivo, 'utf8');
      if (src.includes('--sf-accion-hover')) {
        conAccionHover.push(path.relative(RAIZ, archivo).replace(/\\/g, '/'));
      }
    }
  }
  assert.deepEqual(conAccionHover.sort(), [...CONSUMIDORES].sort());
});
