import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import postcss from 'postcss';
import tailwindcss from '@tailwindcss/postcss';

import { contenedorAnchoClase } from './themes';

// § PARIDAD-CORTENAV-CASCADA-1 — el breakpoint PROPIO de CORTE (`--breakpoint-cortenav:1200px`,
// `app/globals.css`) perdía la cascada contra `sm:` en la hoja COMPILADA: a viewports ≥1200px, el
// encabezado desplegado rendía 24px/88px en vez de los 32px/118px que su propio literal
// (`cortenav:px-8`/`cortenav:h-[118px]`) declaraba. Medido en producción por `PARIDAD-ANCHO-
// CONTENIDO-1` (§ DECISIONS.md) y re-medido acá compilando `app/globals.css` con
// `@tailwindcss/postcss` en aislamiento — SIN `next build`, SIN base, SIN DOM.
//
// LA CAUSA: Tailwind v4 agrupa las variantes de ancho por la UNIDAD del valor declarado (`px` vs
// `rem`), no por su magnitud resuelta. Todo breakpoint declarado en `px` (`--breakpoint-duna`,
// `--breakpoint-cortenav`, cualquier `min-[Npx]:` arbitrario) cae en UN bloque de la hoja,
// ordenado ASCENDENTE por valor; el scale por defecto de Tailwind (`sm`/`md`/`lg`/`xl`/`2xl`, en
// `rem`) cae en OTRO bloque, completo, que la hoja emite DESPUÉS del bloque `px` — sin importar la
// magnitud relativa entre los dos bloques. Reordenar la declaración en `@theme` (incluso con
// `--breakpoint-*: initial` para resetear el namespace) NO cambia esto — probado y descartado, el
// criterio es la unidad, no el orden textual.
//
// EL FIX: los dos consumidores que combinaban `sm:` con `cortenav:` sobre la misma propiedad
// (`contenedorAnchoClase` acá, y `navFilaAltoClase` en `components/storefront/layout/StoreNav.tsx`)
// reescriben el paso de 640px como `min-[640px]:` — variante arbitraria en `px`, EXACTA a
// `sm`=40rem a la raíz de 16px por defecto — que cae en el MISMO bloque que `cortenav:` y ordena
// correctamente. `--breakpoint-sm` NUNCA se toca: el resto del storefront y del panel, todo `sm:`
// fuera de esos dos literales, queda byte-idéntico.
//
// `--breakpoint-duna` (960px, el panel admin) se censó: no combina con ningún breakpoint estándar
// sobre la misma propiedad en ningún consumidor actual, así que no sufre este defecto — no
// necesita la misma pieza hoy. Si alguna vez la gana, el criterio de abajo (unidad `px`, variante
// arbitraria para el paso menor) es el mismo.

function leerDeclaracionCss(nombre: string): string {
  const cssPath = path.join(fileURLToPath(new URL('.', import.meta.url)), '../../app/globals.css');
  const css = readFileSync(cssPath, 'utf8');
  const m = css.match(new RegExp(`--${nombre}:\\s*([^;]+);`));
  if (!m) throw new Error(`no se encontró --${nombre} en app/globals.css`);
  return m[1].trim();
}

test('--breakpoint-duna y --breakpoint-cortenav siguen declarados en `px`, no `rem` — cambiar la unidad los movería al bloque TARDÍO (el del scale por defecto) y reintroduciría el defecto para cualquier combinación futura con un breakpoint estándar', () => {
  assert.match(leerDeclaracionCss('breakpoint-duna'), /^\d+px$/);
  assert.match(leerDeclaracionCss('breakpoint-cortenav'), /^\d+px$/);
});

test('contenedorAnchoClase(true) no vuelve a combinar `sm:` con `cortenav:` — usa `min-[640px]:` (variante arbitraria en `px`, cae en el MISMO bloque que `cortenav:`)', () => {
  const clase = contenedorAnchoClase(true);
  assert.equal(clase.includes('min-[640px]:px-6'), true, `esperaba "min-[640px]:px-6" en: ${clase}`);
  assert.equal(clase.includes('sm:'), false, `"sm:" reaparecería en el bloque tardío y perdería la cascada contra "cortenav:": ${clase}`);
});

test('contenedorAnchoClase(false) — el literal de HOY (todo tenant salvo CORTE) sigue en `sm:`, byte-idéntico: este fix no toca ningún consumidor fuera de la rama CORTE', () => {
  assert.equal(contenedorAnchoClase(false), 'max-w-6xl px-4 sm:px-6 lg:px-8');
});

test('en la hoja COMPILADA (Tailwind v4 real, @tailwindcss/postcss, sin next build): `min-[640px]:` emite ANTES que `cortenav:` y `duna:` — con igual especificidad, `cortenav:`/`duna:` ganan la cascada a su viewport, que es el defecto medido resuelto', async () => {
  // Mirror de `navFilaAltoClase` (posicion:true) en `StoreNav.tsx` — no exportado del componente,
  // igual que `lib/config/cromo-nav-tratamiento.test.ts` ya mirrorea el mismo literal.
  const navFilaAltoClase = 'h-[76px] min-[640px]:h-[88px] cortenav:h-[118px]';
  const clases = `${contenedorAnchoClase(true)} ${navFilaAltoClase} duna:px-8`;

  const css = `
    @import "tailwindcss";
    @source inline("${clases}");
    @theme {
      --breakpoint-duna: 960px;
      --breakpoint-cortenav: 1200px;
    }
  `;
  const result = await postcss([tailwindcss()]).process(css, { from: 'breakpoints-cascada-virtual.css' });
  const out = result.css;

  const posMinPx = out.indexOf('.min-\\[640px\\]\\:px-6');
  const posCortenavPx = out.indexOf('.cortenav\\:px-8');
  const posMinH = out.indexOf('.min-\\[640px\\]\\:h-\\[88px\\]');
  const posCortenavH = out.indexOf('.cortenav\\:h-\\[118px\\]');
  const posDunaPx = out.indexOf('.duna\\:px-8');

  assert.ok(posMinPx >= 0, `no se encontró .min-\\[640px\\]\\:px-6 en la hoja compilada`);
  assert.ok(posCortenavPx >= 0, `no se encontró .cortenav\\:px-8 en la hoja compilada`);
  assert.ok(posMinH >= 0, `no se encontró .min-\\[640px\\]\\:h-\\[88px\\] en la hoja compilada`);
  assert.ok(posCortenavH >= 0, `no se encontró .cortenav\\:h-\\[118px\\] en la hoja compilada`);
  assert.ok(posDunaPx >= 0, `no se encontró .duna\\:px-8 en la hoja compilada`);

  assert.ok(
    posMinPx < posCortenavPx,
    `min-[640px]:px-6 (offset ${posMinPx}) debe emitir ANTES que cortenav:px-8 (offset ${posCortenavPx}) para que cortenav gane a ≥1200px`,
  );
  assert.ok(
    posMinH < posCortenavH,
    `min-[640px]:h-[88px] (offset ${posMinH}) debe emitir ANTES que cortenav:h-[118px] (offset ${posCortenavH}) para que cortenav gane a ≥1200px`,
  );
  assert.ok(
    posMinPx < posDunaPx && posDunaPx < posCortenavPx,
    `el bloque \`px\` ordena ASCENDENTE por valor: min-[640px](640) < duna(960) < cortenav(1200) — offsets ${posMinPx}, ${posDunaPx}, ${posCortenavPx}`,
  );
});
