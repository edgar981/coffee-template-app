"use client";

import type { CSSProperties, ReactNode } from "react";
import { motion } from "framer-motion";
import {
  variantesRevelaBloque,
  transicionRevelaBloque,
} from "@/lib/storefront/revelado-bloque";

// RevelarBloque — § SECCIONES-ENTRAN-VIVAS-1, corregido por § SECCIONES-ENTRAN-UNA-VEZ-1, y
// REEMPLAZADO de magnitudes por § SECCIONES-ENTRAN-COMO-ORIGEN-1 (2026-10-02). La primitiva GENÉRICA
// de entrada por scroll para el resto de la home (texto Y media): sube mientras funde opacidad,
// dispara EN CUANTO el bloque asoma por el borde inferior del viewport — SIN margen, el MISMO
// disparador que "El origen"/Suscripción — y entra UNA SOLA VEZ (`once:true`). Las cifras (24px,
// 0.6s, `cubic-bezier(0.22,0.61,0.36,1)`, 0.09s de paso) viven en `lib/storefront/revelado-bloque.ts`,
// REUSADAS de `fadeUp`/`transicionEscalonada` (lib/animation.ts) — no son propias de esta primitiva.
//
// EL MARGEN DE DISPARO TARDÍO SE RETIRÓ (`REVELA_BLOQUE_MARGEN`, `-20%` en el fondo): gate del owner
// sobre el resultado de `SECCIONES-ENTRAN-VIVAS-1`/`SECCIONES-ENTRAN-UNA-VEZ-1` — «el efecto... está
// como demorado, hay un momento al hacer scroll en el que pareciera que estuviera navegando en una
// página vacía porque demoran en salir las secciones, pero con 'El Origen' y Suscripción no pasa» —
// esas dos secciones YA disparaban sin margen; la demora era la diferencia. `once:true` (de
// `SECCIONES-ENTRAN-UNA-VEZ-1`) NO cambia: un bloque revelado sigue sin volver a ocultarse.
//
// AHORA ES LA MISMA PRIMITIVA QUE "El origen"/Suscripción, NO UNA DISTINTA: hasta esta tanda
// `RevelarBloque` tenía su propio disparo/cifras, separados a propósito de `fadeUp`+
// `transicionEscalonada` (`Origen.tsx`) y de `transicionTituloPostal`/`transicionFadePostal`
// (`SubscriptionCTALinea.tsx`) — las tres resuelven hoy a los MISMOS tokens
// (`REVELADO_GRUPO_*`, lib/animation.ts). `TextoEnCascada.tsx` (la cascada de palabras-por-bloque del
// texto de Origen, `fadeUpCascadaBloque`/`CASCADA_BLOQUE_*`) sigue sin tocarse — es un mecanismo
// aparte, no el que esta tanda iguala.
//
// MISMO contrato `preview` que `TextoEnCascada`/el resto de los `motion.*` de la home: en la vista
// previa EN VIVO del editor (`VistaTiendaEnVivo.tsx`), el árbol se renderiza dentro de un contenedor
// escalado (`transform:scale`) donde `whileInView` nunca dispara — la intersección con el viewport no
// llega. Con `preview=true` se usa `animate="visible"` con `initial={false}`: el bloque nace YA
// asentado, sin esperar un scroll que el editor no puede dar.
//
// `indice` es la posición del bloque dentro de su grupo de hermanos (0-based, orden de lectura) — lo
// consume `transicionRevelaBloque` para el escalonado de 0.09s (`REVELADO_GRUPO_PASO_S`). El default
// 0 sirve a un bloque único sin hermanos (nunca retrasado).
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
      viewport={preview ? undefined : { once: true }}
      variants={variantesRevelaBloque}
      transition={preview ? undefined : transicionRevelaBloque(indice)}
    >
      {children}
    </MotionEtiqueta>
  );
}
