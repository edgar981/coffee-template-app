import type { ReactNode } from "react";

import EntradaPagina from "@/components/storefront/EntradaPagina";
import { getSiteContent } from "@/lib/config/site-content";
import { corteAplicado } from "@/lib/config/themes";

// TEMPLATE, no layout — § TRANSICION-ENTRE-PAGINAS-1. A diferencia de `layout.tsx` (persiste entre
// navegaciones del mismo grupo — es por eso que `StoreNav`/`ScrollInercia`/etc. no remontan),
// `template.tsx` REMONTA en cada cambio de ruta: es el único punto del árbol donde "la página
// cambió" es observable sin JS de cliente, así que es el disparador natural del revelado de entrada
// (ver `EntradaPagina.tsx`/`lib/animation.ts`). Envuelve TODA ruta de `(storefront)` —home incluida—
// desde un único archivo, no un wrapper por página.
//
// GATEADO por `corteAplicado(tema.origenAccion)` (`lib/config/themes.ts`) — el MISMO gate que
// `ScrollInercia` (`app/(storefront)/layout.tsx`), no una segunda comparación: de los 6 presets del
// catálogo sólo CORTE lo enciende, así que Nayoli y el resto quedan BYTE-IDÉNTICOS.
//
// `getSiteContent` es React.cache (dedupe por request) — ya lo lee `layout.tsx` para la paleta/
// fuentes/forma; esta lectura no agrega una query.
export default async function StorefrontTemplate({ children }: { children: ReactNode }) {
  const content = await getSiteContent();
  const activo = corteAplicado(content.tema.origenAccion);
  return <EntradaPagina activo={activo}>{children}</EntradaPagina>;
}
