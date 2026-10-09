"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import RevelarBloque from "@/components/storefront/RevelarBloque";
import CampoEditable from "@/components/storefront/CampoEditable";
import Movimiento from "@/components/storefront/movimiento/Movimiento";
import { useIsPreview } from "@/components/storefront/PreviewMode";
import { useSiteContent } from "@/components/storefront/SiteContentProvider";
import { contenedorAnchoClase } from "@/lib/config/themes";
import type { InstanciaPreguntaItem, InstanciaPreguntasContent } from "@/lib/config/secciones-instancias";

// LA SECCIÓN "PREGUNTAS" del catálogo curado de instancias (§ SECCIONES-TIPOS-2) — título opcional
// + una lista de pregunta/respuesta DESPLEGABLE (acordeón: un `<button aria-expanded>` por fila que
// muestra/oculta su respuesta).
//
// NO ES `PreguntasFrecuentes.tsx` NI LO LLAMA — DESVIACIÓN MEDIDA del spec ("reusá el marcado y la
// accesibilidad de PreguntasFrecuentes, pasándole props, no copiándolo"). Esa componente vive en
// `components/storefront/PreguntasFrecuentes.tsx`, FUERA de `components/storefront/secciones/` —
// el único directorio de este slice en `touches:` para el storefront — y hoy NO es desplegable
// (lista estática, medido por lectura antes de escribir: `suscripcionFaq` siempre muestra las dos
// líneas). Parametrizarla para aceptar props Y agregarle el acordeón habría exigido editar ese
// archivo, fuera de alcance. Esta sección es, por tanto, un componente PROPIO que reusa el mismo
// VOCABULARIO visual (la tarjeta `--sf-tarjeta` con borde `--sf-linea`, el mismo radio) en vez de la
// función — ver el open follow-up en `DECISIONS.md` para la unificación futura de las dos.
//
// MISMOS TOKENS QUE CUALQUIER OTRA BANDA (§ Texto.tsx/ImagenTexto.tsx/Banner.tsx): `--sf-banda`/
// `--sf-sobre-banda(-suave)` con sus fallbacks de fondo/tinta de página, para que el esquema de
// `content.esquemas` tiña esta instancia igual que a cualquier banda.
// El CONTENIDO de una pregunta (botón + panel), compartido por las dos ramas de abajo (con/sin
// animación) — § MOVIMIENTO-EDITOR-EXPOSICION-1: sólo cambia QUIÉN envuelve cada ítem (`RevelarBloque`
// o un `<div>` plano dentro de un `<Movimiento>` que anima `raiz.children`), nunca el contenido.
function ContenidoPregunta({
  item,
  i,
  idSeguro,
  campoBase,
  abierto,
  onToggle,
}: {
  item: InstanciaPreguntaItem;
  i: number;
  idSeguro: string;
  campoBase: string;
  abierto: boolean;
  onToggle: () => void;
}) {
  const panelId = `${idSeguro}-panel-${i}`;
  const botonId = `${idSeguro}-boton-${i}`;
  return (
    <>
      <button
        type="button"
        id={botonId}
        aria-expanded={abierto}
        aria-controls={panelId}
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 p-5 text-left"
      >
        <span className="font-semibold text-sm text-[var(--sf-sobre-tarjeta,var(--sf-tinta))]">
          <CampoEditable campo={`${campoBase}.pregunta`}>{item.pregunta}</CampoEditable>
        </span>
        <ChevronDown
          aria-hidden
          className={`h-4 w-4 shrink-0 text-[var(--sf-sobre-tarjeta,var(--sf-tinta))] transition-transform ${abierto ? "rotate-180" : ""}`}
        />
      </button>
      {abierto && (
        <div id={panelId} role="region" aria-labelledby={botonId} className="px-5 pb-5 text-sm text-[var(--sf-sobre-tarjeta-suave,var(--sf-texto))]">
          <CampoEditable campo={`${campoBase}.respuesta`} multilinea>{item.respuesta}</CampoEditable>
        </div>
      )}
    </>
  );
}

export default function SeccionPreguntas({
  id,
  instancia,
  style,
}: {
  id: string;
  instancia: InstanciaPreguntasContent;
  style?: React.CSSProperties;
}) {
  const { navTratamiento } = useSiteContent();
  const preview = useIsPreview();
  const contenedorClase = contenedorAnchoClase(navTratamiento.posicion);
  const [abierto, setAbierto] = useState<number | null>(null);
  // El marco del id lleva `:`/`.` que no son válidos en un id de atributo HTML por convención —
  // no rompe el DOM (cualquier string es válido), pero `aria-controls` se lee más limpio sin ellos.
  const idSeguro = id.replace(/[^a-zA-Z0-9_-]/g, "-");

  return (
    <section className="py-20 bg-[var(--sf-banda,var(--sf-fondo))]" style={style}>
      <div className={`${contenedorClase} mx-auto max-w-2xl`}>
        {instancia.titulo && (
          <RevelarBloque
            as="h2"
            indice={0}
            preview={preview}
            className="font-playfair text-3xl leading-tight text-[var(--sf-sobre-banda,var(--sf-tinta))] sm:text-4xl text-center mb-8"
          >
            <CampoEditable campo={`${id}.titulo`}>{instancia.titulo}</CampoEditable>
          </RevelarBloque>
        )}
        {instancia.animacion ? (
          // § MOVIMIENTO-EDITOR-EXPOSICION-1 — «tarjetas → los ítems». Un `<Movimiento>` sobre el
          // CONTENEDOR entero anima `raiz.children` en cascada (C01); cada ítem pasa a ser un
          // `<div>` plano — "un mismo elemento nunca lleva las dos [GSAP+framer-motion]".
          <Movimiento id={instancia.animacion} as="div" className="space-y-4">
            {instancia.items.map((item, i) => (
              <div key={i} className="overflow-hidden rounded-2xl sf-borde border-[var(--sf-linea)] bg-[var(--sf-tarjeta)]">
                <ContenidoPregunta
                  item={item}
                  i={i}
                  idSeguro={idSeguro}
                  campoBase={`${id}.items.${i}`}
                  abierto={abierto === i}
                  onToggle={() => setAbierto(abierto === i ? null : i)}
                />
              </div>
            ))}
          </Movimiento>
        ) : (
          <div className="space-y-4">
            {instancia.items.map((item, i) => (
              <RevelarBloque
                key={i}
                indice={instancia.titulo ? i + 1 : i}
                preview={preview}
                className="overflow-hidden rounded-2xl sf-borde border-[var(--sf-linea)] bg-[var(--sf-tarjeta)]"
              >
                <ContenidoPregunta
                  item={item}
                  i={i}
                  idSeguro={idSeguro}
                  campoBase={`${id}.items.${i}`}
                  abierto={abierto === i}
                  onToggle={() => setAbierto(abierto === i ? null : i)}
                />
              </RevelarBloque>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
