"use client";

import RevelarBloque from "@/components/storefront/RevelarBloque";
import CampoEditable from "@/components/storefront/CampoEditable";
import { useIsPreview } from "@/components/storefront/PreviewMode";
import { useSiteContent } from "@/components/storefront/SiteContentProvider";
import { contenedorAnchoClase } from "@/lib/config/themes";
import SeccionImagenTexto from "@/components/storefront/secciones/ImagenTexto";
import type { InstanciaFilasContent, InstanciaImagenTextoContent } from "@/lib/config/secciones-instancias";

// LA SECCIÓN "FILAS" del catálogo curado de instancias (§ SECCIONES-TIPOS-2) — título opcional +
// filas de imagen con texto que ALTERNAN DE LADO, fila por fila. REUSA EL COMPONENTE REAL de
// "Imagen con texto" (`SeccionImagenTexto`, `ImagenTexto.tsx`) por cada fila —literal, pasándole
// props, no copiando su JSX—: cada ítem de `instancia.items` se convierte en una instancia
// `imagenTexto` SINTÉTICA (mismo `tipo`, mismas claves — nunca `lado`, que acá lo decide la
// PARIDAD del índice, no el dueño) y se renderiza con el componente de siempre. El `id` de cada fila
// es `${id}.items.${i}` — exactamente la ruta "items.N.subcampo" que `CampoEditable`/
// `fusionCampoEditable` ya saben leer (§ `lib/storefront/campo-editable.ts`, fuera de `touches:`),
// así que las rutas de campo que `ImagenTexto.tsx` ya construye (`${id}.titulo`, `${id}.imagen`…)
// quedan BIEN FORMADAS sin que `Filas.tsx` tenga que saber nada de campo-editable.
//
// `style` (el esquema de color) SE PASA A CADA FILA, no sólo al título: las filas no llevan su
// propio `<section>` compartido — cada `SeccionImagenTexto` YA es un `<section>` con su propio
// fondo — así que, para que las N filas y el título compartan el MISMO tinte, el `style` viaja a
// cada una.

export default function SeccionFilas({
  id,
  instancia,
  style,
}: {
  id: string;
  instancia: InstanciaFilasContent;
  style?: React.CSSProperties;
}) {
  const { navTratamiento } = useSiteContent();
  const preview = useIsPreview();
  const contenedorClase = contenedorAnchoClase(navTratamiento.posicion);

  return (
    <div>
      {instancia.titulo && (
        <section className="bg-[var(--sf-banda,var(--sf-fondo))] pt-20 pb-4" style={style}>
          <div className={`${contenedorClase} mx-auto`}>
            <RevelarBloque
              as="h2"
              indice={0}
              preview={preview}
              className="text-center font-playfair text-3xl leading-tight text-[var(--sf-sobre-banda,var(--sf-tinta))] sm:text-4xl"
            >
              <CampoEditable campo={`${id}.titulo`}>{instancia.titulo}</CampoEditable>
            </RevelarBloque>
          </div>
        </section>
      )}
      {instancia.items.map((fila, i) => {
        // `lado` ALTERNA por índice — nunca un campo que el dueño elija (§ el spec: "alternan de
        // lado fila por fila"). La primera entra con la imagen a la izquierda, como ImagenTexto.
        const sintetica: InstanciaImagenTextoContent = {
          tipo: "imagenTexto",
          antetitulo: "",
          titulo: fila.titulo,
          texto: fila.texto,
          ctaLabel: fila.ctaLabel,
          ctaDestino: fila.ctaDestino,
          imagen: fila.imagen,
          lado: i % 2 === 0 ? "izquierda" : "derecha",
          // § MOVIMIENTO-EDITOR-EXPOSICION-1 — «filas» DELEGA el elemento 'imagen' en
          // `SeccionImagenTexto`, que YA sabe envolver su foto en `<Movimiento>` (§ su propio
          // cableado). Pasar el MISMO `instancia.animacion` a cada fila sintética es todo lo que
          // hace falta para que las N filas animen su foto — sin repetir el wrapping acá.
          animacion: instancia.animacion,
          visible: true,
        };
        return <SeccionImagenTexto key={i} id={`${id}.items.${i}`} instancia={sintetica} style={style} />;
      })}
    </div>
  );
}
