"use client";

// LA APERTURA PROPIA DE /nosotros (§ ONIX-NOSOTROS-APERTURA-SINOPSIS-1, sobre ONIX-PAGINAS-
// COMPOSICIONES-CENSO-1). Monta la pieza COMPARTIDA `Apertura` (§ ONIX-PAGINAS-PIEZAS-COMPARTIDAS-1)
// con contenido PROPIO de esta sección (`nosotrosApertura`) — nunca el de `tiendaEncabezado` ni de
// `suscripcionApertura`.
//
// MISMO ALTO QUE /suscripciones (§ ONIX-PAGINAS-FIDELIDAD-1, el spec item 1) — "SIN override de
// `alto`" VENCIÓ: la maqueta aprobada del 2026-10-11 mide la apertura de /nosotros IGUAL a la de
// /suscripciones (691px), y medido contra el código vivo, sin pasar `alto` esta pieza caía al
// DEFAULT de /tienda (85vh), más alta de lo aprobado. `ALTO` es el MISMO literal que
// `SuscripcionApertura.tsx` — dos consumidores del mismo valor, nunca un token compartido nuevo
// para una clase de Tailwind completa (§ el docstring de `Apertura.tsx`, "un literal de clase
// COMPLETO, nunca interpolado").
// SIN botón de video: la pieza `Apertura` no tiene esa capacidad hoy — el spec lo dice explícito
// ("todavía no hay video"); llega con su propia tanda cuando exista.
//
// `quieto` (§ ONIX-PAGINAS-FIDELIDAD-1): el título NO se mueve con el scroll, como en
// /suscripciones — ver el docstring de `Apertura.tsx`.
//
// HIDE-ON-OFF, no hide-on-empty: igual que `SuscripcionApertura`, `Apertura` SIEMPRE pinta algo
// —tinta llana si no hay foto—, así que el gate es el TOGGLE (`seccionEsVisible`), nunca "¿hay
// imagen?". Nace `visible:false` (§ el docstring de `NosotrosAperturaContent`): byte-idéntico para
// todo tenant sin fila.
//
// `titulo` resuelve `titulo || negocio || TITULO_POR_DEFECTO` — MISMO mecanismo que
// `TiendaApertura` (`TiendaEncabezado.tsx`: `titulo || negocio || 'Nuestra Tienda'`): el fallback de
// identidad vive AQUÍ, no en `DEFAULTS` (que se queda vacío a propósito, § el docstring del
// contenido). `negocio` llega por PROP desde el server (como `NosotrosGaleria`); sin ella (la vista
// previa del panel) cae a la última red.
import { useSiteContent } from '@/components/storefront/SiteContentProvider';
import { REGISTRY, seccionEsVisible } from '@/lib/config/site-content-defaults';
import Apertura from '@/components/storefront/tienda/Apertura';

const TITULO_POR_DEFECTO = 'Nosotros';
const ALTO = 'h-[70svh] min-h-[420px]';

export default function NosotrosApertura({ negocio }: { negocio?: string }) {
  const { nosotrosApertura } = useSiteContent();
  if (!seccionEsVisible(REGISTRY.nosotrosApertura, nosotrosApertura)) return null;

  const titulo = nosotrosApertura.titulo || negocio || TITULO_POR_DEFECTO;

  return (
    <Apertura
      seccion="nosotrosApertura"
      imagen={nosotrosApertura.imagen}
      rotuloIzquierda={nosotrosApertura.rotuloIzquierda}
      rotuloDerecha={nosotrosApertura.rotuloDerecha}
      titulo={titulo}
      alto={ALTO}
      quieto
    />
  );
}
