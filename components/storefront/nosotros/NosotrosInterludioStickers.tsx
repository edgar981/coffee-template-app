"use client";

// EL INTERLUDIO «STICKERS» (§ CHAMISAS-NOSOTROS-ALBUM-1, refero-chamisas.md §3 punto 5): la franja de
// tejido a sangre con los cafés del CATÁLOGO como stickers, cada uno enlazando a su ficha
// (`/tienda/[slug]`). Segunda composición de `nosotrosInterludio`, hermana de `InterludioPlano` bajo
// el mismo dispatcher (`NosotrosInterludio.tsx`).
//
// `imagen` SE REUSA como la franja de tejido (§ el docstring de `NosotrosInterludioContent`) — no es
// un campo nuevo; el dispatcher sólo monta esta pieza con `imagen` ya garantizada no-vacía (el gate
// vive ahí, igual que con «plano»).
//
// § CHAMISAS-NOSOTROS-ARCO-E-INTERLUDIO-1 — EL STICKER PASA DE CÍRCULO DE COLOR A TARJETA CON FOTO
// + NOMBRE + NOTAS, medido contra la maqueta aprobada (`.scratch/chamisas-paginas/capturas/
// v-d-nosotros.jpg`): por cada café, una tarjeta redondeada del color del café con la foto de la
// bolsa (`producto.imagen`) ENCIMA, y debajo —fuera de la tarjeta, sobre la franja— el nombre en
// serif y sus notas. "Qué se muestra por café" (color/foto-o-ausencia/nombre/notas) se extrajo a
// `stickersDeCatalogo` (`lib/storefront/interludio-stickers.ts`, PURA, con su test) — este
// componente sólo RENDERIZA lo que esa función ya resolvió, no decide nada por su cuenta.
//
// EL COLOR DE CADA STICKER SIGUE SALIENDO DE `colorDeLamina` (vía `stickersDeCatalogo`) sobre
// `tiendaCatalogo.coloresPorProducto` — el MISMO mapa que «Láminas» de /tienda y que las Casillas de
// frecuencia, nunca un segundo sistema de color (sin cambio respecto de antes de esta tanda). El
// catálogo se fetchea con `getCatalog()` (memoizado a nivel de módulo, § lib/api/products.ts):
// mientras carga o si está vacío, no se muestra ningún sticker — la franja de tejido sigue ahí,
// decorativa, nunca un hueco roto.
//
// SIN FOTO, LA TARJETA DE COLOR SOLA (§ el spec) — `stickersDeCatalogo` ya resuelve `imagen: null`
// para ese caso (string vacía o ausente), así que acá basta un `&&`: nunca un `<img src="">` roto.
// SIN NOTAS, SIN LÍNEA — mismo criterio, `notas: null` omite el párrafo entero.
//
// MOVIMIENTO (§ el spec, refero-chamisas.md: "sólo los stickers 'se pegan', una vez, al entrar en
// pantalla: rotación de −8° a −3° y escala de 1,06 a 1, en 200 ms"): framer-motion con
// `whileInView`/`viewport={{once:true}}`, el MISMO mecanismo que el resto de /nosotros
// (`NosotrosEscenas.tsx`) — no un `@keyframes` propio, porque acá la entrada depende del SCROLL, no
// del montaje. `initial={preview ? false : …}` apaga la animación en la vista previa del editor,
// como el resto de las secciones. SIN CAMBIO respecto de antes de esta tanda.
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useSiteContent } from '@/components/storefront/SiteContentProvider';
import { useIsPreview } from '@/components/storefront/PreviewMode';
import { getCatalog } from '@/lib/api/products';
import { stickersDeCatalogo, type StickerCafe } from '@/lib/storefront/interludio-stickers';
import CampoEditable from '@/components/storefront/CampoEditable';
import type { Product } from '@/types/product';

function Sticker({ sticker, preview }: { sticker: StickerCafe; preview: boolean }) {
  return (
    <motion.div
      initial={preview ? false : { opacity: 0, scale: 1.06, rotate: -8 }}
      whileInView={{ opacity: 1, scale: 1, rotate: -3 }}
      viewport={{ once: true }}
      transition={{ duration: 0.2 }}
    >
      <Link
        href={`/tienda/${sticker.slug}`}
        className="flex w-32 flex-col items-center gap-3 text-center transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--sf-fondo)] sm:w-36"
      >
        {/* LA TARJETA — color SIEMPRE, foto si la hay. `p-4` deja el color de la tarjeta visible como
            margen alrededor de la foto (como la maqueta); la foto va en un contenedor INTERIOR propio
            (no directo en la tarjeta con padding) porque `fill` resuelve `inset:0` contra el
            BORDE de su ancestro posicionado, ignorando el padding — mismo mecanismo que el arco de
            `NosotrosAperturaAlbum.tsx` (§ el `relative` que esa pieza necesita en SU PROPIA caja). */}
        <div
          className="relative aspect-[4/5] w-full overflow-hidden rounded-[22px] p-4"
          style={{ backgroundColor: sticker.color }}
        >
          {sticker.imagen && (
            <div className="relative h-full w-full overflow-hidden rounded-[14px]">
              <Image src={sticker.imagen} alt="" fill sizes="144px" className="object-cover" />
            </div>
          )}
        </div>
        {/* EL NOMBRE Y LAS NOTAS VAN DEBAJO de la tarjeta, no adentro (§ el spec, "con su nombre y sus
            notas debajo") — sobre la franja de tejido, no sobre el color de la tarjeta. Texto claro
            (`--sf-fondo`) porque la franja de esta sección es oscura (`bg-[var(--sf-tinta)]`, como
            `InterludioPlano.tsx` ya trata su pie de foto, § el docstring de esa pieza). */}
        <div>
          <p className="font-playfair text-base text-[var(--sf-fondo)]">{sticker.nombre}</p>
          {sticker.notas && <p className="mt-0.5 text-xs text-[var(--sf-fondo)]/70">{sticker.notas}</p>}
        </div>
      </Link>
    </motion.div>
  );
}

export default function NosotrosInterludioStickers({ imagen }: { imagen: string }) {
  const { tiendaCatalogo } = useSiteContent();
  const preview = useIsPreview();
  const [catalog, setCatalog] = useState<Product[] | null>(null);
  useEffect(() => {
    getCatalog().then(setCatalog).catch(() => setCatalog([]));
  }, []);

  const stickers = catalog ? stickersDeCatalogo(catalog, tiendaCatalogo.coloresPorProducto) : [];

  return (
    // § CHAMISAS-NOSOTROS-FIDELIDAD-1 — `mt-20 lg:mt-[120px]` (MARGEN, no padding) se agrega acá, no
    // en la pieza anterior (NosotrosFichaEtiqueta.tsx): medido en captura real que el fondo oscuro
    // de esta sección arrancaba pegado contra la tarjeta de la ficha, sin un solo píxel de crema
    // entre medio — la maqueta separa con `.inter{margin:80px 0 0}`/`120px` (MARGEN, que deja ver
    // el fondo del PADRE antes de que empiece el de esta sección), no con padding (que el propio
    // `bg-[var(--sf-tinta)]` de esta sección ya rellena, así que no abre ningún hueco). `py-20` se
    // queda: sigue siendo el espacio INTERNO entre el borde de la sección y los stickers.
    <section className="relative mt-20 overflow-hidden bg-[var(--sf-tinta)] py-20 lg:mt-[120px]">
      <CampoEditable campo="nosotrosInterludio.imagen" tipo="imagen">
        <div
          className="absolute inset-0"
          style={{ backgroundImage: `url(${imagen})`, backgroundRepeat: 'repeat', backgroundSize: 'auto' }}
          aria-hidden="true"
        />
      </CampoEditable>
      {stickers.length > 0 && (
        <div className="relative z-10 mx-auto flex max-w-4xl flex-wrap items-start justify-center gap-8 px-6">
          {stickers.map((sticker) => (
            <Sticker key={sticker.id} sticker={sticker} preview={preview} />
          ))}
        </div>
      )}
    </section>
  );
}
