import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { decidirComprobante, ComprobanteYaDecidido } from '@duna/core/comprobantes';

// El VEREDICTO sobre un comprobante: verificar o rechazar. Sella quién y cuándo.
//
// Lo que este endpoint NO hace, y es la mitad importante: **no toca la orden**.
// Verificar no la pasa a `pagado` — eso lo hace el Payment, y sólo él
// (§3.1). Cuando la orden todavía no tiene plata, el cliente registra el pago
// PRIMERO por su endpoint de siempre y sella acá después; el orden es
// deliberado, porque una evidencia sellada sobre un cobro que falló afirmaría
// algo falso, mientras que un pago con la evidencia sin sellar sólo deja un
// segundo click pendiente.
//
// Tampoco borra nada: un RECHAZADO conserva su fila y su blob. Un comprobante
// rechazado ES la prueba de que se rechazó.

const ACCIONES = { verificar: 'VERIFICADO', rechazar: 'RECHAZADO' } as const;

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

  try {
    const comprobante = await decidirComprobante(
      id,
      ACCIONES[accion as keyof typeof ACCIONES],
      {
        por:    session.user.id,
        nombre: session.user.name ?? null,
        notas:  typeof body?.notas === 'string' && body.notas.trim() ? body.notas.trim() : null,
      },
    );
    if (!comprobante) {
      return NextResponse.json({ error: 'Comprobante no encontrado' }, { status: 404 });
    }
    return NextResponse.json(comprobante);
  } catch (e) {
    // El mensaje de `ComprobanteYaDecidido` dice cuál fue el veredicto que ya
    // había, que es lo que el operador necesita para entender por qué su click
    // no hizo nada.
    if (e instanceof ComprobanteYaDecidido) {
      return NextResponse.json({ error: e.message }, { status: 409 });
    }
    console.error('[comprobantes] falló el veredicto', e);
    return NextResponse.json({ error: 'No se pudo actualizar el comprobante' }, { status: 500 });
  }
}
