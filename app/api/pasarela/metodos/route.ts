import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import prisma from '@duna/core';
import { consultarMetodosAceptados } from '@/lib/pagos/wompi-api';
import { esDespliegueDemo } from '@/next.config';

// El panel de métodos de PASARELA (§ API-DIRECTA-PANEL-METODOS-1): lee del PROVEEDOR la lista
// real de la cuenta, para que el dueño sólo pueda ofrecer lo que su cuenta realmente tiene —
// nunca un catálogo escrito en este código. Gateado a admin, mismo patrón que
// `app/api/site-settings/route.ts`.
//
// SIEMPRE devuelve `guardado` — lo que hoy vive en `SiteSetting.metodosPasarela` — junto al
// resultado de consultar al proveedor, se haya podido leer o no: es lo que el panel muestra
// mientras la cuenta está "cargando" o cuando falló la lectura (§ el spec: "nunca la lista
// guardada se pierde detrás de un fallo").
//
// `ok:false` es un FALLO EXPLÍCITO, nunca una lista vacía disfrazada de fallo — la
// distinción vive en el TIPO de la respuesta, no en un comentario.

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) };
  if (!['OWNER', 'MANAGER'].includes((session.user as { role?: string }).role ?? '')) {
    return { error: NextResponse.json({ error: 'No autorizado' }, { status: 403 }) };
  }
  return {};
}

function guardadoDesde(valor: unknown): string[] {
  return Array.isArray(valor) ? valor.filter((v): v is string => typeof v === 'string') : [];
}

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const setting = await prisma.siteSetting.findUniqueOrThrow({ where: { id: 'default' } });
  const guardado = guardadoDesde(setting.metodosPasarela);

  const publicKey = process.env.WOMPI_PUBLIC_KEY;
  if (!publicKey) {
    return NextResponse.json({
      ok: false,
      error: 'Este despliegue no tiene una llave de pasarela configurada.',
      guardado,
    });
  }

  const baseUrl = esDespliegueDemo() ? 'https://sandbox.wompi.co' : 'https://production.wompi.co';
  try {
    const metodos = await consultarMetodosAceptados(publicKey, baseUrl);
    return NextResponse.json({ ok: true, metodos, guardado });
  } catch (e) {
    console.error('[pasarela/metodos] no se pudo leer la cuenta de la pasarela:', e);
    return NextResponse.json({
      ok: false,
      error: 'No se pudo consultar tu cuenta de pasarela. Intenta de nuevo más tarde.',
      guardado,
    });
  }
}
