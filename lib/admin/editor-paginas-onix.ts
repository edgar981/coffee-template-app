import type { SeccionConfig } from '@/components/admin/tienda-secciones';

// § EDITOR-PAGINAS-ONIX-ARREGLOS-1 — el defecto medido: `TiendaSeccionEditor.tsx` mostraba el select
// nativo de "Composición" SÓLO para una lista escrita a mano de `seccion === '...'` (tiendaEncabezado,
// tiendaCatalogo, tiendaProducto, suscripcionFaq, nosotrosHistoria, nosotrosCierre). `suscripcionPlanes`
// (Tarjetas/Taquilla), `tiendaInterludio` (Retrato y cita/Plano) y `tiendaCierre` (Costura/Frase y
// botón) declaraban `config.composiciones` con 2 opciones cada una y NINGÚN control las mostraba —
// la clase de hueco que `ONIX-SUSCRIPCION-SELECT-COMPOSICION-ZONAS-HUECO-1` ya documentó una vez
// (`composiciones` se declara pero ningún control real lo muestra, § tienda-secciones.ts).
//
// LA CONDICIÓN SALE DE LOS DATOS, no de una lista a mano: "¿esta sección declara 2+ composiciones?"
// es exactamente lo que ya decide si vale la pena mostrar el select (con 0 o 1 no hay nada que
// elegir), así que una sección nueva con `composiciones` entra sola, sin que nadie se acuerde de
// agregar su nombre a ningún lado — `panel-controles.ts` YA asume esto («`panel-controles.ts` deriva
// `<seccion>.variante` como CONTROLADO con sólo esto presente», § el docstring de
// `SeccionConfig.composiciones`); este helper es lo que hace que la REALIDAD (el JSX) cumpla esa
// misma promesa.
//
// EL HERO SE EXCLUYE A PROPÓSITO: usa su propio diálogo pesado (`ComposicionHero`, con miniatura +
// zonas + aviso de "se guarda"), no este select nativo — el mismo criterio que ya separaba a las
// otras secciones del hero antes de este slice.
export function debeMostrarSelectorComposicion(config: SeccionConfig): boolean {
  return config.seccion !== 'hero' && !!config.composiciones && config.composiciones.length > 1;
}

// § EDITOR-PAGINAS-ONIX-ARREGLOS-1 — el estado de visibilidad de una PÁGINA (`TogglePagina.tsx`)
// es de TRES valores —cargando / visible / oculta—, no dos. El defecto medido: `const on = visible
// === true` colapsaba `null` (cargando) al mismo lado que `false` (oculta), así que mientras el
// fetch de `/api/site-content` estaba en vuelo, el control afirmaba "Oculto" para una página que en
// realidad está encendida — el "La página no se muestra" que reporta el owner durante la carga.
// `null` no es "oculta": es "todavía no sé" (§ CLAUDE.md, "preferir callar a afirmar sin base").
export type EstadoVisibilidadPagina = 'cargando' | 'visible' | 'oculta';

export function estadoVisibilidadPagina(visible: boolean | null): EstadoVisibilidadPagina {
  if (visible === null) return 'cargando';
  return visible ? 'visible' : 'oculta';
}
