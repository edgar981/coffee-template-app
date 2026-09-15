'use client';

import { useEffect, useRef } from 'react';

// La ruta de RETORNO que (c) va a implementar — el widget de Wompi navega el navegador
// ahí cuando el comprador termina de interactuar con el checkout alojado por Wompi
// (aprobado, declinado o pendiente; el manejo de esos tres estados es (c), no esto).
// Declarada acá, con nombre claro, para que exista ANTES de que la ruta exista —
// § WOMPI-WIDGET-EN-EL-CANONICO-1. (b) NO construye esa ruta.
export const RUTA_RETORNO_WOMPI = '/checkout/retorno';

export interface PagoPasarelaProps {
  /** La referencia del `PaymentIntent` — formato "<numero_orden>:<cuid>" (ver
   *  `referenciaIntentoPago`, packages/core/src/orders.ts). */
  reference: string;
  /** El monto en CENTAVOS, ya calculado por el servidor (`pesosACentavos`). */
  amountInCents: number;
  /** El código de moneda ISO tal como lo espera Wompi ('COP' hoy, § MONEDA_WOMPI). */
  currency: string;
  /** La firma de integridad, YA CALCULADA por el servidor (`firmarIntegridadWompi`) —
   *  este componente nunca firma nada ni lee `process.env`. */
  signature: string;
  /** La llave PÚBLICA de la pasarela — no es secreta, viaja al navegador de fábrica
   *  (§ lib/pagos/llaves-pasarela.ts). El servidor la entrega en el mismo bloque `wompi`
   *  de la respuesta del checkout; este componente sólo la recibe por prop. */
  publicKey: string;
}

/**
 * La caja que Wompi entrega — su widget embebido —, montada con la transacción que el
 * servidor YA firmó. No diseña el interior del widget: sólo lo instancia con los valores
 * exactos de `(a)` (§ WOMPI-CREADOR-DE-INTENTOS-1). La verdad del pago NO vive acá —llega
 * por webhook (§4 del slice, CLAUDE.md § Pagos en línea (Wompi)) — así que este componente
 * no afirma "pagado": sólo abre la puerta para que el comprador entre a pagar.
 *
 * EL SCRIPT SE INSERTA A MANO, no con `next/script`: `widget.js` de Wompi AUTO-RENDERIZA un
 * botón en la posición del DOM donde encuentra su propio `<script>` — el patrón estándar de
 * un "buy button" de terceros (`document.currentScript`/inserción in-place). `next/script`
 * gestiona sus scripts con `strategy="afterInteractive"`/`"lazyOnload"` insertándolos en
 * `document.body`, DESACOPLADOS del lugar donde se declaró el componente en el árbol — eso
 * rompería el auto-render posicional del widget. No verificado contra el widget real en
 * esta sesión (sin navegador ni llaves de sandbox, § capa 3); es la elección más segura de
 * las dos, y queda documentada para que el gate visual la confirme o la corrija.
 */
export default function PagoPasarela({ reference, amountInCents, currency, signature, publicKey }: PagoPasarelaProps) {
  const contenedorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const contenedor = contenedorRef.current;
    if (!contenedor) return;

    const script = document.createElement('script');
    script.src = 'https://checkout.wompi.co/widget.js';
    script.setAttribute('data-render', 'button');
    script.setAttribute('data-public-key', publicKey);
    script.setAttribute('data-currency', currency);
    script.setAttribute('data-amount-in-cents', String(amountInCents));
    script.setAttribute('data-reference', reference);
    script.setAttribute('data-signature:integrity', signature);
    script.setAttribute('data-redirect-url', `${window.location.origin}${RUTA_RETORNO_WOMPI}`);
    contenedor.appendChild(script);

    return () => {
      // El widget puede haber insertado sus propios nodos dentro del contenedor al
      // renderizar el botón; se limpia el contenedor entero, no sólo `script`, para no
      // dejar un botón huérfano si el efecto se re-ejecuta (cambio de orden/reference).
      contenedor.replaceChildren();
    };
  }, [reference, amountInCents, currency, signature, publicKey]);

  return <div ref={contenedorRef} data-testid="pago-pasarela" />;
}
