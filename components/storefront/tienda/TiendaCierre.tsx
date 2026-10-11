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
import { REGISTRY, seccionEsVisible, type TiendaCierreContent } from '@/lib/config/site-content-defaults';
import { contenedorAnchoClase } from '@/lib/config/themes';
import { tiendaCierreVisible, botonCierre, type CierreCta } from '@/lib/tienda/tienda-cierre';

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
  // campos propios: reusa `frase`/`boton` tal cual.
  if (tiendaCierre.variante === 'fraseYBoton') {
    return <TiendaCierreFraseYBoton tiendaCierre={tiendaCierre} cta={cta} preview={preview} navTratamiento={navTratamiento} />;
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
            <div
              className="h-10 w-full sm:h-14"
              style={{
                backgroundImage: `url(${tiendaCierre.franjaTejido})`,
                backgroundRepeat: 'repeat-x',
                backgroundSize: 'auto 100%',
              }}
              aria-hidden="true"
            />
          )}
          {/* LA FRASE A LA IZQUIERDA, EL BOTÓN A LA DERECHA (§ el spec, item 3) — en el celular, uno
              debajo del otro. Antes: `text-center` con el botón apilado siempre debajo. */}
          <div className="flex flex-col items-start gap-6 p-8 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-playfair text-xl text-[var(--sf-tinta)] sm:text-2xl">{tiendaCierre.frase}</p>
            <BotonCierre cta={cta} preview={preview} relleno />
          </div>
        </div>
      </div>
    </motion.section>
  );
}

/** EL BOTÓN DEL CIERRE (§ el spec, item 3) — SIN WhatsApp cargado, NO desaparece: `botonCierre`
 *  (lib/tienda/tienda-cierre.ts) ya decidió el destino (WhatsApp, /suscripciones, o ninguno); este
 *  componente sólo lo pinta. `relleno` distingue las dos pieles que las dos composiciones ya tenían
 *  (Costura: fondo sólido `--sf-tinta`; Frase y botón: fantasma con borde) — mismo tratamiento visual
 *  de antes, ahora alimentado por el destino compartido. EL DESTINO DECIDE EL ELEMENTO: `/suscripciones`
 *  —una ruta interna— usa `<Link>` (igual que el resto de los CTA del storefront, § `NosotrosCierre.tsx`);
 *  WhatsApp sigue siendo un `<a>` externo, con `target="_blank"` salvo en la vista previa del editor. */
function BotonCierre({ cta, preview, relleno }: { cta: CierreCta | null; preview: boolean; relleno: boolean }) {
  if (!cta) return null;
  const clasePiel = relleno
    ? 'bg-[var(--sf-tinta)] text-[var(--sf-fondo)] hover:opacity-90'
    : 'border border-[var(--sf-tinta)] text-[var(--sf-tinta)] hover:bg-[var(--sf-tinta)] hover:text-[var(--sf-fondo)]';
  const clase = `sf-pildora shrink-0 cursor-pointer px-6 py-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--sf-tinta)] ${clasePiel}`;
  if (cta.href.startsWith('/')) {
    return <Link href={cta.href} className={clase}>{cta.label}</Link>;
  }
  return (
    <a
      href={cta.href}
      target={preview ? undefined : '_blank'}
      rel="noreferrer"
      className={clase}
    >
      {cta.label}
    </a>
  );
}

// LA COMPOSICIÓN «FRASE Y BOTÓN» (§ TIENDA-ONIX-CARTELERA-1, la referencia aprobada: banda plana,
// sin marco ni franja, frase a la izquierda y el botón fantasma al lado). Headless, como el resto —
// sin wrapper propio más allá del necesario para esta composición. El ANCHO no cambia en esta tanda
// (`max-w-4xl`, el literal de siempre): el spec sólo fija el ancho de «Costura» contra la maqueta
// aprobada (§ item 3); ensancharla también habría sido una decisión visual nueva, sin maqueta que
// la respalde.
function TiendaCierreFraseYBoton({
  tiendaCierre, cta, preview, navTratamiento,
}: {
  tiendaCierre: TiendaCierreContent;
  cta: CierreCta | null;
  preview: boolean;
  navTratamiento: { posicion: boolean };
}) {
  return (
    <motion.section
      initial={preview ? false : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="py-16"
    >
      {/* EL MARGEN LATERAL (§ TIENDA-ONIX-AJUSTES-1) — faltaba del todo: en el celular esta banda
          quedaba pegada a los dos bordes mientras el resto de la página respeta
          `contenedorAnchoClase`. El `max-w-4xl` del spec (§ el comentario de arriba, "el ancho NO
          cambia en esta tanda") se queda, anidado adentro. */}
      <div className={`${contenedorAnchoClase(navTratamiento.posicion)} mx-auto`}>
        <div className="mx-auto flex max-w-4xl flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-playfair text-3xl uppercase leading-tight text-[var(--sf-tinta)] sm:text-4xl">
            {tiendaCierre.frase}
          </p>
          <BotonCierre cta={cta} preview={preview} relleno={false} />
        </div>
      </div>
    </motion.section>
  );
}
