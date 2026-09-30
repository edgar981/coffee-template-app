import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MotionConfig } from 'framer-motion';
import {
  ReducedMotionProvider, valorContador, DURACION_CONTADOR_MS,
  transformMarquesinaTexto, transformMarquesinaTarjeta,
  progresoDesdeTope, veloOpacidad, VELO_OPACIDAD_PISO, rangoVeloDeIntensidad,
  transformRevelaTextoDisplay, opacidadRevelaTextoDisplay, OPACIDAD_REVELADO_TECHO,
  UMBRAL_REVELADO_TEXTO,
  claseAlturaAncestroMarquesina, fadeUp,
  direccionScroll, navOculto, UMBRAL_OCULTAR_NAV, debeActualizarTratamientoNav,
  duracionTickerS, VELOCIDAD_TICKER_PX_S, VELOCIDAD_TICKER_LENTA_PX_S,
  DURACION_TICKER_FALLBACK_S, duracionTickerFallbackS, velocidadTickerPxS,
  MARQUEE_TITULO_FONT_SIZE, MARQUEE_TITULO_LINE_HEIGHT, MARQUEE_TITULO_LETTER_SPACING,
  MARQUEE_MASCARA_RELLENO_EM, parametrosAcomodoCollage, RESORTE_ACOMODO,
  cssRevelaPagina, REVELADO_PAGINA_DURACION_MS, REVELADO_PAGINA_TRASLADO_PX,
  REVELADO_PAGINA_EASE, REVELADO_PAGINA_PASO_MS,
} from './animation';
import { BANDA_IDS } from './config/site-content-defaults';

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

// ── EL TERCER RANGO, 'intermedia' — § HERO-VELO-INTERMEDIO-1 (2026-09-28). El owner, sobre el gate
// visual de 'suave' ya aplicada (misma ronda que subió la frase al pie a `--sf-sobre-banda` PLENO,
// § HERO-FRASE-COLOR-PLENO-1): «el velo del hero puede ser un poquito más oscuro, si eso logra que
// las letras, no solo del pie, sino del nav se aprecien mejor». El rango completo y su porqué —el
// ancho de 0.25 preservado, el desplazamiento de +0.10 sobre 'suave', y por qué no uno más chico ni
// más grande— vive en el docstring de `rangoVeloDeIntensidad`, arriba.

test('rangoVeloDeIntensidad("intermedia") es exactamente {piso:0.4, techo:0.65}', () => {
  assert.deepEqual(rangoVeloDeIntensidad('intermedia'), { piso: 0.4, techo: 0.65 });
});

test('"intermedia" cae ENTRE "suave" y "media" en las DOS puntas, y MÁS CERCA de "suave" — el pedido del owner fue "un poquito", no volver a "media"', () => {
  const suave = rangoVeloDeIntensidad('suave');
  const intermedia = rangoVeloDeIntensidad('intermedia');
  const media = rangoVeloDeIntensidad('media');
  assert.ok(intermedia.piso > suave.piso && intermedia.piso < media.piso, 'el piso debe quedar estrictamente entre los otros dos');
  assert.ok(intermedia.techo > suave.techo && intermedia.techo < media.techo, 'el techo debe quedar estrictamente entre los otros dos');
  const distanciaASuavePiso = intermedia.piso - suave.piso;
  const distanciaAMediaPiso = media.piso - intermedia.piso;
  assert.ok(distanciaASuavePiso < distanciaAMediaPiso, `"intermedia" debe quedar más cerca de "suave" (dist ${distanciaASuavePiso.toFixed(2)}) que de "media" (dist ${distanciaAMediaPiso.toFixed(2)})`);
});

test('"intermedia" preserva el ANCHO de 0.25 que ya comparten "suave" y "media" — se desplaza la base, no se estira ni encoge la ventana', () => {
  // Aritmética en punto flotante: 0.55-0.30 NO da 0.25 exacto (da 0.25000000000000006), así que la
  // comparación va con TOLERANCIA (1e-9), no `assert.equal` — el mismo motivo por el que el resto de
  // este archivo nunca compara floats restados con igualdad estricta.
  const suave = rangoVeloDeIntensidad('suave');
  const intermedia = rangoVeloDeIntensidad('intermedia');
  const media = rangoVeloDeIntensidad('media');
  const anchoSuave = suave.techo - suave.piso;
  const anchoIntermedia = intermedia.techo - intermedia.piso;
  const anchoMedia = media.techo - media.piso;
  const TOLERANCIA = 1e-9;
  assert.ok(Math.abs(anchoSuave - 0.25) < TOLERANCIA, `anchoSuave debía ser ~0.25; dio ${anchoSuave}`);
  assert.ok(Math.abs(anchoMedia - 0.25) < TOLERANCIA, `anchoMedia debía ser ~0.25; dio ${anchoMedia}`);
  assert.ok(Math.abs(anchoIntermedia - anchoSuave) < TOLERANCIA, 'el mismo ancho que "suave"');
  assert.ok(Math.abs(anchoIntermedia - anchoMedia) < TOLERANCIA, 'el mismo ancho que "media"');
});

test('veloOpacidad con el rango "intermedia": progreso=0 da su piso, progreso=1 da su techo, 0.5 a mitad de camino — mismo comportamiento que "suave"/"media", otra magnitud', () => {
  const intermedia = rangoVeloDeIntensidad('intermedia');
  assert.equal(veloOpacidad(0, false, intermedia), intermedia.piso);
  assert.equal(veloOpacidad(1, false, intermedia), intermedia.techo);
  assert.equal(veloOpacidad(0.5, false, intermedia), intermedia.piso + (intermedia.techo - intermedia.piso) * 0.5);
});

test('veloOpacidad con el rango "intermedia": estatico=true rinde el TECHO de ESE rango (0.65) — ni el 0.55 de "suave" ni el 1 de "media"', () => {
  const intermedia = rangoVeloDeIntensidad('intermedia');
  assert.equal(veloOpacidad(0, true, intermedia), intermedia.techo);
  assert.equal(intermedia.techo, 0.65);
});

test('rangoVeloDeIntensidad("intermedia") no colisiona con la guarda de basura — "intermedio"/"INTERMEDIA"/variantes no son la clave exacta y caen a "media"', () => {
  for (const casiIgual of ['intermedio', 'INTERMEDIA', 'Intermedia', 'intermedia ']) {
    assert.deepEqual(rangoVeloDeIntensidad(casiIgual), rangoVeloDeIntensidad('media'), `"${casiIgual}" no es la clave exacta`);
  }
});

test('el rango "intermedia" MEJORA el contraste sobre "suave" en las DOS puntas y las TRES fotos, y sigue bajo AA (4.5:1) — MEDIDO y REPORTADO, no bloqueado (§ el docstring de rangoVeloDeIntensidad)', () => {
  // Mismo método WCAG y las mismas tres fotos de referencia que el test de "suave" arriba, contra la
  // TINTA REAL de CORTE (#102407). "Un poquito más oscuro" se verifica en DOS partes: el contraste
  // SUBE respecto de "suave" (el pedido), y sigue sin cruzar AA (el límite: no es "media" otra vez).
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
  const intermedia = rangoVeloDeIntensidad('intermedia');
  for (const [nombre, foto] of Object.entries(fotos)) {
    const contrasteEn = (opacidad: number) => {
      const alfa = opacidad * 0.8;
      const compuesto = tintaCorte.map((t, i) => alfa * t + (1 - alfa) * foto[i]);
      return contraste(blanco, compuesto);
    };
    const suavePiso = contrasteEn(suave.piso);
    const intermediaPiso = contrasteEn(intermedia.piso);
    assert.ok(intermediaPiso > suavePiso, `piso: "intermedia" (${intermediaPiso.toFixed(2)}) debe superar a "suave" (${suavePiso.toFixed(2)}) contra ${nombre}`);
    assert.ok(intermediaPiso < 4.5, `piso contra ${nombre} debía quedar bajo AA; dio ${intermediaPiso.toFixed(2)}`);

    const suaveTecho = contrasteEn(suave.techo);
    const intermediaTecho = contrasteEn(intermedia.techo);
    assert.ok(intermediaTecho > suaveTecho, `techo: "intermedia" (${intermediaTecho.toFixed(2)}) debe superar a "suave" (${suaveTecho.toFixed(2)}) contra ${nombre}`);
    assert.ok(intermediaTecho < 4.5, `techo contra ${nombre} debía quedar bajo AA; dio ${intermediaTecho.toFixed(2)}`);
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

// ── EL PESO — CORTE-MARQUEE-REVELADO-CON-FADE-1 — la rampa de opacidad que ACOMPAÑA al recorte,
// comparte ventana con `transformRevelaTextoDisplay` por reusar el mismo `progresoRevelado` privado.

test('opacidadRevelaTextoDisplay: estatico=true SIEMPRE el TECHO — peso completo (pero no pleno), nunca a medio aclarar para siempre', () => {
  assert.equal(opacidadRevelaTextoDisplay(0, true), OPACIDAD_REVELADO_TECHO);
  assert.equal(opacidadRevelaTextoDisplay(0.5, true), OPACIDAD_REVELADO_TECHO);
  assert.equal(opacidadRevelaTextoDisplay(1, true), OPACIDAD_REVELADO_TECHO);
  assert.equal(opacidadRevelaTextoDisplay(-0.5, true), OPACIDAD_REVELADO_TECHO, 'estatico gana incluso con progreso fuera de rango');
});

test('opacidadRevelaTextoDisplay: estatico=false, progreso=0 — 0, sin peso en reposo (igual que el recorte, 100% fuera de la máscara)', () => {
  assert.equal(opacidadRevelaTextoDisplay(0, false), 0);
});

test('opacidadRevelaTextoDisplay: estatico=false, progreso=hasta (fin de la ventana) — el TECHO, EN EL MISMO instante en que el recorte llega a 0%', () => {
  assert.equal(opacidadRevelaTextoDisplay(UMBRAL_REVELADO_TEXTO.hasta, false), OPACIDAD_REVELADO_TECHO);
  assert.equal(transformRevelaTextoDisplay(UMBRAL_REVELADO_TEXTO.hasta, false), 'translateY(0.0%)', 'las dos rampas terminan JUNTAS, a la misma altura de progreso');
});

test('opacidadRevelaTextoDisplay: más allá de la ventana — sigue en el TECHO, nunca se pasa de él', () => {
  assert.equal(opacidadRevelaTextoDisplay(0.5, false), OPACIDAD_REVELADO_TECHO);
  assert.equal(opacidadRevelaTextoDisplay(1, false), OPACIDAD_REVELADO_TECHO);
});

test('opacidadRevelaTextoDisplay: a mitad de la ventana, a mitad del TECHO — MISMO punto donde el recorte está a mitad de camino (50%)', () => {
  const medio = UMBRAL_REVELADO_TEXTO.hasta / 2;
  assert.equal(opacidadRevelaTextoDisplay(medio, false), 0.5 * OPACIDAD_REVELADO_TECHO);
  assert.equal(transformRevelaTextoDisplay(medio, false), 'translateY(50.0%)', 'a mitad de ventana, el recorte también está a mitad de camino — las dos rampas avanzan JUNTAS');
});

test('OPACIDAD_REVELADO_TECHO: un escalón MODERADO por debajo del pleno — RONDA § CORTE-HERO-MARQUEE-RONDA-5-1', () => {
  assert.ok(OPACIDAD_REVELADO_TECHO > 0.5, 'sigue siendo peso ALTO, no una segunda opacidad tenue');
  assert.ok(OPACIDAD_REVELADO_TECHO < 1, 'estrictamente menor al pleno — "que no sea un blanco tan claro"');
  assert.equal(OPACIDAD_REVELADO_TECHO, 0.9);
});

test('opacidadRevelaTextoDisplay: progreso se acota a [0,1] antes de mapear a la ventana — un negativo no pasa de 0', () => {
  assert.equal(opacidadRevelaTextoDisplay(-0.5, false), opacidadRevelaTextoDisplay(0, false));
});

test('opacidadRevelaTextoDisplay: MONÓTONA — nunca oscurece a mitad de camino, barriendo toda la ventana', () => {
  const pasos = 20;
  let anterior = -Infinity;
  for (let i = 0; i <= pasos; i++) {
    const p = (UMBRAL_REVELADO_TEXTO.hasta * i) / pasos;
    const valor = opacidadRevelaTextoDisplay(p, false);
    assert.ok(valor >= anterior, `debe ser no-decreciente: en progreso=${p} dio ${valor}, antes ${anterior}`);
    anterior = valor;
  }
});

// ── EL TAMAÑO DEL TEXTO Y SU MÁSCARA — § CORTE-HERO-MARQUEE-RONDA-5-1 ──────────────────────────────
// MEDIDO contra `fz:d1` del tema real (§ el docstring de estas constantes en `lib/animation.ts` para
// la derivación completa: preset-2 body-preset, rem del tema a 62.5%, las dos escalas en 1.0).

test('MARQUEE_TITULO_FONT_SIZE: el clamp MEDIDO en px absolutos — mayor que el techo de hoy (10rem=160px a nuestro rem)', () => {
  assert.equal(MARQUEE_TITULO_FONT_SIZE, 'clamp(76px, calc(17.25vw + 7px), 214px)');
  // el piso/techo del clamp VIEJO (§ el comentario de `fadeUp` arriba): 48px/160px.
  assert.ok(76 > 48, 'el piso nuevo es mayor que el piso de hoy');
  assert.ok(214 > 160, 'el techo nuevo es mayor que el techo de hoy — "se ve más lleno"');
});

test('MARQUEE_TITULO_FONT_SIZE: a 1280px (la referencia de escritorio de este repo) el clamp toca el TECHO — 214px', () => {
  const anchoReferencia = 1280;
  const fluido = 17.25 * (anchoReferencia / 100) + 7; // 17.25vw + 7px
  assert.ok(fluido > 214, 'el tramo fluido a 1280px ya excede el techo — el clamp lo recorta ahí');
});

test('MARQUEE_TITULO_LINE_HEIGHT/MARQUEE_TITULO_LETTER_SPACING: los valores que el tema declara EN LÍNEA (--lh/--lts), no una aproximación', () => {
  assert.equal(MARQUEE_TITULO_LINE_HEIGHT, 1.1);
  assert.equal(MARQUEE_TITULO_LETTER_SPACING, '-1px');
});

test('MARQUEE_MASCARA_RELLENO_EM: un relleno MEDIDO (0.04em), menor que el 0.08em de la pieza de marca de Duna — no se copió a ciegas', () => {
  assert.equal(MARQUEE_MASCARA_RELLENO_EM, 0.04);
  assert.ok(MARQUEE_MASCARA_RELLENO_EM > 0, 'tiene que existir relleno — 0 reproduciría el recorte reportado');
  assert.ok(MARQUEE_MASCARA_RELLENO_EM < 0.08, 'el interlineado nuevo (1.1) ya achica el déficit frente al recorrido de Duna (0.08em)');
});

// ── EL PRESUPUESTO DE SCROLL PROPORCIONAL (§ CORTE-HERO-MARQUEE-REVELA-1) — sin React, sin navegador
// `claseAlturaAncestroMarquesina` es lookup por LITERAL (mismo criterio que `gridColsPresentaciones`,
// `lib/storefront/presentaciones.ts`): las TRES ramas son strings COMPLETOS para que Tailwind los vea.

test('claseAlturaAncestroMarquesina: CON tarjeta, el presupuesto de SIEMPRE — 100svh + 200vh, MEDIDO contra `<xo-parallax class="h:300vh">`', () => {
  assert.equal(claseAlturaAncestroMarquesina(true, false), 'min-h-[calc(100svh+200vh)]');
});

test('claseAlturaAncestroMarquesina: SIN tarjeta, 100svh + 65vh — 200vh menos la ventana [0.12,0.57] de `transformMarquesinaTarjeta` (0.45×300vh=135vh), la porción sin nada que animar', () => {
  assert.equal(claseAlturaAncestroMarquesina(false, false), 'min-h-[calc(100svh+65vh)]');
});

// § HERO-FRASE-AL-PIE-Y-PREVIEW-1: en PREVIEW el ancestro se COLAPSA al tamaño exacto de la sección
// pineada (`h-[100svh]`) — la vista previa del panel no scrollea, así que el "presupuesto" que el
// storefront real esconde detrás del `position:sticky` quedaba VISIBLE, plano, como fondo oscuro
// bajo la media (el defecto reportado por el owner). `tieneTarjeta` deja de importar bajo preview:
// las dos ramas convergen a la MISMA clase colapsada.
test('claseAlturaAncestroMarquesina: EN PREVIEW, el ancestro se colapsa a h-[100svh] — sin recorrido de scroll, cubre el marco entero', () => {
  assert.equal(claseAlturaAncestroMarquesina(true, true), 'h-[100svh]');
  assert.equal(claseAlturaAncestroMarquesina(false, true), 'h-[100svh]');
});

test('claseAlturaAncestroMarquesina: fuera de preview, las dos ramas de SIEMPRE (200vh/65vh) quedan intactas — el storefront real no cambia', () => {
  assert.equal(claseAlturaAncestroMarquesina(true, false), 'min-h-[calc(100svh+200vh)]');
  assert.equal(claseAlturaAncestroMarquesina(false, false), 'min-h-[calc(100svh+65vh)]');
});

// ── EL ÍNDICE CENTRADO DE UN RIEL — RETIRADO, § RIEL-PRODUCTOS-Y-VISTA-RAPIDA-1 ───────────────────
// `indiceCentrado`/`useIndiceCentrado` (§ MUESTRARIO-RIEL-ACTIVO-1) y sus tests vivían acá; se
// retiraron con su único consumidor (`GrindChooserRiel.tsx`) — ver el docstring que queda en
// `lib/animation.ts` en su lugar para el porqué completo (el owner reemplazó el resaltado por-scroll
// por un hover por-tarjeta).

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
// segunda medición. § CORTE-HERO-MARQUEE-RONDA-5-1 (2026-09-27) sube la fracción de 0.6× a 0.7×
// («subele sólo un poco la velocidad») — se actualiza a la nueva meta, no se afloja el test.

test('VELOCIDAD_TICKER_LENTA_PX_S es 0.7× la medida — una fracción ELEGIDA, ESTRICTAMENTE entre la lenta vieja (0.6×) y la medida (1×)', () => {
  assert.equal(VELOCIDAD_TICKER_LENTA_PX_S, VELOCIDAD_TICKER_PX_S * 0.7);
  assert.ok(VELOCIDAD_TICKER_LENTA_PX_S < VELOCIDAD_TICKER_PX_S, 'sigue siendo más lenta que la medida');
  assert.ok(VELOCIDAD_TICKER_LENTA_PX_S > VELOCIDAD_TICKER_PX_S * 0.6, 'más rápida que la lenta anterior — "subele sólo un poco"');
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

// ── EL COLLAGE DE brandStory·centrada — CARDINALIDAD 1-4 CONTRA UN PROTOTIPO DE 3 (§ HISTORIA-COMO-
// MUESTRARIO-1) ─────────────────────────────────────────────────────────────────────────────────
// `parametrosAcomodoCollage` es la pieza puramente MATEMÁTICA; el cableado con `brandStory` (cuál
// slot es "la del medio", el `useTransform` por figura) se afirma en
// `lib/config/historia-direccion-arte.test.ts`, que ya importa `transformAcomodo`.
//
// § HISTORIA-FOTOS-PANEL-Y-GIRO-1 (gate del owner) FUERZA `aperturaPx` a CERO, SIEMPRE — se aparta a
// propósito de `js/home.js:288` (`spread=[-70,0,70]`), que abre horizontalmente. La ROTACIÓN no
// cambió: sigue el literal del prototipo para total=3 y la generalización simétrica para el resto.

test('parametrosAcomodoCollage: total=3 usa la ROTACIÓN LITERAL del prototipo (`js/home.js:287`); la apertura es CERO, no el `spread` del prototipo', () => {
  assert.deepEqual(parametrosAcomodoCollage(0, 3), { rotarInicialDeg: -8, aperturaPx: 0 });
  assert.deepEqual(parametrosAcomodoCollage(1, 3), { rotarInicialDeg: 4, aperturaPx: 0 });
  assert.deepEqual(parametrosAcomodoCollage(2, 3), { rotarInicialDeg: -3, aperturaPx: 0 });
});

test('parametrosAcomodoCollage: total=1 — una sola figura, sin nada contra qué ser simétrica: rotación y apertura en 0', () => {
  assert.deepEqual(parametrosAcomodoCollage(0, 1), { rotarInicialDeg: 0, aperturaPx: 0 });
});

test('parametrosAcomodoCollage: total=2 — PAR, sin centro: las dos posiciones son un espejo exacto en ROTACIÓN (misma magnitud, signo opuesto); la apertura es CERO en las dos', () => {
  const izq = parametrosAcomodoCollage(0, 2);
  const der = parametrosAcomodoCollage(1, 2);
  assert.equal(izq.rotarInicialDeg, -der.rotarInicialDeg);
  assert.ok(izq.rotarInicialDeg !== 0, 'sin centro (total par), ninguna posición cae en offset 0');
  assert.equal(izq.aperturaPx, 0);
  assert.equal(der.aperturaPx, 0);
});

test('parametrosAcomodoCollage: total=4 — PAR, simetría espejo en ROTACIÓN entre 0↔3 y 1↔2; la apertura sigue en CERO para las cuatro (ya no crece con la distancia al centro)', () => {
  const p0 = parametrosAcomodoCollage(0, 4);
  const p1 = parametrosAcomodoCollage(1, 4);
  const p2 = parametrosAcomodoCollage(2, 4);
  const p3 = parametrosAcomodoCollage(3, 4);
  assert.equal(p0.rotarInicialDeg, -p3.rotarInicialDeg, 'espejo: extremo izquierdo ↔ extremo derecho');
  assert.equal(p1.rotarInicialDeg, -p2.rotarInicialDeg, 'espejo: interior izquierdo ↔ interior derecho');
  for (const p of [p0, p1, p2, p3]) assert.equal(p.aperturaPx, 0);
});

test('parametrosAcomodoCollage: la apertura es CERO para TODA cantidad de fotos (1 a 5), sin importar la posición — § HISTORIA-FOTOS-PANEL-Y-GIRO-1', () => {
  for (let total = 1; total <= 5; total++) {
    for (let posicion = 0; posicion < total; posicion++) {
      assert.equal(parametrosAcomodoCollage(posicion, total).aperturaPx, 0, `total=${total}, posicion=${posicion}`);
    }
  }
});

test('parametrosAcomodoCollage: una figura EXACTAMENTE en el centro (posible sólo con total impar) tiene rotarInicialDeg=0 en la regla general (no aplica a total=3, que usa el literal)', () => {
  const centro = parametrosAcomodoCollage(2, 5);
  assert.equal(centro.rotarInicialDeg, 0);
  assert.equal(centro.aperturaPx, 0);
});

// § HISTORIA-COLLAGE-COMO-PROTOTIPO-1 — la constante que `useProgresoAcomodo` pasa a `useSpring`
// (el hook en sí no es testeable sin jsdom, § el docstring de ese archivo; esto afirma el ÚNICO
// invariante verificable sin renderizar: que el resorte no puede OSCILAR más allá de [0,1]).
test('RESORTE_ACOMODO: sobreamortiguado (damping ≥ 2·√stiffness, mass=1) — sin overshoot perceptible del progreso', () => {
  const criticaMasaUno = 2 * Math.sqrt(RESORTE_ACOMODO.stiffness);
  assert.ok(
    RESORTE_ACOMODO.damping >= criticaMasaUno,
    `damping (${RESORTE_ACOMODO.damping}) debe ser ≥ el crítico (${criticaMasaUno.toFixed(2)}) para mass=1 — si baja de eso, el progreso puede pasarse de 1 u oscilar bajo 0 antes de asentar`,
  );
});

// § TRANSICION-ENTRE-PAGINAS-1 — `cssRevelaPagina`, el CSS que `EntradaPagina.tsx` inyecta. Afirma
// el TEXTO producido, no un DOM (no hay navegador en capa 1): los tokens medidos contra el
// prototipo (600ms/28px/la curva/90ms de paso) y el escalonado por `:nth-child`.

test('cssRevelaPagina: la regla base declara opacidad 0, el traslado y la animación con los tokens medidos', () => {
  const css = cssRevelaPagina();
  assert.ok(css.includes('[data-entrada-pagina]>*{opacity:0;transform:translateY(28px);'), css);
  assert.ok(css.includes(`animation:sf-entrada-pagina ${REVELADO_PAGINA_DURACION_MS}ms ${REVELADO_PAGINA_EASE} both}`), css);
  assert.equal(REVELADO_PAGINA_DURACION_MS, 600, '--duration-reveal del prototipo, tokens.css:214');
  assert.equal(REVELADO_PAGINA_TRASLADO_PX, 28, 'translateY del prototipo, app.css:943');
  assert.equal(REVELADO_PAGINA_EASE, 'cubic-bezier(0.22, 0.61, 0.36, 1)', '--ease-reveal=--ease-out, tokens.css:189,213');
});

test('cssRevelaPagina: el keyframe deja el estado FINAL visible (opacity:1, sin transform)', () => {
  const css = cssRevelaPagina();
  assert.ok(css.includes('@keyframes sf-entrada-pagina{to{opacity:1;transform:none}}'), css);
});

test('cssRevelaPagina: el escalonado va en pasos de 90ms — nth-child(1)=0ms, (2)=90ms, (3)=180ms, (4)=270ms, (5)=360ms (§ app.css:954-958)', () => {
  const css = cssRevelaPagina();
  assert.equal(REVELADO_PAGINA_PASO_MS, 90);
  for (let i = 0; i < 5; i++) {
    assert.ok(
      css.includes(`[data-entrada-pagina]>*:nth-child(${i + 1}){animation-delay:${i * 90}ms}`),
      `falta la regla de nth-child(${i + 1})`,
    );
  }
});

test('cssRevelaPagina: el escalonado se EXTIENDE más allá del 5º hijo del prototipo — hasta BANDA_IDS.length, la home entera', () => {
  const css = cssRevelaPagina();
  assert.ok(BANDA_IDS.length > 5, 'la premisa de esta extensión: la home tiene más de 5 bloques');
  for (let i = 0; i < BANDA_IDS.length; i++) {
    assert.ok(
      css.includes(`[data-entrada-pagina]>*:nth-child(${i + 1}){animation-delay:${i * 90}ms}`),
      `falta la regla de nth-child(${i + 1}) — BANDA_IDS.length=${BANDA_IDS.length}`,
    );
  }
  assert.ok(
    !css.includes(`nth-child(${BANDA_IDS.length + 1})`),
    'no hay regla de más — el tope es BANDA_IDS.length, no infinito',
  );
});
