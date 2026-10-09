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
 *  scroll (`toggleActions:'play none none none'`). */
function alEntrar(el: Element) {
  return { trigger: el, start: 'top 82%', toggleActions: 'play none none none' } as const;
}

// ─── TEXTO ───────────────────────────────────────────────────────────────────────────────────────

function t01(raiz: HTMLElement) {
  const split = SplitText.create(raiz, { type: 'lines', mask: 'lines', aria: 'auto' });
  return gsap.from(split.lines, { yPercent: 110, duration: 0.9, ease: 'power3.out', stagger: 0.12, scrollTrigger: alEntrar(raiz) });
}

function t02(raiz: HTMLElement) {
  const split = SplitText.create(raiz, { type: 'words', aria: 'auto' });
  return gsap.from(split.words, { y: '0.6em', autoAlpha: 0, duration: 0.6, ease: 'power2.out', stagger: 0.07, scrollTrigger: alEntrar(raiz) });
}

function t03(raiz: HTMLElement) {
  const split = SplitText.create(raiz, { type: 'chars', aria: 'auto' });
  return gsap.from(split.chars, { yPercent: 80, rotate: 6, autoAlpha: 0, duration: 0.7, ease: 'back.out(1.6)', stagger: 0.05, scrollTrigger: alEntrar(raiz) });
}

/** `.sf-movimiento-resaltada`: la palabra que el dueño de la tienda marca — sin ella, T04 se
 *  degrada a un revelado de bloque (T05), que sigue siendo correcto: la palabra resaltada es un
 *  AGREGADO sobre el revelado base, no una condición para que exista.
 *
 *  SIN HOJA DE ESTILOS PROPIA, A PROPÓSITO (§ el docstring de `Movimiento.tsx`): el subrayado se
 *  arma por ESTILO INLINE, puesto y quitado por GSAP — no una custom property que dependa de que
 *  algún `.css` defina qué significa. `gsap.set` fija el estado de reposo (ancho 0, invisible
 *  hasta que el bloque revele) y el `onUpdate` del tween escribe `backgroundSize` en cada frame. */
function t04(raiz: HTMLElement) {
  const resaltada = raiz.querySelector<HTMLElement>('.sf-movimiento-resaltada');
  const tl = gsap.timeline({ scrollTrigger: alEntrar(raiz) });
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

function t05(raiz: HTMLElement) {
  return gsap.from(raiz, { y: 28, autoAlpha: 0, duration: 0.9, ease: 'power2.out', scrollTrigger: alEntrar(raiz) });
}

// ─── IMAGEN ──────────────────────────────────────────────────────────────────────────────────────

function i01(raiz: HTMLElement) {
  return gsap.fromTo(
    raiz,
    { clipPath: 'inset(100% 0% 0% 0%)' },
    { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.2, ease: 'power3.inOut', scrollTrigger: alEntrar(raiz) },
  );
}

function i02(raiz: HTMLElement) {
  const blanco = (raiz.firstElementChild as HTMLElement | null) ?? raiz;
  return gsap.fromTo(blanco, { scale: 1.18 }, { scale: 1, duration: 1.6, ease: 'power2.out', scrollTrigger: alEntrar(raiz) });
}

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

function c01(raiz: HTMLElement) {
  const hijos = Array.from(raiz.children);
  hoverTarjetas(raiz);
  return gsap.from(hijos, { y: 40, autoAlpha: 0, duration: 0.7, ease: 'power2.out', stagger: 0.12, scrollTrigger: alEntrar(raiz) });
}

function c02(raiz: HTMLElement) {
  hoverTarjetas(raiz);
  return null;
}

/** N01 lee la ESTRUCTURA que el consumidor declara con `data-*` (mismo contrato que el prototipo:
 *  `[data-hasta]` es el valor final, `data-sufijo` es el texto que lo sigue, un `[data-barra]`
 *  HERMANO opcional crece de 0 a 1 en paralelo) — sin exigir una etiqueta ni una clase fija, el
 *  componente genérico no puede saber si el número vive en un `<b>` o un `<span>`. */
function n01(raiz: HTMLElement) {
  const tl = gsap.timeline({ scrollTrigger: alEntrar(raiz) });
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

// ─── EL DESPACHADOR ──────────────────────────────────────────────────────────────────────────────

type ResultadoAnimacion = gsap.core.Tween | gsap.core.Timeline | null;

/** Mapa id→función — ÚNICA fuente que `useMovimiento.ts` consulta. Un id sin entrada acá (porque
 *  `movimientoPorId(id).implementada` es `false`, o porque es basura) nunca llega a este mapa: el
 *  llamador ya filtró con `motorDisponible` antes de invocar. */
export const ANIMACIONES_ESENCIALES: Record<string, (raiz: HTMLElement) => ResultadoAnimacion> = {
  T01: t01, T02: t02, T03: t03, T04: t04, T05: t05,
  I01: i01, I02: i02, I03: i03,
  C01: c01, C02: c02,
  N01: n01,
};
