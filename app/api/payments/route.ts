import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@duna/core';
import { headers } from 'next/headers';
import { BUSINESS_TZ } from '@duna/core/timezone';
import { rangoFechasPagos } from '@/lib/pagos/rango';

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

// Read-only payments ledger. Every row is a received payment tied to an order;
// the customer + order number are read live through the relation. Registration
// happens at POST /api/orders/[id]/payments — there is no independent create here.
//
// EL RANGO SE FILTRA EN SQL, no en el cliente. Antes se devolvían las últimas 500 y
// el rango se recortaba client-side: con >500 pagos, un mes viejo mostraba un
// subconjunto INCOMPLETO sin avisar (mostrar menos antes que mentir). Ahora `desde`/
// `hasta` (claves de día, ancladas a Bogotá) van al `where`, y como la pantalla SIEMPRE
// abre con un rango, no hay caso sin acotar ni corte silencioso que declarar. Si
// faltara el rango (llamada directa a la API), se cae al MES EN CURSO — nunca a una
// consulta sin límite.
export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!['OWNER', 'MANAGER'].includes((session.user as { role?: string }).role ?? '')) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const sp    = req.nextUrl.searchParams;
  const desde = sp.get('desde');
  const hasta = sp.get('hasta');
  if ((desde && !DAY_KEY.test(desde)) || (hasta && !DAY_KEY.test(hasta))) {
    return NextResponse.json({ error: 'Rango de fechas inválido' }, { status: 400 });
  }

  const { gte, lt } = rangoFechasPagos({ desde, hasta, ahora: new Date() }, BUSINESS_TZ);

  const payments = await prisma.payment.findMany({
    where:   { fecha: { gte, lt } },
    orderBy: { fecha: 'desc' },
    // Los comprobantes son de la ORDEN, no del Payment (§3.1): un pago en
    // efectivo no tiene ninguno y una orden puede tener uno sin pago. Sólo se
    // traen `id` y `estado` — lo justo para el indicador, sin arrastrar URLs
    // que esta lista no muestra.
    include: {
      order: {
        select: {
          numero_orden:   true,
          cliente_nombre: true,
          comprobantes:   { select: { id: true, estado: true } },
        },
      },
    },
  });

  return NextResponse.json(payments);
}
