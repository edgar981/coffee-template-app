import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { logsDeInventario } from '@duna/core/inventory';

// ─── EL KARDEX ───────────────────────────────────────────────────────────────
//
// `?producto=<id>` acota los movimientos a UN producto. Es la mitad de servidor
// de la frontera Productos↔Inventario: el detalle de un producto muestra SU
// kardex, y esta pantalla se queda con el completo (la vista de auditoría).
//
// ADITIVO: sin el parámetro la respuesta es exactamente la de antes —mismo
// orden, mismo tope de 200—, así que la pestaña Movimientos no cambia una fila.
//
// La consulta vive en `@duna/core/inventory`, junto a quien ESCRIBE el kardex, y
// no acá: el carril de integración no monta HTTP, así que la única forma de
// afirmar contra una base real qué filas devuelve es que sea una función. Este
// handler se queda con lo suyo — sesión, parseo y códigos de estado.

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!['OWNER', 'MANAGER'].includes((session.user as { role?: string }).role ?? '')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  // `?producto=` vacío o ausente = el kardex completo. Se normaliza acá, en la
  // frontera HTTP: un `''` que llegue de un query mal armado no debe convertirse
  // en un filtro por producto vacío, que devolvería CERO filas y se leería como
  // "este producto no tiene movimientos" en vez de "no filtres nada".
  const producto = req.nextUrl.searchParams.get('producto')?.trim() || undefined;

  const logs = await logsDeInventario({ productoId: producto });
  return NextResponse.json(logs);
}
