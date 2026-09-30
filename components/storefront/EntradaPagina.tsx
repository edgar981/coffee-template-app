"use client";

import type { ReactNode } from "react";

import { cssRevelaPagina } from "@/lib/animation";

// EntradaPagina — § TRANSICION-ENTRE-PAGINAS-1. Envuelve el contenido de UNA página para que sus
// bloques de primer nivel entren progresivamente (opacidad + traslado, escalonados) al montar, como
// el `[data-reveal-group]` del prototipo. La derivación completa de los valores, por qué es CSS puro
// (sin JS, sin IntersectionObserver) y por qué no necesita guard propio de `prefers-reduced-motion`
// vive en `lib/animation.ts` (`cssRevelaPagina`), junto a `EntradaPagina` en el `touches:` de este
// slice — no se repite acá.
//
// `"use client"` — NO por interactividad (este componente no tiene hooks ni estado): `lib/
// animation.ts` entero es un módulo cliente (lo necesitan sus otros exports, con hooks de React/
// framer-motion), así que Next trata CUALQUIER export suyo como una referencia de cliente — un
// Server Component puede RENDERIZARLO como JSX, pero no puede LLAMAR a una de sus funciones
// directamente (medido: `template.tsx` sin este directive revienta en runtime, "Attempted to call
// cssRevelaPagina() from the server but cssRevelaPagina is on the client", digest 1858415120).
// MISMO patrón que `ReducedMotionProvider` (el otro export de ese archivo que envuelve server
// children) ya usa en `app/(storefront)/layout.tsx` — no uno nuevo. `{children}` sigue pudiendo ser
// el árbol SERVER de la página: pasar Server Components como `children` de un Client Component es
// soportado de punta a punta: React sirve ese subárbol en el HTML inicial igual que si este wrapper
// no existiera, sin que `EntradaPagina` tenga que "entender" su contenido.
//
// `activo` lo decide el LLAMADOR (`app/(storefront)/template.tsx`, vía
// `corteAplicado(tema.origenAccion)`): `false` (todo tenant salvo CORTE) → pass-through exacto, sin
// un solo nodo de más — BYTE-IDÉNTICO, ni `<style>` ni `<div>`.
//
// `display:contents` en el wrapper: la regla que `cssRevelaPagina()` emite
// (`[data-entrada-pagina]>*`) necesita que los bloques de la página sean hijos DIRECTOS del nodo
// marcado, pero el wrapper NO puede generar caja propia — desplazaría el árbol de layout que cuelga
// de `<main>`, en particular el ancestro del hero sticky de la home, que asume ser su primer hijo
// (§ el docstring de cabecera de `HeroMediaMarquesina.tsx`). Con `display:contents` el wrapper es
// transparente para el layout (sin `offsetTop`/box propios) pero sigue siendo el padre real en el
// árbol del DOM, así que el selector `>` de la regla lo sigue viendo.
export default function EntradaPagina({
  activo,
  children,
}: {
  activo: boolean;
  children: ReactNode;
}) {
  if (!activo) return <>{children}</>;
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: cssRevelaPagina() }} />
      <div data-entrada-pagina="" style={{ display: "contents" }}>
        {children}
      </div>
    </>
  );
}
