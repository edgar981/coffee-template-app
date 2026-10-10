"use client";

// EL CIERRE «COSTURA» (§ TIENDA-CHAMISAS-ALBUM-1) — sección NUEVA, opcional, montada SIEMPRE por
// `page.tsx`; el gate vive dentro (mismo criterio que `TiendaInterludio`).
import { motion } from 'framer-motion';
import { useSiteContent } from '@/components/storefront/SiteContentProvider';
import { useIsPreview } from '@/components/storefront/PreviewMode';
import { REGISTRY, seccionEsVisible, type TiendaCierreContent } from '@/lib/config/site-content-defaults';
import { whatsappUrl } from '@/lib/config/site';

export default function TiendaCierre({ whatsapp }: { whatsapp?: string } = {}) {
  const { tiendaCierre } = useSiteContent();
  const preview = useIsPreview();
  if (!seccionEsVisible(REGISTRY.tiendaCierre, tiendaCierre)) return null;

  // LA COMPOSICIÓN «FRASE Y BOTÓN» (§ TIENDA-ONIX-CARTELERA-1) — banda crema con una frase en serif
  // mayúscula y un botón fantasma a WhatsApp, SIN el marco punteado ni la franja de tejido de
  // «Costura». CERO campos propios: reusa `frase`/`boton` tal cual.
  if (tiendaCierre.variante === 'fraseYBoton') {
    return <TiendaCierreFraseYBoton tiendaCierre={tiendaCierre} whatsapp={whatsapp} preview={preview} />;
  }

  return (
    <motion.section
      initial={preview ? false : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="py-16"
    >
      <div
        className="mx-auto max-w-2xl rounded-[24px] border-2 border-dashed border-[var(--sf-tinta)] p-8 text-center"
        style={{ backgroundColor: 'var(--sf-superficie)' }}
      >
        {/* LA FRANJA DE TEJIDO (§ el spec, item 5): fondo que SE REPITE en horizontal — nunca SVG en
            línea (§ el censo, `constants/upload.ts` no acepta SVG como contenido general). Sin
            imagen, no se imita con CSS (§ la referencia): no se monta nada en su lugar. */}
        {tiendaCierre.franjaTejido && (
          <div
            className="mx-auto -mt-8 mb-6 h-10 w-full max-w-md rounded-t-[24px]"
            style={{
              backgroundImage: `url(${tiendaCierre.franjaTejido})`,
              backgroundRepeat: 'repeat-x',
              backgroundSize: 'auto 100%',
            }}
            aria-hidden="true"
          />
        )}
        <p className="font-playfair text-xl text-[var(--sf-tinta)]">{tiendaCierre.frase}</p>
        {whatsapp && (
          <a
            href={whatsappUrl(whatsapp, 'Hola, quiero más información sobre el envío mensual.')}
            target={preview ? undefined : '_blank'}
            rel="noreferrer"
            className="sf-pildora mt-6 inline-block bg-[var(--sf-tinta)] px-6 py-3 text-sm font-medium text-[var(--sf-fondo)]"
          >
            {tiendaCierre.boton}
          </a>
        )}
      </div>
    </motion.section>
  );
}

// LA COMPOSICIÓN «FRASE Y BOTÓN» (§ TIENDA-ONIX-CARTELERA-1, la referencia aprobada: banda plana,
// sin marco ni franja, frase a la izquierda y el botón fantasma al lado). Headless, como el resto —
// sin wrapper propio más allá del necesario para esta composición.
function TiendaCierreFraseYBoton({
  tiendaCierre, whatsapp, preview,
}: {
  tiendaCierre: TiendaCierreContent;
  whatsapp?: string;
  preview: boolean;
}) {
  return (
    <motion.section
      initial={preview ? false : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="py-16"
    >
      <div className="mx-auto flex max-w-4xl flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-playfair text-3xl uppercase leading-tight text-[var(--sf-tinta)] sm:text-4xl">
          {tiendaCierre.frase}
        </p>
        {whatsapp && (
          <a
            href={whatsappUrl(whatsapp, 'Hola, quiero más información sobre el envío mensual.')}
            target={preview ? undefined : '_blank'}
            rel="noreferrer"
            className="sf-pildora shrink-0 border border-[var(--sf-tinta)] px-6 py-3 text-sm font-medium text-[var(--sf-tinta)]"
          >
            {tiendaCierre.boton}
          </a>
        )}
      </div>
    </motion.section>
  );
}
