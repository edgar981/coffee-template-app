// COMPRA-LINEAS-ONIX-CHAMISAS-1, ampliado por COMPRA-FIDELIDAD-3 — la resolución de los CUATRO ejes
// del camino de compra (`content.compra.{cajon,confirmacion,seguimiento,pasos}`, §
// `lib/config/site-content-defaults.ts`) al set cerrado de cada uno. PURO, sin JSX ni tokens de
// color — los componentes que consumen esto (`CartDrawer.tsx`, `EstadoPedido.tsx`,
// `rastrear-pedido/page.tsx`, `app/(storefront)/checkout/page.tsx`) deciden la forma visual; este
// módulo sólo dice QUÉ tratamiento corresponde a un valor guardado, caiga lo que caiga a la común.
//
// `resolverSiteContent` (site-content-defaults.ts) YA clampa estos cuatro campos con
// `resolverVariante` al leer de la base — así que en producción nunca llega acá un valor fuera del
// set. Pero los componentes del storefront reciben el valor ya resuelto como un `string` suelto (el
// tipo de `CompraContent` es la unión cerrada, pero TypeScript no puede probar en RUNTIME que lo que
// viajó por un `useSiteContent()` con datos sintéticos de test, o un valor evolucionado de una fila
// vieja, siga en el set) — de ahí que esta SEGUNDA capa de clamp exista: un valor desconocido cae a
// la común, igual que el resolver, nunca lanza.

import { REGISTRY, type ClaveCompraCajon, type ClaveCompraConfirmacion, type ClaveCompraPasos, type ClaveCompraSeguimiento } from '@/lib/config/site-content-defaults';
import { verboBotonPago, type EstadoPedidoPagina, type MetodoPedido } from './estado-pedido';

const CLAVES_CAJON = new Set(REGISTRY.compra.escalares!.cajon.claves);
const CLAVES_CONFIRMACION = new Set(REGISTRY.compra.escalares!.confirmacion.claves);
const CLAVES_SEGUIMIENTO = new Set(REGISTRY.compra.escalares!.seguimiento.claves);
const CLAVES_PASOS = new Set(REGISTRY.compra.escalares!.pasos.claves);

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

/** Los pasos de Entrega y Pago del checkout (§ COMPRA-FIDELIDAD-3). Cualquier valor fuera de
 *  `['comun','ficha','tejido']` cae a `'comun'`. */
export function composicionPasos(valor: unknown): ClaveCompraPasos {
  return typeof valor === 'string' && CLAVES_PASOS.has(valor as ClaveCompraPasos)
    ? (valor as ClaveCompraPasos)
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

// EL CTA DEL PASO DE PAGO NOMBRA EL MÉTODO (§ COMPRA-FIDELIDAD-3, refero.md §3: "al enviar, el CTA
// SIEMPRE nombra el método" — "Pagar $X con Wompi", "Ya pagué con Nequi · confirmar", "Ya transferí,
// confirmar pedido", "Confirmar pedido contra entrega"). `verboBotonPago` (./estado-pedido.ts) ya
// cubre wompi/whatsapp y el default genérico «Confirmar pedido» para el resto — ese archivo es la
// fuente única de "qué dice la pantalla de estado" y queda AFUERA del alcance de este slice
// (`touches:` no lo incluye). Esta función no lo REIMPLEMENTA: lo ENVUELVE, ampliando sólo los
// métodos manuales que hoy caen al genérico. Es un superset por delegación, no una segunda
// definición del mismo hecho — el día que `verboBotonPago` nombre estos métodos por su cuenta, este
// mapa queda inerte (nunca se alcanza) y se puede retirar.
const VERBO_CTA_MANUAL: Partial<Record<Exclude<MetodoPedido, null>, string>> = {
  nequi:         'Ya pagué con Nequi · confirmar',
  daviplata:     'Ya pagué con Daviplata · confirmar',
  breb:          'Ya pagué con Bre-B · confirmar',
  transferencia: 'Ya transferí · confirmar pedido',
  efectivo:      'Confirmar pedido contra entrega',
};

/** El verbo del CTA que confirma el pedido, nombrando el método elegido. Delega en
 *  `verboBotonPago` para wompi/whatsapp/null; para los métodos manuales que ese helper deja en el
 *  genérico «Confirmar pedido», da la frase específica de la maqueta. */
export function verboCTACompra(metodo: MetodoPedido): string {
  const especifico = metodo ? VERBO_CTA_MANUAL[metodo] : undefined;
  return especifico ?? verboBotonPago(metodo);
}
