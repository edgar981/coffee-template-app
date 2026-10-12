// CHECKOUT-LISTO-PARA-VENDER-1 — la PÁGINA DE ESTADO ÚNICA (§ `refero-compra.md` §3: una sola
// plantilla para la confirmación manual y para `/checkout/retorno`). Antes había DOS
// implementaciones del mismo hecho —la pantalla "¡Pedido recibido!" de `checkout/page.tsx` y
// las cinco vistas de `RetornoCliente.tsx`— con su propio texto por rama, cosido a mano en
// cada sitio. Esta función es la FUENTE ÚNICA de "qué dice la pantalla", para que las dos
// pantallas no puedan divergir sobre el mismo estado — la misma razón por la que
// `razonDelServidor`/`cruzoMinimo` tienen una sola definición (CLAUDE.md).
//
// PURO, sin JSX ni tokens de color: el componente que la consume (`EstadoPedido.tsx`, en
// `components/storefront/checkout/`) decide el ícono y el color por estado; este módulo sólo
// decide las PALABRAS.

/** Los CINCO estados de la página (§ el spec del slice). `rechazado` y `sin_referencia` son
 *  hechos distintos: uno es "Wompi dijo que no", el otro es "no sabemos de qué pago hablas". */
export type EstadoPedidoPagina = 'aprobado' | 'pendiente' | 'rechazado' | 'manual' | 'sin_referencia';

/** El método que originó el pedido — determina el «Qué sigue» y, para `manual`, también el
 *  título. `null` = no hay método (p. ej. la pantalla `sin_referencia`, que no tiene pedido
 *  que describir). */
export type MetodoPedido =
  | 'wompi'
  | 'nequi'
  | 'daviplata'
  | 'breb'
  | 'transferencia'
  | 'efectivo'
  | 'whatsapp'
  | null;

export interface ContenidoEstadoPedido {
  /** La PALABRA de estado, para el título (§ el spec: "estado en una palabra más una línea de
   *  explicación"). */
  titulo: string;
  /** La línea de explicación, bajo el título. */
  frase: string;
  /** «Qué sigue», según el método (§ el spec, paso 3 de la página de estado). `null` cuando el
   *  estado no tiene un "qué sigue" propio que contar (p. ej. `sin_referencia`). */
  queSigue: string | null;
}

// TEXTO PROVISIONAL — PENDIENTE DE TEXTO DEL OWNER, igual que el resto del copy de este
// programa (§ el reporte del slice). La FORMA (una frase entera por rama, nunca concatenada —
// regla del repo) es la parte que no es provisional.
const CONFIRMA_EL_EQUIPO_QUE_SIGUE = 'Nuestro equipo confirmará tu pago y procesará tu pedido lo más pronto posible.';

function queSigueManual(metodo: MetodoPedido): string {
  switch (metodo) {
    case 'efectivo':
      return 'Pagas al recibir tu pedido. Ya estamos preparando tu envío.';
    case 'transferencia':
      return 'Revisamos tu comprobante de transferencia y confirmamos tu pedido lo más pronto posible.';
    case 'whatsapp':
      return 'Escríbenos por WhatsApp para coordinar el pago y completar tu pedido.';
    // nequi / daviplata / breb / null (método no identificado, igual confirmación humana).
    default:
      return CONFIRMA_EL_EQUIPO_QUE_SIGUE;
  }
}

/** El contenido de la pantalla para un estado + método dados. `nombre` (opcional) personaliza
 *  el saludo, como ya hacía "¡Pedido recibido!" ("Gracias, {nombre}"). */
export function contenidoEstadoPedido(
  estado: EstadoPedidoPagina,
  metodo: MetodoPedido,
  nombre?: string | null,
): ContenidoEstadoPedido {
  const saludo = nombre?.trim() ? `Gracias, ${nombre.trim()}. ` : '';
  switch (estado) {
    case 'aprobado':
      return {
        titulo: 'Pago aprobado',
        frase: `${saludo}Tu pedido queda confirmado y pasa a preparación.`,
        queSigue: 'El pago se confirmó automáticamente, sin que nadie del equipo lo revise.',
      };
    case 'pendiente':
      return {
        titulo: 'Pago pendiente',
        frase: 'Tu banco aún no confirma el pago.',
        queSigue: 'Esto puede tardar unos minutos. No cierres esta página: se actualiza sola apenas se confirme. No vuelvas a pagar.',
      };
    case 'rechazado':
      return {
        titulo: 'Pago rechazado',
        frase: 'El pago no se completó.',
        queSigue: 'No te preocupes: no se realizó ningún cobro y tu pedido sigue guardado. Puedes intentarlo de nuevo o elegir otro método.',
      };
    case 'manual':
      return {
        titulo: 'Pedido recibido',
        frase: `${saludo}Recibimos tu pedido.`,
        queSigue: queSigueManual(metodo),
      };
    case 'sin_referencia':
      return {
        titulo: 'No encontramos este pago',
        frase: 'Si ya pagaste, revisa el estado de tu pedido con tu número de orden y tu correo.',
        queSigue: null,
      };
  }
}

/** El VERBO del botón que confirma el pedido, en la barra de total fija (§ el spec: «el botón
 *  con el verbo del método»). `null` cuando no hay un monto que confirmar (ninguna de las
 *  ramas de hoy lo necesita vacío, pero el tipo lo deja explícito en vez de un string genérico
 *  que nadie eligió). */
export function verboBotonPago(metodo: MetodoPedido): string {
  switch (metodo) {
    case 'wompi':
      return 'Pagar con Wompi';
    case 'whatsapp':
      return 'Enviar por WhatsApp';
    default:
      return 'Confirmar pedido';
  }
}
