"use client";

import { useSiteContent } from "@/components/storefront/SiteContentProvider";
import { instanciaEsVisible, type InstanciaContent } from "@/lib/config/secciones-instancias";
import SeccionTexto from "@/components/storefront/secciones/Texto";
import SeccionImagenTexto from "@/components/storefront/secciones/ImagenTexto";
import SeccionBanner from "@/components/storefront/secciones/Banner";
import SeccionPreguntas from "@/components/storefront/secciones/Preguntas";
import SeccionColumnas from "@/components/storefront/secciones/Columnas";
import SeccionFilas from "@/components/storefront/secciones/Filas";
import SeccionCollage from "@/components/storefront/secciones/Collage";
import SeccionVideo from "@/components/storefront/secciones/Video";
import SeccionCarrusel from "@/components/storefront/secciones/Carrusel";
import SeccionProceso from "@/components/storefront/secciones/Proceso";
import SeccionCierre from "@/components/storefront/secciones/Cierre";

// EL DISPATCHER de instancias (§ SECCIONES-INSTANCIAS-1) — gemelo de `BANDAS` (el registro
// bandaId→render de `app/(storefront)/page.tsx`), pero por TIPO en vez de por id fijo: una
// instancia de catálogo lleva su propio `tipo` guardado, así que no hace falta un registro externo
// id→componente (el id es arbitrario, el tipo no). `instancia.tipo` ya viene CLAMPADO por
// `resolverInstancia` (secciones-instancias.ts) a uno de los ONCE del catálogo (§ SECCIONES-TIPOS-2
// amplió de tres a seis, § SECCIONES-TIPOS-3 de seis a ocho, § SECCIONES-CARRUSEL-1 de ocho a
// nueve, § MOVIMIENTO-NIVEL-EDITORIAL-1 de nueve a diez, § MOVIMIENTO-NIVEL-FIRMA-1 de diez a
// once), así que el switch es exhaustivo por construcción — ninguna rama "desconocida" puede
// llegar acá con datos reales.
//
// EN VIVO (§ SECCIONES-INSTANCIAS-VIVO-1, ver el docstring de cabecera de `secciones-instancias.ts`
// para la regla general): lee `seccionesHome[id]` del CONTEXTO —el mismo que `EditorPuenteVivo.tsx`
// actualiza en cada tecla del panel, sin recargar— en vez de confiar sólo en `instancia`, la prop
// que `page.tsx` resuelve en el SERVIDOR una sola vez. La prop queda como SEMILLA: fuera del editor
// (o antes de que el id exista en el contexto) coincide byte a byte con lo que trae el contexto —
// `SiteContentProvider` nace con el MISMO `content` que resolvió la prop—, así que sólo gana cuando
// el contexto todavía no conoce ese id. Las DIEZ variantes reciben el
// valor YA resuelto como antes — este componente es el ÚNICO punto que lee el contexto por id,
// mismo criterio que `BrandStory.tsx` leyendo `brandStory` una vez antes de elegir su variante.
//
// EL OJO (§ SECCIONES-INSTANCIAS-VIVO-1): una instancia oculta (`visible === false`) no se dibuja
// para el visitante — mismo contrato que `seccionEsVisible` para una banda ocultable, self-gate acá
// en el dispatcher (como `BrandStory.tsx`/`SubscriptionCTA.tsx` hacen el suyo antes de renderizar).
export default function SeccionInstancia({
  id,
  instancia,
  style,
}: {
  id: string;
  instancia: InstanciaContent;
  style?: React.CSSProperties;
}) {
  const { seccionesHome } = useSiteContent();
  const actual = seccionesHome[id] ?? instancia;
  if (!instanciaEsVisible(actual)) return null;

  switch (actual.tipo) {
    case "texto":
      return <SeccionTexto id={id} instancia={actual} style={style} />;
    case "imagenTexto":
      return <SeccionImagenTexto id={id} instancia={actual} style={style} />;
    case "banner":
      return <SeccionBanner id={id} instancia={actual} style={style} />;
    case "preguntas":
      return <SeccionPreguntas id={id} instancia={actual} style={style} />;
    case "columnas":
      return <SeccionColumnas id={id} instancia={actual} style={style} />;
    case "filas":
      return <SeccionFilas id={id} instancia={actual} style={style} />;
    case "collage":
      return <SeccionCollage id={id} instancia={actual} style={style} />;
    case "video":
      return <SeccionVideo id={id} instancia={actual} style={style} />;
    case "carrusel":
      return <SeccionCarrusel id={id} instancia={actual} style={style} />;
    case "proceso":
      return <SeccionProceso id={id} instancia={actual} style={style} />;
    case "cierre":
      return <SeccionCierre id={id} instancia={actual} style={style} />;
  }
}
