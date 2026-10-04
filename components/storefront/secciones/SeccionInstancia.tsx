import type { InstanciaContent } from "@/lib/config/secciones-instancias";
import SeccionTexto from "@/components/storefront/secciones/Texto";
import SeccionImagenTexto from "@/components/storefront/secciones/ImagenTexto";
import SeccionBanner from "@/components/storefront/secciones/Banner";

// EL DISPATCHER de instancias (§ SECCIONES-INSTANCIAS-1) — gemelo de `BANDAS` (el registro
// bandaId→render de `app/(storefront)/page.tsx`), pero por TIPO en vez de por id fijo: una
// instancia de catálogo lleva su propio `tipo` guardado, así que no hace falta un registro externo
// id→componente (el id es arbitrario, el tipo no). `instancia.tipo` ya viene CLAMPADO por
// `resolverInstancia` (secciones-instancias.ts) a uno de los tres del catálogo, así que el switch
// es exhaustivo por construcción — ninguna rama "desconocida" puede llegar acá con datos reales.
export default function SeccionInstancia({
  id,
  instancia,
  style,
}: {
  id: string;
  instancia: InstanciaContent;
  style?: React.CSSProperties;
}) {
  switch (instancia.tipo) {
    case "texto":
      return <SeccionTexto id={id} instancia={instancia} style={style} />;
    case "imagenTexto":
      return <SeccionImagenTexto id={id} instancia={instancia} style={style} />;
    case "banner":
      return <SeccionBanner id={id} instancia={instancia} style={style} />;
  }
}
