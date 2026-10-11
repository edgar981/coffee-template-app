"use client";

// EL CIERRE «FRASE Y BOTÓN» — pieza COMPARTIDA (§ ONIX-PAGINAS-PIEZAS-COMPARTIDAS-1). Nació como la
// composición «Frase y botón» del cierre de /tienda (§ TIENDA-ONIX-CARTELERA-1, `TiendaCierre.tsx`):
// banda crema con una frase en serif mayúscula y un botón fantasma — sin el marco punteado ni la
// franja de tejido de «Costura». El owner aprobó el 2026-10-11 montarla también en /suscripciones y
// /nosotros, cada una con SU PROPIA frase y SU PROPIO destino de botón
// (§ ONIX-PAGINAS-COMPOSICIONES-CENSO-1) — nunca el `botonCierre()`/`MENSAJE_WHATSAPP` de /tienda,
// que son lógica de ESA composición (WhatsApp sobre el envío mensual, con fallback a
// /suscripciones), no de esta pieza.
//
// PRESENTACIONAL: recibe TODO por props, nunca `useSiteContent`/`useIsPreview` adentro. El `cta` ya
// viene DECIDIDO por el llamador (label + href, o `null` sin botón que mostrar); esta pieza sólo
// elige el ELEMENTO según el destino (`<Link>` para una ruta interna, `<a target="_blank">` para
// WhatsApp/externo — mismo criterio que ya tenía `BotonCierre` en `TiendaCierre.tsx`).
import Link from 'next/link';
import { motion } from 'framer-motion';

export interface CierreFraseYBotonCta {
  label: string;
  href: string;
}

export interface CierreFraseYBotonProps {
  frase: string;
  cta: CierreFraseYBotonCta | null;
  preview: boolean;
  /** El margen lateral (§ TIENDA-ONIX-AJUSTES-1): la clase completa de `contenedorAnchoClase(...)`,
   *  resuelta por el llamador — esta pieza no lee `navTratamiento` (nunca `useSiteContent` adentro). */
  anchoClase: string;
}

export default function CierreFraseYBoton({ frase, cta, preview, anchoClase }: CierreFraseYBotonProps) {
  return (
    <motion.section
      initial={preview ? false : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="py-16"
    >
      <div className={`${anchoClase} mx-auto`}>
        <div className="mx-auto flex max-w-4xl flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-playfair text-3xl uppercase leading-tight text-[var(--sf-tinta)] sm:text-4xl">
            {frase}
          </p>
          <BotonCierre cta={cta} preview={preview} />
        </div>
      </div>
    </motion.section>
  );
}

/** EL BOTÓN DEL CIERRE — EL DESTINO DECIDE EL ELEMENTO: una ruta interna (`/suscripciones`, …) usa
 *  `<Link>` (igual que el resto de los CTA del storefront); un enlace externo (WhatsApp) sigue
 *  siendo un `<a>`, con `target="_blank"` salvo en la vista previa del editor. */
function BotonCierre({ cta, preview }: { cta: CierreFraseYBotonCta | null; preview: boolean }) {
  if (!cta) return null;
  const clase = 'sf-pildora shrink-0 cursor-pointer px-6 py-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--sf-tinta)] border border-[var(--sf-tinta)] text-[var(--sf-tinta)] hover:bg-[var(--sf-tinta)] hover:text-[var(--sf-fondo)]';
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
