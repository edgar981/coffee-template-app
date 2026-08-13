import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@duna/core';
import { headers } from 'next/headers';
import { necesitaAtencion } from '@/lib/pedidos/atencion';
import type { OrderStatus } from '@/types/order';

// ─── ¿HAY PEDIDOS POR ATENDER? ───────────────────────────────────────────────
//
// Alimenta el PUNTO SOL del nav, que es una promesa global: se ve desde cualquier
// pantalla del panel. Por eso tiene endpoint propio y no se cuelga de un dato que
// sólo se refresca en Pedidos — ahí el punto quedaría desactualizado justo cuando
// más sirve, que es cuando el operador NO está mirando la lista.
//
// ── LA REGLA NO SE TRADUCE A SQL, Y ES LA DECISIÓN DE ESTE ARCHIVO ──────────
//
// Sería más barato devolver un `COUNT` con los cuatro predicados escritos en el
// `where`. No se hace: ahí es exactamente donde el pill "Necesitan atención" de la
// pantalla y este punto empiezan a divergir, y la divergencia sería INVISIBLE —
// dos números plausibles calculados con criterios distintos. El operador vería un
// punto encendido en el rail y al entrar no encontraría qué lo causó.
//
// Se trae un `select` ANGOSTO —sólo los campos que la regla mira, ni items ni
// cliente ni totales— y decide `necesitaAtencion`, la MISMA función que filtra el
// pill. Una sola opinión sobre qué necesita atención.
//
// Se evaluó un pre-filtro más agresivo (sólo pedidos con envío o con comprobante
// RECIBIDO, que hoy es un superconjunto demostrable de los cuatro motivos) y se
// DESCARTÓ por decisión del owner: hoy son decenas de filas y eso paga con miles,
// pero el costo es permanente — un quinto motivo que no necesitara ninguna de las
// dos cosas quedaría oculto en silencio, y la única garantía contra eso sería un
// test que alguien puede desactivar. Cuando las filas duelan de verdad se agrega,
// con su test de carril y con el dato de cuánto duelen, no con una estimación.
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!['OWNER', 'MANAGER'].includes((session.user as { role?: string }).role ?? '')) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const ordenes = await prisma.order.findMany({
    // Excluir canceladas en SQL NO es traducir la regla: es su PRIMERA línea, y
    // sacarlas no puede cambiar la respuesta porque para ellas la regla ya devuelve
    // lista vacía. La guarda sigue DENTRO de `necesitaAtencion`, así que si este
    // `where` desapareciera el resultado sería idéntico — sólo más lento. Un atajo
    // que no puede mentir.
    where:  { estado: { not: 'cancelado' } },
    // Exactamente lo que la regla mira, y nada más.
    select: {
      estado:         true,
      condicion_pago: true,
      shipping:     { select: { estado: true, mensajero: true, fecha_programada: true } },
      comprobantes: { select: { estado: true } },
    },
  });

  // `Order.estado` es una columna String en el schema (cada eje tiene su propio
  // vocabulario, por eso no es un enum de Prisma) y `OrderStatus` es la lectura que
  // la app hace de ella. El cast vive acá, en la frontera, y no dentro de la regla:
  // la regla es pura y no debe saber de dónde vienen sus datos.
  const total = ordenes
    .map(o => ({ ...o, estado: o.estado as OrderStatus }))
    .filter(necesitaAtencion)
    .length;

  // `total` sale gratis (es el `.length` del mismo filtro) y por eso viaja: hoy el
  // punto sólo necesita el booleano —no tiene estado apagado, si no hay nada no se
  // renderiza— pero un tooltip o un `aria-label` que diga CUÁNTOS no exigiría otro
  // endpoint. `hay` se deriva acá y no en el cliente para que la pregunta del punto
  // se responda en un solo lugar.
  return NextResponse.json({ hay: total > 0, total });
}
