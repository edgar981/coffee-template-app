"use client";

// EL CIERRE de /suscripciones (§ ONIX-SUSCRIPCION-LETRA-CIERRE-1) — misma razón que el interludio
// (SuscripcionInterludio.tsx): contenido PROPIO de esta página, montado con la pieza COMPARTIDA
// `CierreFraseYBoton` (§ ONIX-PAGINAS-PIEZAS-COMPARTIDAS-1), SIN variante propia — a diferencia de
// /tienda (canónica 'costura' + 'fraseYBoton'), acá sólo existe «Frase y botón».
//
// NACE ENCENDIDO (`visible:true`) pero AUTO-OCULTA SIN `frase` — mismo gate que `TiendaCierre.tsx`,
// "sin frase no hay nada que cerrar con". El botón es un segundo gate independiente: `resolverCtaSeccion`
// ya decide si hay algo que mostrar (sin label, sin destino válido, o apuntando a una página apagada
// → sin botón) — mismo mecanismo que `NosotrosCierre.tsx`.
import { useSiteContent } from '@/components/storefront/SiteContentProvider';
import { useIsPreview } from '@/components/storefront/PreviewMode';
import { REGISTRY, seccionEsVisible, resolverCtaSeccion } from '@/lib/config/site-content-defaults';
import { contenedorAnchoClase } from '@/lib/config/themes';
import CierreFraseYBoton from '@/components/storefront/tienda/CierreFraseYBoton';

export default function SuscripcionCierre() {
  const { suscripcionCierre, navTratamiento, paginas } = useSiteContent();
  const preview = useIsPreview();
  if (!seccionEsVisible(REGISTRY.suscripcionCierre, suscripcionCierre)) return null;
  if (suscripcionCierre.frase.trim() === '') return null;

  const ctaHref = resolverCtaSeccion(suscripcionCierre.ctaLabel, suscripcionCierre.ctaDestino, paginas);
  const cta = ctaHref ? { label: suscripcionCierre.ctaLabel, href: ctaHref } : null;

  return (
    <CierreFraseYBoton
      frase={suscripcionCierre.frase}
      cta={cta}
      preview={preview}
      anchoClase={contenedorAnchoClase(navTratamiento.posicion)}
    />
  );
}
