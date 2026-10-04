import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MotionConfig } from 'framer-motion';
import {
  ReducedMotionProvider, valorContador, DURACION_CONTADOR_MS,
  transformMarquesinaTexto, transformMarquesinaTarjeta, transformSubscripcionParallax,
  progresoDesdeTope, veloOpacidad, VELO_OPACIDAD_PISO, rangoVeloDeIntensidad,
  transformRevelaTextoDisplay, opacidadRevelaTextoDisplay, OPACIDAD_REVELADO_TECHO,
  UMBRAL_REVELADO_TEXTO, UMBRAL_ENTRADA_TARJETA_MARQUESINA, PAUSA_MARQUESINA_TARJETA_VH,
  claseAlturaAncestroMarquesina, fadeUp,
  direccionScroll, navOculto, UMBRAL_OCULTAR_NAV, debeActualizarTratamientoNav,
  duracionTickerS, VELOCIDAD_TICKER_PX_S, VELOCIDAD_TICKER_LENTA_PX_S,
  DURACION_TICKER_FALLBACK_S, duracionTickerFallbackS, velocidadTickerPxS,
  MARQUEE_TITULO_FONT_SIZE, MARQUEE_TITULO_LINE_HEIGHT, MARQUEE_TITULO_LETTER_SPACING,
  MARQUEE_MASCARA_RELLENO_EM, parametrosAcomodoCollage, RESORTE_ACOMODO,
  cssRevelaPagina, REVELADO_PAGINA_DURACION_MS, REVELADO_PAGINA_TRASLADO_PX,
  REVELADO_PAGINA_EASE, REVELADO_PAGINA_PASO_MS,
  transicionEscalonada, REVELADO_GRUPO_DURACION_S, REVELADO_GRUPO_EASE, REVELADO_GRUPO_PASO_S,
  DRAWER_MOVIL_DISTANCIA_PX, DRAWER_MOVIL_DURACION_S, DRAWER_MOVIL_EASE, DRAWER_MOVIL_PASO_S, DRAWER_MOVIL_BASE_S,
  retardoEntradaDrawerMovil, retardoSalidaDrawerMovil,
  transicionBloqueCascada, CASCADA_BLOQUE_DURACION_S, CASCADA_BLOQUE_EASE, CASCADA_BLOQUE_PASO_S, fadeUpCascadaBloque,
  revelaMascaraVertical, transicionTituloPostal, transicionFadePostal,
  transicionDestacadoFoto, transicionDestacadoTexto, TRANSICION_DESTACADO_EASE,
  TRANSICION_DESTACADO_FOTO_DURACION_S, TRANSICION_DESTACADO_TEXTO_DURACION_S,
  transformEntradaSalidaItem, opacidadEntradaSalidaItem,
  ventanasBandaMarquesina, claseAlturaAncestroBandaMarquesina,
  MARQUESINA_BANDA_TEXTO_VH, MARQUESINA_BANDA_ITEM_VH, MAX_ITEMS_BANDA_MARQUESINA,
  direccionDeslizarItem, transformDeslizarItem,
  transformAcercarItem, MARQUESINA_ACERCAR_ESCALA_INICIAL,
  filterEnfocarItem, MARQUESINA_ENFOCAR_DESENFOQUE_PX,
  transformGirarItem, MARQUESINA_GIRAR_ESCALA_INICIAL, MARQUESINA_GIRAR_GRADOS,
  transformTransicionMarquesinaItem, filterTransicionMarquesinaItem,
  estiloTarjetaTransicion, TARJETA_TRANSICION_VENTANA_ENTRADA, TARJETA_TRANSICION_VENTANA_SALIDA,
  progresoLoopTarjetaTransicion, TARJETA_TRANSICION_DURACION_S,
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
//
// EL PARSEO DEL TEXTO ("1.600" → 1600 + su separador, § ORIGEN-CONTADOR-MILES-1) NO SE PRUEBA ACÁ:
// `valorContador` recibe un `destino` ya numérico, nunca el string del dato. Esa lógica (y su
// reformateo del paso intermedio del conteo) tiene su propio módulo puro con su propio test —
// `lib/storefront/cifra-contador.test.ts`.

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

// ── `ventana` (§ MARQUESINA-TARJETA-PRODUCTO-1) — el tercer argumento de `transformMarquesinaTarjeta`.
// Los tests de arriba (2 argumentos) siguen afirmando el DEFAULT [0.12,0.57] — el que
// `Marquesina.tsx` sigue usando, sin cambios. HASTA § MARQUESINA-TARJETA-SECUENCIA-1,
// `HeroMediaMarquesina.tsx` pasaba `UMBRAL_ENTRADA_TARJETA_MARQUESINA` como ESTA ventana — ya NO:
// desde § MARQUESINA-TARJETA-COMO-LETRAS-1 (2026-10-02) ese componente dejó de llamar a
// `transformMarquesinaTarjeta` por completo (la tarjeta usa "el efecto de las letras",
// `transformRevelaTextoDisplay`/`opacidadRevelaTextoDisplay` — ver su propio bloque de tests más
// abajo). Los dos tests que siguen usan `UMBRAL_ENTRADA_TARJETA_MARQUESINA` sólo como una ventana de
// EJEMPLO no-default, para afirmar que el parámetro `ventana` de `transformMarquesinaTarjeta` sigue
// funcionando — una capacidad genérica que `Marquesina.tsx` no ejerce hoy, no una afirmación de que
// algo la pase con ESE valor.

test('transformMarquesinaTarjeta: con `ventana` explícita, el recorte interno usa ESA ventana, no el default', () => {
  const ventana = { desde: 0.2, hasta: 0.4 };
  assert.equal(transformMarquesinaTarjeta(0.2, false, ventana), 'scale(0.850) rotate(-4.00deg)');
  assert.equal(transformMarquesinaTarjeta(0.4, false, ventana), 'scale(1.000) rotate(0.00deg)');
  assert.equal(transformMarquesinaTarjeta(0.3, false, ventana), 'scale(0.925) rotate(-2.00deg)');
});

test('transformMarquesinaTarjeta: `ventana` explícita respeta el mismo recorte [0,1] en los bordes — antes de `desde` queda en el INICIO, después de `hasta` en el FINAL', () => {
  const ventana = { desde: 0.2, hasta: 0.4 };
  assert.equal(transformMarquesinaTarjeta(-0.5, false, ventana), transformMarquesinaTarjeta(0.2, false, ventana));
  assert.equal(transformMarquesinaTarjeta(0.5, false, ventana), transformMarquesinaTarjeta(0.4, false, ventana));
});

test('transformMarquesinaTarjeta: sin `ventana`, el default reproduce EXACTO el mismo resultado que antes de este slice (byte-idéntico para `Marquesina.tsx`)', () => {
  assert.equal(transformMarquesinaTarjeta(0, false), 'scale(0.850) rotate(-4.00deg)');
  assert.equal(transformMarquesinaTarjeta(1, false), 'scale(1.000) rotate(0.00deg)');
  assert.equal(transformMarquesinaTarjeta(0.345, false), transformMarquesinaTarjeta(0.345, false, { desde: 0.12, hasta: 0.57 }));
});

// ── `UMBRAL_ENTRADA_TARJETA_MARQUESINA` — DERIVADA de `UMBRAL_REVELADO_TEXTO`, no un segundo par de
// números suelto: dura el MISMO ancho que la de la frase y arranca DESPUÉS de que ésa termina.
// § MARQUESINA-TARJETA-COMO-LETRAS-1 (2026-10-02) agrega la PAUSA entre las dos — antes (§
// MARQUESINA-TARJETA-SECUENCIA-1) arrancaba EXACTO donde la frase termina, cero distancia.

test('UMBRAL_ENTRADA_TARJETA_MARQUESINA: el mismo ANCHO que UMBRAL_REVELADO_TEXTO — misma cadencia de entrada, no una inventada', () => {
  const anchoTexto = UMBRAL_REVELADO_TEXTO.hasta - UMBRAL_REVELADO_TEXTO.desde;
  const anchoTarjeta = UMBRAL_ENTRADA_TARJETA_MARQUESINA.hasta - UMBRAL_ENTRADA_TARJETA_MARQUESINA.desde;
  assert.equal(anchoTarjeta, anchoTexto);
});

test('UMBRAL_ENTRADA_TARJETA_MARQUESINA: arranca DESPUÉS de donde UMBRAL_REVELADO_TEXTO termina — hay una PAUSA, ya no cero distancia', () => {
  assert.ok(
    UMBRAL_ENTRADA_TARJETA_MARQUESINA.desde > UMBRAL_REVELADO_TEXTO.hasta,
    'con la pausa, el arranque de la tarjeta debe quedar ESTRICTAMENTE después del final de la frase',
  );
});

test('UMBRAL_ENTRADA_TARJETA_MARQUESINA: la pausa se DERIVA de PAUSA_MARQUESINA_TARJETA_VH con la misma fórmula que `claseAlturaAncestroMarquesina` usa para el presupuesto — no es un número suelto', () => {
  // Misma derivación que el docstring de `UMBRAL_ENTRADA_TARJETA_MARQUESINA` en `lib/animation.ts`:
  // F=UMBRAL_REVELADO_TEXTO.hasta, A=F (ancho), R=A/2 (respiro), K=F+A+R, pausaFraccion=G·K/(100+G).
  const F = UMBRAL_REVELADO_TEXTO.hasta;
  const A = F;
  const K = F + A + A / 2;
  const G = PAUSA_MARQUESINA_TARJETA_VH;
  const pausaFraccion = (G * K) / (100 + G);
  assert.ok(
    Math.abs(UMBRAL_ENTRADA_TARJETA_MARQUESINA.desde - (F + pausaFraccion)) < 1e-12,
    `desde debe ser F + pausaFraccion (${F + pausaFraccion}); dio ${UMBRAL_ENTRADA_TARJETA_MARQUESINA.desde}`,
  );
});

test('PAUSA_MARQUESINA_TARJETA_VH: positiva y con los valores de hoy (20, "unidades de viewport" VH=100)', () => {
  assert.ok(PAUSA_MARQUESINA_TARJETA_VH > 0, 'una pausa de cero no sería pausa');
  assert.equal(PAUSA_MARQUESINA_TARJETA_VH, 20);
});

// ── LA ENTRADA DE LA TARJETA — § MARQUESINA-TARJETA-COMO-LETRAS-1 (2026-10-02): "el mismo efecto
// que las letras". `HeroMediaMarquesina.tsx` dejó de llamar a `transformMarquesinaTarjeta`/
// `opacidadEntradaTarjetaMarquesina` (RETIRADA — sin consumidor real, § su docstring en
// `lib/animation.ts`) y pasa a usar las MISMAS `transformRevelaTextoDisplay`/
// `opacidadRevelaTextoDisplay` que ya revelan la frase, con `ventana=UMBRAL_ENTRADA_TARJETA_
// MARQUESINA` y, para la opacidad, `techo=1` (PLENA, no el 0.9 de la frase).

test('la tarjeta, en SU ventana: estatico=true SIEMPRE "translateY(0%)" + opacidad 1 (técho pleno) — visible por completo, nunca a medio aparecer', () => {
  const ventana = UMBRAL_ENTRADA_TARJETA_MARQUESINA;
  assert.equal(transformRevelaTextoDisplay(0, true, ventana), 'translateY(0%)');
  assert.equal(opacidadRevelaTextoDisplay(0, true, ventana, 1), 1);
  assert.equal(opacidadRevelaTextoDisplay(1, true, ventana, 1), 1, 'estatico gana incluso con progreso fuera de rango');
});

test('la tarjeta, en SU ventana: estatico=false, progreso=desde — oculta del todo (100% trasladada, opacidad 0), el ARRANQUE de su propia ventana', () => {
  const ventana = UMBRAL_ENTRADA_TARJETA_MARQUESINA;
  assert.equal(transformRevelaTextoDisplay(ventana.desde, false, ventana), 'translateY(100.0%)');
  assert.equal(opacidadRevelaTextoDisplay(ventana.desde, false, ventana, 1), 0);
});

test('la tarjeta, en SU ventana: estatico=false, progreso=hasta — en su lugar (0%) y PLENA (opacidad 1, no el 0.9 de la frase)', () => {
  const ventana = UMBRAL_ENTRADA_TARJETA_MARQUESINA;
  assert.equal(transformRevelaTextoDisplay(ventana.hasta, false, ventana), 'translateY(0.0%)');
  assert.equal(opacidadRevelaTextoDisplay(ventana.hasta, false, ventana, 1), 1);
});

test('la tarjeta, en SU ventana: más allá de `hasta` — sigue en su lugar y plena, nunca se pasa', () => {
  const ventana = UMBRAL_ENTRADA_TARJETA_MARQUESINA;
  assert.equal(transformRevelaTextoDisplay(1, false, ventana), 'translateY(0.0%)');
  assert.equal(opacidadRevelaTextoDisplay(1, false, ventana, 1), 1);
});

test('la tarjeta, en SU ventana: a mitad de camino — translateY(50%) y opacidad 0.5, la MISMA proporción que la frase a mitad de LA SUYA', () => {
  const ventana = UMBRAL_ENTRADA_TARJETA_MARQUESINA;
  const medio = (ventana.desde + ventana.hasta) / 2;
  assert.equal(transformRevelaTextoDisplay(medio, false, ventana), 'translateY(50.0%)');
  assert.ok(Math.abs(opacidadRevelaTextoDisplay(medio, false, ventana, 1) - 0.5) < 1e-9);
});

// ── LA SECUENCIA (§ MARQUESINA-TARJETA-SECUENCIA-1, LA PAUSA § MARQUESINA-TARJETA-COMO-LETRAS-1) —
// la frase TERMINA de aparecer, DESPUÉS hay una pausa, y SÓLO DESPUÉS la tarjeta empieza — nunca al
// mismo tiempo, y nunca en el MISMO scroll en que la frase completó.

test('LA SECUENCIA: mientras la frase SIGUE revelándose, la tarjeta sigue oculta del todo — no entran juntas', () => {
  const dentroDeLaFrase = (UMBRAL_REVELADO_TEXTO.desde + UMBRAL_REVELADO_TEXTO.hasta) / 2;
  assert.ok(opacidadRevelaTextoDisplay(dentroDeLaFrase, false) > 0, 'la frase ya está apareciendo en ese punto');
  assert.equal(transformRevelaTextoDisplay(dentroDeLaFrase, false, UMBRAL_ENTRADA_TARJETA_MARQUESINA), 'translateY(100.0%)');
  assert.equal(opacidadRevelaTextoDisplay(dentroDeLaFrase, false, UMBRAL_ENTRADA_TARJETA_MARQUESINA, 1), 0, 'la tarjeta todavía no empezó');
});

test('LA PAUSA: en el instante EXACTO en que la frase termina de revelarse, la tarjeta SIGUE oculta — la pausa todavía no se cruzó', () => {
  const finDeLaFrase = UMBRAL_REVELADO_TEXTO.hasta;
  assert.equal(transformRevelaTextoDisplay(finDeLaFrase, false), 'translateY(0.0%)', 'la frase ya está en su lugar');
  assert.equal(opacidadRevelaTextoDisplay(finDeLaFrase, false), OPACIDAD_REVELADO_TECHO, 'la frase ya terminó de aclarar');
  assert.equal(
    transformRevelaTextoDisplay(finDeLaFrase, false, UMBRAL_ENTRADA_TARJETA_MARQUESINA),
    'translateY(100.0%)',
    'justo donde la frase termina, la tarjeta sigue COMPLETAMENTE oculta — la pausa es la distancia hasta UMBRAL_ENTRADA_TARJETA_MARQUESINA.desde',
  );
  assert.equal(opacidadRevelaTextoDisplay(finDeLaFrase, false, UMBRAL_ENTRADA_TARJETA_MARQUESINA, 1), 0);
});

test('LA PAUSA: hay progreso DENTRO de la pausa (entre el fin de la frase y el arranque de la tarjeta) donde las DOS están en su estado de reposo — ni la frase retrocede, ni la tarjeta adelanta', () => {
  const mitadDeLaPausa = (UMBRAL_REVELADO_TEXTO.hasta + UMBRAL_ENTRADA_TARJETA_MARQUESINA.desde) / 2;
  assert.ok(mitadDeLaPausa > UMBRAL_REVELADO_TEXTO.hasta && mitadDeLaPausa < UMBRAL_ENTRADA_TARJETA_MARQUESINA.desde, 'el punto elegido debe caer DENTRO de la pausa');
  assert.equal(transformRevelaTextoDisplay(mitadDeLaPausa, false), 'translateY(0.0%)', 'la frase sigue en su lugar');
  assert.equal(opacidadRevelaTextoDisplay(mitadDeLaPausa, false), OPACIDAD_REVELADO_TECHO, 'la frase sigue a su techo');
  assert.equal(transformRevelaTextoDisplay(mitadDeLaPausa, false, UMBRAL_ENTRADA_TARJETA_MARQUESINA), 'translateY(100.0%)', 'la tarjeta sigue completamente oculta');
  assert.equal(opacidadRevelaTextoDisplay(mitadDeLaPausa, false, UMBRAL_ENTRADA_TARJETA_MARQUESINA, 1), 0);
});

test('LA SECUENCIA: una vez la tarjeta está apareciendo, la frase YA está quieta en su lugar — no retrocede', () => {
  const mediaTarjeta = (UMBRAL_ENTRADA_TARJETA_MARQUESINA.desde + UMBRAL_ENTRADA_TARJETA_MARQUESINA.hasta) / 2;
  const opacidadTarjeta = opacidadRevelaTextoDisplay(mediaTarjeta, false, UMBRAL_ENTRADA_TARJETA_MARQUESINA, 1);
  assert.ok(opacidadTarjeta > 0 && opacidadTarjeta < 1);
  assert.equal(transformRevelaTextoDisplay(mediaTarjeta, false), 'translateY(0.0%)');
  assert.equal(opacidadRevelaTextoDisplay(mediaTarjeta, false), OPACIDAD_REVELADO_TECHO);
});

// ── `transformSubscripcionParallax` (§ SUSCRIPCION-POSTAL-DE-CIERRE-1, unidad cambiada a `vh` en
// § SUSCRIPCION-PARALLAX-VISIBLE-1) — extraída del inline de `SubscriptionCTALinea.tsx`, reproduce
// `[data-parallax]` del prototipo (`js/home.js:303-307`), MISMOS números (±10, rango ±5), ahora en
// `vh` en vez de `%` de su propia caja — § el docstring de la función para el porqué: `vh` es la
// única magnitud que no se achica cuando la postal (la caja) se achica.

test('transformSubscripcionParallax: estatico=true SIEMPRE "0vh" — la imagen QUIETA, sin importar el progreso', () => {
  assert.equal(transformSubscripcionParallax(0, true), '0vh');
  assert.equal(transformSubscripcionParallax(0.5, true), '0vh');
  assert.equal(transformSubscripcionParallax(1, true), '0vh');
  assert.equal(transformSubscripcionParallax(-0.5, true), '0vh', 'estatico gana incluso con progreso fuera de rango');
});

test('transformSubscripcionParallax: estatico=false, progreso=0.5 (el centro del recorrido) — sin desplazamiento', () => {
  assert.equal(transformSubscripcionParallax(0.5, false), '0.00vh');
});

test('transformSubscripcionParallax: estatico=false, progreso=0 y progreso=1 — los dos extremos opuestos de ±5vh', () => {
  assert.equal(transformSubscripcionParallax(0, false), '5.00vh');
  assert.equal(transformSubscripcionParallax(1, false), '-5.00vh');
});

test('transformSubscripcionParallax: progreso se acota a [0,1] — fuera de rango no sobre-desplaza ni invierte el signo', () => {
  assert.equal(transformSubscripcionParallax(-0.5, false), transformSubscripcionParallax(0, false));
  assert.equal(transformSubscripcionParallax(1.5, false), transformSubscripcionParallax(1, false));
});

test('transformSubscripcionParallax: la unidad es `vh`, NUNCA `%` — decoupled del alto de su propia caja', () => {
  assert.match(transformSubscripcionParallax(0, false), /vh$/);
  assert.match(transformSubscripcionParallax(1, false), /vh$/);
  assert.doesNotMatch(transformSubscripcionParallax(0, false), /%/);
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

test('claseAlturaAncestroMarquesina: CON tarjeta, el presupuesto creció a 100svh + 140vh — § MARQUESINA-TARJETA-COMO-LETRAS-1, crece lo justo para la pausa (antes: 100vh; antes de eso, 200vh)', () => {
  assert.equal(claseAlturaAncestroMarquesina(true, false), 'min-h-[calc(100svh+140vh)]');
});

test('claseAlturaAncestroMarquesina: el extra CON tarjeta se DERIVA de las ventanas, no es un número suelto — H tal que el sticky se despinea justo al terminar el respiro', () => {
  const cardEnd = UMBRAL_ENTRADA_TARJETA_MARQUESINA.hasta;
  const respiro = (UMBRAL_ENTRADA_TARJETA_MARQUESINA.hasta - UMBRAL_ENTRADA_TARJETA_MARQUESINA.desde) / 2;
  const pUnpin = cardEnd + respiro;
  const extra = Math.round(100 / (1 - pUnpin) - 100);
  assert.equal(claseAlturaAncestroMarquesina(true, false), `min-h-[calc(100svh+${extra}vh)]`);
});

test('claseAlturaAncestroMarquesina: SIN tarjeta, 100svh + 65vh — SIN CAMBIO en esta ronda ("sin tarjeta: todo como hoy")', () => {
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

test('claseAlturaAncestroMarquesina: fuera de preview, las dos ramas (140vh/65vh) quedan intactas por `preview` — `preview` no las afecta', () => {
  assert.equal(claseAlturaAncestroMarquesina(true, false), 'min-h-[calc(100svh+140vh)]');
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
// cambió de FORMA: sigue el literal del prototipo para total=3 y la generalización simétrica para
// el resto — § HISTORIA-GIRO-ANTES-1 escala esos mismos valores por `MULTIPLICADOR_GIRO_INICIAL`
// (1.5, "arrancan un poco más giradas"), así que los literales de abajo ya NO son la cita exacta
// de `js/home.js:287` (`[-8,4,-3]`): son esa cita ×1.5.

test('parametrosAcomodoCollage: total=3 ESCALA ×1.5 la ROTACIÓN LITERAL del prototipo (`js/home.js:287`, [-8,4,-3] → [-12,6,-4.5], § HISTORIA-GIRO-ANTES-1); la apertura sigue en CERO, no el `spread` del prototipo', () => {
  assert.deepEqual(parametrosAcomodoCollage(0, 3), { rotarInicialDeg: -12, aperturaPx: 0 });
  assert.deepEqual(parametrosAcomodoCollage(1, 3), { rotarInicialDeg: 6, aperturaPx: 0 });
  assert.deepEqual(parametrosAcomodoCollage(2, 3), { rotarInicialDeg: -4.5, aperturaPx: 0 });
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

// § ORIGEN-FOTOS-REVELADO-Y-CONTEO-1 — `transicionEscalonada`, el revelado por GRUPO que consume
// Origen (fotos, texto, cada fila de datos, cada cifra) vía `whileInView` de framer-motion — mismos
// tokens que `REVELADO_PAGINA_*` arriba miden para el `[data-reveal-group]` del prototipo
// (`docs/prototipos/cafeone/css/tokens.css:189,213-214`, `css/app.css:948-958`), pero en SEGUNDOS
// (la unidad de `transition`) y disparado por VIEWPORT, no por el mount de página.

test('REVELADO_GRUPO_*: 600ms de duración, 90ms de paso — LOS MISMOS números que REVELADO_PAGINA_*, sólo que en segundos', () => {
  assert.equal(REVELADO_GRUPO_DURACION_S, REVELADO_PAGINA_DURACION_MS / 1000, 'misma duración del prototipo, --duration-reveal:600ms');
  assert.equal(REVELADO_GRUPO_PASO_S, REVELADO_PAGINA_PASO_MS / 1000, 'mismo paso del prototipo, 90ms por hijo');
});

test('REVELADO_GRUPO_EASE: la curva cubic-bezier(.22,.61,.36,1) — la misma que REVELADO_PAGINA_EASE parsea como string CSS', () => {
  assert.deepEqual(REVELADO_GRUPO_EASE, [0.22, 0.61, 0.36, 1]);
  assert.equal(REVELADO_PAGINA_EASE, `cubic-bezier(${REVELADO_GRUPO_EASE.join(', ')})`, 'las dos formas del mismo token no deben divergir');
});

test('transicionEscalonada(0): sin retraso — el primer hijo del grupo entra de inmediato', () => {
  assert.deepEqual(transicionEscalonada(0), { duration: REVELADO_GRUPO_DURACION_S, ease: REVELADO_GRUPO_EASE, delay: 0 });
});

test('transicionEscalonada: el retraso crece en pasos de 90ms — 1→90ms, 2→180ms, 3→270ms, 4→360ms (los mismos 5 slots que el prototipo declara para su [data-reveal-group])', () => {
  for (let i = 1; i <= 4; i++) {
    assert.equal(transicionEscalonada(i).delay, i * REVELADO_GRUPO_PASO_S, `índice ${i}`);
  }
});

test('transicionEscalonada: duration/ease no cambian con el índice — sólo el delay escalona', () => {
  const a = transicionEscalonada(0);
  const b = transicionEscalonada(3);
  assert.equal(a.duration, b.duration);
  assert.deepEqual(a.ease, b.ease);
  assert.notEqual(a.delay, b.delay);
});

// § MENU-MOVIL-CIERRE-DESLIZANDO-1 — el cierre del drawer móvil `pantallaCompleta` de CORTE RECORRE
// la entrada EN REVERSA. `retardoEntradaDrawerMovil`/`retardoSalidaDrawerMovil` son las dos mitades
// del mismo cálculo escalonado (comparten paso y base); el asiento completo —qué medición cuadro a
// cuadro (WebKit+Chromium, computed style y píxeles reales) descartó y qué asimetría de código sí
// confirmó— vive en `lib/animation.ts`, junto a las constantes.

test('DRAWER_MOVIL_*: 14px/420ms/ease-out — LOS MISMOS tokens que medía ya ENTRADA_ESCALONADA_DRAWER en StoreNav.tsx (m-link del prototipo, app.css:311-321)', () => {
  assert.equal(DRAWER_MOVIL_DISTANCIA_PX, 14);
  assert.equal(DRAWER_MOVIL_DURACION_S, 0.42);
  assert.deepEqual(DRAWER_MOVIL_EASE, [0.22, 0.61, 0.36, 1]);
});

test('retardoEntradaDrawerMovil(0) = la base (80ms) — el primer ítem no espera un paso completo', () => {
  assert.equal(retardoEntradaDrawerMovil(0), DRAWER_MOVIL_BASE_S);
  assert.equal(retardoEntradaDrawerMovil(0), 0.08);
});

test('retardoEntradaDrawerMovil: crece en pasos de 60ms — 1→140ms, 2→200ms, 3→260ms', () => {
  for (let i = 1; i <= 3; i++) {
    assert.equal(retardoEntradaDrawerMovil(i), i * DRAWER_MOVIL_PASO_S + DRAWER_MOVIL_BASE_S, `índice ${i}`);
  }
});

test('retardoSalidaDrawerMovil: EN REVERSA — con 4 ítems, el índice 3 (el que entró último) sale PRIMERO (delay 0)', () => {
  assert.equal(retardoSalidaDrawerMovil(3, 4), 0);
});

test('retardoSalidaDrawerMovil: con 4 ítems, el índice 0 (el que entró primero) sale ÚLTIMO (delay = 3 pasos)', () => {
  assert.equal(retardoSalidaDrawerMovil(0, 4), 3 * DRAWER_MOVIL_PASO_S);
});

test('retardoSalidaDrawerMovil: el orden de salida es el ESPEJO exacto del de entrada — mismo paso, índices invertidos', () => {
  const total = 5;
  for (let i = 0; i < total; i++) {
    const salida = retardoSalidaDrawerMovil(i, total);
    const entradaDelEspejo = (total - 1 - i) * DRAWER_MOVIL_PASO_S;
    assert.equal(salida, entradaDelEspejo, `índice ${i} de ${total}`);
  }
});

test('retardoSalidaDrawerMovil: sin base (a diferencia de la entrada) — el primer ítem en salir no espera los 80ms que sí separan la apertura del click', () => {
  assert.equal(retardoSalidaDrawerMovil(3, 4), 0, 'el cierre no necesita el margen que la entrada usa para separarse del click que abrió el panel');
});

// § ORIGEN-TEXTO-POR-BLOQUE-1 — `transicionBloqueCascada`/`fadeUpCascadaBloque`, el escalonado
// POR BLOQUE de `TextoEnCascada` (reemplaza la cascada por palabra de ORIGEN-TEXTO-EN-CASCADA-1 —
// `transicionPalabra`/`palabrasDeTexto`/`TokenCascada`/`CASCADA_PALABRA_*` se retiraron con esta
// tanda, sin consumidores restantes). Ver el docstring en `lib/animation.ts` para la RE-medición
// contra `xo-cascade`: duración, curva, paso y propiedad, los cuatro leídos del JS/CSS del tema y
// de `window.settings` embebido en la página viva (`.scratch/refs/cafeone-home.html`).

test('transicionBloqueCascada(0): sin retraso — el primer bloque entra de inmediato', () => {
  assert.deepEqual(transicionBloqueCascada(0), { duration: CASCADA_BLOQUE_DURACION_S, ease: CASCADA_BLOQUE_EASE, delay: 0 });
});

test('transicionBloqueCascada: el retraso crece en pasos de 75ms — el `--xo-constant` medido, literal en el JS del tema, no configurable', () => {
  for (const i of [1, 2, 3]) {
    assert.equal(transicionBloqueCascada(i).delay, i * CASCADA_BLOQUE_PASO_S, `índice ${i}`);
  }
});

test('transicionBloqueCascada: duration 500ms y ease cubic-bezier(0,0,.3,1) — las cifras MEDIDAS de xo-cascade, no las de REVELADO_GRUPO_*', () => {
  assert.equal(CASCADA_BLOQUE_DURACION_S, 0.5);
  assert.deepEqual(CASCADA_BLOQUE_EASE, [0, 0, 0.3, 1]);
  assert.equal(transicionBloqueCascada(0).duration, 0.5);
  assert.deepEqual(transicionBloqueCascada(0).ease, [0, 0, 0.3, 1]);
});

test('CASCADA_BLOQUE_PASO_S es 75ms — el `--xo-constant` literal del JS del tema', () => {
  assert.equal(CASCADA_BLOQUE_PASO_S, 0.075);
});

test('fadeUpCascadaBloque: oculto = invisible y desplazado 30% de la propia caja (xo-fade-up, `--xo-strength:1`) — NO los 24px fijos de `fadeUp`', () => {
  assert.deepEqual(fadeUpCascadaBloque, { hidden: { opacity: 0, y: '30%' }, visible: { opacity: 1, y: '0%' } });
});

// § SUSCRIPCION-TITULO-Y-RECARGA-1 — el revelado de la postal de suscripción: el título sube por
// máscara, el eyebrow/botón se desvanecen escalonados DESPUÉS. Ver el docstring en `lib/animation.ts`.

test('revelaMascaraVertical: oculto = fuera de la caja (100%), visible = en su lugar (0%) — SIN opacidad', () => {
  assert.deepEqual(revelaMascaraVertical, { hidden: { y: '100%' }, visible: { y: '0%' } });
  assert.ok(!('opacity' in revelaMascaraVertical.hidden), 'el recorte es por traslado, no por transparencia');
  assert.ok(!('opacity' in revelaMascaraVertical.visible));
});

test('transicionTituloPostal: sin retraso — el título es lo primero que entra', () => {
  assert.deepEqual(transicionTituloPostal(), { duration: REVELADO_GRUPO_DURACION_S, ease: REVELADO_GRUPO_EASE, delay: 0 });
});

test('transicionFadePostal(0): el eyebrow espera exactamente a que el título termine de subir', () => {
  assert.equal(transicionFadePostal(0).delay, REVELADO_GRUPO_DURACION_S);
});

test('transicionFadePostal: cada hermano siguiente suma UN paso más — el escalonado es ENTRE ellos, no por palabra', () => {
  assert.equal(transicionFadePostal(1).delay, REVELADO_GRUPO_DURACION_S + REVELADO_GRUPO_PASO_S);
  assert.equal(transicionFadePostal(2).delay, REVELADO_GRUPO_DURACION_S + 2 * REVELADO_GRUPO_PASO_S);
});

test('transicionFadePostal: duration/ease son los tokens de movimiento YA establecidos — mismos que el título y que Origen', () => {
  assert.equal(transicionFadePostal(0).duration, REVELADO_GRUPO_DURACION_S);
  assert.deepEqual(transicionFadePostal(0).ease, REVELADO_GRUPO_EASE);
  assert.equal(transicionFadePostal(1).duration, transicionTituloPostal().duration);
  assert.deepEqual(transicionFadePostal(1).ease, transicionTituloPostal().ease);
});

test('transicionFadePostal: el eyebrow (0) entra ANTES que el botón (1) — nunca al revés', () => {
  assert.ok(transicionFadePostal(0).delay < transicionFadePostal(1).delay);
});

// ── EL FUNDIDO CRUZADO DEL DESTACADO (§ DESTACADO-NOMBRE-GRUPO-Y-TRANSICION-1) — sin React, sin
// navegador. `transicionDestacadoFoto`/`transicionDestacadoTexto` son las dos mitades que
// `Spotlight.tsx` pasa a `transition` del `motion.div`/`motion.span` que crossfadea foto/etiqueta/
// precio al elegir otra presentación o tamaño.

test('TRANSICION_DESTACADO_EASE es la MISMA curva que gobierna todo el movimiento de CORTE — idéntica a REVELADO_GRUPO_EASE (y a la cifra de REVELADO_PAGINA_EASE, "cubic-bezier(0.22, 0.61, 0.36, 1)")', () => {
  assert.deepEqual(TRANSICION_DESTACADO_EASE, REVELADO_GRUPO_EASE);
  assert.equal(REVELADO_PAGINA_EASE, `cubic-bezier(${TRANSICION_DESTACADO_EASE.join(', ')})`);
});

test('transicionDestacadoTexto dura EXACTAMENTE la mitad de transicionDestacadoFoto — "fundido corto" para texto puntual', () => {
  assert.equal(TRANSICION_DESTACADO_TEXTO_DURACION_S, TRANSICION_DESTACADO_FOTO_DURACION_S / 2);
});

test('transicionDestacadoFoto/Texto: estatico=false usa la curva y duración declaradas', () => {
  assert.deepEqual(transicionDestacadoFoto(false), { duration: TRANSICION_DESTACADO_FOTO_DURACION_S, ease: TRANSICION_DESTACADO_EASE });
  assert.deepEqual(transicionDestacadoTexto(false), { duration: TRANSICION_DESTACADO_TEXTO_DURACION_S, ease: TRANSICION_DESTACADO_EASE });
});

test('transicionDestacadoFoto/Texto: estatico=true colapsa la duración a 0 — "movimiento reducido: cambio directo" del spec, sin desactivar AnimatePresence', () => {
  assert.equal(transicionDestacadoFoto(true).duration, 0);
  assert.equal(transicionDestacadoTexto(true).duration, 0);
  // la curva se conserva (irrelevante a duration:0, pero no debe mutar la forma del objeto devuelto)
  assert.deepEqual(transicionDestacadoFoto(true).ease, TRANSICION_DESTACADO_EASE);
  assert.deepEqual(transicionDestacadoTexto(true).ease, TRANSICION_DESTACADO_EASE);
});

// ─── EDITOR-TIENDA-MARQUESINA-SECCION-1 — el motor generalizado a N ítems, § lib/animation.ts
// "LA SECCIÓN SUELTA" ────────────────────────────────────────────────────────────────────────────

test('transformEntradaSalidaItem: SIN ventanaSalida, delega BYTE A BYTE en transformRevelaTextoDisplay — el hero no cambia un valor', () => {
  const ventana = UMBRAL_ENTRADA_TARJETA_MARQUESINA;
  for (const p of [0, 0.1, ventana.desde, (ventana.desde + ventana.hasta) / 2, ventana.hasta, 1]) {
    assert.equal(
      transformEntradaSalidaItem(p, false, ventana),
      transformRevelaTextoDisplay(p, false, ventana),
    );
  }
  assert.equal(transformEntradaSalidaItem(0.3, true, ventana), transformRevelaTextoDisplay(0.3, true, ventana));
});

test('opacidadEntradaSalidaItem: SIN ventanaSalida, delega BYTE A BYTE en opacidadRevelaTextoDisplay (con el mismo techo)', () => {
  const ventana = UMBRAL_ENTRADA_TARJETA_MARQUESINA;
  for (const p of [0, ventana.desde, ventana.hasta, 1]) {
    assert.equal(
      opacidadEntradaSalidaItem(p, false, ventana, undefined, 1),
      opacidadRevelaTextoDisplay(p, false, ventana, 1),
    );
  }
  assert.equal(opacidadEntradaSalidaItem(0.3, true, ventana, undefined, 1), opacidadRevelaTextoDisplay(0.3, true, ventana, 1));
});

test('CON ventanaSalida: antes de entrar — oculto (100%, opacidad 0)', () => {
  const entrada = { desde: 0.2, hasta: 0.3 };
  const salida = { desde: 0.3, hasta: 0.4 };
  assert.equal(transformEntradaSalidaItem(0.1, false, entrada, salida), 'translateY(100.0%)');
  assert.equal(opacidadEntradaSalidaItem(0.1, false, entrada, salida), 0);
});

test('CON ventanaSalida: a mitad de la entrada — a medio camino de aparecer', () => {
  const entrada = { desde: 0.2, hasta: 0.3 };
  const salida = { desde: 0.3, hasta: 0.4 };
  assert.equal(transformEntradaSalidaItem(0.25, false, entrada, salida), 'translateY(50.0%)');
  assert.equal(opacidadEntradaSalidaItem(0.25, false, entrada, salida), 0.5);
});

test('CON ventanaSalida: entre las dos ventanas — EN SU LUGAR y PLENO (el "hold")', () => {
  const entrada = { desde: 0.2, hasta: 0.3 };
  const salida = { desde: 0.5, hasta: 0.6 };
  assert.equal(transformEntradaSalidaItem(0.4, false, entrada, salida), 'translateY(0.0%)');
  assert.equal(opacidadEntradaSalidaItem(0.4, false, entrada, salida), 1);
});

test('CON ventanaSalida: a mitad de la salida — a medio camino de IRSE (sube, no se devuelve)', () => {
  const entrada = { desde: 0.2, hasta: 0.3 };
  const salida = { desde: 0.5, hasta: 0.6 };
  assert.equal(transformEntradaSalidaItem(0.55, false, entrada, salida), 'translateY(-50.0%)');
  assert.ok(Math.abs(opacidadEntradaSalidaItem(0.55, false, entrada, salida) - 0.5) < 1e-9);
});

test('CON ventanaSalida: después de salir — oculto del todo, por el lado opuesto (-100%, opacidad 0)', () => {
  const entrada = { desde: 0.2, hasta: 0.3 };
  const salida = { desde: 0.5, hasta: 0.6 };
  assert.equal(transformEntradaSalidaItem(0.9, false, entrada, salida), 'translateY(-100.0%)');
  assert.equal(opacidadEntradaSalidaItem(0.9, false, entrada, salida), 0);
});

test('EL RELEVO: la salida del producto i y la entrada del producto i+1 pueden coincidir exactamente — en ese límite, uno ya se fue y el otro ya llegó', () => {
  const salidaDelUno = { desde: 0.3, hasta: 0.4 };
  const entradaDelDos = { desde: 0.4, hasta: 0.5 };
  const entradaDelUno = { desde: 0.2, hasta: 0.3 };
  assert.equal(opacidadEntradaSalidaItem(0.4, false, entradaDelUno, salidaDelUno), 0, 'el uno ya terminó de irse');
  assert.equal(opacidadEntradaSalidaItem(0.4, false, entradaDelDos), 0, 'el dos recién empieza a entrar (sin salida propia en este ejemplo)');
});

test('CON ventanaSalida: estatico=true SIEMPRE en su lugar y al techo, sin importar el progreso', () => {
  const entrada = { desde: 0.2, hasta: 0.3 };
  const salida = { desde: 0.5, hasta: 0.6 };
  for (const p of [0, 0.25, 0.55, 1]) {
    assert.equal(transformEntradaSalidaItem(p, true, entrada, salida), 'translateY(0%)');
    assert.equal(opacidadEntradaSalidaItem(p, true, entrada, salida, 0.9), 0.9);
  }
});

// ─── EDITOR-TIENDA-MARQUESINA-TRANSICIONES-1 — las CUATRO transiciones nuevas ────────────────────
//
// Mismos checkpoints que la suite de `transformEntradaSalidaItem` arriba, para las CINCO (inicio,
// mitad de la entrada, en su lugar/hold, mitad de la salida, después de salir): `entrada = {desde:
// 0.2, hasta:0.3}`, `salida = {desde:0.5, hasta:0.6}` — p=0.1 (antes de entrar), p=0.25 (a mitad de
// entrar), p=0.4 (hold), p=0.55 (a mitad de salir), p=0.9 (ya salió).
const ENTRADA = { desde: 0.2, hasta: 0.3 };
const SALIDA = { desde: 0.5, hasta: 0.6 };

test('direccionDeslizarItem: alterna por índice — par=+1 (derecha), impar=-1 (izquierda)', () => {
  assert.equal(direccionDeslizarItem(0), 1);
  assert.equal(direccionDeslizarItem(1), -1);
  assert.equal(direccionDeslizarItem(2), 1);
  assert.equal(direccionDeslizarItem(3), -1);
});

test('transformDeslizarItem (índice 0, dir +1): recorrido completo, derecha→centro→sigue a la izquierda', () => {
  assert.equal(transformDeslizarItem(0.1, false, ENTRADA, SALIDA, 0), 'translateX(100.0%)');
  assert.equal(transformDeslizarItem(0.25, false, ENTRADA, SALIDA, 0), 'translateX(50.0%)');
  assert.equal(transformDeslizarItem(0.4, false, ENTRADA, SALIDA, 0), 'translateX(0.0%)');
  assert.equal(transformDeslizarItem(0.55, false, ENTRADA, SALIDA, 0), 'translateX(-50.0%)');
  assert.equal(transformDeslizarItem(0.9, false, ENTRADA, SALIDA, 0), 'translateX(-100.0%)');
});

test('transformDeslizarItem (índice 1, dir -1): el ESPEJO — izquierda→centro→sigue a la derecha', () => {
  assert.equal(transformDeslizarItem(0.1, false, ENTRADA, SALIDA, 1), 'translateX(-100.0%)');
  assert.equal(transformDeslizarItem(0.9, false, ENTRADA, SALIDA, 1), 'translateX(100.0%)');
});

test('transformDeslizarItem: SIN ventanaSalida (el último producto) — se asienta en 0% y se queda', () => {
  assert.equal(transformDeslizarItem(0.4, false, ENTRADA, undefined, 0), 'translateX(0.0%)');
  assert.equal(transformDeslizarItem(0.9, false, ENTRADA, undefined, 0), 'translateX(0.0%)');
});

test('transformDeslizarItem: estatico=true SIEMPRE 0%, sin importar el progreso ni el índice', () => {
  for (const p of [0, 0.25, 0.55, 1]) assert.equal(transformDeslizarItem(p, true, ENTRADA, SALIDA, 0), 'translateX(0%)');
});

test('transformAcercarItem: arranca en la escala inicial, se asienta en 1, sigue creciendo al salir', () => {
  assert.equal(transformAcercarItem(0.1, false, ENTRADA, SALIDA), `scale(${MARQUESINA_ACERCAR_ESCALA_INICIAL.toFixed(3)})`);
  assert.equal(transformAcercarItem(0.25, false, ENTRADA, SALIDA), 'scale(0.960)');
  assert.equal(transformAcercarItem(0.4, false, ENTRADA, SALIDA), 'scale(1.000)');
  assert.equal(transformAcercarItem(0.55, false, ENTRADA, SALIDA), 'scale(1.040)');
  assert.equal(transformAcercarItem(0.9, false, ENTRADA, SALIDA), 'scale(1.080)');
});

test('transformAcercarItem: SIN ventanaSalida — se asienta en 1 y se queda (nunca sigue creciendo)', () => {
  assert.equal(transformAcercarItem(0.4, false, ENTRADA, undefined), 'scale(1.000)');
  assert.equal(transformAcercarItem(0.9, false, ENTRADA, undefined), 'scale(1.000)');
});

test('transformAcercarItem: estatico=true SIEMPRE scale(1)', () => {
  for (const p of [0, 0.25, 0.9]) assert.equal(transformAcercarItem(p, true, ENTRADA, SALIDA), 'scale(1)');
});

test('filterEnfocarItem: desenfocado al arrancar, nítido en el hold, SE DESENFOCA OTRA VEZ al salir (blur no puede ser negativo)', () => {
  assert.equal(filterEnfocarItem(0.1, false, ENTRADA, SALIDA), `blur(${MARQUESINA_ENFOCAR_DESENFOQUE_PX.toFixed(1)}px)`);
  assert.equal(filterEnfocarItem(0.25, false, ENTRADA, SALIDA), 'blur(5.0px)');
  assert.equal(filterEnfocarItem(0.4, false, ENTRADA, SALIDA), 'blur(0.0px)');
  assert.equal(filterEnfocarItem(0.55, false, ENTRADA, SALIDA), 'blur(5.0px)');
  assert.equal(filterEnfocarItem(0.9, false, ENTRADA, SALIDA), `blur(${MARQUESINA_ENFOCAR_DESENFOQUE_PX.toFixed(1)}px)`);
});

test('filterEnfocarItem: SIN ventanaSalida — se queda nítido (0px) para siempre, nunca vuelve a desenfocarse', () => {
  assert.equal(filterEnfocarItem(0.4, false, ENTRADA, undefined), 'blur(0.0px)');
  assert.equal(filterEnfocarItem(0.9, false, ENTRADA, undefined), 'blur(0.0px)');
});

test('filterEnfocarItem: estatico=true SIEMPRE blur(0px) — nítido, nunca a medio desenfocar', () => {
  for (const p of [0, 0.25, 0.9]) assert.equal(filterEnfocarItem(p, true, ENTRADA, SALIDA), 'blur(0px)');
});

test('transformGirarItem: MISMA MAGNITUD que transformMarquesinaTarjeta (0.85→1, -4°→0°) al entrar; continúa girando hacia el signo OPUESTO al salir', () => {
  assert.equal(transformGirarItem(0.1, false, ENTRADA, SALIDA), `scale(${MARQUESINA_GIRAR_ESCALA_INICIAL.toFixed(3)}) rotate(-${MARQUESINA_GIRAR_GRADOS.toFixed(2)}deg)`);
  assert.equal(transformGirarItem(0.25, false, ENTRADA, SALIDA), 'scale(0.925) rotate(-2.00deg)');
  assert.equal(transformGirarItem(0.4, false, ENTRADA, SALIDA), 'scale(1.000) rotate(0.00deg)');
  assert.equal(transformGirarItem(0.55, false, ENTRADA, SALIDA), 'scale(1.075) rotate(2.00deg)');
  assert.equal(transformGirarItem(0.9, false, ENTRADA, SALIDA), `scale(1.150) rotate(${MARQUESINA_GIRAR_GRADOS.toFixed(2)}deg)`);
});

test('transformGirarItem: SIN ventanaSalida — se endereza en scale(1) rotate(0deg) y se queda', () => {
  assert.equal(transformGirarItem(0.4, false, ENTRADA, undefined), 'scale(1.000) rotate(0.00deg)');
  assert.equal(transformGirarItem(0.9, false, ENTRADA, undefined), 'scale(1.000) rotate(0.00deg)');
});

test('transformGirarItem: estatico=true SIEMPRE scale(1) rotate(0deg)', () => {
  for (const p of [0, 0.25, 0.9]) assert.equal(transformGirarItem(p, true, ENTRADA, SALIDA), 'scale(1) rotate(0deg)');
});

// ─── EL DISPATCH — transformTransicionMarquesinaItem / filterTransicionMarquesinaItem ─────────────

test('transformTransicionMarquesinaItem: cada nombre despacha a SU función, byte a byte', () => {
  const p = 0.25;
  assert.equal(transformTransicionMarquesinaItem('subir', p, false, ENTRADA, SALIDA, 0), transformEntradaSalidaItem(p, false, ENTRADA, SALIDA));
  assert.equal(transformTransicionMarquesinaItem('deslizar', p, false, ENTRADA, SALIDA, 1), transformDeslizarItem(p, false, ENTRADA, SALIDA, 1));
  assert.equal(transformTransicionMarquesinaItem('acercar', p, false, ENTRADA, SALIDA, 0), transformAcercarItem(p, false, ENTRADA, SALIDA));
  assert.equal(transformTransicionMarquesinaItem('enfocar', p, false, ENTRADA, SALIDA, 0), 'none');
  assert.equal(transformTransicionMarquesinaItem('girar', p, false, ENTRADA, SALIDA, 0), transformGirarItem(p, false, ENTRADA, SALIDA));
});

test('transformTransicionMarquesinaItem: un nombre fuera del set cerrado cae al comportamiento de "subir" (guarda defensiva, como velocidadTickerPxS)', () => {
  const p = 0.25;
  assert.equal(transformTransicionMarquesinaItem('basura', p, false, ENTRADA, SALIDA, 0), transformEntradaSalidaItem(p, false, ENTRADA, SALIDA));
});

test('filterTransicionMarquesinaItem: SÓLO "enfocar" devuelve un blur — las otras cuatro (y la basura) dan "none"', () => {
  const p = 0.25;
  assert.equal(filterTransicionMarquesinaItem('enfocar', p, false, ENTRADA, SALIDA), filterEnfocarItem(p, false, ENTRADA, SALIDA));
  for (const tipo of ['subir', 'deslizar', 'acercar', 'girar', 'basura']) {
    assert.equal(filterTransicionMarquesinaItem(tipo, p, false, ENTRADA, SALIDA), 'none');
  }
});

// ─── LA TARJETA DE LA MINI ANIMACIÓN — estiloTarjetaTransicion / progresoLoopTarjetaTransicion ─────
// § EDITOR-TIENDA-TRANSICIONES-TARJETAS-1

test('estiloTarjetaTransicion: REUSA el dispatch — mismos valores que llamar las tres funciones de siempre con la ventana fija de la tarjeta', () => {
  for (const tipo of ['subir', 'deslizar', 'acercar', 'enfocar', 'girar']) {
    for (const p of [0, 0.15, 0.5, 0.8, 1]) {
      const estilo = estiloTarjetaTransicion(tipo, p, false);
      assert.equal(estilo.transform, transformTransicionMarquesinaItem(tipo, p, false, TARJETA_TRANSICION_VENTANA_ENTRADA, TARJETA_TRANSICION_VENTANA_SALIDA, 0));
      assert.equal(estilo.filter, filterTransicionMarquesinaItem(tipo, p, false, TARJETA_TRANSICION_VENTANA_ENTRADA, TARJETA_TRANSICION_VENTANA_SALIDA));
      assert.equal(estilo.opacity, opacidadEntradaSalidaItem(p, false, TARJETA_TRANSICION_VENTANA_ENTRADA, TARJETA_TRANSICION_VENTANA_SALIDA, 1));
    }
  }
});

test('estiloTarjetaTransicion: estatico=true devuelve el CUADRO FINAL (identidad) para las cinco, SIN mirar el progreso — "en reposo" y "movimiento reducido" son el mismo interruptor', () => {
  for (const tipo of ['subir', 'deslizar', 'acercar', 'enfocar', 'girar']) {
    for (const p of [0, 0.3, 0.7, 1]) {
      const estilo = estiloTarjetaTransicion(tipo, p, true);
      assert.equal(estilo.opacity, 1);
      assert.equal(estilo.filter, tipo === 'enfocar' ? 'blur(0px)' : 'none');
      if (tipo === 'subir') assert.equal(estilo.transform, 'translateY(0%)');
      if (tipo === 'deslizar') assert.equal(estilo.transform, 'translateX(0%)');
      if (tipo === 'acercar') assert.equal(estilo.transform, 'scale(1)');
      if (tipo === 'enfocar') assert.equal(estilo.transform, 'none');
      if (tipo === 'girar') assert.equal(estilo.transform, 'scale(1) rotate(0deg)');
    }
  }
});

test('estiloTarjetaTransicion: en el HOLD (entre las dos ventanas, progreso no estático) las cinco quedan a plena opacidad — la ventana fija deja un tramo asentado antes de salir', () => {
  const pHold = (TARJETA_TRANSICION_VENTANA_ENTRADA.hasta + TARJETA_TRANSICION_VENTANA_SALIDA.desde) / 2;
  for (const tipo of ['subir', 'deslizar', 'acercar', 'enfocar', 'girar']) {
    const estilo = estiloTarjetaTransicion(tipo, pHold, false);
    assert.equal(estilo.opacity, 1);
    // "enfocar" calcula el blur a partir de entra/sale (nunca cae a 'none' fuera de estatico), así
    // que en el hold da 0px NUMÉRICO — equivalente visual a 'none', pero no el mismo string. Las
    // otras cuatro SÍ devuelven 'none' literal para el filter (sólo "enfocar" toca `filter`).
    assert.equal(estilo.filter, tipo === 'enfocar' ? 'blur(0.0px)' : 'none');
  }
});

test('progresoLoopTarjetaTransicion: recorre 0→1 dentro del ciclo y vuelve a arrancar en 0 — nunca ping-pong', () => {
  const duracionMs = TARJETA_TRANSICION_DURACION_S * 1000;
  assert.equal(progresoLoopTarjetaTransicion(0), 0);
  assert.equal(progresoLoopTarjetaTransicion(duracionMs / 2), 0.5);
  // justo antes de completar el ciclo: cerca de 1, nunca retrocede.
  assert.ok(progresoLoopTarjetaTransicion(duracionMs - 1) > 0.99);
  // al cruzar el ciclo completo, vuelve a 0 — no sigue subiendo ni se devuelve.
  assert.equal(progresoLoopTarjetaTransicion(duracionMs), 0);
  assert.equal(progresoLoopTarjetaTransicion(duracionMs + duracionMs / 4), 0.25);
});

test('progresoLoopTarjetaTransicion: negativo o cero siempre 0 (arranque)', () => {
  assert.equal(progresoLoopTarjetaTransicion(0), 0);
  assert.equal(progresoLoopTarjetaTransicion(-50), 0);
});

// ── ventanasBandaMarquesina / claseAlturaAncestroBandaMarquesina ──────────────────────────────────

test('ventanasBandaMarquesina(0): sin productos — sólo texto, extraVh es el de SIEMPRE del texto', () => {
  const v = ventanasBandaMarquesina(0);
  assert.deepEqual(v.items, []);
  assert.equal(v.extraVh, MARQUESINA_BANDA_TEXTO_VH);
});

test('ventanasBandaMarquesina: la cantidad se acota a [0, MAX_ITEMS_BANDA_MARQUESINA] — ni negativa ni más de 6', () => {
  assert.equal(ventanasBandaMarquesina(-3).items.length, 0);
  assert.equal(ventanasBandaMarquesina(9).items.length, MAX_ITEMS_BANDA_MARQUESINA);
  assert.equal(ventanasBandaMarquesina(3.9).items.length, 3, 'se trunca, no se redondea');
});

test('ventanasBandaMarquesina: extraVh = TEXTO + N*ITEM + ITEM/2 (el "respiro" final, media pieza) — para N=1..6', () => {
  for (let n = 1; n <= MAX_ITEMS_BANDA_MARQUESINA; n++) {
    const esperado = MARQUESINA_BANDA_TEXTO_VH + n * MARQUESINA_BANDA_ITEM_VH + MARQUESINA_BANDA_ITEM_VH / 2;
    assert.equal(ventanasBandaMarquesina(n).extraVh, esperado, `N=${n}`);
  }
});

test('ventanasBandaMarquesina: el último producto NO tiene ventanaSalida — se queda, como la tarjeta del hero', () => {
  for (let n = 1; n <= MAX_ITEMS_BANDA_MARQUESINA; n++) {
    const v = ventanasBandaMarquesina(n);
    assert.equal(v.items[n - 1].salida, undefined, `N=${n}: el último (índice ${n - 1}) no debe tener salida`);
    for (let i = 0; i < n - 1; i++) {
      assert.ok(v.items[i].salida, `N=${n}: el producto ${i} (no el último) SÍ debe tener salida`);
    }
  }
});

test('ventanasBandaMarquesina: la salida del producto i TERMINA justo donde EMPIEZA la entrada del producto i+1 — el relevo es continuo, sin hueco ni superposición', () => {
  for (let n = 2; n <= MAX_ITEMS_BANDA_MARQUESINA; n++) {
    const v = ventanasBandaMarquesina(n);
    for (let i = 0; i < n - 1; i++) {
      const salida = v.items[i].salida;
      assert.ok(salida, `N=${n}: el producto ${i} (no el último) debe tener salida`);
      assert.ok(
        Math.abs(salida!.hasta - v.items[i + 1].entrada.desde) < 1e-9,
        `N=${n}, producto ${i}→${i + 1}: salida.hasta (${salida!.hasta}) debe == entrada siguiente.desde (${v.items[i + 1].entrada.desde})`,
      );
    }
  }
});

test('ventanasBandaMarquesina: las ventanas de texto y de cada producto son crecientes y caben en [0,1]', () => {
  for (let n = 1; n <= MAX_ITEMS_BANDA_MARQUESINA; n++) {
    const v = ventanasBandaMarquesina(n);
    assert.ok(v.texto.desde === 0 && v.texto.hasta > v.texto.desde && v.texto.hasta <= 1);
    let anterior = v.texto.hasta;
    for (const item of v.items) {
      assert.ok(item.entrada.desde >= anterior - 1e-9, `N=${n}: la entrada no debe retroceder sobre lo anterior`);
      assert.ok(item.entrada.hasta <= 1 && item.entrada.hasta > item.entrada.desde);
      if (item.salida) {
        assert.ok(item.salida.desde >= item.entrada.hasta - 1e-9);
        assert.ok(item.salida.hasta <= 1 && item.salida.hasta > item.salida.desde);
        anterior = item.salida.hasta;
      } else {
        anterior = item.entrada.hasta;
      }
    }
    assert.ok(anterior < 1, `N=${n}: debe quedar respiro antes de 1 (el presupuesto incluye el descanso final)`);
  }
});

test('claseAlturaAncestroBandaMarquesina: LOOKUP LITERAL para N=1..6 — las clases existen literal en el archivo (visibles al JIT)', () => {
  assert.equal(claseAlturaAncestroBandaMarquesina(1), 'min-h-[calc(100svh+140vh)]');
  assert.equal(claseAlturaAncestroBandaMarquesina(2), 'min-h-[calc(100svh+200vh)]');
  assert.equal(claseAlturaAncestroBandaMarquesina(3), 'min-h-[calc(100svh+260vh)]');
  assert.equal(claseAlturaAncestroBandaMarquesina(4), 'min-h-[calc(100svh+320vh)]');
  assert.equal(claseAlturaAncestroBandaMarquesina(5), 'min-h-[calc(100svh+380vh)]');
  assert.equal(claseAlturaAncestroBandaMarquesina(6), 'min-h-[calc(100svh+440vh)]');
});

test('claseAlturaAncestroBandaMarquesina: coincide con el extraVh que ventanasBandaMarquesina calcula, para cada N', () => {
  for (let n = 1; n <= MAX_ITEMS_BANDA_MARQUESINA; n++) {
    const extra = ventanasBandaMarquesina(n).extraVh;
    assert.equal(claseAlturaAncestroBandaMarquesina(n), `min-h-[calc(100svh+${extra}vh)]`);
  }
});
