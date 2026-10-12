"use client";

// EL CIERRE «COSTURA» (§ TIENDA-CHAMISAS-ALBUM-1, el VISUAL y el CTA REESCRITOS en
// § TIENDA-CHAMISAS-AJUSTES-1) — sección NUEVA, opcional, montada SIEMPRE por `page.tsx`; el gate
// vive dentro (mismo criterio que `TiendaInterludio`): `seccionEsVisible` (el toggle) Y
// `tiendaCierreVisible` (tener `frase` — § TIENDA-CHAMISAS-AJUSTES-1, "publicar = se ve", nunca un
// segundo interruptor que el dueño tenga que prender aparte).
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useSiteContent } from '@/components/storefront/SiteContentProvider';
import { useIsPreview } from '@/components/storefront/PreviewMode';
import { REGISTRY, seccionEsVisible } from '@/lib/config/site-content-defaults';
import { contenedorAnchoClase } from '@/lib/config/themes';
import { tiendaCierreVisible, botonCierre, type CierreCta } from '@/lib/tienda/tienda-cierre';
import CierreFraseYBoton from '@/components/storefront/tienda/CierreFraseYBoton';
import CampoEditable from '@/components/storefront/CampoEditable';

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
  return (
    <motion.section
      initial={preview ? false : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="py-16"
    >
      <div className={`${contenedorAnchoClase(navTratamiento.posicion)} mx-auto`}>
        <div
          className="overflow-hidden rounded-[24px] border-2 border-dashed border-[var(--sf-tinta)]"
          style={{ backgroundColor: 'var(--sf-superficie)' }}
        >
          {/* LA FRANJA DE TEJIDO (§ el spec, item 3): A SANGRE —de borde a borde de la TARJETA, sin
              márgenes ni ancho acotado (antes `max-w-md` con margen negativo, flotando por encima en
              vez de coser el borde de arriba)— repitiéndose en horizontal SIN deformarse
              (`backgroundSize: auto 100%`). El `overflow-hidden` del contenedor es lo que le da sus
              esquinas redondeadas (las de la tarjeta), sin que la franja declare un radio propio.
              Nunca SVG en línea (§ el censo, `constants/upload.ts` no acepta SVG como contenido
              general). Sin imagen, no se imita con CSS (§ la referencia): no se monta nada en su
              lugar. */}
          {tiendaCierre.franjaTejido && (
            <CampoEditable campo="tiendaCierre.franjaTejido" tipo="imagen">
              <div
                className="h-10 w-full sm:h-14"
                style={{
                  backgroundImage: `url(${tiendaCierre.franjaTejido})`,
                  backgroundRepeat: 'repeat-x',
                  backgroundSize: 'auto 100%',
                }}
                aria-hidden="true"
              />
            </CampoEditable>
          )}
          {/* LA FRASE A LA IZQUIERDA, EL BOTÓN A LA DERECHA (§ el spec, item 3) — en el celular, uno
              debajo del otro. Antes: `text-center` con el botón apilado siempre debajo. */}
          <div className="flex flex-col items-start gap-6 p-8 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-playfair text-xl text-[var(--sf-tinta)] sm:text-2xl"><CampoEditable campo="tiendaCierre.frase" multilinea>{tiendaCierre.frase}</CampoEditable></p>
            <BotonCierre cta={cta} preview={preview} />
          </div>
        </div>
      </div>
    </motion.section>
  );
}

/** EL BOTÓN DEL CIERRE «COSTURA» (§ el spec, item 3) — SIN WhatsApp cargado, NO desaparece:
 *  `botonCierre` (lib/tienda/tienda-cierre.ts) ya decidió el destino (WhatsApp, /suscripciones, o
 *  ninguno); este componente sólo lo pinta, con la piel RELLENA de «Costura» (fondo sólido
 *  `--sf-tinta`). La piel fantasma de «Frase y botón» (§ ONIX-PAGINAS-PIEZAS-COMPARTIDAS-1) vive
 *  ahora en su propio `BotonCierre` dentro de `CierreFraseYBoton.tsx` — esta función dejó de
 *  servir a las dos composiciones, así que el parámetro `relleno` que las distinguía se retiró con
 *  el segundo caller. EL DESTINO DECIDE EL ELEMENTO: `/suscripciones` —una ruta interna— usa
 *  `<Link>` (igual que el resto de los CTA del storefront, § `NosotrosCierre.tsx`); WhatsApp sigue
 *  siendo un `<a>` externo, con `target="_blank"` salvo en la vista previa del editor. */
function BotonCierre({ cta, preview }: { cta: CierreCta | null; preview: boolean }) {
  if (!cta) return null;
  const clase = 'sf-pildora shrink-0 cursor-pointer px-6 py-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--sf-tinta)] bg-[var(--sf-tinta)] text-[var(--sf-fondo)] hover:opacity-90';
  // § EDITOR-ORDEN-Y-LIENZO-1, item 3 — `tiendaCierre.boton` es el campo que controla esta etiqueta
  // CUANDO WhatsApp está configurado (§ T-CIE1, deuda conocida: sin número, `botonCierre()` la
  // reemplaza por "Ver suscripciones" y el click-to-edit abriría un campo que no es el texto a la
  // vista — el mismo caveat que ya documenta T-CIE1, no corregido por este slice).
  const label = <CampoEditable campo="tiendaCierre.boton">{cta.label}</CampoEditable>;
  if (cta.href.startsWith('/')) {
    return <Link href={cta.href} className={clase}>{label}</Link>;
  }
  return (
    <a
      href={cta.href}
      target={preview ? undefined : '_blank'}
      rel="noreferrer"
      className={clase}
    >
      {label}
    </a>
  );
}
