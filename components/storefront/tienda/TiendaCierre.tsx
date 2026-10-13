"use client";

// EL CIERRE «COSTURA» (§ TIENDA-CHAMISAS-ALBUM-1, el VISUAL y el CTA REESCRITOS en
// § TIENDA-CHAMISAS-AJUSTES-1) — sección NUEVA, opcional, montada SIEMPRE por `page.tsx`; el gate
// vive dentro (mismo criterio que `TiendaInterludio`): `seccionEsVisible` (el toggle) Y
// `tiendaCierreVisible` (tener `frase` — § TIENDA-CHAMISAS-AJUSTES-1, "publicar = se ve", nunca un
// segundo interruptor que el dueño tenga que prender aparte).
import { useSiteContent } from '@/components/storefront/SiteContentProvider';
import { useIsPreview } from '@/components/storefront/PreviewMode';
import { REGISTRY, seccionEsVisible } from '@/lib/config/site-content-defaults';
import { contenedorAnchoClase } from '@/lib/config/themes';
import { tiendaCierreVisible, botonCierre } from '@/lib/tienda/tienda-cierre';
import CierreFraseYBoton from '@/components/storefront/tienda/CierreFraseYBoton';
import CierreCostura from '@/components/storefront/tienda/CierreCostura';

const MENSAJE_WHATSAPP = 'Hola, quiero más información sobre el envío mensual.';

export default function TiendaCierre({ whatsapp }: { whatsapp?: string } = {}) {
  const { tiendaCierre, navTratamiento, paginas } = useSiteContent();
  const preview = useIsPreview();
  if (!seccionEsVisible(REGISTRY.tiendaCierre, tiendaCierre)) return null;
  // «SIN FRASE NO HAY NADA QUE CERRAR CON» (§ el spec, item 2) — el gate real de esta sección, no el
  // toggle de arriba: con contenido, publicar ya alcanza; sin él, encender el toggle no muestra nada.
  if (!tiendaCierreVisible(tiendaCierre.frase)) return null;

  const cta = botonCierre({
    whatsapp, boton: tiendaCierre.boton, mensajeWhatsapp: MENSAJE_WHATSAPP,
    suscripcionesVisible: paginas.suscripciones.visible,
  });

  // LA COMPOSICIÓN «FRASE Y BOTÓN» (§ TIENDA-ONIX-CARTELERA-1) — banda crema con una frase en serif
  // mayúscula y un botón fantasma, SIN el marco punteado ni la franja de tejido de «Costura». CERO
  // campos propios: reusa `frase`/`boton` tal cual. PIEZA COMPARTIDA
  // (§ ONIX-PAGINAS-PIEZAS-COMPARTIDAS-1): vive en `CierreFraseYBoton.tsx`, presentacional — el
  // `cta` ya sale DECIDIDO de `botonCierre()` (arriba), que sigue siendo lógica de ESTA composición.
  if (tiendaCierre.variante === 'fraseYBoton') {
    return (
      <CierreFraseYBoton
        frase={tiendaCierre.frase}
        cta={cta}
        preview={preview}
        anchoClase={contenedorAnchoClase(navTratamiento.posicion)}
        campoFrase="tiendaCierre.frase"
        campoBoton="tiendaCierre.boton"
      />
    );
  }

  // LA TARJETA ES ANCHA (§ el spec, item 3) — el MISMO ancho de contenido que el resto de la
  // página (`contenedorAnchoClase`, el eje compartido con el encabezado/catálogo de todo el
  // storefront), no una caja angosta centrada (`max-w-2xl`, el literal de antes de este slice).
  //
  // § CHAMISAS-SUSCRIPCIONES-CASILLAS-1 — EXTRAÍDA a la pieza COMPARTIDA `CierreCostura.tsx`
  // (§ ONIX-PAGINAS-PIEZAS-COMPARTIDAS-1, mismo movimiento que ya hizo `CierreFraseYBoton`):
  // SuscripcionCierre la reusa para la "banda punteada" que refero-chamisas.md §4 pide. Markup
  // byte-idéntico al de antes — sólo se movió de acá a la pieza, con los mismos props.
  return (
    <CierreCostura
      franjaTejido={tiendaCierre.franjaTejido}
      frase={tiendaCierre.frase}
      cta={cta}
      preview={preview}
      anchoClase={contenedorAnchoClase(navTratamiento.posicion)}
      campoFrase="tiendaCierre.frase"
      campoBoton="tiendaCierre.boton"
      campoFranjaTejido="tiendaCierre.franjaTejido"
    />
  );
}
