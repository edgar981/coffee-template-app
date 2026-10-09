// LAS ONCE ESENCIALES (§ MOVIMIENTO-MARCO-GSAP-1) — una función por id, que recibe el nodo RAÍZ
// que `<Movimiento>` le da (el propio elemento que envuelve, ref ya montado) y arma la animación
// de GSAP con `ScrollTrigger`/`SplitText` ya REGISTRADOS por el llamador (`useMovimiento.ts` —
// este archivo nunca llama `gsap.registerPlugin`, para que el registro viva en un solo sitio).
//
// CADA función es DIRECTAMENTE la traducción de su ficha en el prototipo aprobado
// (`docs/movimiento/catalogo-movimiento.html`, script final) — mismas duraciones, mismos eases,
// mismo disparador (`start:'top 82%', toggleActions:'play none none none'`, § `alEntrar`), con DOS
// simplificaciones deliberadas por ser un componente GENÉRICO (no conoce la estructura interna que
// el prototipo, con ids fijos, podía asumir):
//  · I02/I03 (escala e imagen en parallax) animan `raiz.firstElementChild ?? raiz` — el patrón
//    "marco que recorta, imagen que se mueve adentro" — en vez del `.capa` del prototipo (una
//    clase que esta pieza no puede exigirle a cualquier consumidor).
//  · C01/C02 (tarjetas) animan los HIJOS DIRECTOS de la raíz completos (`raiz.children`), no un
//    `.bolsa` anidado — la elevación al pasar el mouse es de la TARJETA entera, no de una pieza
//    interna con clase fija.
//  · T04 (palabra resaltada) usa `currentColor` para el subrayado en vez del color de acento de
//    la paleta del prototipo (`--acento` del CSS de la ficha): este archivo no tiene acceso a los
//    tokens `--sf-*` del storefront sin acoplarse a esa hoja de estilos, así que el subrayado
//    hereda el color del propio texto — mismo efecto de revelado, un color más neutro.
// Ninguna de las tres cambia el EFECTO visual que el owner aprobó; cambian qué nodo o qué color
// recibe el componente genérico, porque este motor no puede exigir una clase ni un token de CSS
// que el prototipo sí asumía.
//
// RETORNO: cada función devuelve el objeto GSAP que arma (Tween | Timeline | null), para que
// `useMovimiento.ts` pueda revertirlo explícitamente si hiciera falta — aunque en el camino normal
// la REVERSIÓN la hace `useGSAP`/`gsap.context` solo, sin que este archivo lo sepa.

import { gsap } from 'gsap';
import { SplitText } from 'gsap/SplitText';

/** El disparador compartido por todo `revelado` de este motor — EXACTO al `alEntrar` del
 *  prototipo: dispara al entrar al 82% del viewport, una sola vez, nunca se revierte con el
 *  scroll (`toggleActions:'play none none none'`).
 *
 *  `forzar` (§ MOVIMIENTO-EDITOR-EXPOSICION-1, el botón «Ver animación» del editor) OMITE el
 *  `scrollTrigger` por completo: sin él, GSAP reproduce el tween INMEDIATAMENTE al crearlo, sin
 *  depender de la posición de scroll — necesario porque la vista previa del editor es una cajita
 *  chica que puede estar fuera del 82% del viewport, o directamente no scrollear nunca. */
function alEntrar(el: Element, forzar = false) {
  if (forzar) return undefined;
  return { trigger: el, start: 'top 82%', toggleActions: 'play none none none' } as const;
}

// § MOVIMIENTO-NIVEL-EDITORIAL-1 — EL COLOR SIEMPRE SALE DE LA PALETA, NUNCA FIJO. `getPropertyValue`
// sobre `<html>` lee el valor CASCADEADO de un token `--sf-*` (§ `cssPaleta`, `lib/config/
// palette-style.ts`) tal como el `<style>` server-rendered del layout lo escribió — un literal como
// `#8b4513`, no un color COMPUTADO; GSAP interpola ese string directo. `fallback` cubre el caso sin
// token (tema por defecto sin `<style>` inyectado, o SSR/tests sin DOM real).
function leerVarPaleta(nombre: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(nombre).trim();
  return v || fallback;
}

// ─── TEXTO ───────────────────────────────────────────────────────────────────────────────────────

function t01(raiz: HTMLElement, forzar = false) {
  const split = SplitText.create(raiz, { type: 'lines', mask: 'lines', aria: 'auto' });
  return gsap.from(split.lines, { yPercent: 110, duration: 0.9, ease: 'power3.out', stagger: 0.12, scrollTrigger: alEntrar(raiz, forzar) });
}

function t02(raiz: HTMLElement, forzar = false) {
  const split = SplitText.create(raiz, { type: 'words', aria: 'auto' });
  return gsap.from(split.words, { y: '0.6em', autoAlpha: 0, duration: 0.6, ease: 'power2.out', stagger: 0.07, scrollTrigger: alEntrar(raiz, forzar) });
}

function t03(raiz: HTMLElement, forzar = false) {
  const split = SplitText.create(raiz, { type: 'chars', aria: 'auto' });
  return gsap.from(split.chars, { yPercent: 80, rotate: 6, autoAlpha: 0, duration: 0.7, ease: 'back.out(1.6)', stagger: 0.05, scrollTrigger: alEntrar(raiz, forzar) });
}

/** `.sf-movimiento-resaltada`: la palabra que el dueño de la tienda marca — sin ella, T04 se
 *  degrada a un revelado de bloque (T05), que sigue siendo correcto: la palabra resaltada es un
 *  AGREGADO sobre el revelado base, no una condición para que exista.
 *
 *  SIN HOJA DE ESTILOS PROPIA, A PROPÓSITO (§ el docstring de `Movimiento.tsx`): el subrayado se
 *  arma por ESTILO INLINE, puesto y quitado por GSAP — no una custom property que dependa de que
 *  algún `.css` defina qué significa. `gsap.set` fija el estado de reposo (ancho 0, invisible
 *  hasta que el bloque revele) y el `onUpdate` del tween escribe `backgroundSize` en cada frame. */
function t04(raiz: HTMLElement, forzar = false) {
  const resaltada = raiz.querySelector<HTMLElement>('.sf-movimiento-resaltada');
  const tl = gsap.timeline({ scrollTrigger: alEntrar(raiz, forzar) });
  tl.from(raiz, { y: 24, autoAlpha: 0, duration: 0.7, ease: 'power2.out' });
  if (resaltada) {
    gsap.set(resaltada, {
      backgroundImage: 'linear-gradient(currentColor, currentColor)',
      backgroundRepeat: 'no-repeat',
      backgroundPosition: '0 100%',
      backgroundSize: '0% 0.14em',
    });
    const estado = { s: 0 };
    tl.to(estado, {
      s: 1,
      duration: 0.8,
      ease: 'power2.inOut',
      onUpdate: () => { resaltada.style.backgroundSize = `${Math.round(estado.s * 100)}% 0.14em`; },
    }, '-=0.15');
  }
  return tl;
}

function t05(raiz: HTMLElement, forzar = false) {
  return gsap.from(raiz, { y: 28, autoAlpha: 0, duration: 0.9, ease: 'power2.out', scrollTrigger: alEntrar(raiz, forzar) });
}

/** T06 (§ MOVIMIENTO-NIVEL-EDITORIAL-1) — SCRUB continuo, sin `forzar`: mismo criterio que I03
 *  (parallax), nunca "una vez" que reproducir (`puedeReproducirUnaVez` ya lo excluye por `clases`).
 *  `.sf-movimiento-gigante` es un MARCADOR, no una hoja de estilos (§ el docstring de `t04` para
 *  `.sf-movimiento-resaltada`, el mismo patrón): el consumidor (Banner.tsx/ImagenTexto.tsx) decide
 *  la tipografía por Tailwind; esta función sólo mueve lo que encuentra. Sin el marcador (ningún
 *  consumidor lo renderiza para este id) no hay nada que animar — `null`, nunca un error. */
function t06(raiz: HTMLElement) {
  const gigante = raiz.querySelector<HTMLElement>('.sf-movimiento-gigante');
  if (!gigante) return null;
  return gsap.fromTo(
    gigante,
    { xPercent: 10 },
    { xPercent: -40, ease: 'none', scrollTrigger: { trigger: raiz, start: 'top bottom', end: 'bottom top', scrub: true } },
  );
}

// ─── IMAGEN ──────────────────────────────────────────────────────────────────────────────────────

function i01(raiz: HTMLElement, forzar = false) {
  return gsap.fromTo(
    raiz,
    { clipPath: 'inset(100% 0% 0% 0%)' },
    { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.2, ease: 'power3.inOut', scrollTrigger: alEntrar(raiz, forzar) },
  );
}

function i02(raiz: HTMLElement, forzar = false) {
  const blanco = (raiz.firstElementChild as HTMLElement | null) ?? raiz;
  return gsap.fromTo(blanco, { scale: 1.18 }, { scale: 1, duration: 1.6, ease: 'power2.out', scrollTrigger: alEntrar(raiz, forzar) });
}

// i03 (parallax) es `scrub` continuo, no un revelado de una vez: no tiene "forzar" con sentido —
// `useMovimiento.ts` no ofrece «Ver animación» para ids fuera de la clase `revelado` (§ su
// docstring), así que nunca se le pide reproducir una vez. Sin el segundo parámetro: una función
// con MENOS parámetros sigue siendo asignable a `ANIMACIONES_ESENCIALES` (TS lo permite, JS lo
// ignora en la llamada) — no hace falta nombrar un parámetro que nunca usaría.
function i03(raiz: HTMLElement) {
  const blanco = (raiz.firstElementChild as HTMLElement | null) ?? raiz;
  return gsap.fromTo(
    blanco,
    { yPercent: -8 },
    { yPercent: 8, ease: 'none', scrollTrigger: { trigger: raiz, start: 'top bottom', end: 'bottom top', scrub: true } },
  );
}

// ─── TARJETAS Y CIFRAS ───────────────────────────────────────────────────────────────────────────

/** C01 escalonado + C02 hover en la MISMA raíz (§ el docstring de cabecera: "C01 tarjetas + C02
 *  hover" en el prototipo también los junta) — un consumidor que SÓLO quiere el hover (sin la
 *  entrada escalonada) usa `id="C02"` sobre la misma raíz, que llama a `hoverTarjetas` sin el
 *  `gsap.from` de entrada. */
function hoverTarjetas(raiz: HTMLElement): void {
  for (const hijo of Array.from(raiz.children)) {
    const el = hijo as HTMLElement;
    el.addEventListener('mouseenter', () => gsap.to(el, { y: -8, rotate: -1, duration: 0.35, ease: 'power2.out' }));
    el.addEventListener('mouseleave', () => gsap.to(el, { y: 0, rotate: 0, duration: 0.4, ease: 'power2.out' }));
  }
}

function c01(raiz: HTMLElement, forzar = false) {
  const hijos = Array.from(raiz.children);
  hoverTarjetas(raiz);
  return gsap.from(hijos, { y: 40, autoAlpha: 0, duration: 0.7, ease: 'power2.out', stagger: 0.12, scrollTrigger: alEntrar(raiz, forzar) });
}

// c02 es PURAMENTE interacción de puntero (`clases: []`, § catalogo.ts) — no tiene un tween de
// entrada que «reproducir una vez», así que `useMovimiento.ts` nunca ofrece el botón para este id
// (gate por `clases.includes('revelado')`). Sin el segundo parámetro, misma razón que en i03.
function c02(raiz: HTMLElement) {
  hoverTarjetas(raiz);
  return null;
}

/** N01 lee la ESTRUCTURA que el consumidor declara con `data-*` (mismo contrato que el prototipo:
 *  `[data-hasta]` es el valor final, `data-sufijo` es el texto que lo sigue, un `[data-barra]`
 *  HERMANO opcional crece de 0 a 1 en paralelo) — sin exigir una etiqueta ni una clase fija, el
 *  componente genérico no puede saber si el número vive en un `<b>` o un `<span>`. */
function n01(raiz: HTMLElement, forzar = false) {
  const tl = gsap.timeline({ scrollTrigger: alEntrar(raiz, forzar) });
  const cifras = Array.from(raiz.querySelectorAll<HTMLElement>('[data-hasta]'));
  cifras.forEach((cifra, i) => {
    const hasta = Number(cifra.dataset.hasta);
    const sufijo = cifra.dataset.sufijo ?? '';
    if (!Number.isFinite(hasta)) return;
    const estado = { v: 0 };
    tl.to(estado, {
      v: hasta,
      duration: 1.4,
      ease: 'power2.out',
      onUpdate: () => { cifra.textContent = Math.round(estado.v).toLocaleString('es-CO') + sufijo; },
    }, i * 0.15);
    const barra = cifra.parentElement?.querySelector<HTMLElement>('[data-barra]');
    if (barra) tl.from(barra, { scaleX: 0, duration: 1.2, ease: 'power2.out' }, i * 0.15);
  });
  return tl;
}

// ─── SECCIONES (nivel editorial, § MOVIMIENTO-NIVEL-EDITORIAL-1) ───────────────────────────────────

/** S01 "Capítulos de color" — ver el docstring de su entrada en `lib/movimiento/catalogo.ts` para el
 *  porqué de la simplificación (scrub continuo sobre el fondo de LA SECCIÓN ENTERA, sin capítulos
 *  discretos). `raiz` es el `<section>` completo (Texto.tsx lo pasa como `as="section"`), nunca sólo
 *  el título — S01 no toca el color del TEXTO, sólo el FONDO, así que el texto (ya legible contra
 *  `--sf-fondo`) se mantiene legible contra `--sf-acento`/`--sf-tostado` (tonos medios, nunca el más
 *  oscuro de la paleta). Sin `forzar`: scrub puro, nunca "una vez". */
function s01(raiz: HTMLElement) {
  const fondo = leerVarPaleta('--sf-fondo', '#fdfbf7');
  const acento = leerVarPaleta('--sf-acento', '#8b4513');
  const tostado = leerVarPaleta('--sf-tostado', '#c79a55');
  gsap.set(raiz, { backgroundColor: fondo });
  return gsap
    .timeline({ scrollTrigger: { trigger: raiz, start: 'top bottom', end: 'bottom top', scrub: true } })
    .to(raiz, { backgroundColor: acento, ease: 'none', duration: 0.5 }, 0)
    .to(raiz, { backgroundColor: tostado, ease: 'none', duration: 0.5 }, 0.5);
}

/** S02 "Del fruto a la taza" — el motor de la sección `proceso` (§ secciones-instancias.ts). `raiz`
 *  es la sección ENTERA (Proceso.tsx la envuelve con `<Movimiento id="S02" as="section">`); lee sus
 *  `[data-s02-paso]` (de 3 a 6, el piso/tope del editor), `[data-s02-marca]` (la barra de progreso),
 *  `[data-s02-objeto]`/`[data-s02-taza]` (el dibujo) y `[data-s02-foto]` (la foto propia de cada
 *  paso, si la tiene — § Proceso.tsx). Generaliza a cualquier N: el color/escala/rotación del
 *  objeto es UNA sola transición continua a lo largo de TODO el recorrido (nunca por paso) — ver el
 *  docstring de la entrada S02 en `catalogo.ts` para el porqué frente al prototipo.
 *
 *  LA ENTIDAD VISIBLE EN CADA PASO es su foto (`fotos.get(i)`) si la tiene, o el objeto ilustrativo
 *  si no — y el cruce entre pasos SÓLO anima cuando esa entidad REALMENTE cambia (`actual !==
 *  siguiente`): dos pasos consecutivos sin foto dejan el objeto FIJO (ni se apaga ni se reprende),
 *  sin el parpadeo que un cruce incondicional produciría. */
function s02(raiz: HTMLElement) {
  const pasos = Array.from(raiz.querySelectorAll<HTMLElement>('[data-s02-paso]'));
  const marcas = Array.from(raiz.querySelectorAll<HTMLElement>('[data-s02-marca]'));
  const objeto = raiz.querySelector<SVGElement>('[data-s02-objeto]');
  const taza = raiz.querySelector<SVGElement>('[data-s02-taza]');
  const n = pasos.length;
  if (n < 2 || !objeto) return null;

  const fotos = new Map<number, Element>();
  raiz.querySelectorAll<HTMLElement>('[data-s02-foto]').forEach((el) => {
    const i = Number(el.dataset.s02Foto);
    if (Number.isFinite(i)) fotos.set(i, el);
  });
  const entidadDePaso = (i: number): Element => fotos.get(i) ?? objeto;

  const acento = leerVarPaleta('--sf-acento', '#8b4513');
  const tinta = leerVarPaleta('--sf-tinta', '#1e150e');

  gsap.set(pasos, { autoAlpha: 0, y: 20 });
  gsap.set(pasos[0]!, { autoAlpha: 1, y: 0 });
  marcas.forEach((m, k) => { m.style.backgroundColor = k === 0 ? tinta : 'var(--sf-linea)'; });
  gsap.set(Array.from(fotos.values()), { autoAlpha: 0 });
  gsap.set(entidadDePaso(0), { autoAlpha: 1 });
  gsap.set(objeto, { attr: { fill: acento }, rotate: 0, scale: 1, transformOrigin: '50% 50%' });
  if (taza) gsap.set(taza, { autoAlpha: 0 });

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: raiz,
      start: 'top top',
      end: `+=${(n - 1) * 100}%`,
      pin: true,
      scrub: 0.6,
      onUpdate: (self) => {
        const i = Math.min(n - 1, Math.floor(self.progress * n));
        marcas.forEach((m, k) => { m.style.backgroundColor = k <= i ? tinta : 'var(--sf-linea)'; });
      },
    },
  });

  // El color/escala/rotación del objeto corre SIEMPRE, sea o no la entidad visible en cada paso —
  // cuando está oculto por una foto, nadie ve el cambio; cuando vuelve a ser el visible, ya está en
  // el tono que le corresponde a ESE punto del recorrido.
  tl.to(objeto, { attr: { fill: tinta }, rotate: -24, scale: 0.85, duration: n - 1, ease: 'none' }, 0);

  for (let k = 0; k < n - 1; k++) {
    tl.to(pasos[k]!, { autoAlpha: 0, y: -20, duration: 0.3 }, k + 0.85);
    tl.to(pasos[k + 1]!, { autoAlpha: 1, y: 0, duration: 0.3 }, k + 1);

    const actual = entidadDePaso(k);
    const siguiente = entidadDePaso(k + 1);
    if (actual !== siguiente) {
      tl.to(actual, { autoAlpha: 0, duration: 0.3 }, k + 0.85);
      tl.to(siguiente, { autoAlpha: 1, duration: 0.3 }, k + 1);
    }
  }

  if (taza) {
    const ultima = entidadDePaso(n - 1);
    tl.to(ultima, { autoAlpha: 0, duration: 0.3 }, n - 1.2);
    tl.to(taza, { autoAlpha: 1, duration: 0.3 }, n - 1.05);
  }

  return tl;
}

/** S03 "Galería horizontal" — el MODO `disposicion:'horizontal'` de "collage" (§ Collage.tsx); nunca
 *  se ofrece vía «Animación». `raiz` es el contenedor que Collage.tsx pinea (`<Movimiento id="S03"
 *  as="div">`); su PRIMER hijo es la tira (flex-row de fotos) que se traslada — mismo mecanismo que
 *  el prototipo (`distancia()` mide cuánto sobra de `scrollWidth` contra el viewport). */
function s03(raiz: HTMLElement) {
  const tira = raiz.firstElementChild as HTMLElement | null;
  if (!tira) return null;
  const distancia = () => Math.max(0, tira.scrollWidth - window.innerWidth);
  return gsap.to(tira, {
    x: () => -distancia(),
    ease: 'none',
    scrollTrigger: { trigger: raiz, start: 'top top', end: () => `+=${distancia()}`, pin: true, scrub: 0.5, invalidateOnRefresh: true },
  });
}

// ─── EL DESPACHADOR ──────────────────────────────────────────────────────────────────────────────

type ResultadoAnimacion = gsap.core.Tween | gsap.core.Timeline | null;

/** Mapa id→función — ÚNICA fuente que `useMovimiento.ts` consulta. Un id sin entrada acá (porque
 *  `movimientoPorId(id).implementada` es `false`, o porque es basura) nunca llega a este mapa: el
 *  llamador ya filtró con `motorDisponible` antes de invocar. */
export const ANIMACIONES_ESENCIALES: Record<string, (raiz: HTMLElement, forzar?: boolean) => ResultadoAnimacion> = {
  T01: t01, T02: t02, T03: t03, T04: t04, T05: t05, T06: t06,
  I01: i01, I02: i02, I03: i03,
  C01: c01, C02: c02,
  N01: n01,
  S01: s01, S02: s02, S03: s03,
};
