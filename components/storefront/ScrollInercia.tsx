"use client";

import { useEffect } from "react";

import { useSiteContent } from "@/components/storefront/SiteContentProvider";
import { corteAplicado } from "@/lib/config/themes";
import {
  pasoInercia,
  seAsento,
  limiteScroll,
  objetivoTrasRueda,
  debeUsarScrollNativo,
  debeInterceptarRueda,
  claveScrollGuardado,
  parsearScrollGuardado,
  objetivoDeRestauracion,
  estadoInicialEstabilizacion,
  siguienteEstadoEstabilizacion,
  listoParaRestaurar,
  EVENTOS_QUE_CANCELAN_RESTAURACION,
} from "@/lib/storefront/scroll-inercia";

// ScrollInercia (§ SCROLL-INERCIA-CORTE-1) — gemelo de comportamiento de `initSmoothScroll`/
// `scrollToY` del prototipo (`docs/prototipos/cafeone/js/app.js:209-244`): amortigua el scroll de
// rueda tipo Lenis en vez de saltar por el delta nativo del navegador, para que la tienda con CORTE
// se sienta fluida como el muestrario. La fórmula (el paso de interpolación, el tope del documento y
// la condición de salida) vive en `lib/storefront/scroll-inercia.ts`, puro y testeado aparte — este
// componente es el envoltorio de `window`/RAF/los listeners reales.
//
// GATEADO por `corteAplicado(content.tema.origenAccion)` (`lib/config/themes.ts`): AUSENTE/`null`
// (Nayoli y todo tenant sin CORTE aplicado) = el comportamiento de HOY — este componente rinde
// `null` y no adjunta NINGÚN listener, así que Nayoli queda BYTE-IDÉNTICO. Sólo CORTE lo enciende.
// Se monta SIEMPRE desde el layout (`app/(storefront)/layout.tsx`, como StoreNav/StoreFooter/
// BackToTop/RielSocial) y decide su propio silencio adentro — el MISMO mecanismo que esos cuatro.
//
// SIN RENDER: es puro efecto de `window`, `return null` en las dos ramas.
//
// LAS SALIDAS QUE NO ROMPEN NADA (§ CondicionesRueda/CondicionesEntorno en scroll-inercia.ts):
//   - `prefers-reduced-motion` / `pointer:coarse` → scroll NATIVO, ni un listener adjunto (mismas
//     dos salidas del prototipo).
//   - `ctrlKey` → zoom del navegador, no se intercepta (prototipo).
//   - cuerpo bloqueado (`document.body.style.overflow === 'hidden'`, la ÚNICA señal de scroll-lock
//     real de este storefront — la pone `VistaRapidaProducto.tsx`; `CartDrawer.tsx`/`NavSearch.tsx`
//     NO bloquean, § el censo en ese archivo) → no se intercepta, el modal decide su propio scroll.
//   - gesto predominantemente HORIZONTAL (trackpad) → no se intercepta, para no robarle el gesto al
//     track del riel (`GrindChooserRiel.tsx`, `overflow-x-auto` nativo) ni al zoom horizontal.
//   - el target vive dentro de un elemento con su PROPIO scroll vertical (cuerpo del carrito, vista
//     rápida, menú móvil, cualquier `overflow-y:auto|scroll` con contenido real) → no se intercepta,
//     el navegador desplaza ESE elemento, no la página.
//   - `scrollTo`/anclas/teclado/barra de scroll ajenos a este mecanismo → el listener de `scroll`
//     resincroniza el objetivo interno con `window.scrollY` cada vez que no hay un frame de inercia
//     en vuelo (idéntico al prototipo, `js/app.js:236-238`) — nunca pelean con "volver arriba" ni
//     con ningún otro `scrollTo` de la app.
export default function ScrollInercia() {
  const { tema } = useSiteContent();
  const activo = corteAplicado(tema.origenAccion);

  useEffect(() => {
    if (!activo) return;

    const movimientoReducido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const punteroGrueso = window.matchMedia("(pointer: coarse)").matches;

    if (debeUsarScrollNativo({ movimientoReducido, punteroGrueso })) {
      // Táctil (sin movimiento reducido): scroll suave NATIVO, como el prototipo (`js/app.js:211-
      // 214`) — un dedo no dispara `wheel`, así que amortiguar rueda no tiene sentido acá.
      if (punteroGrueso && !movimientoReducido) {
        const previo = document.documentElement.style.scrollBehavior;
        document.documentElement.style.scrollBehavior = "smooth";
        return () => {
          document.documentElement.style.scrollBehavior = previo;
        };
      }
      // Movimiento reducido: scroll nativo tal cual, ni siquiera `scroll-behavior:smooth`.
      return;
    }

    let objetivo = window.scrollY;
    let actual = window.scrollY;
    let enVuelo = false;
    let rafId: number | null = null;

    // Cada paso del loop mueve la página AL INSTANTE: `html { scroll-behavior: smooth }`
    // (globals.css) convertía cada `scrollTo` por frame en una animación nativa propia que el
    // frame siguiente cancelaba — la página casi no bajaba y luego saltaba de golpe.
    const irA = (y: number) => window.scrollTo({ top: y, behavior: "instant" });

    const frame = () => {
      actual = pasoInercia(actual, objetivo);
      if (seAsento(actual, objetivo)) {
        actual = objetivo;
        irA(actual);
        enVuelo = false;
        rafId = null;
        return;
      }
      irA(actual);
      rafId = requestAnimationFrame(frame);
    };

    // ¿El nodo (o alguno de sus ancestros, hasta <body>) tiene scroll vertical PROPIO con contenido
    // real para desplazar? Camina el árbol una sola vez por evento — el mismo costo que cualquier
    // `closest()` de delegación de eventos ya paga en este storefront (§ `esClickAfuera`).
    const dentroDeScrollPropio = (nodo: EventTarget | null): boolean => {
      let el = nodo instanceof Element ? nodo : null;
      while (el && el !== document.body) {
        const overflowY = window.getComputedStyle(el).overflowY;
        if ((overflowY === "auto" || overflowY === "scroll") && el.scrollHeight > el.clientHeight) {
          return true;
        }
        el = el.parentElement;
      }
      return false;
    };

    const onWheel = (e: WheelEvent) => {
      const cuerpoBloqueado = document.body.style.overflow === "hidden";
      const intercepta = debeInterceptarRueda({
        ctrlKey: e.ctrlKey,
        cuerpoBloqueado,
        deltaX: e.deltaX,
        deltaY: e.deltaY,
        dentroDeScrollPropio: dentroDeScrollPropio(e.target),
      });
      if (!intercepta) return;

      e.preventDefault();
      const limite = limiteScroll(document.documentElement.scrollHeight, window.innerHeight);
      objetivo = objetivoTrasRueda(objetivo, e.deltaY, limite);
      if (!enVuelo) {
        enVuelo = true;
        actual = window.scrollY;
        rafId = requestAnimationFrame(frame);
      }
    };

    // Resincroniza el objetivo interno con cualquier scroll ajeno a este mecanismo (volver arriba,
    // anclas, teclado, barra de scroll) mientras no hay un frame de inercia en vuelo — igual que el
    // prototipo (`js/app.js:236-238`).
    const onScroll = () => {
      if (!enVuelo) {
        objetivo = window.scrollY;
        actual = window.scrollY;
      }
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("scroll", onScroll);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [activo]);

  // LA RESTAURACIÓN DE SCROLL AL RECARGAR — § SUSCRIPCION-TITULO-Y-RECARGA-1. EFECTO APARTE, no una
  // rama más del de arriba: ese efecto corta temprano bajo `pointer:coarse`/`prefers-reduced-motion`
  // (el scroll de RUEDA no aplica ahí), pero el defecto que esto arregla —Chromium restaura el
  // `scrollY` del reload contra un documento que todavía no creció del todo (§ el docstring de
  // `scroll-inercia.ts` para la medición completa)— le pasa a CUALQUIER visitante de CORTE, táctil o
  // con movimiento reducido incluido. Mezclarlo en el efecto de arriba habría significado repetir sus
  // dos `return` tempranos, o peor, dejarlo sin cubrir en esas dos salidas.
  //
  // `history.scrollRestoration = 'manual'` LE DICE al navegador que deje de intentarlo — no es
  // estrictamente necesario para que el fix funcione (lo de abajo sobreescribe cualquier posición que
  // el navegador haya dejado, sea correcta o no), pero evita que una SEGUNDA corrección nativa tardía
  // pelee con la nuestra después de aplicada. Se revierte a `'auto'` al desmontar/desactivarse, para
  // no dejar la preferencia puesta fuera de CORTE.
  useEffect(() => {
    if (!activo) return;

    const historial = window.history;
    const restauracionPrevia = historial.scrollRestoration;
    if ('scrollRestoration' in historial) {
      historial.scrollRestoration = 'manual';
    }

    const clave = claveScrollGuardado(window.location.pathname);
    let guardado: number | null = null;
    try {
      guardado = parsearScrollGuardado(window.sessionStorage.getItem(clave));
    } catch {
      // Storage inaccesible (privado/bloqueado): sin guardado que restaurar, el reload cae al
      // comportamiento por-defecto del navegador — no es peor que antes de este slice.
    }

    let detenido = false;
    let rafId: number | null = null;

    // EL VISITANTE MANDA — § RESTAURACION-CEDE-AL-USUARIO-1 (owner 2026-10-01: al deslizar el riel en el
    // teléfono "la página hace como un rebote hacia arriba"). La espera de estabilidad de altura podía
    // seguir corriendo segundos después de la carga (las fotos del riel cargan al deslizar y reinician la
    // espera) y, al asentarse, saltaba a la posición VIEJA aunque el visitante ya se hubiera movido. En
    // cuanto el visitante toca, arrastra, gira la rueda o usa el teclado, la restauración se cancela.
    const cancelarRestauracion = () => {
      detenido = true;
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = null;
    };
    for (const ev of EVENTOS_QUE_CANCELAN_RESTAURACION) {
      window.addEventListener(ev, cancelarRestauracion, { passive: true, once: true });
    }

    if (guardado !== null) {
      const inicio = performance.now();
      let estado = estadoInicialEstabilizacion(document.documentElement.scrollHeight, inicio);
      const intentar = () => {
        if (detenido) return;
        const ahora = performance.now();
        estado = siguienteEstadoEstabilizacion(estado, document.documentElement.scrollHeight, ahora);
        if (listoParaRestaurar(estado, ahora, inicio)) {
          const objetivo = objetivoDeRestauracion(guardado!, document.documentElement.scrollHeight, window.innerHeight);
          // `behavior:'instant'` — el mismo motivo que `irA` más arriba: con `scroll-behavior:smooth`
          // (globals.css) un `scrollTo` animado es justo el mecanismo que produce la "subida trabada
          // y luego de golpe" que este slice está cerrando; un salto instantáneo no le da pie a eso.
          window.scrollTo({ top: objetivo, behavior: 'instant' });
          return;
        }
        rafId = requestAnimationFrame(intentar);
      };
      rafId = requestAnimationFrame(intentar);
    }

    // Se guarda en CADA scroll (igual que el `onScroll` del efecto de arriba, sin debounce — un
    // `sessionStorage.setItem` es barato) Y en `pagehide` (la salida confiable de cualquier
    // navegación, incluido un reload) como red: si el último scroll no alcanzó a escribir por lo que
    // sea, `pagehide` siempre corre antes de que la página se descargue.
    const guardar = () => {
      try {
        window.sessionStorage.setItem(clave, String(window.scrollY));
      } catch {
        // Igual que arriba: sin storage, simplemente no se guarda nada — no revienta nada más.
      }
    };
    window.addEventListener("scroll", guardar, { passive: true });
    window.addEventListener("pagehide", guardar);

    return () => {
      detenido = true;
      if (rafId !== null) cancelAnimationFrame(rafId);
      for (const ev of EVENTOS_QUE_CANCELAN_RESTAURACION) window.removeEventListener(ev, cancelarRestauracion);
      window.removeEventListener("scroll", guardar);
      window.removeEventListener("pagehide", guardar);
      if ('scrollRestoration' in historial) {
        historial.scrollRestoration = restauracionPrevia;
      }
    };
  }, [activo]);

  return null;
}
