import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@duna/core';
import { headers } from 'next/headers';
import { necesitaAtencion } from '@/lib/pedidos/atencion';
import { isLowStock } from '@duna/core/metrics/inventory-filters';
import { SECCIONES_CON_ATENCION, type MapaAtencion } from '@/lib/atencion/registro';
import type { OrderStatus } from '@/types/order';

// ─── ¿QUÉ SECCIONES PIDEN ATENCIÓN? ──────────────────────────────────────────
//
// Alimenta el PUNTO SOL del nav, que es una promesa global: se ve desde cualquier
// pantalla del panel. Por eso tiene endpoint propio y no se cuelga de un dato que
// sólo se refresca dentro de una sección — ahí el punto quedaría desactualizado
// justo cuando más sirve, que es cuando el operador NO está mirando esa lista.
//
// ── UNO SOLO PARA TODAS LAS SECCIONES, Y ESA ES LA DECISIÓN ─────────────────
//
// Reemplaza a `/api/orders/atencion`, que respondía por una sola. La alternativa
// —un endpoint por sección, pedidos en paralelo— construye a propósito el problema
// que el propio `useAtencionPedidos` ya tenía escrito como advertencia: "serían
// dos timers preguntando lo mismo para siempre", multiplicado por cada sección
// nueva. Con uno, agregar una sección no agrega una petición cada 60 s.
//
// ── LAS REGLAS NO SE TRADUCEN A SQL ─────────────────────────────────────────
//
// Sería más barato un `COUNT` con los predicados escritos en el `where`. No se
// hace, y es la misma decisión que traía el endpoint viejo: ahí es exactamente
// donde el pill de la pantalla y este punto empiezan a divergir, y la divergencia
// sería INVISIBLE —dos números plausibles con criterios distintos—. El operador
// vería un punto encendido en el rail y al entrar no encontraría qué lo causó.
//
// Se trae un `select` ANGOSTO —sólo los campos que la regla mira— y deciden
// `necesitaAtencion` e `isLowStock`, las MISMAS funciones que filtran las listas.
// Una sola opinión por sección sobre qué necesita atención.

/** Pedidos que piden acción. Idéntico al endpoint que este reemplaza. */
async function contarPedidos(): Promise<number> {
  const ordenes = await prisma.order.findMany({
    // Excluir canceladas en SQL NO es traducir la regla: es su PRIMERA línea, y
    // sacarlas no puede cambiar la respuesta porque para ellas la regla ya
    // devuelve lista vacía. La guarda sigue DENTRO de `necesitaAtencion`, así que
    // si este `where` desapareciera el resultado sería idéntico — sólo más lento.
    where:  { estado: { not: 'cancelado' } },
    select: {
      estado:         true,
      condicion_pago: true,
      shipping:     { select: { estado: true, mensajero: true, fecha_programada: true } },
      comprobantes: { select: { estado: true } },
    },
  });
  return ordenes
    .map(o => ({ ...o, estado: o.estado as OrderStatus }))
    .filter(necesitaAtencion)
    .length;
}

/**
 * Productos bajo su punto de reposición.
 *
 * `isLowStock` y no una comparación propia: es la MISMA función que cuenta la
 * card "Alertas de Stock" del dashboard y que filtra `?stock=bajo-minimo` en
 * Inventario, así que el punto no puede decir que hay algo que esas dos vistas no
 * muestren. Ya excluye los inactivos por dentro (un producto despublicado no es
 * una alerta accionable), por eso acá no hay `where` de `activo`: duplicarlo sería
 * una segunda opinión sobre lo mismo.
 */
async function contarProductos(): Promise<number> {
  const productos = await prisma.product.findMany({
    select: { stock: true, stock_minimo: true, activo: true },
  });
  return productos.filter(isLowStock).length;
}

/** Contador por clave del registro. Si falta uno, el test del registro lo dice. */
const CONTADORES: Record<string, () => Promise<number>> = {
  pedidos:   contarPedidos,
  productos: contarProductos,
};

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!['OWNER', 'MANAGER'].includes((session.user as { role?: string }).role ?? '')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  // En paralelo: son consultas independientes y el punto se poletea cada 60 s.
  const totales = await Promise.all(
    SECCIONES_CON_ATENCION.map(async (s) => [s.key, await CONTADORES[s.key]()] as const),
  );

  // `hay` se deriva ACÁ y no en el cliente para que la pregunta del punto se
  // responda en un solo lugar. `total` sale gratis (es el mismo conteo) y viaja
  // porque un tooltip o un `aria-label` que diga CUÁNTOS no exigiría otro viaje.
  const mapa: MapaAtencion = {};
  for (const [key, total] of totales) mapa[key] = { hay: total > 0, total };

  return NextResponse.json(mapa);
}
