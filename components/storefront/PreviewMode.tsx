'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';

// MODO PREVIEW del storefront (`/?preview=1`) — para el iframe de /admin/tienda. La tienda
// se renderiza REAL pero INERTE: nada navega (nav, CTAs, tarjetas de producto, carrito,
// WhatsApp del footer) y la flecha en bucle del hero se apaga. Así un clic dentro del marco
// no aterriza en ningún lado y el preview nunca se sale de la home.
//
// INERTE por `pointer-events: none` en el WRAPPER de contenido —NO en `html/body`—: los
// clics/hover no tienen destino, pero el SCROLL sigue vivo (rueda, barra y arrastre táctil
// van al documento, que conserva sus pointer-events). Cubre TODO lo interactivo de una, y las
// secciones futuras (BrandStory/Testimonios/Suscripción) quedan cubiertas sin trabajo extra.
//
// Es PÚBLICO y no expone nada (sólo desactiva interacción). El sitio entero ya va `noindex`
// (X-Robots-Tag global en next.config); además hay una regla propia para `?preview` que
// sobrevive a que ese header global se quite en el lanzamiento.

const PreviewContext = createContext(false);

/** `true` dentro del modo preview. Default `false` (sin provider / fuera del marco). */
export function useIsPreview(): boolean {
  return useContext(PreviewContext);
}

/**
 * Envuelve el contenido del storefront. Lee `?preview` y aplica el modo. Sin Suspense: el
 * layout del storefront es `force-dynamic`, así que `useSearchParams` resuelve por request y
 * no exige boundary —y un fallback que renderice `{children}` DUPLICARÍA la app en el DOM—.
 */
export function StorefrontFrame({ children }: { children: ReactNode }) {
  const preview = useSearchParams().get('preview') === '1';
  return (
    <PreviewContext.Provider value={preview}>
      <div className={`min-h-screen bg-[#faf7f4] font-inter${preview ? ' pointer-events-none select-none' : ''}`}>
        {children}
      </div>
    </PreviewContext.Provider>
  );
}
