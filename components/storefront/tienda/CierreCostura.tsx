"use client";

// EL CIERRE «COSTURA» — pieza COMPARTIDA (§ CHAMISAS-SUSCRIPCIONES-CASILLAS-1, sobre § ONIX-PAGINAS-
// PIEZAS-COMPARTIDAS-1, el mismo movimiento que ya hizo `CierreFraseYBoton.tsx`). Nació como la
// composición «Costura» de /tienda (§ TIENDA-CHAMISAS-ALBUM-1, `TiendaCierre.tsx`): tarjeta ANCHA con
// marco punteado, la franja de tejido a sangre arriba y la frase a la izquierda con el botón RELLENO a
// la derecha — la banda punteada que refero-chamisas.md §4 (item 6) pide para /suscripciones ("la
// banda punteada: '¿Prefieres hablarlo primero?' y 'Escribir por WhatsApp'").
//
// PRESENTACIONAL: recibe TODO por props, nunca `useSiteContent`/`useIsPreview` adentro — mismo
// contrato que `CierreFraseYBoton`. `TiendaCierre.tsx` sigue siendo DUEÑO de su lógica (`botonCierre()`,
// el gate `tiendaCierreVisible`); esta pieza sólo la pinta, y ahora la comparte con `SuscripcionCierre`.
//
// § CHAMISAS-PAGINAS-ARREGLOS-1 — LA FRASE PASA DE 20/24px A 22/26px (`.band .q{font-size:22px}`
// mobile / `26px` desde `@container shop (min-width:960px)`, `.scratch/chamisas-paginas/
// nosotros-suscripciones.html`), el GAP que `CHAMISAS-NOSOTROS-MAQUETA-1` ya había medido y dejado
// SIN cerrar por estar esta pieza, en ese momento, fuera de `touches:` (compartida con /tienda Y
// /suscripciones). Contado ANTES de tocarla, los TRES consumidores (`NosotrosCierre`,
// `SuscripcionCierre`, `TiendaCierre`) y su variante CANÓNICA/opt-in:
//   - `nosotrosCierre.variante` canónica es 'linea' (NosotrosCierre.tsx) — 'costura' es opt-in.
//   - `suscripcionCierre.variante` canónica es 'fraseYBoton' (SuscripcionCierre.tsx) — 'costura' es
//     opt-in.
//   - `tiendaCierre.variante` canónica ES 'costura' (site-content-defaults.ts, `DEFAULTS.
//     tiendaCierre.variante`) — comparte 'costura' con CUALQUIER tenant que no la cambie — PERO su
//     `frase` default es `''`, y el gate de `TiendaCierre.tsx` ("sin frase no hay nada que cerrar
//     con") la deja SIN RENDERIZAR sin dato. De los tenants con contenido documentado
//     (DECISIONS.md, § TIENDA-ONIX-CARTELERA-1/`customer_bytes`): Onix activa 'fraseYBoton' —no
//     'costura'— en LAS TRES secciones; Nayoli/el template base se queda en el default vacío. Hoy,
//     medido contra el ledger, las TRES secciones que SÍ pintan `CierreCostura` con contenido real
//     son las que eligió Las Chamisas — el cambio de tamaño no toca ningún otro tenant conocido.
import Link from 'next/link';
import { motion } from 'framer-motion';
import CampoEditable from '@/components/storefront/CampoEditable';

export interface CierreCosturaCta {
  label: string;
  href: string;
}

export interface CierreCosturaProps {
  /** La franja de tejido A SANGRE, arriba de la tarjeta — vacía, no se monta nada en su lugar
   *  (§ el criterio de siempre: "sin imagen, no se imita con CSS"). */
  franjaTejido: string;
  frase: string;
  cta: CierreCosturaCta | null;
  preview: boolean;
  /** El margen lateral — la clase completa de `contenedorAnchoClase(...)`, resuelta por el
   *  llamador (esta pieza no lee `navTratamiento`, nunca `useSiteContent` adentro). */
  anchoClase: string;
  campoFrase: string;
  campoBoton?: string;
  campoFranjaTejido: string;
  /** EL ENLACE SECUNDARIO (§ CHAMISAS-NOSOTROS-ALBUM-1, refero-chamisas.md §3 punto 6: "Botón tinta
   *  ... y enlace «Recibirlo cada mes»"). OPCIONAL, y BYTE-IDÉNTICO para `TiendaCierre`/
   *  `SuscripcionCierre` —los dos consumidores de hoy, ninguno lo pasa—: ausente/`undefined` no
   *  renderiza nada, nunca un hueco vacío al lado del botón. Es texto PLANO subrayado, nunca un
   *  segundo `sf-pildora` — dos píldoras rellenas competirían por la misma atención. */
  ctaSecundario?: CierreCosturaCta | null;
  campoCtaSecundario?: string;
}

export default function CierreCostura({ franjaTejido, frase, cta, preview, anchoClase, campoFrase, campoBoton, campoFranjaTejido, ctaSecundario, campoCtaSecundario }: CierreCosturaProps) {
  return (
    <motion.section
      initial={preview ? false : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="py-16"
    >
      <div className={`${anchoClase} mx-auto`}>
        <div
          className="overflow-hidden rounded-[24px] border-2 border-dashed border-[var(--sf-tinta)]"
          style={{ backgroundColor: 'var(--sf-superficie)' }}
        >
          {/* LA FRANJA DE TEJIDO, a sangre — el `overflow-hidden` del contenedor es lo que le da sus
              esquinas redondeadas; la franja no declara un radio propio. Nunca SVG en línea. */}
          {franjaTejido && (
            <CampoEditable campo={campoFranjaTejido} tipo="imagen">
              <div
                className="h-10 w-full sm:h-14"
                style={{
                  backgroundImage: `url(${franjaTejido})`,
                  backgroundRepeat: 'repeat-x',
                  backgroundSize: 'auto 100%',
                }}
                aria-hidden="true"
              />
            </CampoEditable>
          )}
          <div className="flex flex-col items-start gap-6 p-8 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-playfair text-[22px] text-[var(--sf-tinta)] sm:text-[26px]">
              <CampoEditable campo={campoFrase} multilinea>{frase}</CampoEditable>
            </p>
            <div className="flex shrink-0 flex-col items-start gap-3 sm:items-end">
              <BotonCierreCostura cta={cta} preview={preview} campoBoton={campoBoton} />
              {ctaSecundario && (
                <EnlaceSecundarioCostura cta={ctaSecundario} preview={preview} campo={campoCtaSecundario} />
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.section>
  );
}

/** El enlace secundario — texto subrayado, nunca un botón: la jerarquía es "el botón decide, el
 *  enlace acompaña" (mismo criterio de peso que `ctaSecundarioLabel` del CTA de la home). Mismo
 *  criterio de elemento que `BotonCierreCostura`: ruta interna → `<Link>`, externo/WhatsApp → `<a>`. */
function EnlaceSecundarioCostura({ cta, preview, campo }: { cta: CierreCosturaCta; preview: boolean; campo?: string }) {
  const clase = 'cursor-pointer text-sm font-medium text-[var(--sf-tinta)] underline underline-offset-2 transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--sf-tinta)]';
  const label = campo ? <CampoEditable campo={campo}>{cta.label}</CampoEditable> : cta.label;
  if (cta.href.startsWith('/')) {
    return <Link href={cta.href} className={clase}>{label}</Link>;
  }
  return (
    <a href={cta.href} target={preview ? undefined : '_blank'} rel="noreferrer" className={clase}>
      {label}
    </a>
  );
}

/** El botón del cierre «Costura» — RELLENO (fondo sólido `--sf-tinta`), a diferencia del fantasma de
 *  «Frase y botón». El destino decide el elemento: una ruta interna usa `<Link>`, WhatsApp/externo un
 *  `<a>` con `target="_blank"` salvo en la vista previa del editor. */
function BotonCierreCostura({ cta, preview, campoBoton }: { cta: CierreCosturaCta | null; preview: boolean; campoBoton?: string }) {
  if (!cta) return null;
  const clase = 'sf-pildora shrink-0 cursor-pointer px-6 py-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--sf-tinta)] bg-[var(--sf-tinta)] text-[var(--sf-fondo)] hover:opacity-90';
  const label = campoBoton ? <CampoEditable campo={campoBoton}>{cta.label}</CampoEditable> : cta.label;
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
