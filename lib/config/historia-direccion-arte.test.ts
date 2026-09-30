import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import BrandStoryCentrada from '@/components/storefront/home/BrandStoryCentrada';
import BrandStoryColumnas from '@/components/storefront/home/BrandStoryColumnas';
import { SiteContentProvider } from '@/components/storefront/SiteContentProvider';
import { PreviewProvider } from '@/components/storefront/PreviewMode';

import { DEFAULTS } from './site-content-defaults';
import { transformAcomodo, parametrosAcomodoCollage, UMBRAL_ACOMODO } from '../animation';

// TEMAS-BRANDSTORY-DIRECCION-ARTE-1 — la variante `centrada` de brandStory (§ CORTE-BRANDSTORY-
// COLLAGE-1, la ÚNICA que usa el preset CORTE) gana la dirección de arte del prototipo: fotos
// inclinadas y superpuestas que se ACOMODAN con el progreso de scroll de la sección, no con un
// disparo único de `whileInView`. El motor vive en `lib/animation.ts`
// (`transformAcomodo`/`useProgresoAcomodo`), sobre `useScroll`+`useTransform` de framer-motion —no
// un listener de scroll propio—.
//
// § HISTORIA-COMO-MUESTRARIO-1 REESCRIBIÓ el eje de `transformAcomodo`: ya NO es un asiento VERTICAL
// (`translateY`, la aproximación anterior) sino la APERTURA HORIZONTAL real del prototipo
// (`translateX`, `js/home.js:288-297`) — los tests de abajo se re-miden contra ESE eje.
//
// § HISTORIA-FOTOS-PANEL-Y-GIRO-1 (gate del owner) SE APARTA de esa apertura horizontal: `transformAcomodo`
// SIGUE siendo la pieza GENÉRICA (recibe `aperturaPx` y lo aplica — sin cambio, por eso los tests de
// abajo que lo llaman DIRECTO con `aperturaPx=16` siguen afirmando su matemática tal cual), pero su
// ÚNICO llamador real (`parametrosAcomodoCollage`, `lib/animation.ts`) ahora SIEMPRE le pasa `aperturaPx:
// 0` — el collage de brandStory·centrada dejó de abrirse en X; sólo cambia de ángulo. Ver el test de
// integración de esta pieza más abajo, y `lib/animation.test.ts` para la afirmación pura de
// `parametrosAcomodoCollage`.
//
// LO QUE ESTE ARCHIVO PUEDE AFIRMAR SIN NAVEGADOR (§ CLAUDE.md — el carril rápido es DB-free y este
// repo no tiene jsdom): la MATEMÁTICA del scrub (pura, sin React) y el CABLEADO por render server
// (`renderToStaticMarkup`, sin scroll real). LO QUE NO PUEDE: el movimiento en sí — que
// `prefers-reduced-motion` resuelva `true` en tiempo real depende de `matchMedia`, que no existe en
// este carril. El PROXY verificable es la VISTA PREVIA del editor (`preview=true`), que atraviesa
// el MISMO gate `estatico` que movimiento reducido (§ el comentario de `BrandStoryCentrada.tsx`) —
// las dos razones colapsan al mismo código, así que ejercer una prueba la otra.

// ─── LA MATEMÁTICA PURA (`lib/animation.ts`) — sin React, sin navegador ─────────────────────────

test('transformAcomodo: estatico=true SIEMPRE "none", sin importar el progreso — el collage ACOMODADO y quieto (movimiento reducido / vista previa)', () => {
  assert.equal(transformAcomodo(-4, 16, 0, true), 'none');
  assert.equal(transformAcomodo(-4, 16, 0.4, true), 'none');
  assert.equal(transformAcomodo(-4, 16, 1, true), 'none');
  assert.equal(transformAcomodo(4, 16, -0.5, true), 'none', 'estatico gana incluso con un progreso fuera de rango');
});

test('transformAcomodo: estatico=false, progreso=0 — la figura arranca INCLINADA y SIN apertura (translateX en 0, el estado previo al scrub — `js/home.js:294` translateX primero, rotate después)', () => {
  assert.equal(transformAcomodo(-4, 16, 0, false), 'translateX(0.0px) rotate(-4.00deg)');
  assert.equal(transformAcomodo(3, 16, 0, false), 'translateX(0.0px) rotate(3.00deg)');
});

test('transformAcomodo: estatico=false, progreso=1 — la figura llega ACOMODADA: rotación en 0° Y apertura en su TOPE (el mismo VALOR visual que `estatico`, aunque la cadena difiera — `translateX(…)rotate(0.00deg)` vs `none`)', () => {
  assert.equal(transformAcomodo(-4, 16, 1, false), 'translateX(16.0px) rotate(0.00deg)');
  assert.equal(transformAcomodo(3, 16, 1, false), 'translateX(16.0px) rotate(0.00deg)');
});

test('transformAcomodo: progreso se acota a [0,1] — un valor fuera de rango no sobre-rota/sobre-abre ni invierte el signo', () => {
  assert.equal(transformAcomodo(-4, 16, -0.5, false), transformAcomodo(-4, 16, 0, false));
  assert.equal(transformAcomodo(-4, 16, 1.5, false), transformAcomodo(-4, 16, 1, false));
});

test('UMBRAL_ACOMODO reproduce los umbrales MEDIDOS del prototipo (`docs/prototipos/cafeone/js/home.js:291`, `(p - 0.15) / 0.5`)', () => {
  assert.equal(UMBRAL_ACOMODO.desde, 0.15);
  assert.equal(UMBRAL_ACOMODO.hasta, 0.65); // 0.15 + 0.5, el mismo span que `js/home.js`
});

test('§ HISTORIA-FOTOS-PANEL-Y-GIRO-1: con la apertura que REALMENTE produce parametrosAcomodoCollage (0, siempre), transformAcomodo nunca desplaza en X — sólo cambia el ángulo, para 1 a 4 fotos y todo el recorrido del scroll', () => {
  for (let total = 1; total <= 4; total++) {
    for (let posicion = 0; posicion < total; posicion++) {
      const { rotarInicialDeg, aperturaPx } = parametrosAcomodoCollage(posicion, total);
      for (const progreso of [0, 0.25, 0.5, 0.75, 1]) {
        const t = transformAcomodo(rotarInicialDeg, aperturaPx, progreso, false);
        assert.match(t, /^translateX\(0\.0px\) rotate\(-?\d+\.\d{2}deg\)$/, `total=${total} posicion=${posicion} progreso=${progreso}: "${t}"`);
      }
    }
  }
});

// ─── EL CABLEADO — render vía `SiteContentProvider`, sin jsdom (`renderToStaticMarkup`) ─────────

function renderCentrada(opts: { preview?: boolean } = {}): string {
  const arbol = React.createElement(SiteContentProvider, {
    value: DEFAULTS,
    children: React.createElement(BrandStoryCentrada),
  });
  return renderToStaticMarkup(opts.preview ? React.createElement(PreviewProvider, { children: arbol }) : arbol);
}

test('EL ESTADO REDUCIDO (proxy: vista previa) — las 4 figuras del collage rinden `transform:none`, ninguna a medio inclinar', () => {
  const html = renderCentrada({ preview: true });
  // Acotado a las tarjetas del collage (`aspect-[3/4]`): el texto (eyebrow/título/párrafos) usa su
  // PROPIO `motion.div` con `fadeUp` y también resuelve `transform:none` en preview (y:0 → sin
  // transform) — correcto, pero es OTRO mecanismo (§ el switch `preview` de siempre en esta
  // variante), no el que este test verifica.
  const acomodadas = html.match(/style="transform:none" class="relative aspect-\[3\/4\]/g) || [];
  assert.equal(acomodadas.length, 4, 'las cuatro figuras del collage deben quedar en su transform final, no en el de arranque');
  assert.ok(!/rotate\(-?\d/.test(html), 'ninguna figura debe quedar tildada/a medio inclinar bajo el gate estático');
});

test('SIN el gate estático (SSR, sin scroll real: progreso arranca en 0) — las 4 figuras arrancan en su transform de INICIO, inclinadas', () => {
  const html = renderCentrada();
  // DEFAULTS.brandStory trae las 4 imágenes llenas (Nayoli), así que `totalVisible=4` — un total PAR,
  // sin "figura del medio" (§ `parametrosAcomodoCollage`, `lib/animation.ts`: el prototipo sólo define
  // esa simetría para 3). La regla general da magnitud CONSTANTE por lado: posición < centro → -4°,
  // posición > centro → +4° — imagen1/imagen2 comparten signo, imagen3/imagen4 comparten el opuesto.
  // A progreso=0 la apertura (`translateX`) es 0 para las 4 (t=0 anula cualquier magnitud) — sólo la
  // rotación es visible en este punto, así que se cuenta por OCURRENCIAS, no por imagen individual
  // (dos figuras a cada lado producen la MISMA cadena a t=0).
  const negativas = html.match(/translateX\(0\.0px\) rotate\(-4\.00deg\)/g) || [];
  const positivas = html.match(/translateX\(0\.0px\) rotate\(4\.00deg\)/g) || [];
  assert.equal(negativas.length, 2, 'imagen1/imagen2 (posición < centro, total=4) arrancan con rotación -4°');
  assert.equal(positivas.length, 2, 'imagen3/imagen4 (posición > centro, total=4) arrancan con rotación +4°');
  assert.ok(!html.includes('transform:none'), 'sin el gate estático, ninguna figura debe rendir ya-acomodada en el primer render');
});

// ─── LA INVARIANTE: `columnas` (Nayoli) NO CONSUME EL MOTOR NUEVO ───────────────────────────────

test('BrandStoryColumnas no importa el motor de scroll-scrub nuevo — la canónica (Nayoli) queda intacta', () => {
  const columnasPath = path.join(
    fileURLToPath(new URL('.', import.meta.url)),
    '../../components/storefront/home/BrandStoryColumnas.tsx',
  );
  const src = readFileSync(columnasPath, 'utf8');
  assert.doesNotMatch(
    src,
    /useProgresoAcomodo|transformAcomodo|useScroll|useReducedMotion/,
    'columnas no debe consumir ninguna pieza del motor nuevo (ni el hook, ni la función pura, ni framer-motion directo)',
  );
  assert.match(
    src,
    /^import \{ fadeUp \} from "@\/lib\/animation";$/m,
    'el import de lib/animation en columnas se queda igual — sólo `fadeUp`, sin ampliarse',
  );
});

test('BrandStoryColumnas sigue renderizando sin cambios de contenido — smoke render tras el cambio compartido en lib/animation.ts', () => {
  const arbol = React.createElement(SiteContentProvider, {
    value: DEFAULTS,
    children: React.createElement(BrandStoryColumnas),
  });
  const html = renderToStaticMarkup(arbol);
  assert.ok(html.includes(DEFAULTS.brandStory.titulo), 'columnas debe seguir rindiendo el título de brandStory, sin tocar');
  assert.ok(!/rotate\(/.test(html), 'columnas no tiene collage con rotación — su 2×2 no usa `rotar`/`transformAcomodo`');
});
