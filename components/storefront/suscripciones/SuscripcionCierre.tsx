"use client";

// EL CIERRE de /suscripciones (§ ONIX-SUSCRIPCION-LETRA-CIERRE-1, ganó `variante` en §
// CHAMISAS-SUSCRIPCIONES-CASILLAS-1) — misma razón que el interludio (SuscripcionInterludio.tsx):
// contenido PROPIO de esta página. 'fraseYBoton' (canónica, montada con `CierreFraseYBoton`,
// § ONIX-PAGINAS-PIEZAS-COMPARTIDAS-1) | 'costura' (montada con `CierreCostura`, la pieza
// COMPARTIDA con /tienda que refero-chamisas.md §4 pide como "la banda punteada" — item 6: "¿Prefieres
// hablarlo primero?" / "Escribir por WhatsApp").
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
import CierreCostura from '@/components/storefront/tienda/CierreCostura';

export default function SuscripcionCierre() {
  const { suscripcionCierre, navTratamiento, paginas } = useSiteContent();
  const preview = useIsPreview();
  if (!seccionEsVisible(REGISTRY.suscripcionCierre, suscripcionCierre)) return null;
  if (suscripcionCierre.frase.trim() === '') return null;

  const ctaHref = resolverCtaSeccion(suscripcionCierre.ctaLabel, suscripcionCierre.ctaDestino, paginas);
  const cta = ctaHref ? { label: suscripcionCierre.ctaLabel, href: ctaHref } : null;
  const anchoClase = contenedorAnchoClase(navTratamiento.posicion);

  if (suscripcionCierre.variante === 'costura') {
    return (
      <CierreCostura
        franjaTejido={suscripcionCierre.franjaTejido}
        frase={suscripcionCierre.frase}
        cta={cta}
        preview={preview}
        anchoClase={anchoClase}
        campoFrase="suscripcionCierre.frase"
        campoBoton="suscripcionCierre.ctaLabel"
        campoFranjaTejido="suscripcionCierre.franjaTejido"
      />
    );
  }

  return (
    <CierreFraseYBoton
      frase={suscripcionCierre.frase}
      cta={cta}
      preview={preview}
      anchoClase={anchoClase}
      campoFrase="suscripcionCierre.frase"
      campoBoton="suscripcionCierre.ctaLabel"
      // § ONIX-CIERRE-Y-CURSOR-1 — la maqueta aprobada de /suscripciones pinta este cierre con la
      // banda `--sf-papel`, distinta del fondo de la página (ver el docstring de la prop).
      bandaPapel
    />
  );
}
