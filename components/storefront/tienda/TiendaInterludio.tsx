"use client";

// EL INTERLUDIO «RETRATO Y CITA» (§ TIENDA-CHAMISAS-ALBUM-1) — sección NUEVA, opcional, montada
// SIEMPRE por `page.tsx` (como `SubscriptionCTA` en la home): el GATE vive DENTRO del componente
// (`seccionEsVisible` + "sin imagen no hay nada que mostrar"), no en el llamador.
import Image from 'next/image';
import { motion } from 'framer-motion';
import { useSiteContent } from '@/components/storefront/SiteContentProvider';
import { useIsPreview } from '@/components/storefront/PreviewMode';
import { REGISTRY, seccionEsVisible } from '@/lib/config/site-content-defaults';

export default function TiendaInterludio() {
  const { tiendaInterludio } = useSiteContent();
  const preview = useIsPreview();
  if (!seccionEsVisible(REGISTRY.tiendaInterludio, tiendaInterludio)) return null;
  // «Opcional de verdad»: el toggle puede estar encendido y aun así no haber nada que mostrar si
  // nadie subió la foto (§ TiendaInterludioContent, "nada de citas ni nombres en los defaults" —
  // no hay retrato de stock que ofrecer en su lugar).
  if (!tiendaInterludio.imagen) return null;

  return (
    <motion.section
      initial={preview ? false : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="py-16"
    >
      <div className="mx-auto flex max-w-sm flex-col items-center text-center">
        <div className="relative w-[70%] overflow-hidden rounded-t-full rounded-b-[20px]" style={{ aspectRatio: '4 / 5' }}>
          <Image src={tiendaInterludio.imagen} alt={tiendaInterludio.firma || ''} fill sizes="(max-width: 768px) 70vw, 30vw" className="object-cover" />
        </div>
        {tiendaInterludio.cita && (
          <p className="mt-6 font-playfair text-2xl italic text-[var(--sf-tinta)]">&ldquo;{tiendaInterludio.cita}&rdquo;</p>
        )}
        {tiendaInterludio.firma && (
          <p className="mt-3 text-sm text-[var(--sf-texto)]">— {tiendaInterludio.firma}</p>
        )}
      </div>
    </motion.section>
  );
}
