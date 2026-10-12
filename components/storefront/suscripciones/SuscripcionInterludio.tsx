"use client";

// EL INTERLUDIO de /suscripciones (§ ONIX-SUSCRIPCION-LETRA-CIERRE-1, sobre ONIX-PAGINAS-
// COMPOSICIONES-CENSO-1 — el owner decidió el 2026-10-11 "cada página con su PROPIO interludio/
// cierre"). Contenido PROPIO, montado con la pieza COMPARTIDA `InterludioPlano`
// (§ ONIX-PAGINAS-PIEZAS-COMPARTIDAS-1) — la MISMA composición «Plano» que `tiendaInterludio`, SIN
// variante propia: a diferencia de /tienda (canónica 'retrato' + 'plano'), acá sólo existe «Plano»,
// la única forma que el spec pide.
//
// NACE ENCENDIDA (`visible:true`, § DEFAULTS.suscripcionInterludio) pero AUTO-OCULTA SIN FOTO, mismo
// gate que `TiendaInterludio.tsx`: el toggle sirve para esconder A PROPÓSITO una sección que SÍ
// tiene foto; la foto decide si hay algo que mostrar.
import { useSiteContent } from '@/components/storefront/SiteContentProvider';
import { useIsPreview } from '@/components/storefront/PreviewMode';
import { REGISTRY, seccionEsVisible } from '@/lib/config/site-content-defaults';
import InterludioPlano from '@/components/storefront/tienda/InterludioPlano';

export default function SuscripcionInterludio() {
  const { suscripcionInterludio } = useSiteContent();
  const preview = useIsPreview();
  if (!seccionEsVisible(REGISTRY.suscripcionInterludio, suscripcionInterludio)) return null;
  if (!suscripcionInterludio.imagen) return null;
  return (
    <InterludioPlano
      seccion="suscripcionInterludio"
      imagen={suscripcionInterludio.imagen}
      pie={suscripcionInterludio.pie}
      preview={preview}
    />
  );
}
