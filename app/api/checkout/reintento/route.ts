import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { crearIntentoPagoDeReintento } from '@duna/core/orders';
import { pasarelaDisponibleEnEsteDespliegue } from '@/services/checkout.service';
import { armarBloqueWompiPago, type BloqueWompiPago } from '../route';

/**
 * § CHECKOUT-REINTENTO-OTRO-METODO-1 — opción A del owner (DECISIONS.md,
 * `CHECKOUT-REINTENTO-CENSO-1`): tras un rechazo del EMISOR, el comprador
 * puede reintentar el pago con otro método SOBRE LA MISMA ORDEN — un
 * `PaymentIntent` NUEVO, nunca una orden nueva. Esta es la ÚNICA puerta que
 * abre ese intento nuevo.
 *
 * `PATCH /api/checkout` (`../route.ts`) NO CAMBIA: sigue creando la
 * transacción para el intento que YA EXISTE (el nuevo, una vez que este POST
 * lo crea) y su guarda `intent.estado !== 'EN_VUELO'` sigue siendo la que
 * impide reusar un intento ya cerrado — este endpoint sólo abre la puerta
 * para que ESA guarda tenga, de nuevo, un intento `EN_VUELO` legítimo contra
 * el cual confirmar.
 *
 * EL TOPE se cuenta y se aplica en el SERVIDOR, nunca en la pantalla:
 * `crearIntentoPagoDeReintento` (`@duna/core/orders`) lockea la orden y
 * cuenta sus intentos bajo ESE lock, así que un cuarto intento —o dos
 * reintentos concurrentes coleándose por encima del tope— nunca llega a
 * crear una fila.
 *
 * ACEPTACIONES FRESCAS: `armarBloqueWompiPago` (`../route.ts`) pide un bloque
 * de aceptación NUEVO —el MISMO mecanismo que ya usa la creación original
 * (`obtenerBloqueAceptacionPasarela`), nunca uno cacheado—. El cliente no
 * manda ningún dato de aceptación en este POST — sólo `numero_orden` — así
 * que no existe una ruta por la que un token viejo pueda colarse: el bloque
 * que este endpoint devuelve es, por construcción, uno que el comprador
 * TODAVÍA no vio.
 *
 * VERIFICA QUE LA ORDEN SIGA `pendiente` antes de abrir el intento: otra
 * pestaña pudo haberla pagado entre que el comprador vio el rechazo y
 * clickeó "Intentar con otro método". Si ya está `pagado`, el cliente lo
 * traduce a la pantalla de éxito (§ `interpretarRespuestaReintento`,
 * `components/storefront/checkout/interpretar-respuesta-reintento.ts`) —
 * cualquier otro estado no-pendiente (p. ej. `cancelado`) cae al mensaje
 * genérico, fuera de alcance de este slice.
 */
const reintentoSchema = z.object({
  numero_orden: z.string().trim().min(1),
});

const TEXTO_ERROR_GENERICO = 'No pudimos procesar tu pago. Intenta de nuevo o usa otro método.';
const TEXTO_TOPE_ALCANZADO = 'Ya intentaste pagar varias veces y no fue posible completar el cobro.';
const TEXTO_NO_PENDIENTE = 'Esta orden ya no admite un nuevo intento de pago.';
const TEXTO_NO_ENCONTRADA = 'No encontramos el pedido al que corresponde este pago.';
const TEXTO_PASARELA_NO_DISPONIBLE = 'El pago con tarjeta, PSE y más no está disponible en este momento.';

export async function POST(req: NextRequest) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo de la solicitud inválido' }, { status: 400 });
  }

  const parsed = reintentoSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos', issues: parsed.error.flatten() }, { status: 400 });
  }

  // (d) EL TOGGLE POR DESPLIEGUE — MISMO guard que el POST original de creación, y va ANTES de
  // tocar la base: sin la pasarela encendida no hay reintento que ofrecer.
  if (!pasarelaDisponibleEnEsteDespliegue()) {
    return NextResponse.json({ error: TEXTO_PASARELA_NO_DISPONIBLE }, { status: 400 });
  }

  const resultado = await crearIntentoPagoDeReintento(parsed.data.numero_orden);

  switch (resultado.tipo) {
    case 'no_encontrada':
      return NextResponse.json({ tipo: 'no_encontrada', error: TEXTO_NO_ENCONTRADA }, { status: 404 });
    case 'no_pendiente':
      // `estado` viaja para que el cliente distinga PAGADA (mostrar la confirmación de éxito)
      // de cualquier otro caso (mensaje genérico) — ver `interpretarRespuestaReintento`.
      return NextResponse.json(
        { tipo: 'no_pendiente', estado: resultado.estado, error: TEXTO_NO_PENDIENTE },
        { status: 409 },
      );
    case 'tope_alcanzado':
      return NextResponse.json({ tipo: 'tope_alcanzado', error: TEXTO_TOPE_ALCANZADO }, { status: 409 });
    case 'creado': {
      const bloque = await armarBloqueWompiPago(resultado.reference, resultado.montoEsperado);
      if (!bloque.ok) {
        // El intento YA QUEDÓ CREADO (`EN_VUELO`) — no se revierte acá: si el bloque de
        // aceptación falla, el comprador simplemente no recibe con qué pagar en ESTE
        // intento, y un reintento posterior (bajo el mismo tope) puede volver a pedirlo.
        // Ningún estado de la orden ni del intento se toca en este `if`.
        if (bloque.razon === 'sin_config') {
          console.error('[checkout/reintento] falta WOMPI_INTEGRITY_SECRET o WOMPI_PUBLIC_KEY — no se puede firmar el intento de reintento');
        } else {
          console.error('[checkout/reintento] no se pudo armar el bloque de aceptación de la pasarela para el reintento');
        }
        return NextResponse.json({ error: TEXTO_ERROR_GENERICO }, { status: 500 });
      }
      const wompi: BloqueWompiPago = bloque.bloque;
      return NextResponse.json({ tipo: 'creado', wompi }, { status: 201 });
    }
  }
}
