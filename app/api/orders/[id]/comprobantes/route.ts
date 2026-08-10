import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@duna/core';
import { headers } from 'next/headers';
import { storage } from '@/lib/storage';
import { crearComprobante, comprobantesDeOrden } from '@duna/core/comprobantes';
import { validarArchivoComprobante } from '@/lib/comprobante';
import { PREFIJO_COMPROBANTES } from '@/constants/comprobante';

// Comprobantes DE una orden. Adjuntar un soporte no registra un pago ni mueve la
// orden: crea evidencia (§3.1). Es lo que permite el caso real "el cliente mandó
// la foto, la verifico después", que un campo en Payment no podría representar.
//
// Sube a Vercel Blob por `lib/storage.ts` — ningún otro archivo del repo importa
// el SDK del proveedor, y esta ruta no es la excepción.

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!['OWNER', 'MANAGER'].includes((session.user as { role?: string }).role ?? '')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { id } = await params;
  return NextResponse.json(await comprobantesDeOrden(id));
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!['OWNER', 'MANAGER'].includes((session.user as { role?: string }).role ?? '')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { id } = await params;

  // La orden tiene que existir ANTES de subir: un blob subido contra una orden
  // inexistente sería basura que nadie va a reclamar, y el FK fallaría igual.
  const orden = await prisma.order.findUnique({
    where: { id }, select: { id: true, estado: true },
  });
  if (!orden) return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });
  // Sobre una orden cancelada no se adjunta: no hay cobro que soportar, y el
  // soporte quedaría colgado de un registro que nadie va a volver a mirar.
  if (orden.estado === 'cancelado') {
    return NextResponse.json(
      { error: 'La orden está cancelada; no admite comprobantes.' },
      { status: 409 },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: 'Petición inválida: se esperaba multipart/form-data' },
      { status: 400 },
    );
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No se recibió ningún archivo' }, { status: 400 });
  }

  // LA MISMA función que corre el formulario. El cliente valida para no gastar
  // una subida que va a ser rechazada; ésta es la que MANDA. Que sea la misma es
  // lo que impide que discrepen sobre qué es un comprobante válido.
  const problema = validarArchivoComprobante({ type: file.type, size: file.size, name: file.name });
  if (problema) return NextResponse.json({ error: problema }, { status: 400 });

  let url: string;
  try {
    ({ url } = await storage.put(file, { prefix: PREFIJO_COMPROBANTES }));
  } catch (e) {
    console.error('[comprobantes] falló la subida', e);
    return NextResponse.json({ error: 'No se pudo subir el comprobante' }, { status: 502 });
  }

  const comprobante = await crearComprobante({
    ordenId:         id,
    url,
    contentType:     file.type,
    sizeBytes:       file.size,
    subidoPor:       session.user.id,
    subidoPorNombre: session.user.name ?? null,
  });

  return NextResponse.json(comprobante, { status: 201 });
}
