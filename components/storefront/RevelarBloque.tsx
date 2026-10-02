"use client";

import type { CSSProperties, ReactNode } from "react";
import { motion } from "framer-motion";
import {
  variantesRevelaBloque,
  transicionRevelaBloque,
  REVELA_BLOQUE_MARGEN,
} from "@/lib/storefront/revelado-bloque";

// RevelarBloque — § SECCIONES-ENTRAN-VIVAS-1, corregido por § SECCIONES-ENTRAN-UNA-VEZ-1. La
// primitiva GENÉRICA de entrada por scroll para el resto de la home (texto Y media): sube 50px
// mientras funde opacidad, con disparo TARDÍO desde abajo (sólo cuando el bloque ya está bien adentro
// de la pantalla, § `REVELA_BLOQUE_MARGEN`) y entra UNA SOLA VEZ (`once:true`) — las cifras y el
// porqué viven en `lib/storefront/revelado-bloque.ts`.
//
// `once:true` Y el margen ASIMÉTRICO (sólo el fondo se encoge) son LA MISMA corrección, no dos: el
// slice anterior (`SECCIONES-ENTRAN-VIVAS-1`) puso `once:false` + margen simétrico razonando que la
// referencia (homeburgers.com) "se repite" al volver a pasar por un bloque — era un ERROR DE MEDICIÓN
// DEL ORQUESTADOR (§ el spec de este slice). Re-medido: en la referencia un bloque entra UNA VEZ y
// queda visible para siempre — al pasar arriba, al salir por arriba, al volver a bajar y al volver a
// entrar desde abajo. Con `once:false` + margen simétrico, un bloque que ya había cruzado la mitad de
// la pantalla hacia arriba volvía a ocultarse MIENTRAS el visitante todavía lo estaba leyendo.
//
// NO es la primitiva de "El origen"/Suscripción (variante `linea`): esas dos ya tenían la entrada que
// el owner pidió reproducir y el spec de este slice las deja explícitamente sin tocar
// (`TextoEnCascada.tsx`, `fadeUp`/`fadeUpCascadaBloque`/`revelaMascaraVertical` en lib/animation.ts).
//
// MISMO contrato `preview` que `TextoEnCascada`/el resto de los `motion.*` de la home: en la vista
// previa EN VIVO del editor (`VistaTiendaEnVivo.tsx`), el árbol se renderiza dentro de un contenedor
// escalado (`transform:scale`) donde `whileInView` nunca dispara — la intersección con el viewport no
// llega. Con `preview=true` se usa `animate="visible"` con `initial={false}`: el bloque nace YA
// asentado, sin esperar un scroll que el editor no puede dar.
//
// `indice` es la posición del bloque dentro de su grupo de hermanos (0-based, orden de lectura) — lo
// consume `transicionRevelaBloque` para el escalonado de 0.1s. El default 0 sirve a un bloque único
// sin hermanos (nunca retrasado).
type EtiquetaRevelo = "div" | "p" | "h2" | "h3";

export default function RevelarBloque({
  children,
  as: Etiqueta = "div",
  className,
  style,
  preview = false,
  indice = 0,
}: {
  children: ReactNode;
  as?: EtiquetaRevelo;
  className?: string;
  style?: CSSProperties;
  preview?: boolean;
  indice?: number;
}) {
  const MotionEtiqueta = motion[Etiqueta];

  return (
    <MotionEtiqueta
      className={className}
      style={style}
      initial={preview ? false : "hidden"}
      animate={preview ? "visible" : undefined}
      whileInView={preview ? undefined : "visible"}
      viewport={preview ? undefined : { once: true, margin: REVELA_BLOQUE_MARGEN }}
      variants={variantesRevelaBloque}
      transition={preview ? undefined : transicionRevelaBloque(indice)}
    >
      {children}
    </MotionEtiqueta>
  );
}
