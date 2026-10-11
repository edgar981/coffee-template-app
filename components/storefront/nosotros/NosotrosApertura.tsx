"use client";

// LA APERTURA PROPIA DE /nosotros (§ ONIX-NOSOTROS-APERTURA-SINOPSIS-1, sobre ONIX-PAGINAS-
// COMPOSICIONES-CENSO-1). Monta la pieza COMPARTIDA `Apertura` (§ ONIX-PAGINAS-PIEZAS-COMPARTIDAS-1)
// con contenido PROPIO de esta sección (`nosotrosApertura`) — nunca el de `tiendaEncabezado` ni de
// `suscripcionApertura`.
//
// SIN override de `alto`: el spec la pide "la de /tienda tal cual" — a diferencia de
// `SuscripcionApertura` (que ajusta a 70svh "para que asome la orden"), /nosotros no tiene una
// sección inmediata que necesite asomar, así que usa el DEFAULT de la pieza (85vh, el de /tienda).
// SIN botón de video: la pieza `Apertura` no tiene esa capacidad hoy — el spec lo dice explícito
// ("todavía no hay video"); llega con su propia tanda cuando exista.
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

export default function NosotrosApertura({ negocio }: { negocio?: string }) {
  const { nosotrosApertura } = useSiteContent();
  if (!seccionEsVisible(REGISTRY.nosotrosApertura, nosotrosApertura)) return null;

  const titulo = nosotrosApertura.titulo || negocio || TITULO_POR_DEFECTO;

  return (
    <Apertura
      imagen={nosotrosApertura.imagen}
      rotuloIzquierda={nosotrosApertura.rotuloIzquierda}
      rotuloDerecha={nosotrosApertura.rotuloDerecha}
      titulo={titulo}
    />
  );
}
