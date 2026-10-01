"use client";

import type { CSSProperties } from "react";
import { motion } from "framer-motion";
import { fadeUp, palabrasDeTexto, transicionPalabra } from "@/lib/animation";

// TextoEnCascada — § ORIGEN-TEXTO-EN-CASCADA-1. Divide `texto` en PALABRAS y revela cada una con
// `fadeUp` + `transicionPalabra(indice)` (`lib/animation.ts`, con el docstring que explica qué mide
// Cafeone real y por qué el split es por palabra IGUAL si el sitio real no lo hace así — requisito
// explícito del slice, no fidelidad al mecanismo medido). Es el MISMO `whileInView`/`preview` que ya
// usan las fotos, la lista de datos y las cifras de `Origen.tsx` — aplicado palabra por palabra en
// vez de bloque por bloque.
//
// SIN JS, EL TEXTO SE VE COMPLETO — requisito explícito, y el riesgo es real: framer-motion
// hornea `initial="hidden"` como `style="opacity:0;…"` en el HTML del servidor (medido por
// ejecución, `renderToStaticMarkup`), así que sin hidratación ese estilo nunca se revierte. La
// salida NO es `initial={false}`: medido (también por ejecución) que con `whileInView` y sin
// `animate`, eso deja al nodo SIN estilo en el primer render y SIN transición visible al entrar en
// vista —framer-motion no tiene "desde dónde" animar—, perdiendo el efecto para quien SÍ tiene JS.
// La salida es un `<noscript>` con una regla `!important` que el navegador sólo PARSEA como markup
// real cuando el scripting está apagado (con JS encendido, el contenido de `<noscript>` nunca se
// convierte en nodos reales): así la animación de siempre queda intacta para quien tiene JS, y
// quien no lo tiene ve la frase entera, sin un solo opacity:0 que nadie vaya a revertir.
//
// ACCESIBLE: cada palabra es decoración visual (`aria-hidden`); el texto COMPLETO, sin partir,
// vive en el `aria-label` del envoltorio — un lector de pantalla anuncia la frase entera, nunca
// palabra por palabra con pausas que el texto original no tiene.
type EtiquetaCascada = "span" | "p" | "h2" | "h3";

export default function TextoEnCascada({
  texto,
  as: Etiqueta = "span",
  className,
  style,
  preview = false,
  indiceInicial = 0,
}: {
  texto: string;
  as?: EtiquetaCascada;
  className?: string;
  style?: CSSProperties;
  preview?: boolean;
  indiceInicial?: number;
}) {
  if (!texto) return null;

  const tokens = palabrasDeTexto(texto);

  return (
    <Etiqueta className={className} style={style} aria-label={texto}>
      <noscript>
        <style>{".sf-cascada-palabra{opacity:1!important;transform:none!important}"}</style>
      </noscript>
      <span aria-hidden="true">
        {tokens.map((token, i) =>
          token.esPalabra ? (
            <motion.span
              key={i}
              className="sf-cascada-palabra"
              initial={preview ? false : "hidden"}
              animate={preview ? "visible" : undefined}
              whileInView={preview ? undefined : "visible"}
              viewport={preview ? undefined : { once: true }}
              variants={fadeUp}
              transition={preview ? undefined : transicionPalabra(indiceInicial + token.indice)}
            >
              {token.texto}
            </motion.span>
          ) : (
            <span key={i}>{token.texto}</span>
          ),
        )}
      </span>
    </Etiqueta>
  );
}
