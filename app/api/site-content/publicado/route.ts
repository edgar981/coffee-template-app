import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { readSiteContent } from '@/lib/config/site-content-read';

// El contenido PUBLICADO del storefront —lo que ve el VISITANTE (`readSiteContent`: sólo `content`,
// JAMÁS el borrador)—, para el AVISO de configuración del Dashboard (§ Backlog #65): el aviso cruza
// este contenido con el catálogo y detecta los defectos que dejan la tienda rota/incompleta para el
// visitante SIN que el dueño se entere. Es un LECTOR distinto del `GET /api/site-content`, que devuelve
// el BORRADOR (draft-merged) para el EDITOR —el aviso no puede leer el borrador: avisaría de un defecto
// que el visitante todavía no ve, o callaría uno que sí—.
//
// Devuelve el contenido COMPLETO (no sólo `presentaciones`): así la detección de los defectos DORMIDOS
// (#3/#4/#8: hero/brandStory/whatsapp, cuando llegue el 2º cliente) se agrega en `avisosDeConfiguracion`
// sin tocar este lector — la puerta queda abierta, no se construye lo dormido.
//
// Gateado OWNER/MANAGER como todo el árbol `/api/site-content/*` (el único consumidor es el Dashboard,
// admin). El dato en sí es público —la tienda lo sirve—, pero el árbol se mantiene admin por coherencia.
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!['OWNER', 'MANAGER'].includes((session.user as { role?: string }).role ?? '')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }
  return NextResponse.json(await readSiteContent());
}
