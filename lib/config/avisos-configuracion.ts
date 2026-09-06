import { tarjetasDePresentaciones } from '../storefront/presentaciones';
import type { SiteContentData } from './site-content-defaults';

// AVISOS DE CONFIGURACIÓN del Dashboard (§ Backlog #65, Fase 1). Un aviso es un defecto que deja el
// storefront ROTO/INCOMPLETO para el VISITANTE sin que el dueño se entere. Distinto de "Necesita tu
// atención": esa es la COLA DE TRABAJO del OPERADOR (pedidos, stock), que se VACÍA; un defecto de
// configuración se arregla UNA vez y no vuelve —meterlo en la cola la volvería un ACUMULADOR que nunca
// llega a cero y deja de mirarse—. Por eso va en un aviso APARTE, del DUEÑO. Puro (capa 1).

export interface AvisoConfig {
  /** id estable del defecto — la `key` de React y el anti-duplicado. */
  clave: string;
  /** qué está mal, en lenguaje del DUEÑO (no del sistema). */
  mensaje: string;
  /** a dónde va a arreglarlo. */
  href: string;
}

// El enlace de un aviso ATERRIZA EN EL DEFECTO, no en la pantalla: abre la sección correcta con su
// edición y resalta el BLOQUE de la tarjeta (§ el fix del gate). Es el MISMO aterrizaje del puente
// vista→formulario, disparado por query params que /admin/tienda lee al cargar (`?seccion=&tarjeta=`,
// precedente `?pedido=` de Pedidos — sin inventar API). `seccion` elige la página + abre esa sección;
// `tarjeta` (el SLOT) resalta y scrollea su bloque, reusando `tarjetaActiva`/`bloquesRef` del puente.
const hrefTarjeta = (slot: number) => `/admin/tienda?seccion=presentaciones&tarjeta=${slot}`;

/**
 * Los defectos de CONFIGURACIÓN del storefront PUBLICADO —cruzando el contenido que ve el visitante
 * (`readSiteContent` → `SiteContentData`) con el catálogo—. FASE 1: SÓLO Presentaciones —
 *   #1 destino de una tarjeta que NO existe en el catálogo (no trae productos), y
 *   #2 tarjeta con TÍTULO y SIN imagen (hueco visible: el criterio OR de la cardinalidad variable la
 *      muestra apenas tiene título, y la imagen faltante queda como estado incompleto persistente).
 *
 * LA PUERTA DE LOS DORMIDOS QUEDA ABIERTA: los defectos #3/#4/#8 (hero/brandStory/whatsapp — que NO
 * disparan para Nayoli, porque los defaults SON Nayoli) se agregan ACÁ cuando llegue el 2º cliente —
 * mismo contenido publicado, misma forma de aviso— sin tocar el lector ni la UI. NO se construyen ahora.
 *
 * `catalogoListo` gatea SÓLO #1: un fetch de catálogo fallido NO puede afirmar que una categoría "no
 * existe" —mentiría—. #2 no depende del catálogo y corre igual. Mismo criterio que el aviso del editor
 * (`categoriasListas`, TiendaSeccionEditor). El predicado de #1 es el MISMO que ese aviso
 * (`value ∉ categorias`), sacado del editor abierto al Dashboard —una sola definición de "destino roto"—.
 */
export function avisosDeConfiguracion(
  contenido: SiteContentData,
  categorias: string[],
  catalogoListo: boolean,
): AvisoConfig[] {
  const avisos: AvisoConfig[] = [];
  const pres = contenido.presentaciones;

  // Sólo si la sección se MUESTRA al visitante: una Presentaciones OCULTA no tiene defecto visible.
  if (pres && pres.visible !== false) {
    for (const t of tarjetasDePresentaciones(pres)) {
      const cat = t.cat.trim();
      const titulo = t.label.trim();
      const tieneImagen = t.img.trim() !== '';
      // El nombre de la tarjeta para la copy: su título si lo tiene; si no (tarjeta visible sólo por su
      // imagen), su número de tarjeta.
      const nombre = titulo !== '' ? `«${titulo}»` : `#${t.slot}`;

      // #1 — DESTINO INEXISTENTE. Destino NO vacío que no está en las categorías del catálogo (el
      // MISMO predicado que el aviso del editor). Un destino vacío lleva a /tienda (todos), no es defecto.
      if (catalogoListo && cat !== '' && !categorias.includes(cat)) {
        avisos.push({
          clave: `presentaciones-destino-${t.slot}`,
          mensaje: `La tarjeta ${nombre} de la portada lleva a la categoría «${cat}», que ningún producto tiene todavía: no traerá productos.`,
          href: hrefTarjeta(t.slot),
        });
      }

      // #2 — TÍTULO SIN IMAGEN. La tarjeta con título pero sin foto es un estado incompleto que el
      // storefront pinta como HUECO (`--sf-linea`, no un `<img>` roto), y así se queda hasta que suban la foto.
      if (titulo !== '' && !tieneImagen) {
        avisos.push({
          clave: `presentaciones-imagen-${t.slot}`,
          mensaje: `La tarjeta «${titulo}» de la portada no tiene imagen: se ve un hueco en la tienda.`,
          href: hrefTarjeta(t.slot),
        });
      }
    }
  }

  return avisos;
}
