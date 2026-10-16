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
//
// § CHAMISAS-NOSOTROS-MAQUETA-1 — LA SECCIÓN ERA OSCURA CON TEJIDO DE FONDO; LA MAQUETA ES CREMA CON
// UNA FRANJA DELGADA CRUZANDO DETRÁS DE LAS TARJETAS. Medido contra TRES fuentes independientes que
// coinciden (`.scratch/chamisas-paginas/nosotros-suscripciones.html` — `.inter` no declara
// `background`, hereda el crema de `<body>`; `.scratch/chamisas-paginas/capturas-owner/mock-4.png`;
// `.scratch/chamisas-paginas/capturas/v-d-nosotros.jpg`, recorte a y=2650..3150 desktop): el tejido es
// una FRANJA horizontal (`.inter::before`, `background-repeat:repeat-x`, alto 64/96px) que CRUZA
// detrás de las tarjetas pastel —no las rellena—, con texto en TINTA sobre el fondo crema de la
// página, nunca texto claro sobre un fondo oscuro. El docstring de `NosotrosFichaEtiqueta.tsx` que
// asumía "fondo oscuro" (heredado de § CHAMISAS-NOSOTROS-ARCO-E-INTERLUDIO-1, sin re-verificar contra
// la maqueta vigente) queda desactualizado por esto — ver el open follow-up del reporte de este slice.
//
// LA FRANJA ES A SANGRE (`.inter{padding:0 18px}`, SIN `.wrap`): cruza el ANCHO COMPLETO del viewport,
// no sólo el ancho de la fila de tarjetas (`max-width:820px`, centrada aparte). Por eso vive en la
// SECCIÓN (`inset-x-0` sin contenedor), mientras la fila de tarjetas tiene su propio `max-w-[820px]
// mx-auto`.
//
// LA POSICIÓN VERTICAL DE LA FRANJA ES UNA APROXIMACIÓN DECLARADA, no la fórmula literal de la
// maqueta (`top:calc(18px + var(--tw) * .55 - var(--bh) / 2)`, que depende de `--tw` por `cqw` — el
// mismo tipo de cálculo que duna-tienda ya approximó en vez de replicar literalmente para `.lam .ph`,
// § NosotrosEscenasAlbum.tsx). Medido por PÍXEL sobre `v-d-nosotros.jpg` (recorte 1408×500,
// top=2650): el centro de la franja (y≈237) cae al ~38,6 % del alto total de la columna
// tarjeta+nombre+notas (tile y=109..386, columna completa y=109..441) — de ahí `top-[38%]`.
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
      className="flex-1"
    >
      <Link
        href={`/tienda/${sticker.slug}`}
        className="flex flex-col items-center gap-1 text-center transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--sf-tinta)]"
      >
        {/* LA TARJETA — color SIEMPRE, foto si la hay. `aspect-[1/1.1]` (§ CHAMISAS-NOSOTROS-MAQUETA-1
            — medido: `.isk .tile{aspect-ratio:1/1.1}`), no el `4/5` angosto de antes: la maqueta tiene
            tarjetas casi cuadradas, bastante más grandes que un sticker de 128/144px. `p-4` deja el
            color de la tarjeta visible como margen alrededor de la foto; la foto va en un contenedor
            INTERIOR propio (no directo en la tarjeta con padding) porque `fill` resuelve `inset:0`
            contra el BORDE de su ancestro posicionado, ignorando el padding — mismo mecanismo que el
            arco de `NosotrosAperturaAlbum.tsx` (§ el `relative` que esa pieza necesita en SU PROPIA
            caja). */}
        <div
          className="relative aspect-[1/1.1] w-full overflow-hidden rounded-[24px] p-4"
          style={{ backgroundColor: sticker.color }}
        >
          {sticker.imagen && (
            <div className="relative h-full w-full overflow-hidden rounded-[14px]">
              <Image src={sticker.imagen} alt="" fill sizes="(max-width: 1024px) 28vw, 240px" className="object-cover" />
            </div>
          )}
        </div>
        {/* EL NOMBRE Y LAS NOTAS VAN DEBAJO de la tarjeta, no adentro (§ el spec, "con su nombre y sus
            notas debajo") — sobre el fondo CREMA de la sección, no sobre el color de la tarjeta.
            Texto en TINTA (§ CHAMISAS-NOSOTROS-MAQUETA-1 — medido: `.isk{color:var(--ink)}`), no
            claro: la sección ya NO es oscura (ver el docstring de cabecera). `mt-2` sobre el nombre
            compone con el `gap-1` del Link para separar ~12px de la tarjeta, como `.isk{gap:4px}` +
            `.isk .nm{margin-top:8px}` de la maqueta; entre nombre y notas sólo el `gap-1`. */}
        <p className="mt-2 font-playfair text-base text-[var(--sf-tinta)] lg:text-[22px]">{sticker.nombre}</p>
        {sticker.notas && <p className="text-xs text-[var(--sf-tinta)]/70 lg:text-sm">{sticker.notas}</p>}
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
  if (stickers.length === 0) return null;

  return (
    // `mt-20 lg:mt-[120px]` (MARGEN, § CHAMISAS-NOSOTROS-FIDELIDAD-1, intacto) — la franja separa del
    // bloque anterior con la misma lógica. SIN fondo oscuro ni padding vertical propio (§ el
    // docstring de cabecera): la sección hereda el crema de la página, y su alto lo da el contenido
    // (la fila de tarjetas), no un `py-*` que ya no tiene nada que rellenar.
    <section aria-label="Los tres cafés" className="relative mt-20 lg:mt-[120px]">
      {/* LA FRANJA — a sangre (`inset-x-0` sin contenedor de ancho), cruzando detrás de las tarjetas
          al ~38% del alto de la columna (§ el docstring de cabecera, la aproximación por píxel). */}
      <CampoEditable campo="nosotrosInterludio.imagen" tipo="imagen">
        <div
          className="pointer-events-none absolute inset-x-0 top-[38%] h-16 -translate-y-1/2 lg:h-24"
          style={{ backgroundImage: `url(${imagen})`, backgroundRepeat: 'repeat-x', backgroundSize: 'auto 100%' }}
          aria-hidden="true"
        />
      </CampoEditable>
      <div className="relative z-10 mx-auto flex max-w-[820px] justify-center gap-3 px-[18px] lg:gap-10 lg:px-8">
        {stickers.map((sticker) => (
          <Sticker key={sticker.id} sticker={sticker} preview={preview} />
        ))}
      </div>
    </section>
  );
}
