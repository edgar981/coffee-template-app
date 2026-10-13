"use client";

// EL INTERLUDIO de /nosotros (§ ONIX-NOSOTROS-INTERLUDIO-CIERRE-1, sobre ONIX-PAGINAS-
// COMPOSICIONES-CENSO-1 — el owner decidió el 2026-10-11 "cada página con su PROPIO interludio/
// cierre"). Contenido PROPIO, montado con la pieza COMPARTIDA `InterludioPlano`
// (§ ONIX-PAGINAS-PIEZAS-COMPARTIDAS-1) — la MISMA composición «Plano» que `tiendaInterludio`/
// `suscripcionInterludio`.
//
// GANA UNA SEGUNDA COMPOSICIÓN (§ CHAMISAS-NOSOTROS-ALBUM-1): «stickers», montada con
// `NosotrosInterludioStickers` — la franja de tejido con los cafés del catálogo como stickers
// (§ su docstring de cabecera). `imagen` SE REUSA entre las dos composiciones (foto documental bajo
// «plano», franja de tejido bajo «stickers»), así que el gate de abajo ("¿hay imagen?") sigue
// sirviendo a las dos.
//
// NACE ENCENDIDA (`visible:true`, § DEFAULTS.nosotrosInterludio) pero AUTO-OCULTA SIN FOTO, mismo
// gate que `SuscripcionInterludio.tsx`/`TiendaInterludio.tsx`: el toggle sirve para esconder A
// PROPÓSITO una sección que SÍ tiene foto; la foto decide si hay algo que mostrar.
import { useSiteContent } from '@/components/storefront/SiteContentProvider';
import { useIsPreview } from '@/components/storefront/PreviewMode';
import { REGISTRY, seccionEsVisible } from '@/lib/config/site-content-defaults';
import InterludioPlano from '@/components/storefront/tienda/InterludioPlano';
import NosotrosInterludioStickers from '@/components/storefront/nosotros/NosotrosInterludioStickers';

export default function NosotrosInterludio() {
  const { nosotrosInterludio } = useSiteContent();
  const preview = useIsPreview();
  if (!seccionEsVisible(REGISTRY.nosotrosInterludio, nosotrosInterludio)) return null;
  if (!nosotrosInterludio.imagen) return null;

  if (nosotrosInterludio.variante === 'stickers') {
    return <NosotrosInterludioStickers imagen={nosotrosInterludio.imagen} />;
  }

  return (
    <InterludioPlano
      seccion="nosotrosInterludio"
      imagen={nosotrosInterludio.imagen}
      pie={nosotrosInterludio.pie}
      preview={preview}
    />
  );
}
