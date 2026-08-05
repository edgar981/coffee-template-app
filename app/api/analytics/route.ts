import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { calcularAnalitica } from '@/lib/analitica';
import { PERIODO_DEFAULT, esPeriodo, type PeriodoKey } from '@/lib/metrics/periodo';

// ANALÍTICA — cuatro preguntas de dueño, cada una atada a una decisión.
//
// Este handler REEMPLAZA al anterior en su sitio; no hay `/v2`. El endpoint viejo
// tenía cinco defectos de definición (no excluía `SN-`, sumaba `Order.total` en
// vez del libro de pagos, bucketeaba meses con el reloj del SERVIDOR, promediaba
// el margen del catálogo sin ponderar por ventas, y dividía los recurrentes entre
// TODOS los clientes) y ninguna de sus salidas sobrevivía intacta. Un `/v2` habría
// dejado vivo un endpoint con su propia definición de "ingreso" y sin consumidores
// que lo mantuvieran honesto — que es exactamente cómo `razonDelServidor` y
// `cruzoMinimo` terminaron duplicados y divergiendo.
//
// El CÓMPUTO vive en `lib/analitica.ts`, no acá: el carril de integración no monta
// handlers HTTP, así que la única forma de afirmar las consultas contra una base
// real es que sean una función. Acá queda lo que SÍ es del protocolo HTTP — sesión,
// rol y parseo del query param.

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!['OWNER', 'MANAGER'].includes((session.user as { role?: string }).role ?? '')) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  // El selector gobierna SOLO el bloque de Rentabilidad, que es donde vive. Los
  // otros tres declaran su propio período en su subtítulo: la cartera es estado
  // ACTUAL (un saldo no lleva período), la trayectoria ES la serie larga, y
  // clientes/canales van al año en curso.
  //
  // Un período desconocido cae al default en vez de dar 400: mismo criterio que
  // `parseFilters` de Órdenes, que descarta los estados que no reconoce en vez de
  // rechazar la URL entera. El payload hace ECO del período resuelto, así que el
  // cliente puede detectar que le dieron otro (y de hecho lo usa: su estado de
  // carga se deriva de esa comparación).
  const pedido = new URL(request.url).searchParams.get('periodo');
  const periodo: PeriodoKey = esPeriodo(pedido) ? pedido : PERIODO_DEFAULT;

  return NextResponse.json(await calcularAnalitica(periodo));
}
