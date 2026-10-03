import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@duna/core';
import { rateLimit } from '@duna/core/rate-limit';
import { crearComprobante } from '@duna/core/comprobantes';
import { storage } from '@/lib/storage';
import { validarArchivoComprobante, COMPROBANTE_SUBIDO_POR_CLIENTE } from '@/lib/comprobante';
import { PREFIJO_COMPROBANTES } from '@/constants/comprobante';
import {
  admiteComprobanteCliente, mensajeRechazoComprobanteCliente, verificarCodigoComprobante,
} from '@/lib/checkout/comprobante-cliente';

// Público, SIN sesión — el cliente adjunta su comprobante DESPUÉS de crear la orden,
// contra esa misma orden (§ Decisión — Cuándo un pedido está pagado, CLAUDE.md:
// "comprobante SIN pago" es justo este caso: la plata no entró todavía por sí sola,
// el cliente sólo deja la evidencia).
//
// `[id]` es el `numero_orden` (lo único que el cliente tiene como ruta — el `id`
// interno nunca sale de la base), no el cuid interno. El nombre del segmento se
// queda como `id` por ser la misma forma que ya usan las rutas hermanas
// (`[id]/comprobantes`, `[id]/payments`); lo que cambia es QUÉ identifica para esta
// ruta en particular.
//
// LA PRUEBA DE QUE EL CLIENTE CREÓ ESTA ORDEN es el CÓDIGO que `POST /api/checkout`
// emitió al crear la orden y devolvió SÓLO en esa respuesta (§ CHECKOUT-COMPROBANTE-
// TOKEN-1 — el porqué completo, con la vía por correo que esto reemplaza, vive en el
// docstring de cabecera de `lib/checkout/comprobante-cliente.ts`). Un código que no
// verifica se trata EXACTAMENTE igual que una orden que no existe: mismo 404
// genérico, para no delatar cuál de las dos cosas falló.

export const dynamic = 'force-dynamic';

const NOT_FOUND = NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });

const bodySchema = z.object({
  codigo: z.string().trim().min(1),
});

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // Rate-limit por IP — mismo propósito que en `/api/orders/track`: blunt la
  // enumeración de `numero_orden` × correo, y acá además hay costo de storage de
  // por medio, así que el límite es más estricto que el de la sola lectura.
  const rl = rateLimit(`comprobante-cliente:${clientIp(req)}`, { limit: 5, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Demasiadas solicitudes. Intenta de nuevo en un momento.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } },
    );
  }

  const { id: numeroOrden } = await params;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: 'Petición inválida: se esperaba multipart/form-data' },
      { status: 400 },
    );
  }

  const codigo = bodySchema.safeParse({ codigo: form.get('codigo') });
  // Un código con forma inválida (ausente, vacío) no puede verificar nunca: mismo
  // 404 genérico que un código que no verifica (no hay un oráculo que delate cuál
  // de las dos cosas pasó).
  if (!codigo.success) return NOT_FOUND;

  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No se recibió ningún archivo' }, { status: 400 });
  }

  const orden = await prisma.order.findUnique({
    where: { numero_orden: numeroOrden },
    select: { id: true, estado: true, metodo_pago: true },
  });
  if (!orden) return NOT_FOUND;

  // LA MISMA función que correría el cliente para avisar temprano — ésta es la que
  // MANDA (§ `validarArchivoComprobante`, reusada, no copiada).
  const problemaArchivo = validarArchivoComprobante({ type: file.type, size: file.size, name: file.name });
  if (problemaArchivo) return NextResponse.json({ error: problemaArchivo }, { status: 400 });

  const comprobantesExistentes = await prisma.comprobante.count({ where: { orden_id: orden.id } });
  const codigoValido = verificarCodigoComprobante(codigo.data.codigo, numeroOrden, process.env.BETTER_AUTH_SECRET);
  const veredicto = admiteComprobanteCliente(orden, codigoValido, comprobantesExistentes);
  if (!veredicto.ok) {
    // `codigo_invalido` es indistinguible de "la orden no existe" — ver el
    // docstring de `admiteComprobanteCliente`. Las otras tres SÍ pueden mostrarse:
    // para llegar ahí, el cliente ya probó que es el dueño de la orden.
    if (veredicto.motivo === 'codigo_invalido') return NOT_FOUND;
    return NextResponse.json({ error: mensajeRechazoComprobanteCliente(veredicto.motivo) }, { status: 400 });
  }

  let url: string;
  try {
    ({ url } = await storage.put(file, { prefix: PREFIJO_COMPROBANTES }));
  } catch (e) {
    console.error('[comprobante-cliente] falló la subida', e);
    return NextResponse.json({ error: 'No se pudo subir el comprobante' }, { status: 502 });
  }

  const comprobante = await crearComprobante({
    ordenId:         orden.id,
    url,
    contentType:     file.type,
    sizeBytes:       file.size,
    // `subido_por: null` — no hay sesión; el nombre snapshoteado dice que fue el
    // cliente, no un operador (§ `lib/comprobante.ts`, una sola fuente).
    subidoPor:       null,
    subidoPorNombre: COMPROBANTE_SUBIDO_POR_CLIENTE,
  });

  return NextResponse.json(comprobante, { status: 201 });
}
