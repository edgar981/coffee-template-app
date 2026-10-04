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
// LOS TRES DE § SECCIONES-INSTANCIAS-1 (Texto/ImagenTexto/Banner, `components/storefront/
// secciones/`) COPIAN el patrón de `BrandStoryCentrada.tsx` tal cual nacen — un CTA nuevo que
// nace con el patrón VIEJO es justo lo que este censo existe para atrapar; nacer ya migrado evita
// la migración futura, pero el censo sigue siendo exhaustivo: hay que nombrarlos acá para que el
// barrido de abajo no los vea como "fuera de lista".
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
  'components/storefront/secciones/Texto.tsx',
  'components/storefront/secciones/ImagenTexto.tsx',
  'components/storefront/secciones/Banner.tsx',
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

// ── § CTA-HOVER-RESTO-FAMILIA-1 + § CTA-HOVER-CENSO-FINAL-1 — EL RESTO, MISMO SUB-PATRÓN ──────────
// StoreNav.tsx/Spotlight.tsx/pdp-botones.ts NO comparten el patrón de arriba (fondo
// `--sf-accion,var(--sf-tostado)` + texto `--sf-accion-txt,var(--sf-tinta)`): pintan el fondo con
// `--sf-acento` CRUDO (no la indirección `accion`) y su texto ya era `--sf-acento-txt` correcto
// desde `PARIDAD-PDP-BOTONES-1`/`CROMO-NAV-CTA-Y-BADGE-1` — el defecto que este slice cierra era
// SÓLO el hover/active (`--sf-acento-3`/`-2`, que desviaba el hue hacia la tinta). Por eso NO
// entran al loop `CONSUMIDORES` de arriba (fallarían la aserción de fondo/texto, que no aplica) —
// tienen su propio par de aserciones, y `pdp-botones.ts` además tiene su verificación PURA en
// `lib/storefront/pdp-botones.test.ts` (no source-grep: exporta la función que arma la clase).
//
// § CTA-HOVER-CENSO-FINAL-1 sumó los SIETE consumidores del censo ampliado de
// `CTA-HOVER-RESTO-FAMILIA-1` (`ACENTO-2-3-HOVER-HUE-SHIFT-2`, nombrados y dejados fuera de
// `touches:` en ese slice): mismo sub-patrón exacto (`bg-[var(--sf-acento)]` crudo,
// `text-[var(--sf-acento-txt)]` ya correcto, `hover:bg-[var(--sf-acento-3)]` SIN `active:` propio
// — a diferencia de StoreNav/Spotlight, que ya traían `active:bg-[var(--sf-acento-2)]` antes de
// migrar). Ninguno de los siete tenía active previo; los siete ganan `active:bg-[var(--sf-accion-
// active,var(--sf-tostado-3))]` de cero, junto con el hover, cerrando la familia entera.
//
// § CTA-APLICAR-FILTRO-HOVER-1 había sumado `FiltrarOrdenar.tsx` (el botón "Aplicar filtro" del
// panel de /tienda bajo CORTE, § TIENDA-ENCABEZADO-Y-FILTRAR-ORDENAR-1) a esta lista. **SALIÓ
// (§ FILTRAR-SIN-BOTON-APLICAR-1, 2026-10-02):** el owner pidió retirar ese botón porque cada
// filtro del panel ya aplica al cambiar — el botón sólo cerraba el panel sin aplicar nada. Sin
// botón, `FiltrarOrdenar.tsx` no tiene ningún CTA de esta familia que afirmar.
const CONSUMIDORES_HOVER_ACTIVE = [
  'components/storefront/layout/StoreNav.tsx',
  'components/storefront/home/Spotlight.tsx',
  'app/(storefront)/rastrear-pedido/page.tsx',
  'app/(storefront)/checkout/retorno/RetornoCliente.tsx',
  'app/(storefront)/checkout/page.tsx',
  'components/storefront/home/Newsletter.tsx',
  'components/storefront/checkout/FormularioTarjeta.tsx',
  'components/storefront/suscripciones/SuscripcionPlanes.tsx',
  'components/storefront/checkout/FormularioOtroMetodoPasarela.tsx',
] as const;

for (const archivo of CONSUMIDORES_HOVER_ACTIVE) {
  test(`${archivo}: el CTA usa --sf-accion-hover (hover) con fallback a --sf-tostado-4`, () => {
    const src = leer(archivo);
    assert.match(
      src,
      /hover:bg-\[var\(--sf-accion-hover,var\(--sf-tostado-4\)\)\]/,
      `${archivo} no migró el hover del CTA a --sf-accion-hover`,
    );
  });

  test(`${archivo}: el CTA usa --sf-accion-active (active) con fallback a --sf-tostado-3`, () => {
    const src = leer(archivo);
    assert.match(
      src,
      /active:bg-\[var\(--sf-accion-active,var\(--sf-tostado-3\)\)\]/,
      `${archivo} no migró el active del CTA a --sf-accion-active`,
    );
  });

  test(`${archivo}: NO conserva el mecanismo viejo de hover/active (--sf-acento-3/--sf-acento-2, el hue-shift hacia la tinta)`, () => {
    // Blanco de `--sf-acento-2`/`-3` a secas NO sirve de discriminador acá: StoreNav.tsx sigue
    // usando `--sf-acento-2` como color de TEXTO del nav móvil (líneas ~812/827, fuera de esta
    // familia) y ambos archivos nombran los tokens viejos en su propio comentario explicativo. El
    // discriminador real es la CLASE de hover/active del BOTÓN, que es lo que este slice migró.
    const src = leer(archivo);
    assert.doesNotMatch(src, /hover:bg-\[var\(--sf-acento-3\)\]/, `${archivo} todavía usa hover:bg-[var(--sf-acento-3)]`);
    assert.doesNotMatch(src, /active:bg-\[var\(--sf-acento-2\)\]/, `${archivo} todavía usa active:bg-[var(--sf-acento-2)]`);
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

test('barrido: `CONSUMIDORES` + `CONSUMIDORES_HOVER_ACTIVE` son EXHAUSTIVAS — ningún .tsx del storefront usa `--sf-accion-hover` fuera de esos 19 archivos + palette-derive.ts', () => {
  const conAccionHover: string[] = [];
  for (const raiz of RAICES_STOREFRONT) {
    for (const archivo of walkTsx(path.join(RAIZ, raiz))) {
      const src = readFileSync(archivo, 'utf8');
      if (src.includes('--sf-accion-hover')) {
        conAccionHover.push(path.relative(RAIZ, archivo).replace(/\\/g, '/'));
      }
    }
  }
  assert.deepEqual(conAccionHover.sort(), [...CONSUMIDORES, ...CONSUMIDORES_HOVER_ACTIVE].sort());
});

test('barrido: `CONSUMIDORES_HOVER_ACTIVE` es EXHAUSTIVA para `--sf-accion-active` — ningún .tsx del storefront la usa fuera de esos 9 archivos + palette-derive.ts (pdp-botones.ts es .ts, fuera de este barrido de .tsx — cubierto por su propio test PURO)', () => {
  const conAccionActive: string[] = [];
  for (const raiz of RAICES_STOREFRONT) {
    for (const archivo of walkTsx(path.join(RAIZ, raiz))) {
      const src = readFileSync(archivo, 'utf8');
      if (src.includes('--sf-accion-active')) {
        conAccionActive.push(path.relative(RAIZ, archivo).replace(/\\/g, '/'));
      }
    }
  }
  assert.deepEqual(conAccionActive.sort(), [...CONSUMIDORES_HOVER_ACTIVE].sort());
});
