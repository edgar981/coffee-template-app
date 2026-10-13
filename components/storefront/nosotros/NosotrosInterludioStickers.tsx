"use client";

// EL INTERLUDIO «STICKERS» (§ CHAMISAS-NOSOTROS-ALBUM-1, refero-chamisas.md §3 punto 5): la franja de
// tejido a sangre con los cafés del CATÁLOGO como stickers recortados sobre su color, cada uno
// enlazando a su ficha (`/tienda/[slug]`). Segunda composición de `nosotrosInterludio`, hermana de
// `InterludioPlano` bajo el mismo dispatcher (`NosotrosInterludio.tsx`).
//
// `imagen` SE REUSA como la franja de tejido (§ el docstring de `NosotrosInterludioContent`) — no es
// un campo nuevo; el dispatcher sólo monta esta pieza con `imagen` ya garantizada no-vacía (el gate
// vive ahí, igual que con «plano»).
//
// EL COLOR DE CADA STICKER SALE DE `colorDeLamina` (`lib/tienda/laminas.ts`, ya existente) sobre
// `tiendaCatalogo.coloresPorProducto` — el MISMO mapa que «Láminas» de /tienda y que las Casillas de
// frecuencia, nunca un segundo sistema de color. El catálogo se fetchea con `getCatalog()`
// (memoizado a nivel de módulo, § lib/api/products.ts): mientras carga o si está vacío, no se
// muestra ningún sticker — la franja de tejido sigue ahí, decorativa, nunca un hueco roto.
//
// MOVIMIENTO (§ el spec, refero-chamisas.md: "sólo los stickers 'se pegan', una vez, al entrar en
// pantalla: rotación de −8° a −3° y escala de 1,06 a 1, en 200 ms"): framer-motion con
// `whileInView`/`viewport={{once:true}}`, el MISMO mecanismo que el resto de /nosotros
// (`NosotrosEscenas.tsx`) — no un `@keyframes` propio, porque acá la entrada depende del SCROLL, no
// del montaje. `initial={preview ? false : …}` apaga la animación en la vista previa del editor,
// como el resto de las secciones.
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useSiteContent } from '@/components/storefront/SiteContentProvider';
import { useIsPreview } from '@/components/storefront/PreviewMode';
import { getCatalog } from '@/lib/api/products';
import { colorDeLamina } from '@/lib/tienda/laminas';
import CampoEditable from '@/components/storefront/CampoEditable';
import type { Product } from '@/types/product';

export default function NosotrosInterludioStickers({ imagen }: { imagen: string }) {
  const { tiendaCatalogo } = useSiteContent();
  const preview = useIsPreview();
  const [catalog, setCatalog] = useState<Product[] | null>(null);
  useEffect(() => {
    getCatalog().then(setCatalog).catch(() => setCatalog([]));
  }, []);

  return (
    <section className="relative overflow-hidden bg-[var(--sf-tinta)] py-20">
      <CampoEditable campo="nosotrosInterludio.imagen" tipo="imagen">
        <div
          className="absolute inset-0"
          style={{ backgroundImage: `url(${imagen})`, backgroundRepeat: 'repeat', backgroundSize: 'auto' }}
          aria-hidden="true"
        />
      </CampoEditable>
      {catalog && catalog.length > 0 && (
        <div className="relative z-10 mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-8 px-6">
          {catalog.map((product, i) => {
            const color = colorDeLamina(product.id, i, tiendaCatalogo.coloresPorProducto);
            return (
              <motion.div
                key={product.id}
                initial={preview ? false : { opacity: 0, scale: 1.06, rotate: -8 }}
                whileInView={{ opacity: 1, scale: 1, rotate: -3 }}
                viewport={{ once: true }}
                transition={{ duration: 0.2 }}
              >
                <Link
                  href={`/tienda/${product.slug}`}
                  aria-label={product.nombre}
                  className="block h-24 w-24 rounded-full border-4 border-[var(--sf-fondo)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--sf-fondo)] sm:h-28 sm:w-28"
                  style={{ backgroundColor: color }}
                />
              </motion.div>
            );
          })}
        </div>
      )}
    </section>
  );
}
