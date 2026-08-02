import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

// ─── ENDPOINT TEMPORAL DE DIAGNÓSTICO — BORRAR ───────────────────────────────
//
// Existe para cerrar UN incidente: producción quedó 6 migraciones atrás y no se
// sabía si el deploy no corría o si apuntaba a otra base. Todo el diagnóstico
// hecho desde local asumía que la URL comentada en `.env` era la de Vercel — esto
// lo confirma o lo desmiente desde adentro del deployment.
//
// Se elimina en el commit siguiente a la lectura. Si estás leyendo esto y el
// incidente ya está cerrado, bórralo.
//
// REGLA: NUNCA devuelve la cadena de conexión. Solo el `hostname` parseado, que
// no contiene usuario, contraseña ni base — en Neon el hostname ya identifica el
// endpoint/rama, que es exactamente lo que se necesita saber.

/** Hostname de una URL de conexión, o un marcador de por qué no se pudo. */
function hostnameDe(valor: string | undefined): string | null {
  if (!valor) return null;
  try {
    return new URL(valor).hostname;
  } catch {
    // Nunca devolver el valor crudo: podría traer credenciales.
    return '(no parseable)';
  }
}

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  // Solo OWNER: es información de infraestructura, más restringida que el resto
  // del admin (que admite MANAGER).
  if ((session.user as { role?: string }).role !== 'OWNER') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  return NextResponse.json({
    databaseUrlHost:       hostnameDe(process.env.DATABASE_URL),
    directDatabaseUrlHost: hostnameDe(process.env.DIRECT_DATABASE_URL),
    // Contexto del deployment — sin secretos. `commit` es lo que dice, de verdad,
    // qué código está sirviendo: es el dato que falta para cerrar el incidente.
    vercelEnv: process.env.VERCEL_ENV ?? null,
    commit:    process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    branch:    process.env.VERCEL_GIT_COMMIT_REF ?? null,
  });
}
