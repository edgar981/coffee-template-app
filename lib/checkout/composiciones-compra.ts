// COMPRA-LINEAS-ONIX-CHAMISAS-1 — la resolución de los TRES ejes del camino de compra
// (`content.compra.{cajon,confirmacion,seguimiento}`, § `lib/config/site-content-defaults.ts`) al
// set cerrado de cada uno. PURO, sin JSX ni tokens de color — los componentes que consumen esto
// (`CartDrawer.tsx`, `EstadoPedido.tsx`, `rastrear-pedido/page.tsx`) deciden la forma visual; este
// módulo sólo dice QUÉ tratamiento corresponde a un valor guardado, caiga lo que caiga a la común.
//
// `resolverSiteContent` (site-content-defaults.ts) YA clampa estos tres campos con `resolverVariante`
// al leer de la base — así que en producción nunca llega acá un valor fuera del set. Pero los
// componentes del storefront reciben el valor ya resuelto como un `string` suelto (el tipo de
// `CompraContent` es la unión cerrada, pero TypeScript no puede probar en RUNTIME que lo que viajó
// por un `useSiteContent()` con datos sintéticos de test, o un valor evolucionado de una fila vieja,
// siga en el set) — de ahí que esta SEGUNDA capa de clamp exista: un valor desconocido cae a la
// común, igual que el resolver, nunca lanza.

import { REGISTRY, type ClaveCompraCajon, type ClaveCompraConfirmacion, type ClaveCompraSeguimiento } from '@/lib/config/site-content-defaults';
import type { EstadoPedidoPagina, MetodoPedido } from './estado-pedido';

const CLAVES_CAJON = new Set(REGISTRY.compra.escalares!.cajon.claves);
const CLAVES_CONFIRMACION = new Set(REGISTRY.compra.escalares!.confirmacion.claves);
const CLAVES_SEGUIMIENTO = new Set(REGISTRY.compra.escalares!.seguimiento.claves);

/** El cajón del carrito. Cualquier valor fuera de `['comun','creditos','album']` —ausente, basura,
 *  un valor de una versión futura que este slice no conoce— cae a `'comun'`. */
export function composicionCajon(valor: unknown): ClaveCompraCajon {
  return typeof valor === 'string' && CLAVES_CAJON.has(valor as ClaveCompraCajon)
    ? (valor as ClaveCompraCajon)
    : 'comun';
}

/** La confirmación del checkout y la página de estado única. Cualquier valor fuera de
 *  `['comun','boleto','lamina']` cae a `'comun'` (la "Sobria" del editor, § refero-compra.md §4). */
export function composicionConfirmacion(valor: unknown): ClaveCompraConfirmacion {
  return typeof valor === 'string' && CLAVES_CONFIRMACION.has(valor as ClaveCompraConfirmacion)
    ? (valor as ClaveCompraConfirmacion)
    : 'comun';
}

/** El seguimiento del pedido (`/rastrear-pedido`). Cualquier valor fuera de
 *  `['comun','escaleta','album']` cae a `'comun'`. */
export function composicionSeguimiento(valor: unknown): ClaveCompraSeguimiento {
  return typeof valor === 'string' && CLAVES_SEGUIMIENTO.has(valor as ClaveCompraSeguimiento)
    ? (valor as ClaveCompraSeguimiento)
    : 'comun';
}

// EL STICKER de la composición «Lámina» (§ refero-compra.md §4: "sticker de estado inclinado
// («¡Pagado!», «En espera», «Sin pagar», «Guardado»)"). Puro, derivado de los mismos CINCO estados
// que `contenidoEstadoPedido` — nunca una sexta fuente de verdad sobre qué significa cada estado;
// sólo la PALABRA cambia de registro (más corta, más "etiqueta pegada" que "título de página").
const STICKER_POR_ESTADO: Record<EstadoPedidoPagina, string> = {
  aprobado: '¡Pagado!',
  pendiente: 'En espera',
  rechazado: 'Sin pagar',
  manual: 'Guardado',
  sin_referencia: 'Sin pagar',
};

/** La etiqueta del sticker de estado, para la composición «Lámina» de la confirmación. */
export function stickerConfirmacion(estado: EstadoPedidoPagina): string {
  return STICKER_POR_ESTADO[estado];
}

// LA FILA «MÉTODO» de la composición «Boleto» (§ refero-compra.md §4: "filas FECHA · MÉTODO ·
// ENVÍO A · TOTAL"). Un nombre llano, nunca el verbo del botón (`verboBotonPago`, que dice una
// ACCIÓN — "Pagar con Wompi" — no el NOMBRE del método para una fila de datos). `null` (pasarela
// elegida sin método manual, o el desvío genérico) cae a una frase honesta, no a un hueco en blanco.
const ETIQUETA_POR_METODO: Record<Exclude<MetodoPedido, null>, string> = {
  wompi: 'Pago en línea',
  nequi: 'Nequi',
  daviplata: 'Daviplata',
  breb: 'Bre-B',
  transferencia: 'Transferencia',
  efectivo: 'Efectivo (contraentrega)',
  whatsapp: 'Coordinado por WhatsApp',
};

/** El nombre del método, para la fila «Método» de la composición «Boleto». */
export function etiquetaMetodoPedido(metodo: MetodoPedido): string {
  return metodo ? ETIQUETA_POR_METODO[metodo] : 'Por confirmar';
}
