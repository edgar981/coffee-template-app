// lib/storefront/vista-rapida.ts — § RIEL-PRODUCTOS-Y-VISTA-RAPIDA-1
//
// La lógica PURA del modal de vista rápida (el "ojo" de cada tarjeta del riel de Presentaciones,
// § components/storefront/home/GrindChooserRiel.tsx, y su modal, § components/storefront/
// VistaRapidaProducto.tsx): qué galería muestra, con qué molienda abre, la cantidad (mínima 1,
// acotada al tope del selector) y si puede agregarse/comprarse con la molienda elegida.
//
// COMPUESTA sobre lo que YA existe (`galeriaCompleta`, `moliendasDisponibles`, `moliendaAceptada`,
// § packages/core/src/product-gallery.ts y moliendas-opciones.ts) — el MISMO criterio que ya usa
// /tienda/[slug] (`app/(storefront)/tienda/[slug]/page.tsx`), para que el modal y la ficha nunca
// decidan distinto sobre la misma molienda ni muestren un orden de fotos distinto.

import { galeriaCompleta } from '@duna/core/product-gallery';
import { moliendasDisponibles, moliendaAceptada } from '@duna/core/moliendas-opciones';

export interface ProductoGaleriaVistaRapida {
  imagen?: string | null;
  imagenes?: string[] | null;
}

/**
 * La galería del modal: portada + tomas adicionales, sin repetir — MISMA fuente que el detalle
 * (`galeriaCompleta`), para que el modal y /tienda/[slug] muestren siempre el mismo orden.
 */
export function galeriaVistaRapida(producto: ProductoGaleriaVistaRapida): string[] {
  return galeriaCompleta(producto.imagen, producto.imagenes);
}

/**
 * La molienda con la que abre el modal: la primera DISPONIBLE — el mismo default que ya usa
 * /tienda/[slug] (`moliendasDisponibles(product.moliendasOpciones)[0]?.nombre`). `null` cuando el
 * producto no declara opciones: no hay nada que preseleccionar.
 */
export function moliendaInicialVistaRapida(raw: unknown): string | null {
  return moliendasDisponibles(raw)[0]?.nombre ?? null;
}

/**
 * Cantidad SIEMPRE ≥ 1 — nunca 0 ni negativa — y acotada al tope del selector (`maxCompra`). Un
 * `max` ausente, cero o negativo (dato roto) no puede dejar la cantidad en 0: el piso de 1 gana
 * siempre, tanto para el valor de entrada como para el tope.
 */
export function clampCantidadVistaRapida(valor: number, max: number): number {
  const tope = Math.max(1, max);
  return Math.max(1, Math.min(valor, tope));
}

export interface AccionVistaRapida {
  /** `true` — la molienda elegida es válida; "Agregar al carrito"/"Comprar ahora" pueden actuar. */
  puede: boolean;
  /** Presente sólo cuando `puede` es `false` — el MISMO texto que ya usa /tienda/[slug] cuando el
   *  servidor rechazaría la combinación, para que el modal no invente un segundo mensaje. */
  mensajeError?: string;
}

/**
 * ¿Pueden "Agregar al carrito"/"Comprar ahora" actuar con la molienda elegida? Reusa
 * `moliendaAceptada` — LA MISMA regla que valida el servidor — así que lo que el modal deja
 * intentar y lo que el checkout acepta no pueden divergir. Cubre los CUATRO modos de
 * `decidirMolienda` sin nombrarlos: sin opciones declaradas siempre puede; con opciones, exige una
 * que exista Y esté disponible (así que 'eleccion' sin elegir, y 'agotada' con cualquier elección,
 * dan ambas `puede:false`).
 */
export function accionVistaRapida(raw: unknown, molienda: string | null): AccionVistaRapida {
  if (moliendaAceptada(raw, molienda)) return { puede: true };
  return { puede: false, mensajeError: 'Selecciona una molienda disponible' };
}
