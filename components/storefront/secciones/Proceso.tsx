"use client";

import Image from "next/image";
import CampoEditable from "@/components/storefront/CampoEditable";
import Movimiento from "@/components/storefront/movimiento/Movimiento";
import RevelarBloque from "@/components/storefront/RevelarBloque";
import { useIsPreview } from "@/components/storefront/PreviewMode";
import { useModoEditorActivo } from "@/components/storefront/ModoEditor";
import { useSiteContent } from "@/components/storefront/SiteContentProvider";
import { contenedorAnchoClase } from "@/lib/config/themes";
import type { InstanciaProcesoContent } from "@/lib/config/secciones-instancias";

// LA SECCIÓN "PROCESO" (S02, "Del fruto a la taza" — § MOVIMIENTO-NIVEL-EDITORIAL-1): de TRES a
// SEIS pasos que se recorren con el scroll, fija (pin) mientras un objeto cambia de color y una
// taza aparece al llegar al último paso (el motor vive en `components/storefront/movimiento/
// animaciones.ts`, función `s02`).
//
// A DIFERENCIA de las otras NUEVE: nace CON su animación — no hay eje `animacion` que elegir
// (§ DESCRIPTOR_INSTANCIA.proceso, secciones-instancias.ts). `<Movimiento id="S02">` envuelve la
// SECCIÓN ENTERA (nunca un hijo), y los dos gates de siempre (editor/preview, § `useMovimiento.ts`)
// la apagan igual que a cualquier otra sección con animación.
//
// EL FALLBACK SIN MOTOR ES EL MISMO ESTADO INICIAL, SIEMPRE — nunca una rama de JSX aparte. El paso
// 0 se marca visible (`opacity-100`) y el resto invisible (`opacity-0`) por TAILWIND, no por un
// `gsap.set` que sólo corre si el motor está activo (editor/preview lo apagan, § `useMovimiento.ts`):
// así, sin JS corriendo, lo que se ve es EXACTAMENTE "el primer paso" — el spec de este slice pide
// elegir primero o último; se eligió PRIMERO, el estado natural de "todavía no bajaste". `gsap.set`
// en `s02()` reafirma el MISMO estado al montar (no hay flash, nunca cambia lo que ya se ve).
//
// LO QUE SÍ CAMBIA ENTRE MODOS: la ALTURA de la sección. El pin necesita `h-screen` (el objeto de
// `end:'+=N·100%'` en `s02()` mide esa altura); en el editor/Biblioteca —donde el motor está
// apagado y la vista previa es una cajita chica, nunca un viewport real— esa altura sería un bloque
// casi vacío. `quieto` (preview o editor) la cambia a la altura normal de cualquier otra sección.
//
// CADA PASO CON FOTO MUESTRA SU FOTO EN VEZ DEL OBJETO ILUSTRATIVO (§ el spec, punto 2): cada ítem
// con `imagen` agrega su propia capa (`data-s02-foto`) sobre el lienzo; `s02()` cruza esa capa con
// el objeto SVG (`data-s02-objeto`) SÓLO en los pasos donde la entidad visible realmente cambia —
// dos pasos consecutivos sin foto dejan el objeto FIJO, sin parpadeo. Generaliza a cualquier mezcla
// de pasos con/sin foto, de 3 a 6.
export default function SeccionProceso({
  id,
  instancia,
  style,
}: {
  id: string;
  instancia: InstanciaProcesoContent;
  style?: React.CSSProperties;
}) {
  const { navTratamiento } = useSiteContent();
  const preview = useIsPreview();
  const editando = useModoEditorActivo();
  const quieto = preview || editando;
  const contenedorClase = contenedorAnchoClase(navTratamiento.posicion);
  const pasos = instancia.items;
  const primero = pasos[0];
  if (!primero) return null;
  const primeroTieneFoto = !!primero.imagen;

  return (
    <Movimiento
      id="S02"
      as="section"
      className={`relative overflow-hidden bg-[var(--sf-banda,var(--sf-fondo))] ${quieto ? "py-20" : "h-screen min-h-[34rem]"}`}
      style={style}
    >
      <div className={`${contenedorClase} mx-auto grid h-full grid-cols-1 items-center gap-10 py-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]`}>
        <div className="relative min-h-[14rem]">
          {instancia.titulo && (
            <RevelarBloque
              as="p"
              indice={0}
              preview={preview}
              className="mb-4 text-xs font-medium uppercase tracking-[0.2em] text-[var(--sf-sobre-banda,var(--sf-acento-texto))]"
            >
              <CampoEditable campo={`${id}.titulo`}>{instancia.titulo}</CampoEditable>
            </RevelarBloque>
          )}
          {pasos.map((paso, i) => (
            <div
              key={i}
              data-s02-paso
              className={`absolute inset-0 flex flex-col gap-2 ${i === 0 ? "opacity-100" : "opacity-0"}`}
            >
              {paso.etiqueta && (
                <span className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--sf-sobre-banda,var(--sf-acento-texto))]">
                  <CampoEditable campo={`${id}.items.${i}.etiqueta`}>{paso.etiqueta}</CampoEditable>
                </span>
              )}
              <h3 className="font-playfair text-2xl leading-tight text-[var(--sf-sobre-banda,var(--sf-tinta))] sm:text-3xl">
                <CampoEditable campo={`${id}.items.${i}.titulo`}>{paso.titulo}</CampoEditable>
              </h3>
              <p className="max-w-[38ch] text-sm leading-relaxed text-[var(--sf-sobre-banda-suave,var(--sf-texto))]">
                <CampoEditable campo={`${id}.items.${i}.texto`} multilinea>{paso.texto}</CampoEditable>
              </p>
            </div>
          ))}
          <div className="absolute inset-x-0 bottom-0 flex gap-1.5" aria-hidden="true">
            {pasos.map((_, i) => (
              <i
                key={i}
                data-s02-marca
                className="h-[3px] w-7 rounded-full"
                style={{ backgroundColor: i === 0 ? "var(--sf-tinta)" : "var(--sf-linea)" }}
              />
            ))}
          </div>
        </div>

        <div className="relative mx-auto aspect-square w-full max-w-[min(70vh,100%)]">
          <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full" aria-hidden="true">
            <circle cx="100" cy="100" r="96" fill="var(--sf-superficie,var(--sf-fondo))" />
            <circle
              data-s02-objeto
              cx="100"
              cy="100"
              r="42"
              fill="var(--sf-acento,var(--sf-tostado))"
              className={primeroTieneFoto ? "opacity-0" : "opacity-100"}
            />
            <g data-s02-taza className="opacity-0">
              <path d="M58 92 Q58 150 100 156 Q142 150 142 92 Z" fill="var(--sf-fondo)" stroke="var(--sf-tinta)" strokeWidth="3" />
              <ellipse cx="100" cy="92" rx="42" ry="10" fill="var(--sf-tinta)" />
              <path d="M142 108 q24 0 24 18 q0 18 -26 20" fill="none" stroke="var(--sf-tinta)" strokeWidth="3" />
            </g>
          </svg>
          {pasos.map((paso, i) =>
            paso.imagen ? (
              <div
                key={i}
                data-s02-foto={i}
                className={`absolute inset-0 overflow-hidden sf-radio-imagen sf-sombra-imagen ${i === 0 ? "opacity-100" : "opacity-0"}`}
              >
                <CampoEditable campo={`${id}.items.${i}.imagen`} tipo="imagen">
                  <Image src={paso.imagen} alt={paso.titulo} fill sizes="(max-width: 1024px) 100vw, 40vw" className="object-cover" />
                </CampoEditable>
              </div>
            ) : null,
          )}
        </div>
      </div>
    </Movimiento>
  );
}
