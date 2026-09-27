import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MotionConfig } from 'framer-motion';
import {
  ReducedMotionProvider, valorContador, DURACION_CONTADOR_MS,
  transformMarquesinaTexto, transformMarquesinaTarjeta, indiceCentrado,
  progresoDesdeTope, veloOpacidad, VELO_OPACIDAD_PISO, rangoVeloDeIntensidad,
  transformRevelaTextoDisplay, UMBRAL_REVELADO_TEXTO,
  claseAlturaAncestroMarquesina, fadeUp,
  direccionScroll, navOculto, UMBRAL_OCULTAR_NAV, debeActualizarTratamientoNav,
  duracionTickerS, VELOCIDAD_TICKER_PX_S, VELOCIDAD_TICKER_LENTA_PX_S,
  DURACION_TICKER_FALLBACK_S, duracionTickerFallbackS, velocidadTickerPxS,
} from './animation';

// EL INVARIANTE de este slice (STOREFRONT-REDUCED-MOTION-1): el storefront monta
// `<MotionConfig reducedMotion="user">`, no un valor distinto ni ningún otro provider.
// No hay DOM ni navegador en capa 1, así que no se puede afirmar la CONDUCTA (que una
// entrada deje de desplazarse bajo `prefers-reduced-motion: reduce`) — eso es capa 3.
// Lo que sí se puede afirmar sin renderizar: `ReducedMotionProvider` es una función pura
// que devuelve el elemento `MotionConfig` con ese prop exacto envolviendo a sus children.
// Llamarla directamente (sin ReactDOM) es seguro porque no usa hooks.

test('ReducedMotionProvider monta MotionConfig con reducedMotion="user"', () => {
  const children = 'contenido-de-prueba';
  const el = ReducedMotionProvider({ children });

  assert.equal(el.type, MotionConfig, 'debe ser el componente MotionConfig, no otro wrapper');
  assert.equal(
    el.props.reducedMotion,
    'user',
    'sin "user" no respeta la preferencia del sistema — "always"/"never" o ausente dejarían el defecto vivo',
  );
});

test('ReducedMotionProvider no descarta ni envuelve los children', () => {
  const children = 'contenido-de-prueba';
  const el = ReducedMotionProvider({ children });

  assert.equal(
    el.props.children,
    children,
    'el provider sólo debe agregar el contexto, nunca alterar lo que renderiza',
  );
});

// ── EL CONTADOR (§ ORIGEN-BANDA-1) — `valorContador`, sin React, sin navegador ────────────────────
// Reproduce el cálculo de `docs/prototipos/cafeone/js/home.js:320-327` (ease-out cúbica). El hook
// (`useContadorAnimado`, sobre IntersectionObserver + rAF) no se puede afirmar acá — es render +
// timers reales; su cableado se verifica por render en `lib/config/origen-banda.test.ts` (proxy de
// vista previa, mismo criterio que `historia-direccion-arte.test.ts` usa para el otro motor de
// movimiento de este repo).

test('valorContador: progreso=0 da 0, sin importar el destino', () => {
  assert.equal(valorContador(1600, 0), 0);
  assert.equal(valorContador(52, 0), 0);
});

test('valorContador: progreso=1 da EXACTAMENTE el destino — ease-out cúbica converge a 1', () => {
  assert.equal(valorContador(1600, 1), 1600);
  assert.equal(valorContador(12, 1), 12);
});

test('valorContador: a mitad de progreso ya pasó la mitad del camino — ease-out (desacelera, no lineal)', () => {
  const v = valorContador(1000, 0.5);
  assert.ok(v > 500, `ease-out cúbica a k=0.5 debe superar el lineal (500); dio ${v}`);
  assert.equal(v, 1000 * (1 - Math.pow(0.5, 3)));
});

test('valorContador: progreso se acota a [0,1] — fuera de rango no se dispara ni retrocede', () => {
  assert.equal(valorContador(1600, -0.5), valorContador(1600, 0));
  assert.equal(valorContador(1600, 1.5), valorContador(1600, 1));
});

test('DURACION_CONTADOR_MS reproduce el `dur=1100` medido en el prototipo (`js/home.js:321`)', () => {
  assert.equal(DURACION_CONTADOR_MS, 1100);
});

// ── EL LOOP DE LA MARQUESINA (§ MARQUESINA-BANDA-1) — sin React, sin navegador ────────────────────
// Reproduce `docs/prototipos/cafeone/js/home.js:259-282`. El hook (`useProgresoScroll`, sobre
// `useScroll`) no se puede afirmar acá sin DOM real; su cableado se verifica por render en
// `lib/config/marquesina-banda.test.ts` (proxy de vista previa, mismo criterio que
// `historia-direccion-arte.test.ts`/`origen-banda.test.ts`).

test('transformMarquesinaTexto: estatico=true SIEMPRE queda centrado y QUIETO, sin importar el progreso ni el travel', () => {
  assert.equal(transformMarquesinaTexto(0, 1600, true), 'translateY(-50%)');
  assert.equal(transformMarquesinaTexto(0.5, 1600, true), 'translateY(-50%)');
  assert.equal(transformMarquesinaTexto(1, 1600, true), 'translateY(-50%)');
  assert.equal(transformMarquesinaTexto(-0.5, 3000, true), 'translateY(-50%)', 'estatico gana incluso con progreso fuera de rango');
});

test('transformMarquesinaTexto: estatico=false, progreso=0 — sin desplazamiento todavía, centrado', () => {
  assert.equal(transformMarquesinaTexto(0, 1600, false), 'translate(0.0px, -50%)');
});

test('transformMarquesinaTexto: estatico=false, progreso=1 — el desplazamiento máximo es EXACTAMENTE -travel', () => {
  assert.equal(transformMarquesinaTexto(1, 1600, false), 'translate(-1600.0px, -50%)');
  assert.equal(transformMarquesinaTexto(1, 2000, false), 'translate(-2000.0px, -50%)');
});

test('transformMarquesinaTexto: progreso se acota a [0,1] — fuera de rango no sobre-desplaza ni invierte el signo', () => {
  assert.equal(transformMarquesinaTexto(-0.5, 1600, false), transformMarquesinaTexto(0, 1600, false));
  assert.equal(transformMarquesinaTexto(1.5, 1600, false), transformMarquesinaTexto(1, 1600, false));
});

test('transformMarquesinaTarjeta: estatico=true SIEMPRE "none" — la tarjeta ACOMODADA, sin escalar ni rotar', () => {
  assert.equal(transformMarquesinaTarjeta(0, true), 'none');
  assert.equal(transformMarquesinaTarjeta(0.3, true), 'none');
  assert.equal(transformMarquesinaTarjeta(1, true), 'none');
});

test('transformMarquesinaTarjeta: estatico=false, progreso=0 — arranca en su escala/rotación de INICIO (`js/home.js:274-279`: t=0 bajo 0.12)', () => {
  assert.equal(transformMarquesinaTarjeta(0, false), 'scale(0.850) rotate(-4.00deg)');
});

test('transformMarquesinaTarjeta: estatico=false, progreso=1 — llega a su escala/rotación FINAL (t=1, sobre 0.57)', () => {
  assert.equal(transformMarquesinaTarjeta(1, false), 'scale(1.000) rotate(0.00deg)');
});

test('transformMarquesinaTarjeta: el recorte interno [0.12, 0.57] deja la tarjeta en su INICIO antes de 0.12 y en su FINAL después de 0.57', () => {
  assert.equal(transformMarquesinaTarjeta(0.1, false), transformMarquesinaTarjeta(0, false));
  assert.equal(transformMarquesinaTarjeta(0.6, false), transformMarquesinaTarjeta(1, false));
});

test('transformMarquesinaTarjeta: progreso se acota a [0,1] — fuera de rango no sobre-escala ni invierte', () => {
  assert.equal(transformMarquesinaTarjeta(-0.5, false), transformMarquesinaTarjeta(0, false));
  assert.equal(transformMarquesinaTarjeta(1.5, false), transformMarquesinaTarjeta(1, false));
});

// ── EL PROGRESO DESDE EL TOPE (§ CORTE-HERO-STICKY-RONDA-2-1) — sin React, sin navegador ──────────
// Reproduce la derivación cerrada del docstring de `progresoDesdeTope`: progreso = -rectTop/alturaTotal,
// el ancla que hace 0 el progreso exactamente en scrollY=0 para un target cuyo tope de documento es 0
// (el wrapper de `HeroMediaMarquesina`, primero en `<main>`). El hook (`useProgresoScrollDesdeTope`,
// sobre `useScroll`) no se puede afirmar acá sin DOM real — mismo límite que `useProgresoScroll`.

test('progresoDesdeTope: rectTop=0 (scrollY=0, el target arriba del todo) da progreso 0 — el defecto que este slice cierra', () => {
  assert.equal(progresoDesdeTope(0, 1200), 0);
});

test('progresoDesdeTope: rectTop=-alturaTotal (el target scrolleó su propio alto completo) da progreso 1', () => {
  assert.equal(progresoDesdeTope(-1200, 1200), 1);
  assert.equal(progresoDesdeTope(-3000, 3000), 1);
});

test('progresoDesdeTope: a un cuarto del alto scrolleado, progreso 0.25 — LA CIFRA EXACTA del defecto viejo (VH/4VH con H=300vh)', () => {
  assert.equal(progresoDesdeTope(-300, 1200), 0.25);
});

test('progresoDesdeTope: se acota a [0,1] — un rectTop positivo (todavía no llegó) no da negativo, uno más allá de -alturaTotal no pasa de 1', () => {
  assert.equal(progresoDesdeTope(50, 1200), 0);
  assert.equal(progresoDesdeTope(-1500, 1200), 1);
});

test('progresoDesdeTope: alturaTotal <= 0 no divide por cero — da 0', () => {
  assert.equal(progresoDesdeTope(-100, 0), 0);
  assert.equal(progresoDesdeTope(-100, -50), 0);
});

// ── EL VELO ANIMADO (§ CORTE-HERO-STICKY-RONDA-2-1) — sin React, sin navegador ─────────────────────
// `veloOpacidad` reemplaza el overlay SIEMPRE-ENCENDIDO por uno que sigue el progreso: casi
// transparente en reposo (el PISO medido por contraste, `VELO_OPACIDAD_PISO`), denso al final.

test('veloOpacidad: estatico=true SIEMPRE 1 (la densidad de HOY) — sin scroll que lo densifique, no puede quedar en el piso', () => {
  assert.equal(veloOpacidad(0, true), 1);
  assert.equal(veloOpacidad(0.5, true), 1);
  assert.equal(veloOpacidad(1, true), 1);
  assert.equal(veloOpacidad(-0.5, true), 1, 'estatico gana incluso con progreso fuera de rango');
});

test('veloOpacidad: estatico=false, progreso=0 — el PISO exacto, el punto más transparente permitido', () => {
  assert.equal(veloOpacidad(0, false), VELO_OPACIDAD_PISO);
});

test('veloOpacidad: estatico=false, progreso=1 — la densidad MÁXIMA es exactamente 1 (la misma de HOY)', () => {
  assert.equal(veloOpacidad(1, false), 1);
});

test('veloOpacidad: a mitad de progreso, a mitad de camino entre el piso y 1', () => {
  assert.equal(veloOpacidad(0.5, false), VELO_OPACIDAD_PISO + (1 - VELO_OPACIDAD_PISO) * 0.5);
});

test('veloOpacidad: progreso se acota a [0,1] — fuera de rango no baja del piso ni sube de 1', () => {
  assert.equal(veloOpacidad(-0.5, false), veloOpacidad(0, false));
  assert.equal(veloOpacidad(1.5, false), veloOpacidad(1, false));
});

test('VELO_OPACIDAD_PISO deja margen sobre el piso AA (4.5:1) contra la foto de referencia MÁS clara — no es el mínimo exacto', () => {
  // Contraste WCAG de blanco sobre el velo (tinta #1a0f08, densidad efectiva = piso*0.80) contra
  // casi-blanco rgb(245,245,240) — la peor de las tres fotos de referencia de HeroMedia.tsx.
  function srgbToLin(c: number) { const cs = c / 255; return cs <= 0.03928 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4); }
  function relLum([r, g, b]: number[]) { return 0.2126 * srgbToLin(r) + 0.7152 * srgbToLin(g) + 0.0722 * srgbToLin(b); }
  function contraste(c1: number[], c2: number[]) {
    const L1 = relLum(c1), L2 = relLum(c2);
    return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
  }
  const tinta = [0x1a, 0x0f, 0x08];
  const casiBlanco = [245, 245, 240];
  const blanco = [255, 255, 255];
  const alfa = VELO_OPACIDAD_PISO * 0.8;
  const compuesto = tinta.map((t, i) => alfa * t + (1 - alfa) * casiBlanco[i]);
  const c = contraste(blanco, compuesto);
  assert.ok(c >= 4.5, `debe superar AA (4.5:1) contra la foto MÁS clara; dio ${c.toFixed(2)}`);
  assert.ok(c > 5, `debe dejar margen real sobre AA, no el mínimo exacto; dio ${c.toFixed(2)}`);
});

// ── EL RANGO DEL VELO POR INTENSIDAD (§ CORTE-HERO-REVELADO-MASCARA-1, RONDA 4) ─────────────────────
// `veloOpacidad` gana un TERCER parámetro (`rango`), con DEFAULT = el rango de 'media' — así que
// TODOS los tests de arriba (que no pasan `rango`) siguen afirmando exactamente lo mismo, byte a
// byte: el default es la garantía de byte-identidad, no una promesa en prosa.

test('rangoVeloDeIntensidad("media") es exactamente {piso: VELO_OPACIDAD_PISO, techo: 1} — el rango de SIEMPRE', () => {
  assert.deepEqual(rangoVeloDeIntensidad('media'), { piso: VELO_OPACIDAD_PISO, techo: 1 });
});

test('rangoVeloDeIntensidad: ausente/vacío/basura cae al rango de "media" — nunca lanza (mismo criterio que objectPositionDePuntoFocal)', () => {
  for (const basura of ['', 'fuerte', 'MEDIA', 'suavecito']) {
    assert.deepEqual(rangoVeloDeIntensidad(basura), rangoVeloDeIntensidad('media'));
  }
});

test('rangoVeloDeIntensidad("suave") baja las DOS puntas del rango — el pedido del owner es "en general", no sólo al cargar', () => {
  const suave = rangoVeloDeIntensidad('suave');
  const media = rangoVeloDeIntensidad('media');
  assert.ok(suave.piso < media.piso, 'el piso (reposo) debe ser más tenue');
  assert.ok(suave.techo < media.techo, 'el techo (fin del recorrido) también debe ser más tenue');
});

test('veloOpacidad con el rango "suave": progreso=0 da su piso, progreso=1 da su techo — mismo comportamiento que "media", otra magnitud', () => {
  const suave = rangoVeloDeIntensidad('suave');
  assert.equal(veloOpacidad(0, false, suave), suave.piso);
  assert.equal(veloOpacidad(1, false, suave), suave.techo);
  assert.equal(veloOpacidad(0.5, false, suave), suave.piso + (suave.techo - suave.piso) * 0.5);
});

test('veloOpacidad con el rango "suave": estatico=true rinde el TECHO de ESE rango (0.55), no el 1 de "media"', () => {
  const suave = rangoVeloDeIntensidad('suave');
  assert.equal(veloOpacidad(0, true, suave), suave.techo);
  assert.equal(suave.techo, 0.55);
});

test('el rango "suave" queda BAJO AA (4.5:1) contra el proxy de fotos claras — MEDIDO y REPORTADO, no bloqueado (§ el docstring de veloOpacidad)', () => {
  // Mismo método WCAG que el test de arriba, contra la TINTA REAL de CORTE (#102407, raices.tinta en
  // themes.ts) — no el #1a0f08 genérico, que no es de ningún preset. Las tres fotos de referencia de
  // HeroMedia.tsx (arena/casi-blanco/crema) son un proxy CONSERVADOR para un video claro; el video
  // real de CORTE es oscuro, así que quedar bajo AA acá es esperado, no un defecto.
  function srgbToLin(c: number) { const cs = c / 255; return cs <= 0.03928 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4); }
  function relLum([r, g, b]: number[]) { return 0.2126 * srgbToLin(r) + 0.7152 * srgbToLin(g) + 0.0722 * srgbToLin(b); }
  function contraste(c1: number[], c2: number[]) {
    const L1 = relLum(c1), L2 = relLum(c2);
    return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
  }
  const tintaCorte = [0x10, 0x24, 0x07];
  const blanco = [255, 255, 255];
  const fotos = { arena: [232, 222, 200], casiBlanco: [245, 245, 240], crema: [238, 230, 214] };
  const suave = rangoVeloDeIntensidad('suave');
  for (const [nombre, foto] of Object.entries(fotos)) {
    const alfaPiso = suave.piso * 0.8;
    const compuestoPiso = tintaCorte.map((t, i) => alfaPiso * t + (1 - alfaPiso) * foto[i]);
    const cPiso = contraste(blanco, compuestoPiso);
    assert.ok(cPiso < 4.5, `piso contra ${nombre} debía quedar bajo AA; dio ${cPiso.toFixed(2)}`);

    const alfaTecho = suave.techo * 0.8;
    const compuestoTecho = tintaCorte.map((t, i) => alfaTecho * t + (1 - alfaTecho) * foto[i]);
    const cTecho = contraste(blanco, compuestoTecho);
    assert.ok(cTecho < 4.5, `techo contra ${nombre} debía quedar bajo AA; dio ${cTecho.toFixed(2)}`);
  }
});

// ── EL REVELADO DEL TEXTO — CORTE-HERO-MARQUEE-REVELA-1, REESCRITO por RONDA 4 (§ CORTE-HERO-
// REVELADO-MASCARA-1) — sin React, sin navegador. `transformRevelaTextoDisplay` reemplaza a
// `opacidadRevelado`/`translateYRevelado` (RETIRADAS, sin otro consumidor): traslada un PORCENTAJE de
// la propia caja del texto — 100% (fuera de la máscara `overflow-hidden`) en reposo, 0% (en su lugar)
// al completar `UMBRAL_REVELADO_TEXTO`. El hook que la consume (`useProgresoScrollDesdeTope`, vía
// `HeroMediaMarquesina.tsx`) no se puede afirmar acá sin DOM real; su cableado se verifica por
// render en `lib/config/hero-marquesina.test.ts`.

test('UMBRAL_REVELADO_TEXTO: la ventana empieza en 0 (el arranque mismo del scroll) y termina bien antes de la mitad del recorrido', () => {
  assert.equal(UMBRAL_REVELADO_TEXTO.desde, 0);
  assert.ok(UMBRAL_REVELADO_TEXTO.hasta > 0 && UMBRAL_REVELADO_TEXTO.hasta < 0.5, 'consumido en la parte TEMPRANA, no a lo largo de todo el progreso');
});

test('LA MEDICIÓN QUE MOTIVA EL CAMBIO: fadeUp.hidden.y (24px) es una fracción PEQUEÑA del texto DISPLAY del marquee (clamp(3rem,10vw,10rem), 48–160px) — por eso un desplazamiento en píxeles fijos no se lee como "subir"', () => {
  assert.equal(fadeUp.hidden.y, 24);
  const pisoClampPx = 48;   // 3rem
  const techoClampPx = 160; // 10rem
  const referenciaPx = 128; // 10vw a 1280px — el ancho de referencia de escritorio de este repo
  assert.ok(fadeUp.hidden.y / pisoClampPx > 0.4, 'contra el piso del clamp ya es una fracción grande (ni acá se lee "sube")');
  assert.ok(fadeUp.hidden.y / referenciaPx < 0.2, 'contra el ancho de referencia de escritorio, bajo el 20% de la altura de la letra');
  assert.ok(fadeUp.hidden.y / techoClampPx < 0.2, 'contra el techo del clamp, todavía más chico');
});

test('transformRevelaTextoDisplay: estatico=true SIEMPRE "translateY(0%)" — el texto queda EN SU LUGAR, visible por completo', () => {
  assert.equal(transformRevelaTextoDisplay(0, true), 'translateY(0%)');
  assert.equal(transformRevelaTextoDisplay(0.5, true), 'translateY(0%)');
  assert.equal(transformRevelaTextoDisplay(1, true), 'translateY(0%)');
  assert.equal(transformRevelaTextoDisplay(-0.5, true), 'translateY(0%)', 'estatico gana incluso con progreso fuera de rango');
});

test('transformRevelaTextoDisplay: estatico=false, progreso=0 — 100% de la caja, TOTALMENTE fuera de la máscara', () => {
  assert.equal(transformRevelaTextoDisplay(0, false), 'translateY(100.0%)');
});

test('transformRevelaTextoDisplay: estatico=false, progreso=hasta (fin de la ventana) — 0%, ya en su lugar', () => {
  assert.equal(transformRevelaTextoDisplay(UMBRAL_REVELADO_TEXTO.hasta, false), 'translateY(0.0%)');
});

test('transformRevelaTextoDisplay: más allá de la ventana — sigue en 0%, NUNCA se pasa de su posición final (sin overshoot)', () => {
  assert.equal(transformRevelaTextoDisplay(0.5, false), 'translateY(0.0%)');
  assert.equal(transformRevelaTextoDisplay(1, false), 'translateY(0.0%)');
});

test('transformRevelaTextoDisplay: a mitad de la ventana, a mitad de camino (50%)', () => {
  const medio = UMBRAL_REVELADO_TEXTO.hasta / 2;
  assert.equal(transformRevelaTextoDisplay(medio, false), 'translateY(50.0%)');
});

test('transformRevelaTextoDisplay: progreso se acota a [0,1] antes de mapear a la ventana — un negativo no pasa de 100%', () => {
  assert.equal(transformRevelaTextoDisplay(-0.5, false), transformRevelaTextoDisplay(0, false));
});

// ── EL PRESUPUESTO DE SCROLL PROPORCIONAL (§ CORTE-HERO-MARQUEE-REVELA-1) — sin React, sin navegador
// `claseAlturaAncestroMarquesina` es lookup por LITERAL (mismo criterio que `gridColsPresentaciones`,
// `lib/storefront/presentaciones.ts`): las dos ramas son strings COMPLETOS para que Tailwind los vea.

test('claseAlturaAncestroMarquesina: CON tarjeta, el presupuesto de SIEMPRE — 100svh + 200vh, MEDIDO contra `<xo-parallax class="h:300vh">`', () => {
  assert.equal(claseAlturaAncestroMarquesina(true), 'min-h-[calc(100svh+200vh)]');
});

test('claseAlturaAncestroMarquesina: SIN tarjeta, 100svh + 65vh — 200vh menos la ventana [0.12,0.57] de `transformMarquesinaTarjeta` (0.45×300vh=135vh), la porción sin nada que animar', () => {
  assert.equal(claseAlturaAncestroMarquesina(false), 'min-h-[calc(100svh+65vh)]');
});

// ── EL ÍNDICE CENTRADO DE UN RIEL (§ MUESTRARIO-RIEL-ACTIVO-1) — sin React, sin navegador ─────────
// Reproduce `centreIndex()` de `docs/prototipos/cafeone/js/home.js:113-119`. El hook
// (`useIndiceCentrado`, sobre eventos de scroll/resize del contenedor real) no se puede afirmar
// acá sin DOM real — mismo criterio que `useProgresoAcomodo`/`useProgresoScroll`/
// `useContadorAnimado`, que tampoco se testean en este archivo; su cableado en
// `GrindChooserRiel.tsx` es capa 3 (gate visual).
//
// Fixture: tres tarjetas de 300px con 16px de gap — `offsetLeft` 0, 316, 632 — mismas proporciones
// que el riel real (`w-[clamp(260px,26vw,360px)]` + `gap-6`).
const TARJETAS_FIXTURE = [
  { offsetLeft: 0, offsetWidth: 300 },
  { offsetLeft: 316, offsetWidth: 300 },
  { offsetLeft: 632, offsetWidth: 300 },
];

test('indiceCentrado: contenedor VACÍO (sin hijos) da null — no hay "centrado" que afirmar', () => {
  assert.equal(indiceCentrado(0, 300, []), null);
  assert.equal(indiceCentrado(999, 999, []), null, 'null incluso con scroll/ancho arbitrarios');
});

test('indiceCentrado: UN SOLO hijo siempre es el centrado, sin importar scroll/ancho', () => {
  const unHijo = [{ offsetLeft: 40, offsetWidth: 300 }];
  assert.equal(indiceCentrado(0, 300, unHijo), 0);
  assert.equal(indiceCentrado(500, 120, unHijo), 0, 'un solo candidato gana aunque el scroll lo aleje del centro medido');
  assert.equal(indiceCentrado(-50, 0, unHijo), 0, 'geometría degenerada (ancho 0) no rompe: sigue habiendo un único hijo');
});

test('indiceCentrado: scrollLeft=0 (extremo izquierdo) centra el PRIMER hijo', () => {
  assert.equal(indiceCentrado(0, 300, TARJETAS_FIXTURE), 0);
});

test('indiceCentrado: scrollLeft en el medio centra el hijo del MEDIO', () => {
  // medio visible = scrollLeft + clientWidth/2 = 316 + 150 = 466 = centro exacto del hijo 1
  assert.equal(indiceCentrado(316, 300, TARJETAS_FIXTURE), 1);
});

test('indiceCentrado: scrollLeft en el extremo derecho (scrollWidth - clientWidth) centra el ÚLTIMO hijo', () => {
  // scrollWidth = 632 + 300 = 932; scroll máximo = 932 - 300 = 632
  assert.equal(indiceCentrado(632, 300, TARJETAS_FIXTURE), 2);
});

test('indiceCentrado: en un empate exacto de distancia, gana el índice MENOR (el primero que el recorrido encuentra)', () => {
  // medio = 158: a 158px del centro del hijo 0 (150) y del hijo 1 (466) — no es el caso real, se
  // arma el empate a mano para fijar el criterio de desempate sin depender de la fixture de arriba.
  const dosHijos = [
    { offsetLeft: 0, offsetWidth: 100 },   // centro 50
    { offsetLeft: 100, offsetWidth: 100 }, // centro 150
  ];
  // medio = 100 → distancia al hijo 0 = |50-100| = 50; al hijo 1 = |150-100| = 50 → empate
  assert.equal(indiceCentrado(100, 0, dosHijos), 0, 'empate exacto: gana el primero, no el último');
});

// ── LA DIRECCIÓN DEL SCROLL DEL NAV (§ CROMO-NAV-DIRECCION-SCROLL-1) — sin React, sin navegador ────
// `direccionScroll`/`navOculto` replican, medidas contra el tema real (`xo-sticky`, § el docstring de
// cabecera de `animation.ts`), la dirección por-frame SIN mínimo de movimiento y el umbral de 80px
// que decide cuándo el header puede empezar a ocultarse.

test('direccionScroll: scrollY bajó respecto al frame anterior → "arriba"', () => {
  assert.equal(direccionScroll(90, 100), 'arriba');
});

test('direccionScroll: scrollY subió respecto al frame anterior → "abajo"', () => {
  assert.equal(direccionScroll(110, 100), 'abajo');
});

test('direccionScroll: SIN mínimo de movimiento — 1px de diferencia ya define la dirección (medido contra el tema real, sin debounce)', () => {
  assert.equal(direccionScroll(99, 100), 'arriba', '1px hacia arriba ya cuenta como subir');
  assert.equal(direccionScroll(101, 100), 'abajo', '1px hacia abajo ya cuenta como bajar');
});

test('direccionScroll: empate (mismo scrollY que el frame anterior) cae a "abajo" — sin evidencia de que subió', () => {
  assert.equal(direccionScroll(100, 100), 'abajo');
});

test('navOculto: bajo UMBRAL_OCULTAR_NAV, nunca oculta — "arriba del todo manda el tratamiento de hoy", sin importar la dirección', () => {
  assert.equal(navOculto(0, 'abajo'), false);
  assert.equal(navOculto(UMBRAL_OCULTAR_NAV - 1, 'abajo'), false, 'un píxel antes del umbral: todavía no oculta');
  assert.equal(navOculto(UMBRAL_OCULTAR_NAV - 1, 'arriba'), false);
});

test('navOculto: en o sobre UMBRAL_OCULTAR_NAV, BAJANDO oculta', () => {
  assert.equal(navOculto(UMBRAL_OCULTAR_NAV, 'abajo'), true, 'justo en el umbral ya oculta, como `e < i-t` del tema real');
  assert.equal(navOculto(UMBRAL_OCULTAR_NAV + 500, 'abajo'), true);
});

test('navOculto: en o sobre UMBRAL_OCULTAR_NAV, SUBIENDO revela — el mismo xoDirection:"up" medido', () => {
  assert.equal(navOculto(UMBRAL_OCULTAR_NAV, 'arriba'), false);
  assert.equal(navOculto(UMBRAL_OCULTAR_NAV + 500, 'arriba'), false, 'aunque el scroll esté muy abajo, subir revela de inmediato');
});

// ── EL DESTELLO DEL TRATAMIENTO AL BAJAR (§ CROMO-NAV-SIN-DESTELLO-1) ───────────────────────────────
// `debeActualizarTratamientoNav` decide si `StoreNav.tsx` re-evalúa `scrolled` (el umbral de 20px que
// resuelve flotante/sólido) en el frame actual, o lo CONGELA en lo que ya tenía. Ver el docstring de
// cabecera para la medición del destello (ventana 21–79px) que esto cierra.

test('debeActualizarTratamientoNav: direccionActiva=false (todo preset salvo el que declare el eje) → SIEMPRE true, byte-idéntico a hoy', () => {
  assert.equal(debeActualizarTratamientoNav(false, 'abajo'), true);
  assert.equal(debeActualizarTratamientoNav(false, 'arriba'), true);
});

test('debeActualizarTratamientoNav: direccionActiva=true, BAJANDO → false — el tratamiento se congela, no se re-evalúa', () => {
  assert.equal(debeActualizarTratamientoNav(true, 'abajo'), false);
});

test('debeActualizarTratamientoNav: direccionActiva=true, SUBIENDO → true — se re-evalúa siempre, como hoy', () => {
  assert.equal(debeActualizarTratamientoNav(true, 'arriba'), true);
});

// ── EL TICKER — § CORTE-HERO-VELO-OFF-Y-TICKER-1 ────────────────────────────────────────────────
//
// VELOCIDAD_TICKER_PX_S: MEDIDA contra el JS del tema real (`xo-webcomponents.min.js`,
// `setDuration()`: `h = clamp(u*14 - (xoSpeed-1)*u, u, Infinity)`, `xoSpeed=1` medido en el HTML
// servido — ver el docstring completo en `animation.ts`). `1000/14 ≈ 71.43 px/s`.

test('VELOCIDAD_TICKER_PX_S es 1000/14 (≈71.43 px/s) — la derivación de nd=14, xoSpeed=1 medidos contra el tema real', () => {
  assert.equal(VELOCIDAD_TICKER_PX_S, 1000 / 14);
  assert.ok(Math.abs(VELOCIDAD_TICKER_PX_S - 71.43) < 0.01);
});

test('duracionTickerS: distancia/velocidad — el mismo px/s para cualquier ancho (velocidad EFECTIVA constante)', () => {
  assert.equal(duracionTickerS(714.3, VELOCIDAD_TICKER_PX_S), 714.3 / VELOCIDAD_TICKER_PX_S);
  // el doble de ancho → el doble de duración, misma velocidad (px/s) resultante en los dos casos.
  const anchoChico = 500;
  const anchoGrande = 1000;
  const dChico = duracionTickerS(anchoChico, VELOCIDAD_TICKER_PX_S);
  const dGrande = duracionTickerS(anchoGrande, VELOCIDAD_TICKER_PX_S);
  assert.ok(Math.abs((anchoChico / dChico) - (anchoGrande / dGrande)) < 1e-9, 'la velocidad efectiva (ancho/duración) no depende del ancho');
});

test('duracionTickerS: ancho o velocidad no positivos → 0 (SSR/antes de medir el DOM, nunca NaN/Infinity)', () => {
  assert.equal(duracionTickerS(0, VELOCIDAD_TICKER_PX_S), 0);
  assert.equal(duracionTickerS(-10, VELOCIDAD_TICKER_PX_S), 0);
  assert.equal(duracionTickerS(500, 0), 0);
  assert.equal(duracionTickerS(500, -5), 0);
});

test('DURACION_TICKER_FALLBACK_S es positivo y finito — un valor real antes de la primera medición del DOM', () => {
  assert.ok(Number.isFinite(DURACION_TICKER_FALLBACK_S));
  assert.ok(DURACION_TICKER_FALLBACK_S > 0);
});

test('duracionTickerFallbackS(VELOCIDAD_TICKER_PX_S) es EXACTAMENTE DURACION_TICKER_FALLBACK_S — la constante es el caso "media" de la función genérica, no un número aparte', () => {
  assert.equal(duracionTickerFallbackS(VELOCIDAD_TICKER_PX_S), DURACION_TICKER_FALLBACK_S);
});

// ── LA VELOCIDAD ES UNA PREFERENCIA DEL OWNER (§ CORTE-HERO-REVELADO-MASCARA-1, RONDA 4) ───────────
// «la velocidad a la que van las letras debería ser más baja» — sobre una medición que ya estaba
// bien (arriba). `VELOCIDAD_TICKER_LENTA_PX_S`/`velocidadTickerPxS` son la preferencia, no una
// segunda medición.

test('VELOCIDAD_TICKER_LENTA_PX_S es 0.6× la medida — una fracción ELEGIDA, más lenta que VELOCIDAD_TICKER_PX_S', () => {
  assert.equal(VELOCIDAD_TICKER_LENTA_PX_S, VELOCIDAD_TICKER_PX_S * 0.6);
  assert.ok(VELOCIDAD_TICKER_LENTA_PX_S < VELOCIDAD_TICKER_PX_S);
});

test('velocidadTickerPxS: "lenta" da la velocidad lenta; ausente/vacío/basura cae a la MEDIDA ("media")', () => {
  assert.equal(velocidadTickerPxS('lenta'), VELOCIDAD_TICKER_LENTA_PX_S);
  for (const basura of ['', 'media', 'rapida', 'LENTA']) {
    assert.equal(velocidadTickerPxS(basura), VELOCIDAD_TICKER_PX_S);
  }
});

test('un ticker más lento tarda MÁS en completar un ciclo del mismo ancho — duracionTickerS compone bien con la velocidad elegida', () => {
  const ancho = 714.3;
  const dMedia = duracionTickerS(ancho, velocidadTickerPxS('media'));
  const dLenta = duracionTickerS(ancho, velocidadTickerPxS('lenta'));
  assert.ok(dLenta > dMedia, 'a menor velocidad, mayor duración del mismo recorrido');
});
