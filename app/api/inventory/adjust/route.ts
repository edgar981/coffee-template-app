import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { runEventAutomations } from '@/lib/automations/engine';
import {
  aplicarAjusteInventario,
  InsufficientStockError, ProductoNoEncontradoError, CantidadInvalidaError,
} from '@duna/core/inventory';

// El handler se queda con lo suyo: sesión, parseo y códigos de estado. La regla
// del movimiento y su transacción viven en lib/inventory (extraídas para poder
// testear su concurrencia — ver CLAUDE.md § Las tres capas).

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!['OWNER', 'MANAGER'].includes((session.user as { role?: string }).role ?? '')) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const { producto_id, tipo, cantidad, motivo } = await req.json();

  let resultado;
  try {
    resultado = await aplicarAjusteInventario(
      { producto_id, tipo, cantidad, motivo },
      { id: session.user.id, nombre: session.user.name ?? null },
    );
  } catch (e) {
    if (e instanceof ProductoNoEncontradoError) return NextResponse.json({ error: e.message }, { status: 404 });
    if (e instanceof CantidadInvalidaError)     return NextResponse.json({ error: e.message }, { status: 400 });
    if (e instanceof InsufficientStockError)    return NextResponse.json({ error: e.message }, { status: 409 });
    throw e;
  }

  // CRUCE del mínimo, no estado bajo — el cálculo vive en `aplicarAjusteInventario`
  // con los dos valores de la misma transacción. Post-commit y fire-and-forget:
  // `runEventAutomations` nunca lanza, así que un fallo de aviso no puede tumbar
  // un ajuste ya persistido.
  if (resultado.cruzoElMinimo) {
    await runEventAutomations({ tipo: 'stock.cruzo_minimo', productoId: producto_id });
  }

  return NextResponse.json({ product: resultado.product, log: resultado.log });
}
