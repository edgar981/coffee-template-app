"use client";

// LA APERTURA «ÁLBUM» (§ CHAMISAS-NOSOTROS-ALBUM-1, refero-chamisas.md §3 punto 1: "Portada ...
// Celular: foto en arco (como en /tienda), 4:5, de 55vh como máximo, con el sticker «cosecha 2026»
// en la esquina y una franja de tejido de 12 px al pie. Escritorio: 6/6, título abajo a la izquierda
// y arco a la derecha"). Segunda composición de `nosotrosApertura`, hermana de la canónica (la pieza
// `Apertura` a pantalla completa) bajo el mismo dispatcher (`NosotrosApertura.tsx`).
//
// EL ARCO 4:5 REUSA EL MISMO PATRÓN QUE «LÁMINAS» DE /TIENDA (`rounded-t-full rounded-b-[20px]`,
// § TiendaLaminas.tsx) — el `overflow-hidden` recorta la foto al semicírculo, nunca un SVG de
// máscara. `aspectRatio`/`maxHeight` van por `style` (dos valores NUMÉRICOS del spec —4/5 y 55vh—
// que Tailwind no expresa con una clase literal sin inventar un arbitrario nuevo por cada uno).
//
// `rotuloIzquierda` SE REUSA como el eyebrow (§ el docstring de `NosotrosAperturaContent`);
// `rotuloDerecha` queda sin leer bajo esta composición.
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
    <section className="bg-[var(--sf-fondo)]">
      <div className="mx-auto grid max-w-6xl grid-cols-1 lg:min-h-[640px] lg:grid-cols-2 lg:items-end">
        {/* TEXTO — abajo a la izquierda en escritorio (`lg:order-1`); arriba del arco en celular. */}
        <div className="order-2 flex flex-col gap-4 px-6 py-12 sm:px-10 lg:order-1 lg:px-16 lg:py-20">
          {eyebrow.trim() !== '' && (
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--sf-tinta)]/70">
              <CampoEditable campo="nosotrosApertura.rotuloIzquierda">{eyebrow}</CampoEditable>
            </p>
          )}
          <h1 className="font-playfair text-[40px] leading-[1.05] text-[var(--sf-tinta)]">
            <CampoEditable campo="nosotrosApertura.titulo">{titulo}</CampoEditable>
          </h1>
          {bajada.trim() !== '' && (
            <p className="max-w-md text-[17px] text-[var(--sf-tinta)]">
              <CampoEditable campo="nosotrosApertura.bajada" multilinea>{bajada}</CampoEditable>
            </p>
          )}
        </div>

        {/* EL ARCO — arriba en celular (`order-1`); a la derecha en escritorio (`lg:order-2`). */}
        <div className="order-1 flex flex-col items-center px-6 pt-12 sm:px-10 lg:order-2 lg:items-end lg:px-16 lg:pt-20">
          <div
            className="relative mx-auto w-[78%] overflow-hidden rounded-t-full rounded-b-[20px] bg-[var(--sf-tinta)] lg:w-[72%]"
            style={{ aspectRatio: '4 / 5', maxHeight: '55vh' }}
          >
            {tieneImagen ? (
              <CampoEditable campo="nosotrosApertura.imagen" tipo="imagen">
                <Image src={imagen} alt="" fill sizes="(max-width: 1024px) 78vw, 36vw" className="object-cover" />
              </CampoEditable>
            ) : (
              <HuecoImagenOpcional campo="nosotrosApertura.imagen" className="absolute inset-0" />
            )}
            {sticker.trim() !== '' && (
              <motion.span
                initial={preview ? false : { opacity: 0, scale: 1.06, rotate: -8 }}
                whileInView={{ opacity: 1, scale: 1, rotate: -3 }}
                viewport={{ once: true }}
                transition={{ duration: 0.2 }}
                // `top-8` (no `top-3`, § CHAMISAS-NOSOTROS-ALBUM-1, medido en captura real): a
                // `top-3` el borde superior SEMICIRCULAR del arco recorta el texto largo ("Cosecha
                // 2026") contra su propio `overflow-hidden` — más abajo, el arco ya se abrió lo
                // bastante para que el `whitespace-nowrap` quepa entero.
                className="sf-pildora absolute top-8 right-3 whitespace-nowrap bg-[var(--sf-tostado)] px-3 py-1.5 text-xs font-semibold text-[var(--sf-tinta)]"
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
