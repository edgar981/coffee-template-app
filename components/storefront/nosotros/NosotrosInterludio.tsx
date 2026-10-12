"use client";

// EL INTERLUDIO de /nosotros (§ ONIX-NOSOTROS-INTERLUDIO-CIERRE-1, sobre ONIX-PAGINAS-
// COMPOSICIONES-CENSO-1 — el owner decidió el 2026-10-11 "cada página con su PROPIO interludio/
// cierre"). Contenido PROPIO, montado con la pieza COMPARTIDA `InterludioPlano`
// (§ ONIX-PAGINAS-PIEZAS-COMPARTIDAS-1) — la MISMA composición «Plano» que `tiendaInterludio`/
// `suscripcionInterludio`, SIN variante propia: a diferencia de /tienda (canónica 'retrato' +
// 'plano'), acá sólo existe «Plano», la única forma que el spec pide (§ refero-onix-paginas.md,
// "e. Interludio (tal cual)").
//
// NACE ENCENDIDA (`visible:true`, § DEFAULTS.nosotrosInterludio) pero AUTO-OCULTA SIN FOTO, mismo
// gate que `SuscripcionInterludio.tsx`/`TiendaInterludio.tsx`: el toggle sirve para esconder A
// PROPÓSITO una sección que SÍ tiene foto; la foto decide si hay algo que mostrar.
import { useSiteContent } from '@/components/storefront/SiteContentProvider';
import { useIsPreview } from '@/components/storefront/PreviewMode';
import { REGISTRY, seccionEsVisible } from '@/lib/config/site-content-defaults';
import InterludioPlano from '@/components/storefront/tienda/InterludioPlano';

export default function NosotrosInterludio() {
  const { nosotrosInterludio } = useSiteContent();
  const preview = useIsPreview();
  if (!seccionEsVisible(REGISTRY.nosotrosInterludio, nosotrosInterludio)) return null;
  if (!nosotrosInterludio.imagen) return null;
  return (
    <InterludioPlano
      seccion="nosotrosInterludio"
      imagen={nosotrosInterludio.imagen}
      pie={nosotrosInterludio.pie}
      preview={preview}
    />
  );
}
