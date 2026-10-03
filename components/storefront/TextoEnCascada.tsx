"use client";

import type { CSSProperties } from "react";
import { motion } from "framer-motion";
import { fadeUpCascadaBloque, transicionBloqueCascada } from "@/lib/animation";
import CampoEditable from "@/components/storefront/CampoEditable";

// TextoEnCascada — § ORIGEN-TEXTO-POR-BLOQUE-1 (reemplaza la cascada POR PALABRA de
// ORIGEN-TEXTO-EN-CASCADA-1: el gate del owner sobre esa tanda — "la animación no me supe
// explicar y efectivamente hazla por bloque de texto" — pidió exactamente esto). Cada instancia
// es UN bloque: el `texto` ENTERO, sin tokenizar, revelado con `fadeUpCascadaBloque` +
// `transicionBloqueCascada(indice)` (`lib/animation.ts`, con el docstring que trae la RE-medición
// contra `xo-cascade`). `Origen.tsx` monta TRES instancias (eyebrow, título, párrafo) que
// ESCALONAN ENTRE SÍ por su propio `indice` — la PIEZA, no la palabra, es la unidad de esta
// cascada, igual que en Cafeone real (§ SHARED MOMENTS, medido: el eyebrow y el h4 son DOS
// `<xo-animate xo-cascade>` propios, nunca palabras sueltas).
//
// SIN JS, EL TEXTO SE VE COMPLETO — mismo requisito y mismo mecanismo que la versión por palabras:
// framer-motion hornea `initial="hidden"` como `style="opacity:0;transform:translateY(30%)"` en
// el HTML del servidor (medido por ejecución, `renderToStaticMarkup`), y sin hidratación ese
// estilo nunca se revierte. La salida es un `<noscript>` con una regla `!important` que el
// navegador sólo PARSEA como markup real cuando el scripting está apagado: con JS la animación
// queda intacta, y sin JS el bloque se ve completo, sin opacidad/traslado residual.
//
// YA NO HACE FALTA `aria-hidden`/`aria-label`: al no partir el texto en nodos, el propio elemento
// YA contiene el texto completo — un lector de pantalla lo anuncia como cualquier `<p>`/`<h2>`
// normal, sin el riesgo de pausas por palabra que sí existía al tokenizar.
//
// `campo` (§ EDITOR-TIENDA-CAMPO-EDITABLE-HOME-1, docs/editor-tienda/EDICION-INLINE.md § 2.3, "los
// textos en cascada: el campo se monta sobre el bloque asentado"): esta primitiva toma `texto` como
// PROP (no `children`), así que un consumidor NO puede envolver `<TextoEnCascada .../>` desde afuera
// con `<CampoEditable>` — no hay nodo de hijos que envolver. El marcador se monta ACÁ, DENTRO del
// `MotionEtiqueta` ya "asentado" (el elemento que YA tiene su tipografía/geometría finales; el
// `<noscript>` hermano no es el bloque, es la red sin-JS) — nunca un `<span>` extra ENVOLVIENDO el
// `MotionEtiqueta` desde afuera, que mediría/clickearía el contenedor en vez del texto. `CampoEditable`
// sigue devolviendo `children` sin envoltorio fuera de modo editor (cero bytes), así que un consumidor
// que no pase `campo` (`undefined`) rinde IDÉNTICO a antes de este slice.
type EtiquetaCascada = "span" | "p" | "h2" | "h3";

export default function TextoEnCascada({
  texto,
  as: Etiqueta = "span",
  className,
  style,
  preview = false,
  indice = 0,
  campo,
  multilinea = false,
}: {
  texto: string;
  as?: EtiquetaCascada;
  className?: string;
  style?: CSSProperties;
  preview?: boolean;
  indice?: number;
  /** La ruta "seccion.campo" del editor inline — sin esto, byte-idéntico a antes (§ el docstring de
   *  cabecera). */
  campo?: string;
  /** Sólo aplica con `campo`: `<textarea>` (Enter inserta salto) si `true`, `<input>` si `false`. */
  multilinea?: boolean;
}) {
  if (!texto) return null;

  const MotionEtiqueta = motion[Etiqueta];
  const contenido = campo
    ? <CampoEditable campo={campo} multilinea={multilinea}>{texto}</CampoEditable>
    : texto;

  return (
    <>
      <noscript>
        <style>{".sf-cascada-bloque{opacity:1!important;transform:none!important}"}</style>
      </noscript>
      <MotionEtiqueta
        className={className ? `sf-cascada-bloque ${className}` : "sf-cascada-bloque"}
        style={style}
        initial={preview ? false : "hidden"}
        animate={preview ? "visible" : undefined}
        whileInView={preview ? undefined : "visible"}
        viewport={preview ? undefined : { once: true }}
        variants={fadeUpCascadaBloque}
        transition={preview ? undefined : transicionBloqueCascada(indice)}
      >
        {contenido}
      </MotionEtiqueta>
    </>
  );
}
