import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { procesarFilasImport, type FilaImport } from '@duna/core/product-import';

// Import de catálogo en lote. La LÓGICA vive en `procesarFilasImport` (core) para que
// el carril la afirme contra una base real; este handler sólo gatea (OWNER/MANAGER),
// valida la forma del body y le pasa el actor. Devuelve el resultado POR FILA que la
// grilla pinta (creada · omitida · error, con su motivo).
export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!['OWNER', 'MANAGER'].includes((session.user as { role?: string }).role ?? '')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 }); }

  const filas = (body as { filas?: unknown })?.filas;
  if (!Array.isArray(filas)) return NextResponse.json({ error: 'Falta `filas` (un arreglo de productos).' }, { status: 400 });
  if (filas.length === 0)    return NextResponse.json({ error: 'No hay filas para importar.' }, { status: 400 });
  // Tope de sanidad: un catálogo copiado a mano no llega a 500 de una; más que eso es
  // casi seguro un pegado accidental.
  if (filas.length > 500)    return NextResponse.json({ error: 'Máximo 500 productos por import.' }, { status: 400 });

  const resultado = await procesarFilasImport(
    filas as FilaImport[],
    { id: session.user.id, nombre: session.user.name ?? null },
  );
  return NextResponse.json(resultado, { status: 200 });
}
