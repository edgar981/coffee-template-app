"use client";

import { createElement, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { MotionConfig, useScroll, useSpring, useTransform } from "framer-motion";
// `VeloIntensidad`/`TickerVelocidad` — el VOCABULARIO de contenido (el set cerrado de strings que el
// resolver acepta) vive en `site-content-defaults.ts`, no acá (§ CORTE-HERO-REVELADO-MASCARA-1, el
// mismo criterio que ya separa `PuntoFocal` —declarado ahí— de `objectPositionDePuntoFocal` —también
// ahí—): este archivo sólo traduce esos valores a MAGNITUD (el rango de opacidad, los px/s). Un tipo
// re-declarado acá con las mismas claves sería la clase de doble-lista que ya mordió en este repo
// (§ CLAUDE.md, "CATEGORIAS ≠ CATEGORIA_LABELS").
import { BANDA_IDS, type VeloIntensidad, type TickerVelocidad } from "./config/site-content-defaults";

// fadeUp — la variante compartida de entrada (opacity 0→1, y 24→0) que usan las
// animaciones de scroll-in del storefront (`whileInView`/`initial+animate` + `variants`).
//
// § SECCIONES-ENTRAN-VIVAS-1 (2026-10-01): el RESTO de la home (incluida Nayoli) migró su entrada por
// scroll de `fadeUp`/un `motion.div` inline a `RevelarBloque` (components/storefront/RevelarBloque.tsx)
// + `lib/storefront/revelado-bloque.ts`. `fadeUp` SIGUE vivo acá: lo consumen "El origen"
// (`TextoEnCascada`/Origen.tsx, sus fotos/datos/cifras) y `GrindChooserRiel.tsx` (las TARJETAS del
// riel, a propósito sin tocar — su `y:24px` es la mitad de la razón de `overflow-y-hidden` en el
// track, § RIEL-SIN-SCROLL-VERTICAL-1).
//
// § SECCIONES-ENTRAN-COMO-ORIGEN-1 (2026-10-02) CORRIGE la frase de arriba: hasta esa tanda,
// `RevelarBloque` tenía su PROPIA magnitud/disparo (disparo tardío por margen, 50px/0.8s/
// `cubic-bezier(0.22,1,0.36,1)`) — el owner, sobre el gate de `SECCIONES-ENTRAN-VIVAS-1`/
// `SECCIONES-ENTRAN-UNA-VEZ-1`, midió que ese disparo tardío SE LEE como "página vacía" al scrollear
// (una sección ya en pantalla, todavía sin arrancar), mientras que "El origen"/Suscripción —que
// DISPARAN sin margen— no tienen ese problema. `RevelarBloque` pasa a REUSAR `fadeUp` y
// `transicionEscalonada` (abajo) DIRECTO, sin su propia copia de cifras — ver
// `lib/storefront/revelado-bloque.ts` para el porqué completo. No reusar `fadeUp` INLINE para una
// sección NUEVA de la home: la primitiva vigente para eso sigue siendo `RevelarBloque`, que ahora
// entrega EXACTAMENTE esta variante.
export const fadeUp = { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0 } };

// ── EL REVELADO ESCALONADO POR GRUPO — § ORIGEN-FOTOS-REVELADO-Y-CONTEO-1 ─────────────────────────
//
// Hasta este slice, cada `whileInView`+`transition={{ delay: i*N }}` de una lista (Testimonios,
// FeaturedProducts, GrindChooser*) elegía su propio paso (0.06/0.08/0.1) sin atarlo a ningún token
// del prototipo — el `duration`/`ease` quedaban en el spring por defecto de framer-motion. El gate
// del owner sobre "El origen" pidió explícitamente reproducir «la gramática y los tokens del
// revelado del prototipo», y ORIGEN-DATOS-EXACTO-1 ya dejó el precedente de medir esos tokens en
// vez de aproximarlos: `[data-reveal-group]` (`docs/prototipos/cafeone/css/app.css:948-958`) declara
// duración 600ms/curva `cubic-bezier(.22,.61,.36,1)` (`--duration-reveal`/`--ease-reveal=--ease-out`,
// `tokens.css:189,213-214` — LOS MISMOS que ya reproduce `REVELADO_PAGINA_*` más abajo, pero para el
// mount de PÁGINA completa vía CSS puro) y un paso de 90ms por hijo directo
// (`:nth-child(1..5){transition-delay:0/90/180/270/360ms}`).
//
// ACÁ el consumidor es framer-motion disparado por VIEWPORT (`whileInView`), no CSS puro al montar
// —Origen está bajo el pliegue, así que "la página cambió" no sirve de disparador—, así que los
// tokens van en SEGUNDOS (la unidad que espera `transition`), no en ms como `REVELADO_PAGINA_*`.
// `transicionEscalonada(indice)` es la ÚNICA función que arma ese objeto: los CUATRO grupos de Origen
// (fotos, texto, cada fila de datos, cada cifra) la llaman con su propio índice 0-based, así que
// ninguno puede declarar un paso o una curva distintos de los otros tres sin tocar esta función.
//
// LO QUE NO REPRODUCE, para no afirmar una fidelidad que no es: `fadeUp` (arriba) traslada 24px, no
// los 28px del prototipo (`app.css:943`) — es la MISMA variante compartida que usan ya ~20 secciones
// del storefront, y darle a Origen su propio traslado de 28px lo volvería la ÚNICA sección con un
// `y` distinto sin que nadie lo pidiera; el pedido del owner fue sobre el ESCALONADO y el CONTEO, no
// sobre el traslado en píxeles.
export const REVELADO_GRUPO_DURACION_S = 0.6;
export const REVELADO_GRUPO_EASE: [number, number, number, number] = [0.22, 0.61, 0.36, 1];
export const REVELADO_GRUPO_PASO_S = 0.09;

export function transicionEscalonada(indice: number): { duration: number; ease: [number, number, number, number]; delay: number } {
  return { duration: REVELADO_GRUPO_DURACION_S, ease: REVELADO_GRUPO_EASE, delay: indice * REVELADO_GRUPO_PASO_S };
}

// ── ACOMODO DE SCROLL — el motor de scroll-scrub, TEMAS-BRANDSTORY-DIRECCION-ARTE-1 ──────────────
//
// La variante `centrada` de brandStory (§ CORTE-BRANDSTORY-COLLAGE-1) dejó escrito en su propio
// comentario que el prototipo resuelve la inclinación/superposición del collage EN FUNCIÓN DEL
// PROGRESO DE SCROLL de la sección (`docs/prototipos/cafeone/js/app.js:183-203`, `FSA.scrub`;
// consumido por el collage en `js/home.js:284-301`) — no de un disparo único —, y que "un motor de
// scroll-scrub propio que este repo no tiene" se aproximaba con una entrada `whileInView`. Esto es
// ese motor, construido sobre `useScroll`+`useTransform` (el mismo paquete de `fadeUp`/
// `ReducedMotionProvider`, NO un listener de scroll propio).
//
// LOS DOS UMBRALES ERAN MEDIDOS DEL PROTOTIPO —`js/home.js:291` calcula `t = clamp((p - 0.15) /
// 0.5, 0, 1)`, acomodo entre el 15% y el 65% del progreso— y § HISTORIA-GIRO-ANTES-1 LOS REEMPLAZA
// por una ventana PROPIA de este tema, más temprana: gate del owner sobre HISTORIA-COLLAGE-COMO-
// PROTOTIPO-1 (2026-09-30), *"arrancan un poco más giradas y se enderezan antes de bajar tanto en
// la página, el problema no es que se enderecen, es que lo hacen cuando casi he pasado la
// sección"*. Con [0.15,0.65] el collage queda recto cuando la sección ya casi TERMINÓ de cruzar el
// viewport (el borde final del acomodo, 0.65, está cerca del 1.0 en que la sección sale del todo);
// con **[0.10,0.50]** el acomodo TERMINA a mitad del progreso de scroll de la sección, que es
// cuando el collage está más o menos CENTRADO en la pantalla — el punto que el owner pidió, medido
// por ejecución (§ el comentario de `RESORTE_ACOMODO`, más abajo, y `HISTORIA-GIRO-ANTES-1` en
// DECISIONS.md). El ARRANQUE (0.10, antes que el 0.15 viejo) es la mitad del mismo ajuste: si el final se
// adelanta pero el arranque no, la ventana se ANGOSTA de 0.50 a 0.40 de progreso — más corta, no
// solo más temprana — así que el arranque también se corre 0.05 antes para no comprimir el
// recorrido de más (la cardinalidad decidida por el orquestador, § cifras-decision del spec:
// 0.10/0.50, no una tercera combinación).
export const UMBRAL_ACOMODO = { desde: 0.10, hasta: 0.50 } as const;

// `transformAcomodo` reproduce, PURA y sin React, el cálculo por-figura EXACTO de
// `js/home.js:288-297` — REESCRITO por § HISTORIA-COMO-MUESTRARIO-1 para dejar de aproximar con un
// asiento VERTICAL (`y: 16 → 0`, la aproximación de `MUESTRARIO`/`TEMAS-BRANDSTORY-DIRECCION-ARTE-1`,
// que el prototipo NUNCA tuvo) y pasar a la apertura HORIZONTAL real que el prototipo sí hace:
//   `rot = from[i]*(1-t)` (arranca inclinada, se endereza a 0 — SIN CAMBIO, mismo signo/magnitud)
//   `x   = spread[i]*t`   (arranca en 0, SE ABRE hasta `spread[i]` — nuevo: antes era un asiento que
//                          se CERRABA desde un valor inicial; acá es una apertura que CRECE desde 0)
// El ORDEN de la cadena también se copia literal de `js/home.js:294`
// (`'translateX(' + x + 'px) rotate(' + rot + 'deg)'`) — translateX PRIMERO, luego rotate.
// Separada del hook para poder afirmarla en `node:test` sin navegador — el hook (abajo) no se puede
// testear por render sin jsdom, esta función sí.
//
// `estatico` es el gate de MOVIMIENTO REDUCIDO (y de la vista previa del editor, que tampoco puede
// scrollear de verdad): con `estatico=true` la figura rinde SIEMPRE `'none'` —el collage
// ACOMODADO, quieto y legible—, sin importar `progreso`. Es la garantía de que no hay un estado
// "a medio inclinar/abrir" bajo esa preferencia.
export function transformAcomodo(
  rotarInicialDeg: number,
  aperturaPx: number,
  progreso: number,
  estatico: boolean,
): string {
  if (estatico) return "none";
  const t = Math.max(0, Math.min(1, progreso));
  const rot = rotarInicialDeg * (1 - t);
  const x = aperturaPx * t;
  return `translateX(${x.toFixed(1)}px) rotate(${rot.toFixed(2)}deg)`;
}

// `parametrosAcomodoCollage` — LA CARDINALIDAD 1-4 (§ CORTE-HISTORIA-COLOR-FOTOS-1) contra un
// prototipo que sólo define el caso de TRES fotos (`from = [-8, 4, -3]`, `js/home.js:287`). Con
// exactamente 3 figuras visibles, la ROTACIÓN usa esos valores LITERALES — el prototipo manda, no se
// aproxima. Para 1, 2 o 4 figuras (que el prototipo no cubre), se EXTIENDE la regla con el criterio
// MÁS SIMPLE que sigue siendo fiel a lo medido: SIMETRÍA alrededor del centro.
//
// LA ROTACIÓN no generaliza con una fórmula única: `from = [-8, 4, -3]` no es lineal ni simétrica del
// offset (la figura del medio, offset 0, rota 4° — no 0°), así que NO hay fórmula que la reproduzca
// para total=3 Y sea simétrica a la vez. Por eso total=3 usa el ARRAY LITERAL del prototipo, y la
// regla general (para 1/2/4) es una generalización PROPIA, declarada como tal: magnitud CONSTANTE
// (`PASO_ROTACION_DEG`), signo negativo del lado izquierdo del centro y positivo del derecho —
// simetría espejo real (la figura en offset -d y la de offset +d rotan la MISMA magnitud, signo
// opuesto), y 0° para una figura exactamente en el centro (posible sólo con total impar).
//
// LA APERTURA (`aperturaPx`) SE FUERZA A CERO, SIEMPRE — DECISIÓN DEL OWNER, no aproximación
// (§ HISTORIA-FOTOS-PANEL-Y-GIRO-1, gate: "en el muestrario las imágenes no se desplazan en X,
// simplemente cambia su ángulo; en nuestra página están cambiando en X y cambiando de ángulo"). Se
// APARTA A PROPÓSITO de `js/home.js:288` (`spread=[-70,0,70]`), que SÍ abre horizontalmente — el
// collage de esta variante ya NO reproduce esa apertura, sólo el enderezado de la rotación. El campo
// `aperturaPx` se CONSERVA en la firma (en vez de retirarlo de acá y de `transformAcomodo`) porque
// `transformAcomodo` sigue siendo la pieza GENÉRICA —matemática pura, sin conocimiento de brandStory—
// que cualquier apertura futura reutilizaría sin cambios; lo que dejó de abrir es esta función, la que
// decide CUÁNTO abrir por figura para el collage de HOY.
const PASO_ROTACION_DEG = 4; // generalización PROPIA (no del prototipo) para total ≠ 3, § arriba

const ROTACION_PROTOTIPO_N3 = [-8, 4, -3] as const; // js/home.js:287, literal

// `MULTIPLICADOR_GIRO_INICIAL` — § HISTORIA-GIRO-ANTES-1, la otra mitad del mismo gate que movió
// `UMBRAL_ACOMODO` (arriba): *"arrancan un poco más giradas"*. Escala el ÁNGULO INICIAL que cada
// figura YA tenía (el literal del prototipo para total=3, la generalización propia para el resto)
// — NO reescribe esos literales, para no perder de dónde salió cada número: `ROTACION_PROTOTIPO_N3`
// sigue siendo la cita EXACTA de `js/home.js:287`, y lo que arranca más girado es el COLLAGE de
// este tema (aplicado al devolver), no la cita del prototipo. Sin desplazamiento en X — sin cambio,
// `aperturaPx` se sigue forzando a 0 más abajo (§ HISTORIA-FOTOS-PANEL-Y-GIRO-1).
const MULTIPLICADOR_GIRO_INICIAL = 1.5;

export function parametrosAcomodoCollage(
  posicion: number,
  total: number,
): { rotarInicialDeg: number; aperturaPx: number } {
  if (total === 3 && posicion >= 0 && posicion < 3) {
    return { rotarInicialDeg: ROTACION_PROTOTIPO_N3[posicion] * MULTIPLICADOR_GIRO_INICIAL, aperturaPx: 0 };
  }
  const centro = (total - 1) / 2;
  const d = posicion - centro;
  const rotarInicialDeg = (d === 0 ? 0 : d < 0 ? -PASO_ROTACION_DEG : PASO_ROTACION_DEG) * MULTIPLICADOR_GIRO_INICIAL;
  return { rotarInicialDeg, aperturaPx: 0 };
}

// `useProgresoAcomodo` — el progreso de scroll [0,1] YA acotado a `UMBRAL_ACOMODO`, listo para que
// cada figura derive su propio `transformAcomodo` con `useTransform`. El rango de `useScroll`
// (`["start end", "end start"]`) es el mismo que `FSA.scrub` mide a mano
// (`p = (vh - r.top) / (r.height + vh)`, `js/app.js:190-197`): progreso 0 cuando el target entra
// por el borde inferior del viewport, 1 cuando termina de salir por el superior.
//
// EL `useSpring` (§ HISTORIA-COLLAGE-COMO-PROTOTIPO-1) — el gate del owner reportó el collage "no tan
// smooth como en el muestrario". El candidato que el spec nombra ("¿escritura directa por evento de
// scroll sin interpolar?") es exactamente lo que había: `scrollYProgress` sigue el scroll NATIVO
// frame a frame sin ninguna interpolación temporal, así que `transformAcomodo` saltaba directo al
// valor de cada evento. El prototipo SÍ suaviza, pero por un mecanismo de OTRA escala — un
// scroll-momentum GLOBAL que anima el `scrollY` real de toda la página (`initSmoothScroll`,
// `js/app.js:205-239`), fuera del alcance de esta variante (afectaría cada gesto de scroll del
// sitio, no sólo este collage; § el comentario de cabecera de `BrandStoryCentrada.tsx`). `useSpring`
// es la aproximación LOCAL, del mismo paquete (framer-motion) que ya trae `useScroll`/`useTransform`
// —no un segundo motor—: suaviza el VALOR derivado, no el scroll físico, así que el resto del sitio
// (incluida la propia página que contiene este collage) sigue con scroll nativo. Los parámetros
// (stiffness/damping) no reproducen ninguna constante del prototipo —su mecanismo es categóricamente
// distinto, no hay un número que "medir" acá— y se declaran como generalización propia, con el mismo
// criterio que ya usa `PASO_ROTACION_DEG` para los totales que el prototipo no cubre: la más simple
// que da un seguimiento suave sin overshoot perceptible (crítica o cercana a ella) ni lag excesivo.
//
// § HISTORIA-GIRO-ANTES-1 RE-ESCALA stiffness/damping — no por gusto, por lo que angostar
// `UMBRAL_ACOMODO` (arriba, de una franja de 0.50 a una de 0.40) le hace al RETRASO del resorte.
// Verificado contra la fuente REAL del generador (`node_modules/motion-dom/dist/es/animation/
// generators/spring.mjs`, `node_modules/motion-dom/dist/es/value/follow-value.mjs`): cada vez que
// el valor de origen (`acotado`) cambia, `attachFollow` relanza una animación de resorte desde el
// valor actual hacia el nuevo objetivo conservando la velocidad — el resorte SIGUE al valor de
// origen en vez de reiniciar, así que durante un scroll continuo se comporta como un sistema de
// 2º orden estándar (masa-resorte-amortiguador, `stiffness`=k, `damping`=c, `mass`=1) persiguiendo
// una RAMPA. El error de régimen permanente de ese seguimiento es el resultado de control clásico
// `e_ss = α·(c/k)` (unidades de `progreso`, α = velocidad de cambio de `acotado`). Expresado en
// SCROLL FÍSICO (α = v / (ancho_ventana·D), v=velocidad de scroll en px/s, D=r.height+vh — la
// distancia física total del `useScroll` de abajo): el retraso en PÍXELES es `v·(c/k)`, y el
// `ancho_ventana` SE CANCELA — angostar la ventana NO agranda el retraso absoluto en píxeles.
//
// PERO SÍ agranda ese MISMO retraso absoluto como FRACCIÓN del recorrido de la ventana —angosta de
// 0.50 a 0.40 es ×1.25 (0.50/0.40)—, que es justo lo que el gate reporta: el punto en que el
// collage queda recto se demora relativo a dónde está la sección en pantalla. Para conservar la
// MISMA fracción relativa de sobrepaso que tenía la ventana vieja (ni más lag relativo, ni menos),
// `stiffness` escala por 1.25² y `damping` por 1.25 — eso mantiene EXACTO el mismo damping ratio ζ
// = damping/(2·√stiffness) = 1.0955 (ni más sobreamortiguado ni menos: mismo carácter, sin
// oscilación) y reduce `damping/stiffness` en el mismo factor 1/1.25 que compensa el angostamiento
// (120×1.5625=187.5, 24×1.25=30 — exacto, no redondeado).
//
// MEDIDO POR EJECUCIÓN (arnés propio de este slice, § HISTORIA-GIRO-ANTES-1 en DECISIONS.md: el
// componente REAL montado en un navegador headless con scroll CONTINUO simulado —`mouse.wheel` en
// pasos de ~16ms, no un jump—, framer-motion real, sin Postgres/Next build): a 1440×900, con esta
// pareja compensada, un scroll de 900px/s (brisco, normal) deja recto ~16px DESPUÉS de donde la
// ventana lo pide (1483 contra 1467 de scrollY, 2.1% del ancho de la ventana) — el collage queda
// centrado en pantalla al milímetro (su centro cae a 434px de un viewport de 900px, 16px del
// centro exacto). Con el resorte SIN compensar (120/24) el mismo scroll dejaba el doble de
// sobrepaso (31px, 4.2%). A 2200px/s (scroll muy rápido) el sobrepaso compensado es 152px (20.7%)
// contra 223px (30.4%) sin compensar — sigue siendo una reducción real, y aun en el caso más
// exigente el collage queda recto muy por dentro de la sección (progreso crudo ≈0.58 de 1), lejos
// del "casi pasé la sección" que motivó este slice. A 390×844 el resorte es INERTE: por debajo del
// breakpoint `sm` (640px) el collage fuerza `transform:none!` siempre (§ el comentario de cabecera
// de `BrandStoryCentrada.tsx`, "ANGOSTO"), así que no hay giro que suavizar en ese ancho — medido:
// el ángulo es 0° desde scrollY=0.
export const RESORTE_ACOMODO = { stiffness: 187.5, damping: 30, restDelta: 0.001 } as const;

export function useProgresoAcomodo(target: RefObject<HTMLElement | null>) {
  const { scrollYProgress } = useScroll({ target, offset: ["start end", "end start"] });
  const acotado = useTransform(scrollYProgress, [UMBRAL_ACOMODO.desde, UMBRAL_ACOMODO.hasta], [0, 1], { clamp: true });
  return useSpring(acotado, RESORTE_ACOMODO);
}

// ── EL LOOP DE LA MARQUESINA — texto y tarjeta scrubbed por scroll, § MARQUESINA-BANDA-1 ──────────
//
// El prototipo (`docs/prototipos/cafeone/js/home.js:259-282`) mueve DOS piezas con el MISMO
// progreso crudo de scroll de la sección `.marquee` (`FSA.scrub(marquee, fn)`, sin la ventana
// [0.15,0.65] que `UMBRAL_ACOMODO` recorta para el collage de brandStory — acá el `p` que cada
// callback recibe es el CRUDO 0..1 de `js/app.js:190-197`, sin mapear):
//   · el TEXTO en loop se traslada horizontalmente: `travel = innerWidth*1.6`,
//     `track.style.transform = translate(-p*travel, -50%)` (`js/home.js:269-271`);
//   · la TARJETA flotante escala y rota, con su PROPIO recorte interno del mismo `p`:
//     `t = clamp((p-0.12)/0.45, 0, 1)`, `scale = 0.85+0.15*t`, `rot = -4+4*t` (`js/home.js:274-279`).
//
// `useProgresoScroll` es el progreso CRUDO —gemelo de `useProgresoAcomodo` pero SIN el mapeo a
// `UMBRAL_ACOMODO`—, mismo `useScroll`/offset, ninguna instancia nueva del motor.
export function useProgresoScroll(target: RefObject<HTMLElement | null>) {
  const { scrollYProgress } = useScroll({ target, offset: ["start end", "end start"] });
  return scrollYProgress;
}

// `transformMarquesinaTexto` reproduce, PURA y sin React, `js/home.js:269-271`. `estatico` (§ el
// mismo gate que `transformAcomodo`: `prefers-reduced-motion` o la vista previa del editor) deja el
// texto QUIETO —sin el desplazamiento horizontal, pero centrado verticalmente, legible— en vez de
// congelado a medio camino de un recorrido que nunca avanza.
export function transformMarquesinaTexto(progreso: number, travelPx: number, estatico: boolean): string {
  if (estatico) return "translateY(-50%)";
  const p = Math.max(0, Math.min(1, progreso));
  return `translate(${(-p * travelPx).toFixed(1)}px, -50%)`;
}

// `transformMarquesinaTarjeta` reproduce, PURA y sin React, `js/home.js:274-279`. `estatico` rinde
// el estado YA ACOMODADO de la tarjeta (escala 1, sin rotar) — el mismo criterio que
// `transformAcomodo(…, estatico=true)` devuelve `'none'` en vez del arranque a medio inclinar.
//
// `ventana` — § MARQUESINA-TARJETA-PRODUCTO-1 (2026-10-02): PARAMETRIZA el recorte interno que
// antes era [0.12, 0.57] a secas (`t = clamp((p-0.12)/0.45, 0, 1)`). El DEFAULT reproduce ese
// mismo recorte, byte-idéntico, para `Marquesina.tsx` (la banda SUELTA, fuera de `touches:` de
// este slice) — sigue llamando a la función con dos argumentos, sin pasar `ventana`, así que no
// cambia. El NUEVO consumidor es `HeroMediaMarquesina.tsx`: medido contra su propia frase de
// marquee, la tarjeta arrancaba en progreso 0.12 y tardaba hasta 0.57, mientras la frase revela en
// [0, `UMBRAL_REVELADO_TEXTO.hasta`] = [0, 0.2] — dos arranques y dos duraciones distintas para lo
// que el spec de ese slice pide como UNA sola "entrada".
//
// ESE PRIMER ARREGLO QUEDÓ MAL — § MARQUESINA-TARJETA-SECUENCIA-1 (2026-10-02), gate del owner
// sobre Café Las Chamisas: pasar la MISMA `UMBRAL_REVELADO_TEXTO` como ventana de la tarjeta hace
// que las dos entren JUNTAS, a la vez, con la misma duración — el owner la pidió SECUENCIAL
// ("no debe salir al tiempo con el marquee, sino una vez las letras han salido, luego salga el
// producto"). EN ESE MOMENTO, `HeroMediaMarquesina.tsx` pasó a usar `UMBRAL_ENTRADA_TARJETA_
// MARQUESINA` (declarada más abajo, junto a `UMBRAL_REVELADO_TEXTO`) como `ventana` de ESTA
// función — la MISMA fuente de progreso de siempre, pero una ventana DERIVADA que arranca justo
// donde la de la frase termina, no la propia ventana de la frase.
//
// YA NO ES CIERTO — § MARQUESINA-TARJETA-COMO-LETRAS-1 (2026-10-02): el gate SIGUIENTE pidió que la
// tarjeta usara el EFECTO de las letras (sube+se desvanece, nunca escala/rota), así que
// `HeroMediaMarquesina.tsx` dejó de llamar a esta función — hoy pasa `UMBRAL_ENTRADA_TARJETA_
// MARQUESINA` a `transformRevelaTextoDisplay`/`opacidadRevelaTextoDisplay` (arriba). Esta función
// SIGUE VIVA, sin cambios de forma, porque `Marquesina.tsx` (la banda suelta) la sigue usando con su
// ventana DEFAULT — ver el docstring de `VENTANA_TARJETA_MARQUESINA_PROTOTIPO`, abajo.
const VENTANA_TARJETA_MARQUESINA_PROTOTIPO = { desde: 0.12, hasta: 0.57 };

export function transformMarquesinaTarjeta(
  progreso: number,
  estatico: boolean,
  ventana: { desde: number; hasta: number } = VENTANA_TARJETA_MARQUESINA_PROTOTIPO,
): string {
  if (estatico) return "none";
  const p = Math.max(0, Math.min(1, progreso));
  const t = Math.max(0, Math.min(1, (p - ventana.desde) / (ventana.hasta - ventana.desde)));
  const scale = 0.85 + 0.15 * t;
  const rot = -4 + 4 * t;
  return `scale(${scale.toFixed(3)}) rotate(${rot.toFixed(2)}deg)`;
}

// `transformSubscripcionParallax` reproduce, PURA y sin React, `[data-parallax]` del prototipo
// (`docs/prototipos/cafeone/js/home.js:303-307`): `img.style.transform = translateY((p-0.5)*-10%)`
// sobre el progreso CRUDO que ya da `useProgresoScroll` — el MISMO hook que `Marquesina.tsx` usa para
// su texto/tarjeta, ahora un TERCER consumidor (§ SUSCRIPCION-POSTAL-DE-CIERRE-1,
// `SubscriptionCTALinea.tsx`). Hasta esa tanda la cuenta vivía INLINE dentro del componente (una sola
// línea, "no amerita una función nueva… fuera de `touches:` de ese slice" — su propio docstring lo
// decía); esta tanda SÍ declara `lib/animation.ts`/`lib/animation.test.ts` en su `touches:`, así que
// se extrae — mismo criterio que `transformMarquesinaTexto`/`Tarjeta`: una transformación con
// decisión (el recorte a [0,1], el "estático" congelado) se afirma con un test, no se confía a una
// lectura del JSX.
//
// § SUSCRIPCION-PARALLAX-VISIBLE-1 (2026-10-02) — LA UNIDAD CAMBIA DE `%` A `vh`; LOS NÚMEROS NO.
// Gate del owner: «antes había un efecto en la imagen de fondo de Suscripción… se veía bien. Parece
// que se quitó». MEDIDO (Playwright, 1440×900, preset CORTE, § DECISIONS.md de este slice): el
// contenedor recorría ~14px de punta a punta — se lee como si no existiera.
//
// LA CAUSA: el `%` de la fórmula SIEMPRE fue relativo al alto de SU PROPIA CAJA (112% del alto de
// la SECCIÓN, `top-[-6%] bottom-[-6%]` en el componente — ver ahí el porqué de esos dos números).
// `SUSCRIPCION-POSTAL-DE-CIERRE-1` convirtió la franja de una línea de 108px pegada al pie a una
// "postal" más alta (264px a 1440×900) — pero SIGUE SIENDO CHICA frente al viewport, porque es una
// franja corta por DISEÑO (el owner ya calificó de "exageradamente grande" agrandarla al 62vh del
// prototipo, § el docstring de `SUSCRIPCION-POSTAL-DE-CIERRE-1` en el componente). Atar el
// desplazamiento al alto de esa caja la condena a ser leve sea cual sea su alto exacto — 108, 264,
// o cualquier otro: la referencia (su propio alto) se achica (o se mantiene chica) CON la postal.
//
// LA REFERENCIA PASA A SER EL VIEWPORT (`vh`), lo único de la ecuación que NO se achica cuando la
// postal se achica. Es además la magnitud correcta para este caso: `useProgresoScroll` recorre su
// rango 0→1 sobre una distancia de scroll de `alto-sección + alto-viewport` (§ el docstring de
// cabecera de `useProgresoScroll`); para una franja CORTA esa distancia la domina el VIEWPORT, no
// la sección — atar el desplazamiento a esa misma unidad lo ata a la cantidad que de verdad
// gobierna cuánto se scrollea mientras la postal está en pantalla.
//
// LOS NÚMEROS NO CAMBIAN, SÓLO LA UNIDAD: `(p-0.5)*-10` sigue dando el rango ±5 en los extremos;
// `estatico` sigue congelando en el CENTRO del rango (cero desplazamiento, ahora `"0vh"`). A
// 900px de viewport (1440×900, el gate), 5vh=45px — un recorrido total de 90px de punta a punta,
// del orden de lo que un parallax necesita para notarse, y del mismo orden que el `.cta-strip` del
// prototipo (`min-height:62vh`, ±5% de 558px≈28px por lado) lograba atando su desplazamiento a una
// caja GRANDE: acá, en vez de agrandar la postal (ya descartado), se ata el desplazamiento a una
// unidad que no depende del alto de la caja.
//
// EL BÚFER DEL CONTENEDOR CAMBIA DE UNIDAD JUNTO CON EL DESPLAZAMIENTO, EN EL COMPONENTE (la caja
// del `motion.div` vive en `SubscriptionCTALinea.tsx`, no acá): `top-[-6vh] bottom-[-6vh]`, el
// MISMO margen de antes (6 contra un máximo de 5, la misma holgura de 1) pero en la unidad que
// ahora gobierna el desplazamiento — un búfer en `%` (de una caja chica) no alcanzaría para un
// desplazamiento en `vh` (grande): expondría el borde de la foto. Las dos unidades tienen que
// coincidir SIEMPRE; ver el comentario del contenedor en el componente para el detalle completo.
export function transformSubscripcionParallax(progreso: number, estatico: boolean): string {
  if (estatico) return "0vh";
  const p = Math.max(0, Math.min(1, progreso));
  return `${((p - 0.5) * -10).toFixed(2)}vh`;
}

// ── EL PROGRESO DESDE EL TOPE — hermana de `useProgresoScroll`, § CORTE-HERO-STICKY-RONDA-2-1 ─────
//
// EL DEFECTO (reportado por el owner sobre HeroMediaMarquesina.tsx, la variante `sticky` del hero):
// «las letras salen de una, deberían salir apenas alguien empieza a hacer scroll» — al cargar la
// home el marquee ya aparece corrido, como si se hubiera scrolleado un tramo.
//
// LA HIPÓTESIS DEL ORQUESTADOR ERA CORRECTA, CONFIRMADA por derivación cerrada (no por navegador:
// las clases de `HeroMediaMarquesina.tsx` son valores fijos, así que la cuenta es exacta, no una
// suposición). `useProgresoScroll` usa `offset: ["start end", "end start"]`, pensado para un
// elemento que el visitante encuentra MÁS ABAJO de la página (`Marquesina.tsx`, una banda suelta):
// progreso 0 cuando el TOPE del target toca el FONDO del viewport. Verificado contra el propio
// código de framer-motion (`node_modules/framer-motion/dist/es/render/dom/scroll/offsets/{offset,
// edge,inset}.mjs`): con `T` = posición-en-documento del tope del target (`calcInset`, la suma de
// `offsetTop` hasta el contenedor de scroll), `H` = alto del target y `VH` = alto del viewport, el
// ancla de progreso-0 de `"start end"` cae en `scrollY = T - VH` y la de progreso-1 de `"end start"`
// en `scrollY = T + H` — progreso = (scrollY - (T-VH)) / (H+VH).
//
// El wrapper de `HeroMediaMarquesina` es el PRIMER hijo de `<main>` (el `<header>` de `StoreNav` es
// `fixed`, § `components/storefront/layout/StoreNav.tsx:203` — no ocupa flujo) y CORTE (el único
// preset que hoy pide `hero:'sticky'`) también lo pone primero en `orden` (`lib/config/themes.ts`,
// `CORTE.orden`) — así que `T = 0`. Con `H = 100svh + 200vh = 300vh` (§ el docstring de cabecera de
// `HeroMediaMarquesina.tsx`), al cargar (`scrollY = 0`): progreso = (0 - (0-VH)) / (300vh+VH) =
// VH / 400vh = **0.25** — un cuarto del recorrido YA consumido antes de que el visitante scrollee un
// solo píxel. Es EXACTAMENTE la forma del defecto reportado: `transformMarquesinaTexto` traslada el
// texto `-0.25*travelPx` desde el primer render.
//
// LA HERMANA usa `["start start", "end start"]` — MISMO ancla final (`"end start"`, sin tocar: sigue
// siendo el punto en que el wrapper entero terminó de salir por arriba, § el docstring de cabecera),
// sólo cambia el ancla de progreso-0: `"start start"` ancla en `scrollY = T` (targetPoint = T+H*0,
// containerPoint = VH*0 = 0) — el instante en que el TOPE del target alcanza el TOPE del viewport,
// que es el único instante que tiene sentido como "arranque" para un elemento que empieza pineado
// desde el principio del documento. progreso = (scrollY - T) / H — con T=0, progreso=0 EXACTO en
// scrollY=0 (el criterio de aceptación del spec), y progreso=1 en scrollY=H, SIN mover el ancla
// final. NO SE TOCÓ `useProgresoScroll`: la usan también `Marquesina.tsx` y
// `SubscriptionCTALinea.tsx`, bandas de MEDIA página donde "start end"/"end start" es el offset
// correcto (el target SÍ entra desde abajo del viewport); cambiarla ahí habría arreglado un
// consumidor rompiendo dos.
//
// `progresoDesdeTope` es la MISMA fórmula, pura y SIN React —dado `rectTop` (el
// `getBoundingClientRect().top` del target, es decir `T - scrollY`) y `alturaTotal` (`H`)—, para
// poder afirmar la derivación en `node:test` sin DOM: progreso = (scrollY-T)/H = -rectTop/H. Nótese
// que el alto del VIEWPORT no aparece en la fórmula —se cancela porque las dos anclas usan
// `containerPoint` en el mismo extremo (0, "start")—, a diferencia de la fórmula vieja
// (`p = (vh - r.top)/(r.height+vh)`, § `useProgresoAcomodo`) que sí lo necesita. El hook no LLAMA a
// esta función (framer-motion mide el DOM real por su cuenta); es la prueba, no la implementación.
export function progresoDesdeTope(rectTop: number, alturaTotal: number): number {
  if (alturaTotal <= 0) return 0;
  const p = -rectTop / alturaTotal;
  return Math.max(0, Math.min(1, p));
}

export function useProgresoScrollDesdeTope(target: RefObject<HTMLElement | null>) {
  const { scrollYProgress } = useScroll({ target, offset: ["start start", "end start"] });
  return scrollYProgress;
}

// EL VELO ANIMADO — antes un overlay SIEMPRE-ENCENDIDO en `--sf-velo` (decisión explícita de
// `MUESTRARIO-HERO-MARQUESINA-STICKY-1`, "reusá el motor de scroll... no repliques la curva exacta
// del tema real"); el owner reportó, sobre el prototipo aplicado, que "oscurece mucho... se ve
// opaca la página". El tema real anima la opacidad del velo con el MISMO progreso de scroll (§ el
// docstring de cabecera de `HeroMediaMarquesina.tsx`) — esta función sigue esa DIRECCIÓN (casi
// transparente en reposo, densa al final del recorrido), no la curva exacta (el spec no la pide).
//
// EL COLOR SIGUE SALIENDO DEL TOKEN `--sf-velo` (NUNCA un rgba horneado): lo que anima es la
// opacidad DEL ELEMENTO (el `opacity` CSS del `<div>` que ya tiene `background-color:
// var(--sf-velo)`), una SEGUNDA capa de alfa que multiplica al 80% que el token ya hornea
// (`color-mix(in oklab, var(--sf-tinta) 80%, transparent)`, § `app/globals.css`) — el token no se
// toca ni se separa en un segundo color.
//
// `VELO_OPACIDAD_PISO` es el PISO medido, no un número a ojo: contraste WCAG (blanco sobre el velo,
// las MISMAS tres fotos claras de referencia que `HeroMedia.tsx` ya usa — arena rgb(232,222,200),
// casi-blanco rgb(245,245,240), crema rgb(238,230,214)) con densidad efectiva = piso × 0.80 (el
// 80% horneado en el token). En reposo (progreso=0, densidad = 0.75×0.80 = 0.60): 5.98:1 (arena) ·
// **5.25:1 (casi-blanco, el peor caso)** · 5.70:1 (crema) — los tres sobre el piso AA (4.5:1) que
// `HeroMedia.tsx` ya acepta para el mismo texto. 0.70 ya alcanzaba el piso (4.60:1 contra
// casi-blanco) pero sin margen (una fuente de video más clara lo tumbaría); 0.75 deja margen real
// sin volver al velo denso. Al final del recorrido (progreso=1) la densidad vuelve a 0.80 — la
// MISMA de hoy, byte-idéntica en contraste (9.61–11.33:1 contra las tres fotos, § `HeroMedia.tsx`).
export const VELO_OPACIDAD_PISO = 0.75;

// `estatico` (reduced-motion o vista previa) NO puede quedar en el piso semitransparente: no hay
// scroll que lo densifique, así que el texto quedaría permanentemente sobre el velo MÁS DÉBIL en
// vez del más seguro. Rinde la densidad FINAL del rango (`rango.techo` — para 'media', 1 → efectiva
// 0.80, la que ya pasaba AA con margen amplio en las tres fotos de referencia) — la misma decisión
// que `transformAcomodo`/`transformMarquesinaTarjeta` ya toman: `estatico` gana con el estado FINAL,
// no un punto intermedio.
//
// `rango` (§ CORTE-HERO-REVELADO-MASCARA-1, RONDA 4 — ver el bloque de abajo, "EL VELO VUELVE, PERO
// SUAVE") PARAMETRIZA piso Y techo; el DEFAULT es el rango de SIEMPRE ('media'), así que todo call
// site que no lo pase —no había ninguno antes de esta ronda— queda BYTE-IDÉNTICO.
export function veloOpacidad(progreso: number, estatico: boolean, rango: VeloRango = VELO_RANGO_MEDIA): number {
  if (estatico) return rango.techo;
  const p = Math.max(0, Math.min(1, progreso));
  return rango.piso + (rango.techo - rango.piso) * p;
}

// EL VELO SE VUELVE OPT-IN — § CORTE-HERO-VELO-OFF-Y-TICKER-1 (2026-09-27): esta función SIGUE
// existiendo, sin cambios de fondo — la usa cualquier tema con `hero.veloVisible:true` (el default,
// § el docstring de `HeroContent.veloVisible`, site-content-defaults.ts). `HeroMediaMarquesina.tsx`
// puede NO MONTAR el `<motion.div>` del velo en absoluto. El owner, sobre el prototipo aplicado:
// «ese velo verde debemos quitarlo, hace que el video se vea sin calidad» — CORTE apagó el toggle
// (`heroVeloVisible:false`, § themes.ts) en ESA ronda.
//
// EL CONTRASTE SIN VELO, MEDIDO (no supuesto) contra las MISMAS tres fotos de referencia de arriba
// (blanco `var(--sf-sobre-banda,white)` sobre arena `rgb(232,222,200)`, casi-blanco
// `rgb(245,245,240)`, crema `rgb(238,230,214)`): **1.34:1 · 1.09:1 · 1.24:1** — muy por debajo del
// piso AA (4.5:1) que el velo, encendido, garantizaba incluso en su punto más débil (5.25:1, § arriba).
// Esas tres fotos son un proxy CONSERVADOR para un video CLARO (el mismo criterio que ya fundaba
// `VELO_OPACIDAD_PISO`), no una medición del video REAL de CORTE, que es oscuro (§ el comentario de
// `navTinta` en `themes.ts`: "es oscuro y uniforme, sin esquema asignado a 'hero'") — sobre un fondo
// oscuro, blanco sin velo SÍ contrasta. **LA PALANCA DE CONTRASTE ES EL VIDEO, no el velo.**
//
// EL VELO VUELVE, PERO SUAVE — § CORTE-HERO-REVELADO-MASCARA-1 (RONDA 4, 2026-09-27): el owner, sobre
// el gate visual de ESTA ronda (el prototipo con el velo ya apagado): «también podemos agregar un
// velo, pero no tiene que ser tan fuerte porque ya comprobé que incluso sin el velo se ven bien las
// letras». Dos hechos a conciliar, no uno que corrige al otro: (a) el proxy de arriba dice que SIN
// velo el contraste es bajísimo, y (b) el owner ya VIO el texto legible sin velo sobre el video REAL
// de CORTE, que ese proxy no representa. La salida no es reactivar el rango de SIEMPRE (calibrado
// para un video CLARO genérico): es una intensidad más suave, propia de CORTE.
//
// `VeloIntensidad` es un ESCALAR más de `hero.escalares` (mismo mecanismo que `imagenTipo`/
// `puntoFocal`, § site-content-defaults.ts): 'media' es la CANÓNICA — el rango de SIEMPRE,
// byte-idéntico para todo tema que no la declare —; 'suave' fue la primera intensidad no-canónica
// (RONDA 4, la que CORTE eligió entonces); 'intermedia' es la TERCERA (§ HERO-VELO-INTERMEDIO-1,
// abajo). CORTE la usó por UN slice: **§ CORTE-CUERPO-LETRA-E-ICONOS-1 (2026-09-28) la REVIRTIÓ a
// 'suave'** — el owner, sobre el gate visual de 'intermedia' ya aplicada, la dejó fijada en
// 'suave' («el velo en suave es el que voy a dejar»). El PASO 'intermedia' NO se retira del
// catálogo ni del `<select>` del panel — sigue disponible para cualquier tema que quiera elegirla —,
// sólo CORTE deja de declararla.
//
// EL RANGO, NO SÓLO EL PISO: cada intensidad no-canónica baja (o, para 'intermedia' sobre 'suave',
// sube) las DOS puntas del recorrido, no sólo el reposo — el pedido original del owner era sobre el
// velo "en general", no sólo al cargar, y § HERO-VELO-INTERMEDIO-1 hereda ese mismo eje.
//
// CONTRASTE MEDIDO PARA 'suave' (mismo método WCAG que `VELO_OPACIDAD_PISO`, blanco sobre el velo
// compuesto sobre las TRES fotos claras de referencia, densidad efectiva = opacidad×0.80), esta vez
// CONTRA LA TINTA REAL DE CORTE (`#102407`, § `raices.tinta` en `themes.ts` — no el `#1a0f08`
// genérico del test de `VELO_OPACIDAD_PISO`, que no es de ningún preset en particular):
//   piso 0.30 (densidad efectiva 0.24): arena 2.16:1 · casi-blanco 1.80:1 · crema 2.02:1
//   techo 0.55 (densidad efectiva 0.44): arena 3.46:1 · casi-blanco 2.95:1 · crema 3.26:1
// LOS DOS QUEDAN BAJO AA (4.5:1) — MEDIDO Y REPORTADO, NO BLOQUEADO: la misma razón que ya acepta
// `heroVeloVisible:false` (arriba) — el proxy es conservador para un video claro, no el video real de
// CORTE, y el owner ya verificó la legibilidad real sobre pantalla. Un tema futuro con video CLARO
// que quiera 'suave' debe medir el SUYO antes de adoptarla; no hereda esta garantía por el nombre.
//
// ── 'intermedia' — § HERO-VELO-INTERMEDIO-1 (2026-09-28) ───────────────────────────────────────────
// EL PEDIDO, LITERAL, sobre el gate visual de 'suave' YA APLICADA (§ HERO-FRASE-COLOR-PLENO-1, la
// misma ronda que subió la frase al pie a `--sf-sobre-banda` PLENO): «Mejoró, sin embargo creo que
// el velo del hero puede ser un poquito más oscuro, si eso logra que las letras, no solo del pie,
// sino del nav se aprecien mejor». DOS LECTORES, no uno: la frase al pie (rol PLENO,
// `--sf-sobre-banda`, fallback `white` — CORTE no asigna esquema a 'hero', § el comentario de
// `navTinta` en `themes.ts`) Y los links del nav en su tratamiento FLOTANTE sobre el hero
// (`StoreNav.tsx`, `navFlotando && navClaro → text-[var(--sf-sobre)]`, TAMBIÉN blanco puro — un
// token GLOBAL, no gated por esquema). Las dos superficies renderizan el MISMO blanco (#ffffff)
// sobre el MISMO velo compuesto, así que la medición de abajo — UNA sola tabla — vale para las dos;
// no hay una segunda tabla que hacer.
//
// EL RANGO ELEGIDO, Y POR QUÉ ÉSE: `VELO_RANGO_SUAVE` y `VELO_RANGO_MEDIA` comparten el MISMO ancho
// (0.25: 0.55-0.30 y 1.00-0.75) — 'intermedia' preserva ese ancho ({piso:0.40, techo:0.65}, ancho
// 0.25) y sólo DESPLAZA la base +0.10 sobre 'suave' (piso 0.30→0.40, techo 0.55→0.65). +0.10 es
// MENOS de un cuarto de la distancia total entre 'suave' y 'media' (0.75-0.30=0.45; un cuarto sería
// +0.1125) — deliberadamente CONSERVADOR: el owner dijo «un poquito», y el error caro es pasarse
// (volver a 'media', que YA se probó y el owner reportó que "opaca" el video, § RONDA 4 arriba), no
// quedarse corto. Se descartó un paso MÁS CHICO (+0.05, piso 0.35/techo 0.60) por MEDIDO: el salto de
// contraste que produce (~+0.20 en los tres fotos, ~9% relativo) es más difícil de distinguir a ojo
// que el de +0.10 (~+0.40, ~19% relativo, tabla abajo) — "que se note", como pide el spec, no sólo
// que el número cambie.
//
// CONTRASTE MEDIDO PARA 'intermedia' (mismo método y mismas tres fotos que 'suave', arriba, contra la
// TINTA REAL de CORTE):
//   piso 0.40 (densidad efectiva 0.32): arena 2.58:1 · casi-blanco 2.17:1 · crema 2.42:1
//   techo 0.65 (densidad efectiva 0.52): arena 4.26:1 · casi-blanco 3.69:1 · crema 4.04:1
// CONTRA 'suave' (mismo piso/techo de arriba), la ganancia es PAREJA en las tres fotos:
//   piso:  +0.42 (arena) · +0.37 (casi-blanco) · +0.40 (crema)  →  ~19–21% relativo
//   techo: +0.80 (arena) · +0.74 (casi-blanco) · +0.78 (crema)  →  ~23–25% relativo
// SIGUE BAJO AA (4.5:1) EN LOS DOS EXTREMOS DE LAS TRES FOTOS — MEDIDO Y REPORTADO, NO BLOQUEADO, la
// MISMA razón que ya acepta 'suave' bajo AA: el proxy de fotos claras es conservador para un video
// claro, no el video real y oscuro de CORTE, y el pedido del owner («un poquito más oscuro») es sobre
// la LEGIBILIDAD REAL que ya verificó en pantalla, no sobre alcanzar el piso WCAG de un proxy que no
// representa su video. El techo (4.26 en arena) queda a 0.24 de AA — el más cerca de los tres pasos,
// pero sigue sin cruzarlo; cruzarlo habría exigido acercarse más a 'media', el paso que el spec pide
// evitar.
export interface VeloRango {
  piso: number;
  techo: number;
}
const VELO_RANGO_MEDIA: VeloRango = { piso: VELO_OPACIDAD_PISO, techo: 1 };
const VELO_RANGO_SUAVE: VeloRango = { piso: 0.3, techo: 0.55 };
const VELO_RANGO_INTERMEDIA: VeloRango = { piso: 0.4, techo: 0.65 };
const VELO_RANGOS: Record<VeloIntensidad, VeloRango> = {
  media: VELO_RANGO_MEDIA,
  suave: VELO_RANGO_SUAVE,
  intermedia: VELO_RANGO_INTERMEDIA,
};

// Ausente/vacío/basura → 'media' (mismo criterio que `objectPositionDePuntoFocal`): el resolver de
// contenido (`REGISTRY.hero.escalares.veloIntensidad`) ya clampa el valor guardado a la canónica
// antes de que llegue acá — ésta es la SEGUNDA guarda, defensiva, para quien llame la función directo.
export function rangoVeloDeIntensidad(intensidad: string): VeloRango {
  return (VELO_RANGOS as Record<string, VeloRango | undefined>)[intensidad] ?? VELO_RANGO_MEDIA;
}

// ── EL REVELADO DEL TEXTO — CORTE-HERO-MARQUEE-REVELA-1, REESCRITO por CORTE-HERO-REVELADO-MASCARA-1 ─
//
// EL PEDIDO ORIGINAL, LITERAL, sobre el muestrario de RONDA 2 (arriba) ya aplicado: «el marquee no
// debe salir inicialmente, inicialmente solo el video del hero. Las letras van saliendo hacia arriba,
// en una transición smooth, cuando alguien empiece a hacer scroll». La PRIMERA versión (histórica,
// abajo la reemplaza) reusaba `fadeUp` (`opacity 0→1`, `y 24→0px`) scrubbed por el scroll — y el
// owner, sobre ESE muestrario, reportó el defecto exacto que predecía tener: «las letras no están
// apareciendo como si subieran desde un lugar abajo… el efecto actual está simplemente mostrándolas
// cada vez más claras».
//
// LA MEDICIÓN QUE EXPLICA EL DEFECTO — la hipótesis del orquestador (que 24px es imperceptible contra
// texto DISPLAY) se CONFIRMA por aritmética, no por navegador (no hay uno en este carril): el texto
// del marquee usa `text-[clamp(3rem,10vw,10rem)]` — 48px en el piso del clamp, 160px en el techo, y
// 128px a un ancho de referencia de 1280px (10vw, el mismo ancho que este repo ya usa como referencia
// de escritorio para `EscalaDesktop`, § CLAUDE.md). `fadeUp.hidden.y` es 24px, fijo. La RELACIÓN
// desplazamiento/tamaño-de-letra:
//   piso del clamp (48px):  24/48  = 50.0%
//   ancho de referencia (128px): 24/128 = 18.75%
//   techo del clamp (160px): 24/160 = 15.0%
// `fadeUp` se diseñó para texto de CUERPO/TARJETA (14–24px), donde un desplazamiento de 24px es DEL
// ORDEN de la propia altura de la letra o mayor — ahí "sube" se lee. Contra texto display de 128px
// (el caso típico de escritorio, donde se gateó), el MISMO desplazamiento es apenas un 18.75% de la
// altura del glifo — casi nada frente al cambio de opacidad que ocurre en la MISMA ventana, y por eso
// domina la lectura de "se aclara" sobre la de "sube". CONFIRMADO: no hace falta un desplazamiento
// mayor en píxeles fijos (que volvería a vencerse en otra escala de clamp) — hace falta que el
// desplazamiento sea PROPORCIONAL al tamaño de la letra, no un valor absoluto.
//
// NO SE TOCA `fadeUp` (instrucción explícita del spec, y la razón ya escrita en este repo): es
// compartida por ~21 animaciones de entrada de tarjetas/bloques de texto normales, y "arreglar" su
// `y` para el hero display rompería esos otros consumidores. Lo que sigue es su HERMANA para texto
// DISPLAY — misma familia de intención (revelado por scroll), otra magnitud.
//
// EL REVELADO ENMASCARADO — la construcción, no sólo la magnitud: en vez de sumar un `translateY` en
// PÍXELES sobre un texto ya visible (transparente→opaco), el texto vive dentro de un contenedor
// `overflow:hidden` del alto EXACTO de una línea de ese texto (line-height:1, `leading-none` —
// el propio contenido define esa altura; un transform no la cambia, sólo el layout la fija), y se
// traslada un PORCENTAJE de su PROPIA caja: 100% (fuera del todo, oculto bajo el borde inferior de la
// máscara) en reposo, 0% (en su lugar) al completar la ventana. Es la construcción que hace el TEMA
// REAL para este mismo texto («reveal de entrada… otro `xo-parallax-scroll`», § el docstring de
// cabecera de `HeroMediaMarquesina.tsx`) y la razón de por qué "sube desde atrás de un borde" se ve
// distinto de "aparece más claro": antes del borde, el texto NO EXISTE visualmente (recortado), no
// que exista pero transparente.
//
// PORCENTAJE, NO PÍXELES — esto es lo que resuelve la medición de arriba de raíz: un `translateY(N%)`
// CSS es relativo a la altura de la CAJA TRANSFORMADA, así que escala AUTOMÁTICAMENTE con el
// `clamp(3rem,10vw,10rem)` del texto (a 48px, 100% son 48px de recorrido; a 160px, 100% son 160px) —
// nunca vuelve a vencerse en otra pantalla, sin que nadie tenga que recalcular un número.
//
// SIN FADE (histórico, REVERTIDO por § CORTE-MARQUEE-REVELADO-CON-FADE-1 más abajo) — esta ronda
// evaluó agregar opacidad ADEMÁS del recorte y la descartó, con el argumento de arriba. El spec de
// ESA ronda pedía explícitamente probar sin fade primero y quedarse con lo que se pareciera más al
// tema real — "sin fade" fue la elección correcta CONTRA ESE PEDIDO, no un error. El owner, sobre el
// resultado YA aplicado, pidió las dos cosas compuestas (§ `opacidadRevelaTextoDisplay`, debajo de
// `transformRevelaTextoDisplay`): es una corrección del CRITERIO —qué se le pidió al worker—, no un
// defecto de esta ronda.
//
// `UMBRAL_REVELADO_TEXTO` NO CAMBIA (mismo campo, mismo valor): acota la ventana a la parte TEMPRANA
// del progreso — el pedido sigue siendo "cuando alguien EMPIECE a scrollear", no a lo largo de las
// tres pantallas del recorrido pineado completo. Fuera de esta ventana (progreso ≥ 0.2) el texto ya
// está en su posición final y el resto del recorrido lo sigue ocupando el TICKER (horizontal, por
// tiempo, § más abajo) y la tarjeta (`transformMarquesinaTarjeta`, recortada a [0.12,0.57]).
export const UMBRAL_REVELADO_TEXTO = { desde: 0, hasta: 0.2 } as const;

// `UMBRAL_ENTRADA_TARJETA_MARQUESINA` — NACIÓ en § MARQUESINA-TARJETA-SECUENCIA-1 (2026-10-02). El
// gate del owner sobre Café Las Chamisas, literal: «No debe salir al tiempo con el marquee, sino una
// vez las letras han salido, luego salga el producto». `MARQUESINA-TARJETA-PRODUCTO-1` había
// alineado la tarjeta a la MISMA ventana que la frase (`UMBRAL_REVELADO_TEXTO`, [0,0.2]) — eso las
// hace entrar JUNTAS, que es justo lo que el owner reportó mal.
//
// LA VENTANA SE DERIVA, NO SE INVENTA: dura el MISMO ancho que la ventana de la frase (`hasta -
// desde` igual en las dos) — no inventa una MAGNITUD nueva, la "duración de una entrada" ya la fijó
// `UMBRAL_REVELADO_TEXTO`, y la tarjeta hereda esa misma cadencia en vez de tener la suya propia.
//
// GANA UNA PAUSA ANTES DE ARRANCAR — § MARQUESINA-TARJETA-COMO-LETRAS-1 (2026-10-02). La primera
// versión arrancaba EXACTO donde la frase termina (`desde = UMBRAL_REVELADO_TEXTO.hasta`, cero
// distancia) — el gate del owner sobre esa versión: «debe haber una mini pausa entre que salen las
// letras y sale la imagen, ahora mismo parece que en el mismo scroll que las letras salen completas
// con su tono correcto ahí mismo sale la imagen, la imagen debería empezar a salir un scroll
// después». `desde` pasa a `UMBRAL_REVELADO_TEXTO.hasta + pausaFraccion` — la tarjeta sigue sin
// superponerse jamás con la frase (la pausa sólo puede alejarlas más, nunca acercarlas), y encima ya
// no arrancan en el MISMO instante.
//
// `pausaFraccion` ES LA PAUSA, CONVERTIDA A LA MISMA UNIDAD QUE TODA VENTANA DE ESTE ARCHIVO
// ("progreso", una fracción de H, el presupuesto total que da `claseAlturaAncestroMarquesina` más
// abajo) — "Expresala en el mismo progreso del tramo fijo", el pedido del orquestador, tomado
// literal. No es un número suelto: se deriva de una DISTANCIA DE SCROLL DE UN GESTO (`PAUSA_
// MARQUESINA_TARJETA_VH`, abajo), convertida vía la MISMA relación cerrada que ya resuelve el
// presupuesto H en `claseAlturaAncestroMarquesina` ("RONDA SECUENCIA" → "RONDA PAUSA", su docstring
// para la derivación completa) — así que agregar la pausa no es una segunda cuenta aparte, es la
// MISMA cuenta con un término más.
//
//   F = UMBRAL_REVELADO_TEXTO.hasta           (dónde termina la frase — SIN CAMBIO, 0.2)
//   A = F                                      (ancho de la ventana de la tarjeta — SIN CAMBIO: "dura lo mismo")
//   R = A / 2                                   (el respiro DESPUÉS de la tarjeta, antes de despinear — SIN CAMBIO)
//   K = F + A + R                               (la suma de fracciones FIJAS del sistema, sin la pausa — con hoy, 0.5)
//   G = PAUSA_MARQUESINA_TARJETA_VH              (la pausa, en "unidades de viewport", VH=100)
//   H = (100 + G) / K                            (el presupuesto que hace que pUnpin = K + G/H — ver abajo)
//   pausaFraccion = G / H = G·K / (100 + G)      (la pausa, YA en fracción de H — lo que `desde` suma)
//
// Con los valores de hoy (F=0.2, K=0.5, G=20): H=240 (extra=140vh, el literal que
// `claseAlturaAncestroMarquesina` usa), pausaFraccion = 20·0.5/120 = 1/12 ≈ 0.0833 → ventana
// ≈ [0.2833, 0.4833] (antes [0.2, 0.4], sin pausa).
//
// Consumida por `HeroMediaMarquesina.tsx` como `ventana` de `transformRevelaTextoDisplay` Y de
// `opacidadRevelaTextoDisplay` (arriba, con `techo=1`) — las DOS capas de la tarjeta comparten esta
// única ventana, así que no pueden desincronizarse entre sí (una terminando de subir mientras la
// otra sigue aclarando). `transformMarquesinaTarjeta`/`opacidadEntradaTarjetaMarquesina` (su
// consumidor anterior, RETIRADA — ver el hueco que deja más abajo) ya no la consumen.
export const PAUSA_MARQUESINA_TARJETA_VH = 20; // ver la derivación del gesto, arriba del bloque siguiente

// EL GESTO DE REFERENCIA, Y POR QUÉ ESOS DOS NÚMEROS — § MARQUESINA-TARJETA-COMO-LETRAS-1. No hay
// una medición externa que fije "un scroll" (no hay prototipo que lo declare — es una preferencia de
// RITMO del owner, la misma clase de decisión sin medición externa que ya tomó
// `VELOCIDAD_TICKER_LENTA_PX_S`: "elegida, no derivada de ninguna medición"). Se eligen DOS
// referencias de gesto —una por plataforma— y se toma la MÁS GRANDE, para que la pausa nunca se
// consuma DENTRO de un solo gesto en NINGÚN dispositivo:
//   - RUEDA DE MOUSE, escritorio: ~100px por notch (el delta estándar de un `WheelEvent` en modo
//     píxel en la mayoría de navegadores), sobre el viewport de referencia que este mismo archivo ya
//     usa para `RESORTE_ACOMODO` ("a 1440×900") → 100/900 ≈ 11.11% de un viewport.
//   - DESLIZAMIENTO CORTO, teléfono: un touch arrastra el contenido ~1:1 con el dedo (antes de
//     cualquier inercia), así que cubre MÁS pantalla por gesto que un solo notch de rueda — se toma
//     un quinto (20%) del viewport como "corto" (menos que un swipe largo, que cubriría más).
// 20% (móvil) > 11.11% (escritorio): la pausa queda calibrada para que un deslizamiento corto típico
// la cruce casi exacto (es la fracción que define `PAUSA_MARQUESINA_TARJETA_VH`), y en escritorio
// quede un poco MÁS larga que un solo notch (~1.8 notches) — nunca al revés. Una pausa que se
// consume en MENOS de un gesto no se lee como pausa; una que dura un poco más de uno, sí.
const anchoVentanaEntradaTarjeta = UMBRAL_REVELADO_TEXTO.hasta - UMBRAL_REVELADO_TEXTO.desde;
const sumaFraccionesFijasEntradaTarjeta =
  UMBRAL_REVELADO_TEXTO.hasta + anchoVentanaEntradaTarjeta + anchoVentanaEntradaTarjeta / 2;
const pausaFraccionEntradaTarjeta =
  (PAUSA_MARQUESINA_TARJETA_VH * sumaFraccionesFijasEntradaTarjeta) / (100 + PAUSA_MARQUESINA_TARJETA_VH);

export const UMBRAL_ENTRADA_TARJETA_MARQUESINA = {
  desde: UMBRAL_REVELADO_TEXTO.hasta + pausaFraccionEntradaTarjeta,
  hasta: UMBRAL_REVELADO_TEXTO.hasta + pausaFraccionEntradaTarjeta + anchoVentanaEntradaTarjeta,
} as const;

// `progresoEnVentana` — la fórmula de recorte [0,1] que `transformRevelaTextoDisplay`/
// `opacidadRevelaTextoDisplay` (bajo `ventana`, con default `UMBRAL_REVELADO_TEXTO`) comparten —
// generalizada § MARQUESINA-TARJETA-SECUENCIA-1 para que dos ventanas usen la MISMA aritmética sin
// duplicarla, y vuelta a usar directo (sin el envoltorio privado `progresoRevelado`, RETIRADO) por
// § MARQUESINA-TARJETA-COMO-LETRAS-1 cuando las dos funciones ganaron `ventana` como parámetro
// explícito — ver el docstring de cada una, más abajo.
function progresoEnVentana(progreso: number, ventana: { desde: number; hasta: number }): number {
  const p = Math.max(0, Math.min(1, progreso));
  const { desde, hasta } = ventana;
  return Math.max(0, Math.min(1, (p - desde) / (hasta - desde)));
}

// El traslado en reposo: 100% de la caja del propio elemento — completamente fuera del área que la
// máscara (el contenedor `overflow:hidden`, montado por el componente) deja ver. No es "casi oculto":
// es la MISMA garantía que pedía `opacidadRevelado` (0 en reposo), expresada por recorte en vez de
// transparencia.
const REVELADO_TRASLADO_PCT = 100;

// `transformRevelaTextoDisplay`: el `transform` CSS completo del elemento que el componente traslada
// DENTRO de la máscara — reemplaza a `opacidadRevelado`/`translateYRevelado` (RETIRADAS, sin otro
// consumidor). `estatico` (reduced-motion/preview, el MISMO gate que `veloOpacidad`/
// `transformAcomodo`) rinde `translateY(0%)` — el texto EN SU LUGAR, visible por completo: un gate de
// movimiento apaga el DESPLAZAMIENTO, nunca el CONTENIDO, y acá "en su lugar" es lo que dentro de la
// máscara SIGNIFICA visible (0% = ninguna porción recortada).
//
// `ventana` — § MARQUESINA-TARJETA-COMO-LETRAS-1 (2026-10-02). El owner, sobre el gate de
// MARQUESINA-TARJETA-SECUENCIA-1: «el efecto [de la tarjeta] no es el mismo de las letras, debería
// ser el de las letras, desde abajo y el desvanecido quitarse progresivamente». En vez de una COPIA
// de esta función para la tarjeta, gana un segundo parámetro `ventana` (default
// `UMBRAL_REVELADO_TEXTO`, byte-idéntico para el único call-site de hoy que no lo pasa, el loop de
// texto) — el mismo patrón que `transformMarquesinaTarjeta` ya tenía. `HeroMediaMarquesina.tsx` pasa
// `UMBRAL_ENTRADA_TARJETA_MARQUESINA` para la tarjeta — ver su docstring, abajo, para la derivación
// de ESA ventana (con la pausa). EL `translateY(N%)` SIGUE SIENDO RELATIVO A LA PROPIA CAJA DEL
// ELEMENTO TRANSFORMADO (la misma razón por la que escala con el `clamp()` de la fuente del marquee,
// § "PORCENTAJE, NO PÍXELES" arriba) — por eso la MISMA función, sin cambiar un solo número, sirve
// para una línea de texto y para una tarjeta de proporción distinta: el recorrido se mide contra lo
// que sea que el llamador haga `h-full`/`w-full` de la máscara, nunca contra un píxel fijo.
export function transformRevelaTextoDisplay(
  progreso: number,
  estatico: boolean,
  ventana: { desde: number; hasta: number } = UMBRAL_REVELADO_TEXTO,
): string {
  if (estatico) return 'translateY(0%)';
  const pct = REVELADO_TRASLADO_PCT * (1 - progresoEnVentana(progreso, ventana));
  return `translateY(${pct.toFixed(1)}%)`;
}

// EL PESO — LA RAMPA DE OPACIDAD VUELVE, COMPUESTA CON EL RECORTE — § CORTE-MARQUEE-REVELADO-CON-
// FADE-1 (2026-09-27). El owner, sobre el gate de RONDA 4 ya re-aplicado: «ahora el ajuste quedó de
// la frase saliendo hacia arriba, pero se perdió el de la frase haciéndose más clara al hacer el
// scroll, sale con el mismo peso desde el inicio». Pide las DOS cosas juntas — sube desde detrás del
// recorte Y gana peso mientras sube —, no una reversión de la máscara.
//
// POR QUÉ ESTO NO REINTRODUCE EL DEFECTO ORIGINAL (§ el bloque "SIN FADE" arriba, y el pedido de
// RONDA 4: «el efecto actual está simplemente mostrándolas cada vez más claras»): esa lectura salía
// de que la OPACIDAD ERA EL ÚNICO MECANISMO — sin recorte, una letra estática que sólo se aclara no
// "sube", se ilumina. Acá el recorte SIGUE siendo el mecanismo de aparición (la letra sale de detrás
// del borde de la máscara, en movimiento); la opacidad es una SEGUNDA señal —peso, no visibilidad—
// que viaja sobre la MISMA letra que ya se está moviendo. No hay porción de letra que "ya cruzó el
// borde y todavía se aclara": las dos rampas comparten exactamente la misma ventana
// (`UMBRAL_REVELADO_TEXTO`, sin tocar) y terminan JUNTAS — al completar la ventana el texto está a la
// vez en su lugar (0% de traslado) y a peso completo (opacidad 1), nunca una sin la otra.
//
// `opacidadRevelaTextoDisplay` REUSA `progresoEnVentana` (el mismo mapeo [0,1] que
// `transformRevelaTextoDisplay` ya usa) en vez de declarar su propio tramo: con la MISMA `ventana`
// que su hermana (el default de las dos, o la que pase el llamador — § MARQUESINA-TARJETA-COMO-
// LETRAS-1, abajo), las dos rampas se mueven juntas por construcción — dos funciones leyendo la
// MISMA ventana no pueden divergir en cuándo terminan, que es justo la garantía que el spec pide
// ("termina de aclarar cuando termina de subir"). Es MONÓTONA porque `progresoEnVentana` ya lo es
// (un cociente clamped de una resta creciente en `progreso`): no puede oscurecerse a mitad de camino.
//
// `estatico` (reduced-motion/preview, el MISMO gate que `transformRevelaTextoDisplay`) rinde el
// `techo` — PESO COMPLETO (o, con `techo=1`, opacidad PLENA), nunca a medio aclarar para siempre: un
// gate de movimiento apaga el DESPLAZAMIENTO temporal de la rampa, nunca deja el contenido en un
// estado transitorio permanente.
//
// SE COMPONE EN EL MISMO ELEMENTO QUE `transformRevelaTextoDisplay` (el `motion.div` del MEDIO en
// `HeroMediaMarquesina.tsx`, vía un segundo `style.opacity` junto al `style.transform` ya existente)
// y NO EN LA MÁSCARA (el `<div>` de afuera, `overflow-hidden`, plano/sin motion): `opacity` y
// `transform` son propiedades CSS independientes sobre el mismo nodo — aplicarlas juntas no altera el
// recorte de la máscara ancestro, que sigue intacto. Medido antes de escribir el cableado: no hay
// pisada entre las dos capas que exija tocar la ESTRUCTURA de tres elementos (§ "EL LOOP DE TEXTO"),
// sólo agregar un segundo valor de `style` al elemento del medio.
// EL TECHO DE LA RAMPA BAJA UN ESCALÓN — § CORTE-HERO-MARQUEE-RONDA-5-1 (2026-09-27): el owner, sobre
// el gate visual de RONDA 4 ya reaplicada: «la opacidad final de las letras dejemosla sólo un poco
// más bajo, que no sea un blanco tan claro al que llegan». `OPACIDAD_REVELADO_TECHO` reemplaza al `1`
// (peso pleno) como destino de la rampa — un escalón MODERADO por debajo del pleno, no una segunda
// curva: `opacidadRevelaTextoDisplay` sigue siendo la MISMA rampa (0 en reposo, lineal dentro de la
// ventana) ESCALADA por este techo. Sigue MONÓTONA por construcción: escalar una función
// no-decreciente (`progresoEnVentana`) por una constante positiva preserva el orden — no hace falta
// una prueba nueva de monotonía, la que ya existe (`lib/animation.test.ts`) sigue afirmándola tal
// cual sobre la función escalada.
//
// `ventana`/`techo` — § MARQUESINA-TARJETA-COMO-LETRAS-1 (2026-10-02), MISMA razón que el parámetro
// `ventana` de `transformRevelaTextoDisplay` (arriba): la tarjeta necesita la MISMA rampa, en SU
// PROPIA ventana (`UMBRAL_ENTRADA_TARJETA_MARQUESINA`, con la pausa — ver su docstring más abajo) y
// con un TECHO DISTINTO — PLENO (`1`), no `OPACIDAD_REVELADO_TECHO` (0.9): ese 0.9 es una decisión de
// LEGIBILIDAD sobre texto blanco ("que no sea un blanco tan claro al que llegan"), ajena a una foto
// de producto, que debe llegar a su opacidad completa. Los DOS parámetros son opcionales, con el
// default de SIEMPRE (`UMBRAL_REVELADO_TEXTO`/`OPACIDAD_REVELADO_TECHO`) para el único call-site que
// no los pasa hoy (el loop de texto) — byte-idéntico.
export const OPACIDAD_REVELADO_TECHO = 0.9;

export function opacidadRevelaTextoDisplay(
  progreso: number,
  estatico: boolean,
  ventana: { desde: number; hasta: number } = UMBRAL_REVELADO_TEXTO,
  techo: number = OPACIDAD_REVELADO_TECHO,
): number {
  if (estatico) return techo;
  return progresoEnVentana(progreso, ventana) * techo;
}

// `opacidadEntradaTarjetaMarquesina` — RETIRADA, § MARQUESINA-TARJETA-COMO-LETRAS-1 (2026-10-02).
// Nació en § MARQUESINA-TARJETA-PRODUCTO-1 para darle a la tarjeta una "aparición" que no tenía
// (`transformMarquesinaTarjeta` sólo escalaba/rotaba una tarjeta ya a opacidad 1); § MARQUESINA-
// TARJETA-SECUENCIA-1 le dio su propia ventana, secuencial a la frase. El gate del owner sobre ESA
// versión pidió que la tarjeta usara "el efecto de las letras" —no su propia rampa, la MISMA que ya
// usa la frase—, así que `opacidadRevelaTextoDisplay` (arriba) ganó los parámetros `ventana`/`techo`
// que la generalizan, y esta función quedó sin ningún llamador real (sólo sus propios tests). Código
// sin consumidor vivo no se deja ambiguo (§ CLAUDE.md, el ex-#68: "se BORRA o se CABLEA, nunca se
// deja AMBIGUO") — se retira entera, con sus tests (`lib/animation.test.ts`).

// ── EL TAMAÑO DEL TEXTO Y SU MÁSCARA — MEDIDO CONTRA EL TEMA REAL, § CORTE-HERO-MARQUEE-RONDA-5-1 ──
//
// EL PEDIDO DEL OWNER, LITERAL, sobre el gate visual de RONDA 4 ya reaplicada (2026-09-27): «el
// tamaño de la fuente en cafeone es mayor, hace que se vea más lleno el hero, tenemos que subirle el
// tamaño a la fuente». Hasta este slice el marquee HORNEABA su tamaño en la className de
// `HeroMediaMarquesina.tsx` (`text-[clamp(3rem,10vw,10rem)] leading-none`) sin haberlo medido nunca
// contra el tema real — era el tamaño elegido para la primera versión del componente.
//
// MEDIDO (`node --eval "fetch(...)"` contra `https://x-cafeone.myshopify.com/`, 2026-09-27 — NO
// `docs/prototipos/cafeone/`, que § el docstring de cabecera de `HeroMediaMarquesina.tsx` ya
// declaró "ya no es la autoridad para esta banda"): el HTML servido (sección
// `hero_banner_marquee`) envuelve el texto del loop en un `<div class="... fz:d1 ...">` con
// `style="--lh:1.1;--lts:-0.1rem;..."` inline. `styles.css` (`.../cdn/shop/t/5/assets/styles.css`)
// declara TRES variantes de `.fz\:d1` bajo distintos selectores de PRESET; el `<body>` servido trae
// `class="gradient preset-2 body-preset"` (confirmado en dos fetches independientes), así que la
// que aplica es `.preset-2 body-preset .fz\:d1`:
//   font-size: calc(var(--font-heading-scale) * var(--font-body-scale) *
//              clamp(7.6rem, calc(17.25vw + .7rem), 21.4rem))
// Las dos variables de escala están declaradas `1.0` en el `:root` inline del HTML (única aparición
// de cada una) — sin multiplicador efectivo. Y `<html>` trae `font-size:62.5%` — 1rem de ESE tema
// son 10px (62.5% de los 16px de default del navegador), NO los 16px de este repo (`app/globals.css`
// no toca el rem raíz): es EXACTAMENTE el caso que el spec pedía no pasar por alto ("el tamaño
// efectivo en px depende además de la base del rem que fija el tema"). Convertido a PX ABSOLUTOS —la
// unidad que no depende de NINGÚN rem—:
//   clamp(76px, calc(17.25vw + 7px), 214px)
// A 1280px de ancho (la referencia de escritorio de este repo, § el comentario de `fadeUp` arriba):
// 17.25vw+7px = 227.8px, por encima del techo → rinde 214px — MAYOR que el techo de hoy (160px,
// `10rem` a los 16px de nuestro rem): confirma "se ve más lleno" con un número, no sólo a ojo.
//
// POR QUÉ ES UNA CONSTANTE LOCAL Y NO UN TERCER ROL DE `fontSizeDisplay`/`escalaDisplay`
// (`lib/config/escala-display.ts`) — DECISIÓN, no descuido: ese archivo (y `site-content-
// defaults.ts`/`tienda-secciones.ts`, que tendrían que ganar el campo nuevo + su control de panel
// bajo el trinquete `PENDIENTE_PANEL`, § CLAUDE.md "PANEL-REFLEJA-TIENDA-CHEQUEO-1") están FUERA de
// `touches:` de este slice. Y no hace falta un eje de tema nuevo para representarlo: `hero:'sticky'`
// —la única composición que monta este texto— la declara HOY sólo CORTE (verificado,
// `grep -n "hero:\s*'sticky'" lib/config/themes.ts`: una sola asignación, dentro de `CORTE.
// variantes`), así que aplicar el valor MEDIDO sin condición, DENTRO de este componente, es
// byte-idéntico en EFECTO a gatearlo por un eje de tema que sólo CORTE prendería: ningún otro preset
// renderiza jamás este árbol. Si algún día un SEGUNDO preset pidiera `hero:'sticky'` con OTRO
// tamaño, ESE es el momento de promover esto a un escalar de `hero.escalares` con su control de
// panel, en su propio slice — no antes.
//
// EL INTERLINEADO Y EL INTERLETRADO TAMBIÉN SE COPIAN, tal como el tema los declara EN LÍNEA:
// `--lh:1.1` es unitless (sin ambigüedad de rem) → `line-height:1.1`. `--lts:-0.1rem` SÍ depende del
// rem del tema (10px) → -1px ABSOLUTO — se copia como `-1px` (no como `-0.1rem`, que en NUESTRO rem
// de 16px daría -1.6px, un valor que el tema real nunca declaró).
export const MARQUEE_TITULO_FONT_SIZE = 'clamp(76px, calc(17.25vw + 7px), 214px)';
export const MARQUEE_TITULO_LINE_HEIGHT = 1.1;
export const MARQUEE_TITULO_LETTER_SPACING = '-1px';

// LOS DESCENDENTES CORTADOS — la máscara gana el relleno de la pieza de marca, MEDIDO (no copiado a
// ciegas). EL PEDIDO DEL OWNER: «la g y la q salen cortadas en la parte de abajo un poco». La pieza
// de marca de Duna resuelve exactamente esto en su propia máscara (transcrita por el spec):
// `.mask{overflow:hidden;padding:0 .02em .08em;margin-bottom:-.08em}` — relleno inferior en `em`
// para que la máscara incluya el descendente, y margen negativo de IGUAL magnitud para que el
// layout no se corra por el relleno agregado.
//
// EL 0.08em DE DUNA NO SE COPIÓ TAL CUAL — medido, no asumido: con el interlineado nuevo (1.1, arriba)
// el déficit real es MENOR. Verificado fuera de `touches:` (Chromium headless vía Playwright + Canvas
// 2D `measureText`, sin dejar rastro en el repo — el mismo playbook que `CORTE-MARQUEE-VELOCIDAD-
// REAL-1` ya usó para medir el ticker) contra la fuente REAL que este componente rinde bajo CORTE
// (Roboto Serif, el titulo del par 'prensa'): sus métricas propias dan `ascent+descent = 1.17em`
// (`fontBoundingBox{Ascent,Descent}` a 100px: 93+24), MÁS que el `1.10em` que `line-height:1.1`
// reserva — el déficit que el modelo de "half-leading" de CSS reparte mitad arriba/mitad abajo
// termina recortando el descendente. Confirmado por PÍXEL (no sólo por métrica): a `font-size:214px`
// (el techo del clamp de arriba, el caso más exigente) una frase con g/q/j/y/ü perdía 8px de tinta
// real contra `overflow:hidden` sin relleno; con **0.04em** de relleno (el doble del déficit
// analítico, ~0.035em por lado) la pérdida da CERO en las tres paradas del clamp (76px/140px/214px).
// 0.08em (el valor de Duna) también cierra el caso, pero con margen que este componente no necesita.
export const MARQUEE_MASCARA_RELLENO_EM = 0.04;

// ── EL PRESUPUESTO DE SCROLL, PROPORCIONAL A LO QUE HAY PARA MOSTRAR — CORTE-HERO-MARQUEE-REVELA-1 ─
//
// EL TRAMO MUERTO REPORTADO POR EL OWNER («por más que haga scroll demoro en bajar mucho esa
// sección... ahora mismo parece un bug») — MEDIDO, no asumido (§ el spec pedía medirlo antes de
// aceptarlo): `GET https://coffee-template-app-onix.vercel.app/api/catalog` devuelve `[]` — el
// catálogo del muestrario desplegado está VACÍO — y el HTML servido de la sección pineada (entre
// `min-h-[calc(100svh+200vh)]` y su `</section>` de cierre) no contiene el marcado de la tarjeta
// (`aspect-[3/4]`): la página tiene 8 apariciones de esa clase y las 8 caen en Presentaciones/
// BrandStory, CERO dentro de la sección del hero. La hipótesis del spec queda CONFIRMADA por
// ejecución: sin producto que pinear (hide-on-empty, § el docstring de cabecera de
// `HeroMediaMarquesina.tsx`), el ancestro seguía reservando el MISMO presupuesto de 200vh que la
// ventana [0.12,0.57] de `transformMarquesinaTarjeta` necesita para animar una tarjeta que nunca
// aparece — 135vh de scroll (0.45 × 300vh) dedicados a una animación sin nada que mostrar.
//
// `claseAlturaAncestroMarquesina` deriva la altura del mismo hecho que ya decide si la tarjeta se
// muestra (`producto`, hide-on-empty): CON tarjeta, el presupuesto de ENTONCES era 100svh + 200vh,
// medido contra `<xo-parallax class="h:300vh">`, § el docstring de cabecera de
// `HeroMediaMarquesina.tsx` — ESE NÚMERO CAMBIÓ, ver "RONDA SECUENCIA" más abajo. SIN tarjeta, se le
// resta EXACTAMENTE la porción que esa ventana ocupaba (135vh = 0.45×300vh, la misma ventana
// [0.12,0.57] de `transformMarquesinaTarjeta`) — lo que queda (65vh) alcanza para el reveal temprano
// del texto (§ `UMBRAL_REVELADO_TEXTO`, arriba) y el arrastre continuo del texto/velo, sin arrastrar
// un tramo que no tiene contenido nuevo que mostrar. **ESTA RAMA (sin tarjeta) NO CAMBIA en esta
// ronda** — el spec de § MARQUESINA-TARJETA-SECUENCIA-1 es explícito: "Sin tarjeta: todo como hoy".
//
// EL PÁRRAFO DE ARRIBA DESCRIBE EL DEFAULT DE `transformMarquesinaTarjeta`, NO YA LO QUE
// `HeroMediaMarquesina.tsx` ANIMA — § MARQUESINA-TARJETA-PRODUCTO-1 (2026-10-02): ese componente pasa
// su PROPIA `ventana` para alinear la entrada de la tarjeta con la de la frase (la ventana cambió de
// nuevo en la ronda de abajo, y la FORMA que esa ventana anima cambió otra vez en § MARQUESINA-
// TARJETA-COMO-LETRAS-1 — ver el docstring de `transformRevelaTextoDisplay`/
// `opacidadRevelaTextoDisplay`, arriba: ya no es `transformMarquesinaTarjeta`/
// `opacidadEntradaTarjetaMarquesina` quien la consume); el recorte [0.12,0.57] que justifica el 135vh
// de este párrafo sigue siendo el DEFAULT de la función —y el que `Marquesina.tsx` sigue usando—,
// pero ya no el que la tarjeta de este componente recorre.
//
// ── RONDA SECUENCIA — § MARQUESINA-TARJETA-SECUENCIA-1 (2026-10-02): el presupuesto CON TARJETA SÍ
// SE RE-DERIVA, y es la primera vez que se toca ──
//
// EL DEFECTO REPORTADO POR EL OWNER, LITERAL, sobre Café Las Chamisas: «Revisa el scroll luego de
// que la imagen ha salido, actualmente vi un bug en la implementación, luego de que la imagen salió
// completa hice scroll 3 veces antes de poder iniciar a bajar en la página». Con el presupuesto
// VIEJO (100svh+200vh, H=300vh en unidades de viewport, VH=100): la tarjeta de `HeroMediaMarquesina.
// tsx` terminaba de escalar/rotar/aparecer en progreso 0.2 (compartía `UMBRAL_REVELADO_TEXTO` con la
// frase) y el `position:sticky` no se despinea hasta progreso ≈(H-VH)/H = 200/300 ≈ 0.667 (el punto
// en que el excedente del ancestro, H-VH, se termina de consumir — ahí el panel deja de poder
// quedarse "pegado" sin desbordar su propio contenedor) — un tramo de ≈0.47 de progreso (≈140vh de
// scroll) donde NADA nuevo pasa (texto y tarjeta ya quietos, sólo el velo se sigue oscureciendo)
// antes de que la página empiece a avanzar. Es EXACTAMENTE la forma del "scroll 3 veces" reportado.
//
// LA RE-DERIVACIÓN, EN FUNCIÓN DE LAS VENTANAS — no un número ajustado a ojo. Con la tarjeta ahora
// en su PROPIA ventana secuencial (`UMBRAL_ENTRADA_TARJETA_MARQUESINA`, § su docstring), se define
// un RESPIRO corto —la MITAD del ancho de esa ventana (0.1)— para que la tarjeta completa quede un
// instante quieta y visible antes de que el panel se libere, y se elige el presupuesto (H) de modo
// que el `position:sticky` se despinee EXACTAMENTE al terminar ese respiro, no mucho después:
//   cardEnd  = UMBRAL_ENTRADA_TARJETA_MARQUESINA.hasta  (con los valores de ESTA ronda, 0.4)
//   respiro  = (UMBRAL_ENTRADA_TARJETA_MARQUESINA.hasta - .desde) / 2  (0.1)
//   pUnpin   = cardEnd + respiro = 0.5          (el progreso donde QUEREMOS que se despinee)
//   H        = VH / (1 - pUnpin) = 100 / 0.5 = 200   (VH=100, "unidades de viewport")
//   extra    = H - VH = 100                      → +100vh, la mitad del 200vh de antes
// Verificado también en la otra dirección: a extra=100vh (H=200vh), progreso=pUnpin=0.5 da
// (H-VH)/H = 100/200 = 0.5 — coincide por construcción, no por casualidad. El "sin tarjeta" (65vh)
// no entra en esta cuenta porque esa rama no tiene tarjeta que alinear — se queda intacta.
//
// MEDIDO CONTRA EL NAVEGADOR REAL, no sólo por aritmética (Playwright, Chromium 1440×900 y WebKit
// `iPhone 13`, preset CORTE + un producto 3:4 por `marquesina.productoSlug`): la distancia de scroll
// entre "tarjeta al 100%" (opacidad 1, progreso=`UMBRAL_ENTRADA_TARJETA_MARQUESINA.hasta`) y "el
// `position:sticky` deja de estar pegado" queda documentada en el asiento de este slice
// (`DECISIONS.md`, § MARQUESINA-TARJETA-SECUENCIA-1) junto con los píxeles medidos en los dos
// viewports — la derivación de arriba predice el punto exacto, la medición confirma que es corta
// (un gesto de scroll, no tres).
//
// ── RONDA PAUSA — § MARQUESINA-TARJETA-COMO-LETRAS-1 (2026-10-02): LA MISMA FÓRMULA, UN TÉRMINO MÁS ──
//
// `UMBRAL_ENTRADA_TARJETA_MARQUESINA` ganó la pausa (§ su docstring, arriba, para el gesto de
// referencia y la derivación de `pausaFraccion`) — `cardEnd`/`respiro`/`pUnpin`/`H` arriba NO
// cambiaron de FÓRMULA, sólo de VALOR, porque `UMBRAL_ENTRADA_TARJETA_MARQUESINA.hasta`/`.desde` ya
// no son [0.4, 0.2] sino los que incluyen la pausa:
//   cardEnd  = UMBRAL_ENTRADA_TARJETA_MARQUESINA.hasta ≈ 0.4833   (antes 0.4)
//   respiro  = (hasta - desde) / 2 = 0.1                          (SIN CAMBIO: la MITAD del ancho, que tampoco cambió)
//   pUnpin   = cardEnd + respiro ≈ 0.5833
//   H        = 100 / (1 - pUnpin) = 100 / 0.41666... = 240        (antes 200)
//   extra    = H - VH = 140                                       → +140vh (antes 100vh)
// Esta función NO tuvo que cambiar de MECANISMO para absorber la pausa — ya derivaba el presupuesto
// genéricamente de `UMBRAL_ENTRADA_TARJETA_MARQUESINA`, nunca de un literal propio aparte de su
// `return`; cambiar la ventana (arriba) ya le movió el resultado. Lo único que cambia AQUÍ es el
// LITERAL que `return` entrega para la rama CON tarjeta (100vh → 140vh, abajo) — LOOKUP POR LITERAL,
// no por interpolación, § el bloque de siempre.
//
// LOOKUP POR LITERAL, NO INTERPOLACIÓN — mismo criterio que `gridColsPresentaciones`
// (`lib/storefront/presentaciones.ts`): Tailwind escanea el TEXTO de los archivos buscando
// substrings de clase COMPLETOS; una clase construida por template literal
// (`` `min-h-[calc(100svh+${n}vh)]` ``) es invisible para el JIT porque el número nunca queda escrito
// literal en el archivo fuente. Las TRES ramas son strings completos, todas presentes en este archivo
// (la de `preview` además es LITERAL en `HeroMediaMarquesina.tsx`, en el `<section>` pineado).
//
// EL SEGUNDO PARÁMETRO — `preview` — CIERRA EL DEFECTO DE LA VISTA PREVIA DEL PANEL
// (§ HERO-FRASE-AL-PIE-Y-PREVIEW-1). El owner, sobre el panel: «la imagen de la sección "Hero de la
// home" no se está renderizando correctamente… cubre sólo una parte del marco y el resto queda en
// el fondo oscuro». MEDIDO por ARITMÉTICA de las propias clases (no una captura): el `<section>`
// pineado mide `h-[100svh]`; el ANCESTRO (`wrapperRef`, este mismo cálculo) mide `100svh+140vh` CON
// tarjeta (§ RONDA PAUSA, arriba — era `100svh+100vh` antes de esta ronda, `100svh+200vh` antes de
// RONDA SECUENCIA) o `100svh+65vh` SIN ella — la sección visible es sólo 100/240≈0.417 (CON) o
// 100/165≈0.606 (SIN) de ese total. En el storefront REAL eso es invisible: `position:sticky` PINEA
// la sección sobre el resto mientras se scrollea, así que el visitante nunca ve el tramo extra — es
// justamente el "presupuesto de scroll" (§ el bloque de arriba). Pero `VistaTiendaEnVivo`
// (`EscalaDesktop`, § su docstring) NO scrollea: mide el alto NATURAL completo del contenido sin
// escalar (`ResizeObserver` sobre `contenidoRef`) y lo escala ENTERO — así que el tramo que el
// storefront real esconde queda VISIBLE, plano, como el fondo `--sf-tinta` del propio `wrapperRef`
// sin nada pintado encima. Coincide exacto con el reporte: la media (dentro del `<section>`) cubre
// sólo una fracción del marco, y el resto es el fondo oscuro.
//
// LA SALIDA: en `preview`, el ancestro se COLAPSA al tamaño EXACTO de la sección pineada
// (`h-[100svh]`, el mismo literal que ya lleva el `<section>` — no hay recorrido que reservar
// porque no hay scroll que animar) — el marco pasa a ser UN SOLO CUADRO COMPUESTO: la media llena
// el marco entero, el marquee y la frase al pie quietos en su lugar (`estatico` ya los rinde así,
// § el resto de este archivo), sin el tramo muerto. `tieneTarjeta` deja de importar bajo `preview`
// (las dos ramas no-preview convergen a la misma clase colapsada). **El storefront REAL no cambia
// por `preview`**: `preview` es `false` ahí siempre, así que las dos ramas de siempre (140vh/65vh,
// § RONDA PAUSA para el primero) quedan intactas.
export function claseAlturaAncestroMarquesina(tieneTarjeta: boolean, preview: boolean): string {
  if (preview) return 'h-[100svh]';
  return tieneTarjeta ? 'min-h-[calc(100svh+140vh)]' : 'min-h-[calc(100svh+65vh)]';
}

// ── EL TICKER HORIZONTAL — por TIEMPO, no por scroll, § CORTE-HERO-VELO-OFF-Y-TICKER-1 ─────────────
//
// EL PEDIDO DEL OWNER, LITERAL, sobre el gate del prototipo aplicado (2026-09-27): «las letras
// empiezan a salir desde abajo, pero están continuamente desplazándose horizontalmente, como un
// aviso, no estático, cuando salen completas es que ya se empieza a navegar hacia abajo». Hasta este
// slice el desplazamiento HORIZONTAL de `HeroMediaMarquesina` estaba LIGADO al scroll
// (`transformMarquesinaTexto`, arriba) — la decisión EXPLÍCITA del spec original de `MUESTRARIO-HERO-
// MARQUESINA-STICKY-1` ("reusá el motor de scroll de `lib/animation.ts`… no agregues librería"), que
// el owner acaba de revertir con el tema real en la mano: es exactamente lo que ese spec prohibió
// reproducir. Esta sección es el reemplazo — `transformMarquesinaTexto` NO SE TOCA (sigue gobernando
// la X de `Marquesina.tsx`, la banda suelta, que también scrubea por scroll y no cambia con este
// slice); `HeroMediaMarquesina.tsx` deja de llamarla.
//
// EL EJE VERTICAL (el revelado, § `UMBRAL_REVELADO_TEXTO` arriba) SIGUE siendo por SCROLL — son DOS
// EJES, DOS MOTORES, compuestos en DOS ELEMENTOS `motion.*` distintos dentro del componente (el de
// afuera centra/revela por scroll; el de adentro, con las dos copias del texto, corre el ticker por
// tiempo) — nunca un solo `transform` armado a mano con las dos piezas concatenadas, que es como
// vivía antes (`translate(x,-50%) translateY(dy)`).
//
// MEDIDO CONTRA EL JS DEL TEMA REAL, NO SU DOCUMENTACIÓN (el spec lo pide explícito): se leyó
// `xo-webcomponents.min.js` servido por `x-cafeone.myshopify.com/cdn/shop/t/5/assets/`
// (`node --eval "fetch(...)"`, no un navegador). La clase que registra `Names.Marquee = "xo-marquee"`
// calcula la duración de la animación CSS de cada ítem en su método `setDuration()`:
//   `u = this.children[0].offsetWidth` — el ancho de UN ítem del track, en px.
//   `h = clamp(u*nd - (xoSpeed-1)*u, u, Infinity)`, con `nd = 14` (constante del bundle).
// El HTML servido (`GET /`, la sección `hero_banner_marquee`) trae
// `<xo-marquee xo-speed="1" xo-direction="ltr">` — SIN el atributo `xo-pause-on-hover`, así que cae
// al default de la clase (`xoPauseOnHover: false`): NO pausa al pasar el cursor, y esta variante
// tampoco lo implementa. Con `xoSpeed = 1`: `h = u*(14-0) = 14u` ms — la duración escala LINEAL con
// el ancho del ítem, así que la VELOCIDAD EFECTIVA (distancia/tiempo) es CONSTANTE, independiente del
// largo del texto: `u / (14u ms) = 1/14 px/ms = 1000/14 px/s ≈ 71.43 px/s`. Y
// `xo-direction="ltr"` mapea a `--xo-marquee-to:"-100%"` (la rama `"rtl"/"btt"` no aplica) — el
// mismo sentido NEGATIVO en X que ya tenía `transformMarquesinaTexto`, así que el sentido del
// desplazamiento no cambia con este slice.
export const VELOCIDAD_TICKER_PX_S = 1000 / 14;

// `duracionTickerS` — PURA, sin React: dado el ancho medido de UNA COPIA del texto (px, el ancho de
// UNO de los dos `<span>` duplicados) y la velocidad objetivo (px/s), la duración (segundos) de un
// ciclo `x: 0% → -50%` sobre un track con DOS copias idénticas. Trasladar el track la MITAD de su
// ancho total (`-50%`) mueve exactamente el ancho de UNA copia — el punto donde la segunda copia ya
// ocupa la posición inicial de la primera, cerrando el loop sin salto visible en la costura ("cuando
// la primera copia sale, la segunda ya viene", § el spec). `0` con un ancho o una velocidad no
// positivos (SSR, o antes de la primera medición del DOM) — el llamador cae a un fallback en vez de
// animar con `NaN`/`Infinity`.
export function duracionTickerS(anchoUnaCopiaPx: number, velocidadPxS: number): number {
  if (anchoUnaCopiaPx <= 0 || velocidadPxS <= 0) return 0;
  return anchoUnaCopiaPx / velocidadPxS;
}

// Fallback ANTES de la primera medición del DOM — mismo papel que `TRAVEL_FALLBACK_PX`
// (`HeroMediaMarquesina.tsx`): un texto de ancho típico (~800px) a la velocidad objetivo.
//
// "SE SOBRESCRIBE EN EL PRIMER useEffect" ERA FALSO EN LA PRÁCTICA — § CORTE-MARQUEE-VELOCIDAD-
// REAL-1 (2026-09-27), corregido en `HeroMediaMarquesina.tsx` (RONDA 5 del ticker, ver su docstring
// de cabecera para la derivación completa). El estado SÍ se corregía (`setDuracionTicker` con el
// ancho real, casi siempre ≫800px para un titular display), pero framer-motion IGNORABA ese cambio
// —sólo diffea el TARGET de `animate`, nunca `transition`, y nuestro target (`x:['0%','-50%']`) es
// el mismo literal en cada render— así que el ticker corría PARA SIEMPRE a la duración de ESTE
// fallback, ~3.2× más rápido de lo declarado. El fix (`key={duracionTicker}` en el `motion.div` del
// track) es lo que hace que "se sobrescribe" vuelva a ser cierto: sin él, este valor es el que
// SIEMPRE se ve en pantalla, no un valor transitorio antes de la medición.
//
// PARAMETRIZADO por la velocidad (§ CORTE-HERO-REVELADO-MASCARA-1, abajo) para no destellar un
// instante a la velocidad 'media' si el tema pidió 'lenta'; `DURACION_TICKER_FALLBACK_S` es el caso
// 'media' de siempre, sin cambios de valor.
export function duracionTickerFallbackS(velocidadPxS: number): number {
  return 800 / velocidadPxS;
}
export const DURACION_TICKER_FALLBACK_S = duracionTickerFallbackS(VELOCIDAD_TICKER_PX_S);

// LA VELOCIDAD ES UNA PREFERENCIA DEL OWNER, NO UNA CORRECCIÓN DE LA MEDIDA — § CORTE-HERO-REVELADO-
// MASCARA-1 (2026-09-27): sobre el gate visual de esta ronda, el owner: «la velocidad a la que van
// las letras debería ser más baja». `VELOCIDAD_TICKER_PX_S` SIGUE siendo la medida correcta contra el
// tema real (§ arriba, `xo-webcomponents.min.js`) — el owner no la corrige, pide una MÁS LENTA a
// propósito sobre una medición que ya está bien. Por eso esa constante NO se toca; se agrega una
// SEGUNDA, EXPLÍCITAMENTE ELEGIDA (no medida contra nada), y el eje pasa a ser un escalar de tema
// (`hero.tickerVelocidad`, mismo mecanismo que `veloIntensidad` arriba, § site-content-defaults.ts) —
// así la próxima vez que el owner pida otro ajuste de velocidad es un valor de contenido, no un
// segundo slice tocando código.
//
// `VELOCIDAD_TICKER_LENTA_PX_S` nació en 0.6× la medida — una fracción redonda, ELEGIDA, no derivada
// de ninguna medición (no hay un "tema real más lento" contra qué medirla).
//
// SUBE A 0.7× — § CORTE-HERO-MARQUEE-RONDA-5-1 (2026-09-27): el owner, sobre el gate visual de RONDA
// 4 ya reaplicada: «ahora quedaron lentas las letras, subele sólo un poco la velocidad». Es un
// ajuste MODERADO, no un salto a la medida (1.0×): 0.7 sigue siendo más lento que
// `VELOCIDAD_TICKER_PX_S`, sólo que menos lento que el 0.6 de antes — queda ESTRICTAMENTE entre las
// dos, como pide el spec. `hero.tickerVelocidad:'lenta'` (§ site-content-defaults.ts) sigue
// resolviendo a ESTA constante sin cambiar de mecanismo: sólo cambia el número.
//
// ÚNICO CONSUMIDOR, verificado antes de tocarla (`grep -rn "heroTickerVelocidad" lib/config/
// themes.ts`): CORTE es la ÚNICA entrada del catálogo que declara `heroTickerVelocidad:'lenta'` — el
// cambio de fracción no le llega a ningún otro preset.
export const VELOCIDAD_TICKER_LENTA_PX_S = VELOCIDAD_TICKER_PX_S * 0.7;

// Ausente/vacío/basura → la velocidad MEDIDA ('media'); 'lenta' → la preferencia del owner. Segunda
// guarda defensiva, como `rangoVeloDeIntensidad` — el resolver de contenido (`REGISTRY.hero.
// escalares.tickerVelocidad`) ya clampa el valor guardado antes de que llegue acá.
export function velocidadTickerPxS(velocidad: string): number {
  return velocidad === 'lenta' ? VELOCIDAD_TICKER_LENTA_PX_S : VELOCIDAD_TICKER_PX_S;
}

// ── EL CONTADOR — el count-up de la banda ORIGEN, § ORIGEN-BANDA-1 ───────────────────────────────
//
// El prototipo (`docs/prototipos/cafeone/js/home.js:311-332`) anima sus tres estadísticas
// ("1.600 msnm promedio", "12 hectáreas sembradas", "52 años de tradición") con un IntersectionObserver
// que dispara UNA vez al 40% visible y un loop de `requestAnimationFrame` de 1100ms con ease-out
// cúbica. Medido: ORIGEN-BANDA-CENSO-1 — el repo no tenía precedente de esto (cero
// `requestAnimationFrame`/CountUp antes de este slice).
export const DURACION_CONTADOR_MS = 1100;

// `valorContador` reproduce, PURA y sin React, el cálculo de `js/home.js:320-327`
// (`k = min(1,(now-t0)/dur)`, `eased = 1-(1-k)^3`, valor = destino*eased). Separada del hook por el
// MISMO criterio que `transformAcomodo`: poder testearla en `node:test` sin navegador.
export function valorContador(destino: number, progreso: number): number {
  const k = Math.max(0, Math.min(1, progreso));
  const eased = 1 - Math.pow(1 - k, 3);
  return destino * eased;
}

export interface ContadorAnimado {
  // `HTMLDivElement`, no `HTMLElement` — § ORIGEN-FOTOS-REVELADO-Y-CONTEO-1: `OrigenContador` (el
  // único consumidor) adjunta este `ref` a un `motion.div` (el mismo nodo que la animación de
  // entrada), y TypeScript trata `RefObject<T>` como INVARIANTE en `.current` — un
  // `RefObject<HTMLElement|null>` no es asignable al `ref` de un `<div>` aunque `HTMLDivElement`
  // extienda `HTMLElement` (`tsc` lo rechaza: "Property 'align' is missing…"). Antes de este slice el
  // tipo daba igual porque el `ref` NUNCA se adjuntaba a nada — ésa era la mitad del bug del conteo.
  ref: RefObject<HTMLDivElement | null>;
  valor: number;
}

// `useContadorAnimado` — monta `valorContador` sobre un IntersectionObserver (dispara UNA vez, al
// 40% visible, como el prototipo) + un loop de rAF sobre `DURACION_CONTADOR_MS`.
//
// `estatico` es el GATE ÚNICO, decidido por el llamador — MISMO criterio que `estatico` de
// `transformAcomodo`/`BrandStoryCentrada` (`preview || !!useReducedMotion()`): con `estatico=true`
// el valor nace YA en `destino`, sin observer ni rAF. Dos razones lo piden, ninguna nueva en este
// repo: `prefers-reduced-motion` (ni "a medio contar" bajo esa preferencia, un número que salta de
// golpe a su valor final ya ES la lectura correcta — no hay equivalente a "acomodado y quieto" para
// un contador, el número simplemente no cuenta), y la VISTA PREVIA del editor de `/admin/tienda`
// (`useIsPreview`, el patrón que `BrandStory`/`GrindChooser`/`Spotlight` ya siguen): dentro de
// `EscalaDesktop` (`transform:scale`) un `IntersectionObserver` puede no disparar — medido:
// ORIGEN-BANDA-CENSO-1 —, así que el preview no puede depender de él para mostrar un número.
export function useContadorAnimado(destino: number, estatico: boolean): ContadorAnimado {
  const ref = useRef<HTMLDivElement | null>(null);
  const [valor, setValor] = useState(estatico ? destino : 0);
  const disparado = useRef(false);

  useEffect(() => {
    if (estatico) {
      setValor(destino);
      return;
    }
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setValor(destino);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting || disparado.current) return;
          disparado.current = true;
          io.unobserve(entry.target);
          const t0 = performance.now();
          const paso = (now: number) => {
            const progreso = (now - t0) / DURACION_CONTADOR_MS;
            setValor(valorContador(destino, progreso));
            if (progreso < 1) requestAnimationFrame(paso);
          };
          requestAnimationFrame(paso);
        });
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destino, estatico]);

  return { ref, valor };
}

// ── EL ÍNDICE CENTRADO DE UN RIEL — RETIRADO, § RIEL-PRODUCTOS-Y-VISTA-RAPIDA-1 ───────────────────
//
// `indiceCentrado`/`useIndiceCentrado` (MUESTRARIO-RIEL-ACTIVO-1) reproducían el resaltado de la
// tarjeta CENTRADA del riel (`.pres-card.is-active`, escala + dimmed en las demás). El owner, sobre
// el gate visual de esta composición ya aplicada: «la segunda tarjeta está todo el tiempo "activa"
// por lo que se ve más grande, el efecto debería ser, cada vez que haga hover sobre la tarjeta me
// muestre la otra foto». Se RETIRÓ el resaltado por-scroll a favor de un hover POR TARJETA (la foto
// de atrás del propio producto, § GrindChooserRiel.tsx) — `useIndiceCentrado` se quedó sin su único
// consumidor (verificado: `grep -rln useIndiceCentrado` fuera de este archivo y su test daba sólo
// `GrindChooserRiel.tsx`) y se retiró con él, junto con `indiceCentrado` (su única función interna).

// ── LA DIRECCIÓN DEL SCROLL DEL NAV — CROMO-NAV-DIRECCION-SCROLL-1 ────────────────────────────────
//
// EL PEDIDO DEL OWNER, LITERAL: «el nav debe aparecer/cambiar de color cuando alguien empiece a hacer
// scroll hacia arriba. De hecho en CAFEONE cuando alguien hace scroll hacia abajo el nav de la página
// se oculta». Es un eje del TEMA — sólo CORTE lo declara (§ `NavTratamientoContent.direccion`,
// `site-content-defaults.ts`); todo otro preset, Nayoli incluida, conserva el nav de HOY byte a byte.
//
// MEDIDO CONTRA EL TEMA REAL (`https://x-cafeone.myshopify.com/`, fetched 2026-09-27), NO el
// prototipo local: el prototipo capturado (`docs/prototipos/cafeone/js/app.js:275-286`,
// `initHeader()`) sólo alterna `.is-solid` con `window.scrollY > 80` — NO oculta nada por dirección;
// el prototipo no cubre este comportamiento. El sitio real corre un theme de Shopify OS 2.0 con el
// web component `xo-sticky` (`.../cdn/shop/t/5/assets/xo-webcomponents.min.js`, la clase que define
// `handleStickyTop`), cuyo default es `xoDirection:"up"`:
//   - `c = window.scrollY < this.prevScrollY` — la dirección se recalcula en CADA frame de scroll,
//     comparando sólo contra el frame anterior. SIN mínimo de movimiento: la única guarda que corre
//     antes es `window.scrollY !== this.prevScrollY`, que no filtra por magnitud — 1px hacia arriba
//     ya cuenta como "subiendo". No hay debounce que inventar: el tema real no lo tiene.
//   - el hide/reveal por dirección SÓLO se activa una vez que el scroll pasó la altura PROPIA del
//     header (`e < i - t`, con `t` = alto del header e `i` = 0 para un header suelto sin otros
//     `xo-sticky` apilados encima) — bajo ese umbral el header queda SIEMPRE en su posición normal,
//     visible, sin importar la dirección: es el "arriba del todo manda el tratamiento de hoy" del
//     spec.
//   - SUBIENDO, sobre el umbral: `translate3d(0,0,0)` (visible) de inmediato, sin esperar a volver a
//     cruzar ningún otro punto. BAJANDO, sobre el umbral: `translateY(-(t+i))` (oculto, corrido su
//     propia altura hacia arriba).
//
// `UMBRAL_OCULTAR_NAV` traduce ese umbral medido (la altura del header) a un número fijo: 80px — el
// MISMO valor que ya usa `initHeader()` del prototipo local para su propio corte sólido/transparente
// (`window.scrollY > 80`, arriba), lo que da confianza de que aproxima bien la altura real de este
// header. Se mantiene SEPARADO del umbral de 20px que ya gobierna `scrolled` en `StoreNav.tsx` (el
// color sólido de HOY) — DELIBERADO, no un descuido: la doctrina de este repo (§ CLAUDE.md, "un
// umbral que gobierna DOS comportamientos distintos es la FORMA del bug") pide un número nombrado
// por pregunta, no reciclar uno. Y como 80 > 20, para cuando el nav puede empezar a ocultarse YA
// está en su tratamiento sólido (`scrolled` ya es `true`) — "cambia de tratamiento" (el pedido del
// owner, resuelto "con el sistema de tratamiento que ya existe") sale GRATIS de reusar `scrolled`,
// sin inventar un color literal nuevo.
export const UMBRAL_OCULTAR_NAV = 80;

export type DireccionScroll = 'arriba' | 'abajo';

/** `direccionScroll` — pura, sin DOM: dado el scrollY actual y el del frame de scroll anterior, la
 *  dirección. SIN mínimo de movimiento (medido contra el tema real, arriba): 1px de diferencia ya
 *  cuenta — replica `window.scrollY < this.prevScrollY` del web component real. Un empate (mismo
 *  valor, p. ej. el primer frame) cae a `'abajo'`: no hay evidencia de que el visitante haya subido. */
export function direccionScroll(scrollYActual: number, scrollYAnterior: number): DireccionScroll {
  return scrollYActual < scrollYAnterior ? 'arriba' : 'abajo';
}

/** `navOculto` — ¿debe el encabezado traducirse fuera de vista? `false` SIEMPRE bajo
 *  `UMBRAL_OCULTAR_NAV` (el "arriba del todo" del spec — replica el `e >= i` del tema real: cerca
 *  del tope, sin sticky, sin ocultar, sin importar la dirección). Sobre el umbral, oculta BAJANDO y
 *  muestra SUBIENDO — el mismo `xoDirection:"up"` medido arriba. NO decide sola: el llamador
 *  (`StoreNav.tsx`) además fuerza `false` si el foco del teclado está dentro del nav, o si el drawer
 *  móvil/la búsqueda/el panel desplegable están abiertos — esta función sólo conoce el scroll, no el
 *  resto del estado de la UI (§ el docstring de `StoreNav.tsx` para el porqué de cada gate). */
export function navOculto(scrollY: number, direccion: DireccionScroll): boolean {
  return scrollY >= UMBRAL_OCULTAR_NAV && direccion === 'abajo';
}

// ── EL DESTELLO DEL TRATAMIENTO AL BAJAR — CROMO-NAV-SIN-DESTELLO-1 ────────────────────────────────
//
// EL PEDIDO DEL OWNER, LITERAL, sobre el gate de `CROMO-NAV-DIRECCION-SCROLL-1`: «cuando empiezo a
// hacer scroll para bajar está saliendo el nav en verde. El efecto debería ser: a medida que voy
// haciendo scroll el nav se va ocultando, sin cambiar de color, y van saliendo las letras del
// marquee, son como dos cosas que pasan al tiempo».
//
// MEDIDO, no supuesto — las DOS condiciones que producían el destello son INDEPENDIENTES entre sí:
// `StoreNav.tsx` resolvía el tratamiento (flotante/sólido) contra `scrolled = scrollY > 20`, evaluado
// en CADA frame de scroll sin mirar la dirección, mientras que `navOculto` (arriba) sólo empieza a
// ocultar en `UMBRAL_OCULTAR_NAV` (80px) y sólo bajando. Bajando desde el tope: el tratamiento cae a
// SÓLIDO en scrollY=21 (un píxel después de que `scrolled` se vuelve `true`) y el header recién se
// oculta en scrollY=80 — una VENTANA VISIBLE de **21 a 79px (59px)** donde el nav ya es sólido pero
// todavía no se tradujo fuera de vista. Ésa es la forma exacta del destello: dos pasos donde el owner
// pide uno solo.
//
// LA SALIDA NO ES UN CAMPO NUEVO — `navTratamiento.direccion` ya existe (§ `CROMO-NAV-DIRECCION-
// SCROLL-1`) y sigue siendo el único eje que declara esto. Lo que cambia es CUÁNDO `StoreNav.tsx`
// re-evalúa `scrolled`, no QUÉ se declara: `debeActualizarTratamientoNav` decide si el frame de scroll
// ACTUAL debe re-evaluar el umbral de 20px o CONGELAR el valor que ya tenía.
//   - BAJANDO: se congela. El tratamiento que el header tenía ANTES de empezar a bajar es el mismo
//     que lleva mientras se traduce fuera de vista — "sin cambiar de tratamiento" es literal, no una
//     aproximación. Si nunca llega a ocultarse (el visitante no pasa de 80px), simplemente sigue
//     mostrando el tratamiento de antes; no hay un estado intermedio que mostrar.
//   - SUBIENDO: se re-evalúa SIEMPRE, en cada frame — el mismo comportamiento que `scrolled` ya tenía
//     antes de este slice. Es lo que hace que el header REAPAREZCA ya con el tratamiento que le
//     corresponde (§ el pedido YA resuelto de `CROMO-NAV-DIRECCION-SCROLL-1`, que este slice no toca):
//     "el cambio de color queda reservado para cuando reaparece al subir".
//
// `direccionActiva:false` (todo preset salvo el que declare el eje, hoy sólo CORTE) → SIEMPRE `true`
// → BYTE-IDÉNTICO: `scrolled` se re-evalúa en cada frame de scroll exactamente como antes de este
// slice, para cualquier tenant que no declare `navTratamiento.direccion`.
export function debeActualizarTratamientoNav(direccionActiva: boolean, direccion: DireccionScroll): boolean {
  return !direccionActiva || direccion === 'arriba';
}

// ReducedMotionProvider — STOREFRONT-REDUCED-MOTION-1 (2026-09-12).
//
// EL DEFECTO: las ~21 animaciones de entrada del storefront (censadas en
// TEMAS-P4-MOVIMIENTO-CENSO-1) ignoraban `prefers-reduced-motion`. Se verificaron
// las DOS piezas que parecían cubrirlo y NINGUNA lo hacía:
//   - el guard global de `app/globals.css:247` neutraliza `animation-duration` y
//     `transition-duration` de CSS — framer-motion no anima por ahí, escribe estilos
//     inline vía WAAPI/motion values, así que ese guard lo esquiva por construcción.
//   - `NosotrosGaleria.tsx:31` ya usa `useReducedMotion()`, pero para decidir si
//     REPRODUCE UN VIDEO, no para apagar una animación de entrada — es precedente del
//     HOOK, no de la guarda que faltaba.
//
// LA SALIDA, medida antes de tocar los 12 archivos censados: `<MotionConfig
// reducedMotion="user">` (framer-motion ^12.38.0, instalado 12.40.0). Leído en
// `node_modules/motion-dom/dist/cjs/index.js`: con la preferencia del sistema activa,
// TODA animación de un componente `motion.*` que toque un valor de TRANSFORM (x, y,
// scale, rotate — `positionalKeys`) se fija al target EN EL ACTO (`{ type: false }` →
// `makeAnimationInstant`); los valores que NO son transform (opacity, color…) siguen
// animando con su transición normal. Para `fadeUp` eso es EXACTAMENTE la semántica
// correcta — "aparece sin desplazarse", no "no aparece": el `y: 24 → 0` salta, el
// `opacity: 0 → 1` sigue su fade.
//
// Es el MISMO mecanismo (`animateTarget` → `animateMotionValue`) que usan `whileInView`,
// `initial`/`animate` y `AnimatePresence`, así que el bounce en bucle de la flecha del
// hero (`HeroCurtina.tsx`, `animate={{ y: [0,8,0] }}`) también se apaga: `y` es
// transform, y bajo reduced-motion su transición se reemplaza entera —el `repeat:
// Infinity` incluido— por el salto instantáneo.
//
// LO QUE NO CUBRE, para no declarar un remedio total que es parcial:
//   - `staggerChildren`/`delayChildren` es un RETRASO DE PROGRAMACIÓN entre hijos, no
//     un valor animado — MotionConfig no lo toca. Con la preferencia activa, los hijos
//     de una lista con stagger siguen apareciendo en cascada TEMPORAL (uno tras otro),
//     sólo que cada uno funde su opacidad en vez de deslizarse. No es un desplazamiento
//     espacial, pero sigue siendo una secuencia en el tiempo.
//   - Cualquier animación que NO pase por un componente `motion.*` (una transición CSS
//     de Tailwind, un `<video autoplay>`) sigue siendo del guard de `globals.css` o de
//     su propio guard — no de este provider.
//
// Se monta UNA vez en `app/(storefront)/layout.tsx`, envolviendo todo el árbol del
// storefront: cubre los 21 sitios de hoy y cualquier `motion.*` que se agregue después
// sin que ese componente tenga que acordarse de nada.
export function ReducedMotionProvider({ children }: { children: ReactNode }) {
  return createElement(MotionConfig, { reducedMotion: "user" }, children);
}

// ── LA ENTRADA DE PÁGINA — § TRANSICION-ENTRE-PAGINAS-1 ───────────────────────────────────────────
//
// EL PEDIDO DEL OWNER: «al cambiar de página… el contenido entra progresivamente (como el revelado
// del prototipo) en vez de aparecer de golpe». El target es `[data-reveal-group]` del prototipo
// (`docs/prototipos/cafeone/css/app.css:948-958`): opacidad 0→1 + `translateY(28px)→none`,
// escalonado por hijo directo (`:nth-child(N)` con `transition-delay` en pasos de 90ms —
// `app.css:954-958`), sobre `--duration-reveal:600ms`/`--ease-reveal:var(--ease-out)=cubic-
// bezier(.22,.61,.36,1)` (`docs/prototipos/cafeone/css/tokens.css:189,213-214`).
//
// DISPARADO AL MONTAR, NO AL ENTRAR EN VIEWPORT — a diferencia del prototipo (que usa
// `IntersectionObserver` para revelar al hacer scroll, § `initReveal`, `js/app.js:167-181`), acá el
// evento es "la página cambió": `app/(storefront)/template.tsx` REMONTA en cada navegación (a
// diferencia de `layout.tsx`, que persiste), así que el remount ES el disparo — no hace falta
// observar el scroll para saber cuándo jugar la animación.
//
// POR ESO ES CSS PURO, SIN JS: la regla vive en un `<style>` inyectado por el propio componente
// (`EntradaPagina.tsx`, generado por `cssRevelaPagina` de acá abajo — MISMO patrón que `cssPaleta`/
// `cssFuentes`/`cssForma`, server-rendered, sin flash). El spec lo exige explícito: "sin retrasar el
// primer pintado… el HTML llega visible si el JS no corre". Un mecanismo `IntersectionObserver` (como
// el del prototipo) depende de que el JS corra para agregar la clase que revela — roto, el contenido
// quedaría oculto para siempre. Una `animation` CSS declarada en el propio `@keyframes` no depende de
// nada: si el CSS se aplica, juega sola; si por algo no se aplicara, no hay un `opacity:0` de base que
// pudiera quedar huérfano (el `opacity:0` vive DENTRO de la regla que también declara la animación).
//
// `prefers-reduced-motion` no necesita un guard propio: el guard GLOBAL de `app/globals.css`
// (`*,*::before,*::after{animation-duration:0.01ms!important;animation-iteration-count:1!important}`)
// ya neutraliza CUALQUIER `animation-duration` declarada en cualquier hoja — incluida ésta, inyectada
// en runtime —, así que bajo esa preferencia el contenido aparece casi al instante (una iteración
// completa a 0.01ms, `both` deja el estado FINAL) en vez de quedar a medio revelar.
export const REVELADO_PAGINA_DURACION_MS = 600;
export const REVELADO_PAGINA_TRASLADO_PX = 28;
export const REVELADO_PAGINA_EASE = "cubic-bezier(0.22, 0.61, 0.36, 1)";
export const REVELADO_PAGINA_PASO_MS = 90;

// El prototipo sólo declara `:nth-child(1..5)` (`app.css:954-958`) porque sus grupos de ejemplo no
// pasan de 5 ítems. Acá el consumidor es LA PÁGINA ENTERA — la home llega a `BANDA_IDS.length`
// bloques de primer nivel (hoy 9) — así que el paso se EXTIENDE a ese tope en vez de dejar los
// bloques 6+ sin regla (sin `animation-delay` explícito caería a 0ms: entrarían todos junto con el
// primero). `BANDA_IDS.length`, no un literal, para que un bloque nuevo de la home no vuelva a dejar
// esta lista corta sin que nadie lo note.
const REVELADO_PAGINA_TOPE_HIJOS = BANDA_IDS.length;

// `cssRevelaPagina` — el texto CSS completo (keyframes + la regla base + el escalonado por
// `:nth-child`), PURO, para poder afirmar sus valores en `node:test` sin DOM. `EntradaPagina.tsx` lo
// inyecta en un `<style>` server-rendered; esta función no toca React.
export function cssRevelaPagina(): string {
  const base =
    `[data-entrada-pagina]>*{opacity:0;transform:translateY(${REVELADO_PAGINA_TRASLADO_PX}px);` +
    `animation:sf-entrada-pagina ${REVELADO_PAGINA_DURACION_MS}ms ${REVELADO_PAGINA_EASE} both}`;
  const keyframes = `@keyframes sf-entrada-pagina{to{opacity:1;transform:none}}`;
  const pasos = Array.from(
    { length: REVELADO_PAGINA_TOPE_HIJOS },
    (_, i) => `[data-entrada-pagina]>*:nth-child(${i + 1}){animation-delay:${i * REVELADO_PAGINA_PASO_MS}ms}`,
  ).join("");
  return base + keyframes + pasos;
}

// ── EL CIERRE del drawer móvil RECORRE la entrada EN REVERSA — § MENU-MOVIL-CIERRE-DESLIZANDO-1 ──
//
// Gate del owner tras MENU-MOVIL-MARGEN-Y-CENSO-TRANSICIONES-1 (ese slice ya había medido, cuadro a
// cuadro en Chromium, que el PANEL del drawer `pantallaCompleta` de CORTE SÍ se desvanecía al cerrar
// —opacity 1→0 en ~220ms—; lo que arregló fue Escape/foco): *"cuando se colapsa el sidebar en la
// vista móvil, no tiene efecto de transición y cierra de golpe."* Medido de nuevo para este slice,
// en WebKit con perfil de iPhone 15 Y en Chromium móvil, cuadro a cuadro (computed style) Y por
// PÍXELES reales de pantalla (screenshot + luminosidad promedio, para no confiar sólo en que
// framer-motion sigue ESCRIBIENDO el estilo cada frame — eso no prueba que el navegador lo PINTE):
// en los dos motores, por las tres salidas (X, Esc, enlace), el PANEL YA fade+desliza simétrico a su
// propia entrada (opacity 0,y:-8 → 1,0 al abrir; 1,0 → 0,y:-8 al cerrar, mismos 220ms, misma curva) —
// confirmado también por píxeles reales (la luminosidad del área del panel cae gradualmente, no en
// un solo salto). Ningún "golpe" reproducible ahí, en ninguno de los dos motores.
//
// LA ASIMETRÍA REAL es la de los ÍTEMS: `ENTRADA_ESCALONADA_DRAWER` (`StoreNav.tsx`) sólo declaraba
// `hidden`/`visible` — cada fila entra deslizándose 14px con un paso escalonado de 420ms por ítem,
// pero al cerrar no tenía variante `exit` propia, así que se apagaba ÚNICAMENTE por el fade del
// PANEL (8px/220ms) y nunca ejercía su propio desplazamiento de 14px/420ms. Es la pieza que no
// "recorría la entrada en reversa" en el sentido literal del gate — misma propiedad (opacity+y),
// misma distancia y misma duración/curva que la entrada, pero el STAGGER invertido por índice: el
// ítem que apareció ÚLTIMO es el PRIMERO en retirarse, deshaciendo la cascada en el orden exacto
// opuesto al que la construyó. `retardoSalidaDrawerMovil`/`retardoEntradaDrawerMovil` son las dos
// mitades del mismo cálculo —comparten paso y constantes— para que un ajuste futuro al paso no
// pueda mover una sin la otra.
export const DRAWER_MOVIL_DISTANCIA_PX = 14;
export const DRAWER_MOVIL_DURACION_S = 0.42;
export const DRAWER_MOVIL_EASE: [number, number, number, number] = [0.22, 0.61, 0.36, 1];
export const DRAWER_MOVIL_PASO_S = 0.06;
export const DRAWER_MOVIL_BASE_S = 0.08;

export function retardoEntradaDrawerMovil(indice: number): number {
  return indice * DRAWER_MOVIL_PASO_S + DRAWER_MOVIL_BASE_S;
}

export function retardoSalidaDrawerMovil(indice: number, total: number): number {
  return (total - 1 - indice) * DRAWER_MOVIL_PASO_S;
}

// ── LA CASCADA DE BLOQUES — § ORIGEN-TEXTO-POR-BLOQUE-1 (reemplaza a la cascada de palabras de
// ORIGEN-TEXTO-EN-CASCADA-1) ───────────────────────────────────────────────────────────────────
//
// Gate del owner sobre el resultado de esa tanda: *"La animación no me supe explicar y
// efectivamente hazla por bloque de texto."* — la cascada por PALABRA se retira; `TextoEnCascada`
// deja de tokenizar y pasa a ser UN bloque (el texto ENTERO) por instancia, el mecanismo que
// ORIGEN-TEXTO-EN-CASCADA-1 ya había leído de `xo-webcomponents.min.js` pero no reusaba (ese
// slice reusaba a propósito `REVELADO_GRUPO_DURACION_S`/`REVELADO_GRUPO_EASE`, por consistencia
// con el resto de los reveals — ver su commit). Esta tanda SÍ pide las cifras medidas.
//
// RE-MEDIDO por EJECUCIÓN, no releído de memoria: `window.settings` embebido en
// `.scratch/refs/cafeone-home.html` (la página viva, la misma usada por ORIGEN-TEXTO-EN-CASCADA-1)
// trae `animate_duration: 500`, `animate_effect: 'fade-up'`, `animate_strength: 1` — los TRES
// iguales a los defaults que el propio `xo-webcomponents.min.js` ya declara (`xoDuration` cae a
// 500 y `xoType` a `'fade-up'` si `window.settings` no los trae), así que SHARED MOMENTS corre con
// esos tres valores de fábrica o explícitos, da igual. `xoEasing:"easeLight"` es un LITERAL fijo
// en el JS —NO viene de `window.settings`, no es configurable por tema— que el mapa de nombres de
// easing del mismo bundle resuelve a `cubic-bezier(0, 0, 0.3, 1)`. Y `xoConstant` (el paso del
// escalonado entre hermanos, asignado por el `IntersectionObserver` compartido vía `--xo-order`)
// es **75, también literal en el JS**. El keyframe `xo-fade-up` (`xo-webcomponents.min.css`) anima
// `opacity:0→1` junto a `transform:translate3d(0, calc(var(--xo-strength) * 30%), 0) → none` — con
// `--xo-strength:1`, un `translateY(30%)` de la propia caja del bloque, no un píxel fijo.
//
// LAS CUATRO CIFRAS DE ESTA TANDA SON LAS MEDIDAS DE XO-CASCADE, NO LAS DEL STOREFRONT — a
// diferencia de `transicionPalabra` (retirada, con esta tanda, junto a `palabrasDeTexto`/
// `TokenCascada`/`CASCADA_PALABRA_*`: nada más los usaba — censo: sólo `Origen.tsx`,
// `TextoEnCascada.tsx` y sus dos archivos de test — dejarlos vivos sería código muerto), el spec
// de esta tanda pide explícitamente "las propiedades, duración, curva y escalonado que ese slice
// midió de `xo-cascade`": 500ms, `cubic-bezier(0,0,.3,1)`, 75ms de paso, `opacity 0→1` +
// `translateY(30%)→0%`.
export const CASCADA_BLOQUE_DURACION_S = 0.5;
export const CASCADA_BLOQUE_EASE: [number, number, number, number] = [0, 0, 0.3, 1];
export const CASCADA_BLOQUE_PASO_S = 0.075;

// `fadeUpCascadaBloque` es el GEMELO de `fadeUp` para esta cascada — NO SE REUSA `fadeUp` porque
// su magnitud (24px fijos, § el docstring de `fadeUp` arriba) es la convención de ESTE storefront
// para tarjetas/texto de cuerpo, mientras que acá la cifra a replicar es la de Cafeone: un
// PORCENTAJE de la propia caja del bloque (30%, `--xo-strength:1`). Mismo principio que
// `transformRevelaTextoDisplay` ya aplica al marquee del hero: un `translateY(N%)` escala con el
// tamaño del propio bloque, nunca se vuelve a vencer en otra escala tipográfica.
export const fadeUpCascadaBloque = { hidden: { opacity: 0, y: "30%" }, visible: { opacity: 1, y: "0%" } };

export function transicionBloqueCascada(indice: number): { duration: number; ease: [number, number, number, number]; delay: number } {
  return {
    duration: CASCADA_BLOQUE_DURACION_S,
    ease: CASCADA_BLOQUE_EASE,
    delay: indice * CASCADA_BLOQUE_PASO_S,
  };
}

// ── EL REVELADO DE LA POSTAL DE SUSCRIPCIÓN — § SUSCRIPCION-TITULO-Y-RECARGA-1 ───────────────────
//
// Gate del owner tras `SUSCRIPCION-POSTAL-DE-CIERRE-1` (el alto/escala/composición de la franja ya
// aplicados): aprobó la transición propuesta para el título — *"sube desde detrás de una línea"*
// (revelado con máscara) — y que el eyebrow y el botón entren DESPUÉS con un desvanecimiento
// escalonado, DISTINTO de la cascada por palabras de `TextoEnCascada` (§ ORIGEN-TEXTO-EN-CASCADA-1):
// acá no hay palabras que tokenizar — el título es UN bloque que se revela por máscara, y el
// eyebrow/botón son dos HERMANOS que se desvanecen con un paso entre ellos, el mismo patrón de
// `transicionEscalonada` (fotos/filas/cifras de Origen) aplicado a esta sección.
//
// `revelaMascaraVertical` es la MISMA construcción que `transformRevelaTextoDisplay`/
// `UMBRAL_REVELADO_TEXTO` ya usan para el marquee del hero (§ "EL REVELADO ENMASCARADO", arriba): el
// texto vive dentro de un contenedor `overflow:hidden` del alto de su propia caja, y se traslada un
// PORCENTAJE de esa caja — 100% (fuera, bajo el borde inferior de la máscara) en reposo, 0% (en su
// lugar) revelado. NO ES LA MISMA FUNCIÓN: aquélla es SCROLL-SCRUBBED (`useTransform` sobre un
// progreso continuo de `useScroll`, re-evaluada en cada frame de scroll); ésta es un DISPARO ÚNICO
// por viewport (`whileInView`/`variants`, como `fadeUp`), consistente con el resto de los reveals de
// esta sección (§ SUSCRIPCION-POSTAL-DE-CIERRE-1 ya monta su bloque entero así). Por eso es una
// variante de `variants` —no una función `transform*DeProgreso`— y no reusa `transformRevelaTexto-
// Display`: no hay progreso de scroll que leer acá, el disparador es "entró en vista", el mismo que
// ya usa `fadeUp` en ~20 secciones.
//
// SIN OPACIDAD: a diferencia de `fadeUp`, esto traslada SIN desvanecer — el texto no existe
// visualmente ANTES de cruzar el borde de la máscara (recortado), no que exista pero transparente
// (la misma distinción que el docstring de `transformRevelaTextoDisplay` ya hace: "antes del borde,
// el texto NO EXISTE visualmente… no que exista pero transparente"). Es la pieza que hace que "sube
// desde atrás de una línea" se vea distinto de un fundido.
export const revelaMascaraVertical = { hidden: { y: "100%" }, visible: { y: "0%" } };

/**
 * El título entra PRIMERO, sin retraso — el resto de la postal espera a que termine (ver
 * `transicionFadePostal`, abajo). Reusa `REVELADO_GRUPO_DURACION_S`/`REVELADO_GRUPO_EASE`: son los
 * tokens de movimiento YA establecidos de este storefront (el mismo revelado de Origen), y un
 * título no tiene motivo para entrar con una curva distinta de una foto o una cifra.
 */
export function transicionTituloPostal(): { duration: number; ease: [number, number, number, number]; delay: number } {
  return { duration: REVELADO_GRUPO_DURACION_S, ease: REVELADO_GRUPO_EASE, delay: 0 };
}

/**
 * El eyebrow (`indice=0`) y el botón (`indice=1`) se desvanecen DESPUÉS de que el título termina de
 * subir — el retraso arranca en `REVELADO_GRUPO_DURACION_S` (cuando el título ya está en su lugar), y
 * cada hermano siguiente suma UN paso más (`REVELADO_GRUPO_PASO_S`, el mismo paso de 90ms que ya usa
 * `transicionEscalonada` para los grupos de Origen) — el escalonado que el spec pide entre ellos DOS,
 * no entre palabras.
 */
export function transicionFadePostal(indice: number): { duration: number; ease: [number, number, number, number]; delay: number } {
  return {
    duration: REVELADO_GRUPO_DURACION_S,
    ease: REVELADO_GRUPO_EASE,
    delay: REVELADO_GRUPO_DURACION_S + indice * REVELADO_GRUPO_PASO_S,
  };
}

// ── EL FUNDIDO CRUZADO DEL DESTACADO — § DESTACADO-NOMBRE-GRUPO-Y-TRANSICION-1 ────────────────────
//
// Gate del owner tras DESTACADO-PRESENTACION-POR-TAMANO-1: «se produce un cambio brusco entre
// saltos [al elegir otra presentación o tamaño]... lo ideal sería que cambie la imagen con su texto
// solamente, pero que la transición sea suave». `Spotlight.tsx` reemplaza la foto/etiqueta/precio de
// golpe (un `<Image src=…>` que cambia de `src` sin más) por un fundido cruzado vía
// `AnimatePresence`+`motion.div` apilados (`position:absolute`, dentro de un contenedor de alto FIJO
// — § `aspect-[3/4]` — así que el fundido nunca mueve el alto de la sección).
//
// LA CURVA ES LA ÚNICA QUE GOBIERNA TODO EL MOVIMIENTO DE CORTE — `[0.22,0.61,0.36,1]`, la MISMA que
// `REVELADO_GRUPO_EASE`/`REVELADO_PAGINA_EASE` (arriba) Y la que `GaleriaProducto.tsx` ya usa,
// inline, para el swap de foto del detalle de producto (`duration:0.22, ease:[0.22,0.61,0.36,1]`,
// su propio comentario: "LOS TOKENS DE CORTE"). No se inventa una curva nueva.
//
// LA DURACIÓN DE LA FOTO REUSA, LITERAL, la ya medida para ESE MISMO GESTO — "cambiar la imagen de un
// producto por una elección del visitante" (GaleriaProducto.tsx, flechas de la galería del PDP) —, no
// la de 0.6s de un reveal por SCROLL (`REVELADO_GRUPO_DURACION_S`): son disparadores distintos (un
// clic contra el viewport entrando en vista), y copiar el token de scroll habría sido la MISMA
// confusión que esa sección ya advierte para `fadeUp` ("se diseñó para OTRO disparador, no se
// reusa sin medir"). La etiqueta y el precio son texto PUNTUAL —no la superficie que el ojo sigue—,
// así que su fundido es la MITAD de corto.
export const TRANSICION_DESTACADO_EASE: [number, number, number, number] = [0.22, 0.61, 0.36, 1];
export const TRANSICION_DESTACADO_FOTO_DURACION_S = 0.22;
export const TRANSICION_DESTACADO_TEXTO_DURACION_S = TRANSICION_DESTACADO_FOTO_DURACION_S / 2;

/** `estatico` (reduced-motion, el MISMO gate que `transformAcomodo`/`veloOpacidad`: "movimiento
 *  reducido: cambio directo" del spec) rinde `duration:0`. `AnimatePresence` sigue montando la
 *  transición de salida/entrada (no se desactiva el mecanismo, se colapsa su duración a 0) — el
 *  efecto visible es el swap directo que el spec pide, sin bifurcar el árbol de JSX entre dos
 *  implementaciones. Mismo criterio que `transformMarquesinaTarjeta(progreso, estatico)`: `estatico`
 *  cambia el VALOR que la función devuelve, no la forma del componente que la consume. */
export function transicionDestacadoFoto(estatico: boolean): { duration: number; ease: [number, number, number, number] } {
  return { duration: estatico ? 0 : TRANSICION_DESTACADO_FOTO_DURACION_S, ease: TRANSICION_DESTACADO_EASE };
}

/** La hermana de `transicionDestacadoFoto`, para la etiqueta sobre la foto y el precio — MISMA
 *  curva, la MITAD de duración. */
export function transicionDestacadoTexto(estatico: boolean): { duration: number; ease: [number, number, number, number] } {
  return { duration: estatico ? 0 : TRANSICION_DESTACADO_TEXTO_DURACION_S, ease: TRANSICION_DESTACADO_EASE };
}
