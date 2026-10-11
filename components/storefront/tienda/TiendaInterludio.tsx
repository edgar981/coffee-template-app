"use client";

// EL INTERLUDIO «RETRATO Y CITA» (§ TIENDA-CHAMISAS-ALBUM-1) — sección NUEVA, opcional, montada
// SIEMPRE por `page.tsx` (como `SubscriptionCTA` en la home): el GATE vive DENTRO del componente
// (`seccionEsVisible` + "sin imagen no hay nada que mostrar"), no en el llamador.
import Image from 'next/image';
import { motion } from 'framer-motion';
import { useSiteContent } from '@/components/storefront/SiteContentProvider';
import { useIsPreview } from '@/components/storefront/PreviewMode';
import { REGISTRY, seccionEsVisible } from '@/lib/config/site-content-defaults';
import { contenedorAnchoClase } from '@/lib/config/themes';
import InterludioPlano from '@/components/storefront/tienda/InterludioPlano';

export default function TiendaInterludio() {
  const { tiendaInterludio, navTratamiento } = useSiteContent();
  const preview = useIsPreview();
  if (!seccionEsVisible(REGISTRY.tiendaInterludio, tiendaInterludio)) return null;
  // «Opcional de verdad»: el toggle puede estar encendido y aun así no haber nada que mostrar si
  // nadie subió la foto (§ TiendaInterludioContent, "nada de citas ni nombres en los defaults" —
  // no hay retrato de stock que ofrecer en su lugar).
  if (!tiendaInterludio.imagen) return null;

  // LA COMPOSICIÓN «PLANO» (§ TIENDA-ONIX-CARTELERA-1) — una foto documental a sangre, con un pie en
  // micro-mayúsculas; SIN el arco ni la cita atribuida de «Retrato y cita». PIEZA COMPARTIDA
  // (§ ONIX-PAGINAS-PIEZAS-COMPARTIDAS-1): vive en `InterludioPlano.tsx`, presentacional.
  if (tiendaInterludio.variante === 'plano') {
    return <InterludioPlano imagen={tiendaInterludio.imagen} pie={tiendaInterludio.pie} preview={preview} />;
  }

  return (
    <motion.section
      initial={preview ? false : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="py-16"
    >
      {/* EL MARGEN LATERAL (§ TIENDA-ONIX-AJUSTES-1) — sin él, en el celular la cita quedaba pegada
          a los dos bordes mientras el resto de la página respeta `contenedorAnchoClase`. El ancho de
          LECTURA angosto (`max-w-sm`) se queda, anidado adentro. */}
      <div className={`${contenedorAnchoClase(navTratamiento.posicion)} mx-auto`}>
        <div className="mx-auto flex max-w-sm flex-col items-center text-center">
          {/* QUALITY 85 (§ ONIX-PAGINAS-PIEZAS-COMPARTIDAS-1, el pedido del owner del 2026-10-11) —
              antes sin `quality` propio (default 75). `85` ya está en `next.config.ts` →
              `images.qualities`. */}
          <div className="relative w-[70%] overflow-hidden rounded-t-full rounded-b-[20px]" style={{ aspectRatio: '4 / 5' }}>
            <Image src={tiendaInterludio.imagen} alt={tiendaInterludio.firma || ''} fill sizes="(max-width: 768px) 70vw, 30vw" quality={85} className="object-cover" />
          </div>
          {tiendaInterludio.cita && (
            <p className="mt-6 font-playfair text-2xl italic text-[var(--sf-tinta)]">&ldquo;{tiendaInterludio.cita}&rdquo;</p>
          )}
          {tiendaInterludio.firma && (
            <p className="mt-3 text-sm text-[var(--sf-texto)]">— {tiendaInterludio.firma}</p>
          )}
        </div>
      </div>
    </motion.section>
  );
}
