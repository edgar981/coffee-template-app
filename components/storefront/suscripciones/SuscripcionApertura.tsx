"use client";

// LA APERTURA PROPIA DE /suscripciones (§ ONIX-SUSCRIPCION-TAQUILLA-1, sobre ONIX-PAGINAS-
// COMPOSICIONES-CENSO-1). Monta la pieza COMPARTIDA `Apertura` (§ ONIX-PAGINAS-PIEZAS-COMPARTIDAS-1)
// con contenido PROPIO de esta sección (`suscripcionApertura`) — nunca el de `tiendaEncabezado`.
//
// ALTO 70svh (§ el spec, item 1): "para que asome la orden" — un parámetro de la PIEZA, no una
// composición nueva (§ refero-onix-paginas.md, "Dos ajustes a piezas que ya existen no cuentan como
// composiciones nuevas"). `min-h` menor que el de /tienda por la misma razón: esta apertura es más
// baja a propósito.
//
// HIDE-ON-OFF, no hide-on-empty: a diferencia de `TiendaInterludio`/`TiendaCierre` (que se auto-
// ocultan SIN contenido), `Apertura` SIEMPRE pinta algo —tinta llana si no hay foto—, así que el
// gate es el TOGGLE (`seccionEsVisible`), nunca "¿hay imagen?". Nace `visible:false` (§ el docstring
// de `SuscripcionAperturaContent`): byte-idéntico para todo tenant sin fila.
//
// `quieto` (§ ONIX-PAGINAS-FIDELIDAD-1): el título NO se mueve con el scroll — la maqueta aprobada
// lo pide quieto, al ras de la izquierda, sangrando por el borde inferior. Ver el docstring de
// `Apertura.tsx`.
import { useSiteContent } from '@/components/storefront/SiteContentProvider';
import { REGISTRY, seccionEsVisible } from '@/lib/config/site-content-defaults';
import Apertura from '@/components/storefront/tienda/Apertura';

const ALTO = 'h-[70svh] min-h-[420px]';

export default function SuscripcionApertura() {
  const { suscripcionApertura } = useSiteContent();
  if (!seccionEsVisible(REGISTRY.suscripcionApertura, suscripcionApertura)) return null;

  return (
    <Apertura
      imagen={suscripcionApertura.imagen}
      rotuloIzquierda={suscripcionApertura.rotuloIzquierda}
      rotuloDerecha={suscripcionApertura.rotuloDerecha}
      titulo={suscripcionApertura.titulo}
      alto={ALTO}
      quieto
    />
  );
}
