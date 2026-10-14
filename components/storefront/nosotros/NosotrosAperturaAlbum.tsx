"use client";

// LA APERTURA «ÁLBUM» (§ CHAMISAS-NOSOTROS-ALBUM-1, refero-chamisas.md §3 punto 1: "Portada ...
// Celular: foto en arco (como en /tienda), 4:5, de 55vh como máximo, con el sticker «cosecha 2026»
// en la esquina y una franja de tejido de 12 px al pie. Escritorio: 6/6, título abajo a la izquierda
// y arco a la derecha"). Segunda composición de `nosotrosApertura`, hermana de la canónica (la pieza
// `Apertura` a pantalla completa) bajo el mismo dispatcher (`NosotrosApertura.tsx`).
//
// EL ARCO 4:5 REUSA EL MISMO PATRÓN QUE «LÁMINAS» DE /TIENDA (`rounded-t-full rounded-b-[20px]`,
// § TiendaLaminas.tsx) — el `overflow-hidden` recorta la foto al semicírculo, nunca un SVG de
// máscara.
//
// `rotuloIzquierda` SE REUSA como el eyebrow (§ el docstring de `NosotrosAperturaContent`);
// `rotuloDerecha` queda sin leer bajo esta composición.
//
// § CHAMISAS-APERTURA-ALBUM-AJUSTES-1 — TRES AJUSTES medidos contra la maqueta
// (`.scratch/chamisas-paginas/nosotros-suscripciones.html`, `.cov`/`.cov-g`/`.arch-w`/`.stk`):
//
// 1. SIN `min-h` en el grid — ESE era el defecto de la banda vacía arriba del rótulo. La maqueta NO
//    fija una altura mínima de sección (`.cov{padding:28px 0 0}` — sólo padding superior, la altura
//    la da el CONTENIDO); el `lg:min-h-[640px]` que tenía esta pieza forzaba el grid a 640px aunque
//    el arco (su contenido más alto, tope `lg:max-h-[600px]`) nunca llegara ahí, y `lg:items-end`
//    empujaba las DOS columnas hacia abajo dejando el sobrante como banda vacía ARRIBA. Quitado el
//    `min-h`, `items-end` sigue siendo correcto (coincide con `.cov-g{align-items:end}` de la
//    maqueta: la columna de texto, más corta que el arco, se asienta contra su base) — ya no hay
//    altura de más que repartir.
// 2. EL STICKER sale del contenedor `overflow-hidden` del arco — ERA la causa del recorte
//    (`CHAMISAS-STICKER-APERTURA-RECORTE-1`): estaba DENTRO de la misma caja que recorta la foto al
//    semicírculo (`rounded-t-full` + `overflow-hidden`), así que cualquier posición cerca del borde
//    curvo se cortaba contra esa máscara. La maqueta (`.arch-w`) lo monta como HERMANO del arco, no
//    hijo — acá, un wrapper `relative` (SIN `overflow-hidden`) envuelve al arco (que sí lo mantiene,
//    para recortar la FOTO) y al sticker, así el sticker nunca entra a la zona que se recorta.
//    Posición de la maqueta: `top:12%` (relativo a la ALTURA del arco, no un px fijo — por eso sigue
//    centrado en la curva a cualquier tamaño) y `right:-8px`/`-14px` (cuelga del borde, nunca
//    "adentro" donde el arco podría taparlo).
// 3. EN CELULAR EL TEXTO VA PRIMERO — medido contra la maqueta (`v-m-nosotros.jpg`): rótulo+título+
//    bajada arriba, el arco debajo. El docstring de cada columna YA decía esto ("arriba del arco en
//    celular"/"arriba en celular") pero las clases `order-1`/`order-2` estaban INVERTIDAS respecto
//    del comentario — el arco quedaba primero. Se corrige el `order` para que coincida con lo que el
//    comentario siempre dijo.
import Image from 'next/image';
import { motion } from 'framer-motion';
import { useIsPreview } from '@/components/storefront/PreviewMode';
import CampoEditable, { HuecoImagenOpcional } from '@/components/storefront/CampoEditable';

export interface NosotrosAperturaAlbumProps {
  eyebrow: string;
  titulo: string;
  bajada: string;
  imagen: string;
  sticker: string;
  franjaTejido: string;
}

export default function NosotrosAperturaAlbum({ eyebrow, titulo, bajada, imagen, sticker, franjaTejido }: NosotrosAperturaAlbumProps) {
  const preview = useIsPreview();
  const tieneImagen = imagen.trim() !== '';

  return (
    <section className="bg-[var(--sf-fondo)] pt-7 lg:pt-10">
      {/* SIN `min-h`/`py` extra acá (§ el ajuste 1, arriba) — sólo el padding SUPERIOR de la sección
          (`.cov{padding:28px 0 0}` de la maqueta); el padding horizontal vive en ESTA fila, no
          repetido por columna, para que `gap` sea la única fuente de separación vertical/horizontal. */}
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-[22px] px-6 sm:px-10 lg:grid-cols-2 lg:items-end lg:gap-12 lg:px-16">
        {/* TEXTO — primero en celular Y en escritorio-izquierda (§ el ajuste 3, arriba). */}
        <div className="order-1 flex flex-col gap-4 lg:pb-7">
          {eyebrow.trim() !== '' && (
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--sf-tinta)]/70">
              <CampoEditable campo="nosotrosApertura.rotuloIzquierda">{eyebrow}</CampoEditable>
            </p>
          )}
          <h1 className="font-playfair text-[40px] leading-[1.05] text-[var(--sf-tinta)] lg:text-[54px]">
            <CampoEditable campo="nosotrosApertura.titulo">{titulo}</CampoEditable>
          </h1>
          {bajada.trim() !== '' && (
            <p className="max-w-md text-[17px] text-[var(--sf-tinta)]">
              <CampoEditable campo="nosotrosApertura.bajada" multilinea>{bajada}</CampoEditable>
            </p>
          )}
        </div>

        {/* EL ARCO — segundo en celular (§ el ajuste 3); a la derecha en escritorio. */}
        <div className="order-2 flex flex-col items-center lg:items-end">
          {/* `relative`, SIN `overflow-hidden` (§ el ajuste 2, arriba) — el sticker es HERMANO de la
              caja que recorta la foto, nunca su hijo, para no caer dentro de esa máscara. */}
          <div className="relative w-[78%] lg:w-[72%]">
            <div
              className="aspect-[4/5] max-h-[55vh] overflow-hidden rounded-t-full rounded-b-[20px] bg-[var(--sf-tinta)] lg:max-h-[600px]"
            >
              {tieneImagen ? (
                <CampoEditable campo="nosotrosApertura.imagen" tipo="imagen">
                  <Image src={imagen} alt="" fill sizes="(max-width: 1024px) 78vw, 36vw" className="object-cover" />
                </CampoEditable>
              ) : (
                <HuecoImagenOpcional campo="nosotrosApertura.imagen" className="absolute inset-0" />
              )}
            </div>
            {sticker.trim() !== '' && (
              <motion.span
                initial={preview ? false : { opacity: 0, scale: 1.06, rotate: -8 }}
                whileInView={{ opacity: 1, scale: 1, rotate: -3 }}
                viewport={{ once: true }}
                transition={{ duration: 0.2 }}
                // `top-[12%]` (relativo a la ALTURA del arco, como `.arch-w .stk{top:12%}` de la
                // maqueta) + `-right-2`/`lg:-right-3.5` (cuelga -8px/-14px del borde derecho, como
                // `right:-8px`/`-14px`) — ya NO dentro de la caja que recorta la foto (§ el ajuste 2),
                // así que un texto largo no se corta contra el borde semicircular.
                className="sf-pildora absolute top-[12%] -right-2 z-10 whitespace-nowrap bg-[var(--sf-tostado)] px-3 py-1.5 text-xs font-semibold text-[var(--sf-tinta)] lg:-right-3.5"
              >
                <CampoEditable campo="nosotrosApertura.sticker">{sticker}</CampoEditable>
              </motion.span>
            )}
          </div>
          {/* LA FRANJA DE TEJIDO — 12px (§ el spec), SÓLO CELULAR (`lg:hidden`): la maqueta la pide
              únicamente bajo el arco de la vista móvil. */}
          {franjaTejido.trim() !== '' && (
            <CampoEditable campo="nosotrosApertura.franjaTejido" tipo="imagen">
              <div
                className="h-3 w-[78%] lg:hidden"
                style={{ backgroundImage: `url(${franjaTejido})`, backgroundRepeat: 'repeat-x', backgroundSize: 'auto 100%' }}
                aria-hidden="true"
              />
            </CampoEditable>
          )}
        </div>
      </div>
    </section>
  );
}
