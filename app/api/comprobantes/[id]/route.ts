import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import {
  decidirComprobante, ComprobanteYaDecidido,
  PagoRequeridoParaVerificar, EfectivoConComprobanteError,
  type PagoAlVerificar,
} from '@duna/core/comprobantes';
import { MetodoPago } from '@duna/core';
import { FechaFuturaError } from '@duna/core/orders';
import { dayKeyStart, BUSINESS_TZ } from '@duna/core/timezone';
import { runEventAutomations } from '@/lib/automations/engine';

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

// El VEREDICTO sobre un comprobante: verificar o rechazar. Sella quién y cuándo.
//
// VERIFICAR CREA LA PLATA (§ Decisión — Cuándo un pedido está pagado). Sobre una
// orden PENDIENTE, verificar registra el Payment y la pasa a `pagado` en la misma
// transacción (dentro de `decidirComprobante`); sobre una ya pagada, sólo sella.
// Rechazar nunca toca la orden, y tampoco borra: un RECHAZADO conserva su fila y
// su blob — es la prueba de que se rechazó.

const ACCIONES = { verificar: 'VERIFICADO', rechazar: 'RECHAZADO' } as const;
const METODOS  = Object.values(MetodoPago);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!['OWNER', 'MANAGER'].includes((session.user as { role?: string }).role ?? '')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { id } = await params;
  const body   = await req.json().catch(() => null);

  const accion = String(body?.accion ?? '');
  if (!(accion in ACCIONES)) {
    return NextResponse.json(
      { error: 'Acción inválida: usa "verificar" o "rechazar".' },
      { status: 400 },
    );
  }

  // Datos del pago para el caso verificar-sobre-orden-pendiente. `monto` NO se lee
  // del body A PROPÓSITO: sale de `order.total` server-side dentro de
  // `decidirComprobante` (§ Decisión, precisión 3). El método, si viene, se valida
  // contra el enum; el veto a EFECTIVO con comprobante lo impone el core, no acá.
  let pago: PagoAlVerificar | undefined;
  if (accion === 'verificar') {
    const metodo = body?.metodo != null ? String(body.metodo).toUpperCase() : null;
    if (metodo !== null && !METODOS.includes(metodo as MetodoPago)) {
      return NextResponse.json({ error: 'Método de pago inválido' }, { status: 400 });
    }
    // La fecha viaja como CLAVE DE DÍA (`YYYY-MM-DD`, la que emite el date picker),
    // no como instante: se ancla al inicio de ese día en Bogotá para que bucketee
    // al día correcto (§ la trampa TZ de `lib/day-key`) y para que "hoy" no caiga
    // en futuro. El veto a fecha futura lo impone `registerOrderPaymentTx`.
    const dayKey = typeof body?.fecha === 'string' ? body.fecha : null;
    if (dayKey !== null && !DAY_KEY.test(dayKey)) {
      return NextResponse.json({ error: 'Fecha de pago inválida' }, { status: 400 });
    }
    if (metodo !== null) {
      pago = {
        metodo:     metodo as MetodoPago,
        fecha:      dayKey ? dayKeyStart(dayKey, BUSINESS_TZ) : undefined,
        referencia: typeof body?.referencia === 'string' ? body.referencia : null,
      };
    }
  }

  try {
    const { comprobante, pagoCreado } = await decidirComprobante(
      id,
      ACCIONES[accion as keyof typeof ACCIONES],
      {
        por:    session.user.id,
        nombre: session.user.name ?? null,
        notas:  typeof body?.notas === 'string' && body.notas.trim() ? body.notas.trim() : null,
      },
      pago,
    );
    if (!comprobante) {
      return NextResponse.json({ error: 'Comprobante no encontrado' }, { status: 404 });
    }

    // El pago acaba de nacer de la verificación → dispara `order.pagado`. Es el
    // TERCER emisor de ese evento (los otros: el route de pagos y el PATCH de
    // estado), y omitirlo dejaría la orden pagada sin avisarle al cliente.
    // Post-commit y fire-and-forget: jamás afecta el veredicto ya escrito.
    if (pagoCreado) {
      await runEventAutomations({ tipo: 'order.pagado', orderId: comprobante.orden_id });
    }

    return NextResponse.json(comprobante);
  } catch (e) {
    // El mensaje de `ComprobanteYaDecidido` dice cuál fue el veredicto que ya
    // había, que es lo que el operador necesita para entender por qué su click
    // no hizo nada.
    if (e instanceof ComprobanteYaDecidido) {
      return NextResponse.json({ error: e.message }, { status: 409 });
    }
    // Verificar una orden pendiente exige el método (y que no sea efectivo). Los
    // dos son 400: el cliente mandó (o le faltó) un dato, no es un fallo del server.
    if (
      e instanceof PagoRequeridoParaVerificar ||
      e instanceof EfectivoConComprobanteError ||
      e instanceof FechaFuturaError
    ) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    console.error('[comprobantes] falló el veredicto', e);
    return NextResponse.json({ error: 'No se pudo actualizar el comprobante' }, { status: 500 });
  }
}
