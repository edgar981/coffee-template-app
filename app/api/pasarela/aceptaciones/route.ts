import { NextResponse } from 'next/server';
import prisma from '@duna/core';
import { consultarAceptaciones, consultarMetodosAceptados } from '@/lib/pagos/wompi-api';
import { evaluarAceptaciones } from '@/lib/pagos/aceptaciones';
import { metodosPasarelaParaComprador } from '@/lib/pagos/metodos-pasarela';
import { pasarelaDisponibleEnEsteDespliegue } from '@/services/checkout.service';
import { esDespliegueDemo } from '@/next.config';
import type { AceptacionesWompi } from '@/types/payment';

// § CHECKOUT-UNA-SOLA-PANTALLA-1: el bloque de aceptación de la pasarela — las DOS
// aceptaciones, la llave pública, y los métodos QUE NO SON TARJETA — SIN CREAR NINGUNA ORDEN.
//
// EL NUDO QUE ESTA RUTA DESATA: `POST /api/checkout` ya arma este MISMO bloque (§ API-DIRECTA-
// ACEPTACIONES-SERVIDOR-1, § API-DIRECTA-OTROS-METODOS-1), pero sólo DESPUÉS de crear la orden
// — así que el checkout no podía mostrar el formulario de pago hasta que el comprador ya
// hubiera confirmado el pedido. Las aceptaciones NO dependen de ninguna orden (son una consulta
// a la cuenta del comercio, con la llave pública), así que se extraen a un lugar que el
// checkout puede pedir ANTES de que el comprador elija pagar — apenas entra al paso de Pago,
// para saber si puede OFRECER la opción antes de que la elija.
//
// `obtenerBloqueAceptacionPasarela` es la ÚNICA implementación: la usa el GET de acá y el POST
// de `/api/checkout` (que la llama para construir su bloque `wompi`, § el reporte del slice) —
// dos llamadores del MISMO helper, nunca dos lecturas separadas de la cuenta que pudieran
// divergir sobre si las aceptaciones están completas.

export interface BloqueAceptacionPasarela {
  aceptaciones: AceptacionesWompi;
  publicKey: string;
  /** Los tipos QUE NO SON TARJETA disponibles — el dueño los encendió Y su cuenta los tiene
   *  (§ API-DIRECTA-OTROS-METODOS-1, `metodosPasarelaParaComprador`). Vacío si no hay ninguno o
   *  si no se pudo consultar — la tarjeta sigue disponible por su propio camino. */
  metodosOtros: string[];
}

function metodosGuardadosDesde(valor: unknown): string[] {
  return Array.isArray(valor) ? valor.filter((v): v is string => typeof v === 'string') : [];
}

/**
 * El bloque completo, o `null` si no se puede armar (falta la llave pública, o las DOS
 * aceptaciones no llegaron completas — § API-DIRECTA-ACEPTACIONES-SERVIDOR-1: sin las dos, la
 * transacción no se puede crear en el proveedor, así que ofrecer el pago sería ofrecer algo que
 * va a fallar). `metodosOtros` es best-effort: si la cuenta o `SiteSetting` no se pueden leer,
 * cae a `[]` — la tarjeta sigue viable por su cuenta, así que un fallo ahí no debe tumbar el
 * bloque entero (mismo criterio que ya regía `tiposPasarelaOtrosDisponibles` en el POST de
 * `/api/checkout` antes de esta extracción).
 */
export async function obtenerBloqueAceptacionPasarela(): Promise<BloqueAceptacionPasarela | null> {
  const publicKey = process.env.WOMPI_PUBLIC_KEY;
  if (!publicKey) return null;

  const baseUrlPasarela = esDespliegueDemo() ? 'https://sandbox.wompi.co' : 'https://production.wompi.co';

  let aceptaciones: AceptacionesWompi | null = null;
  try {
    aceptaciones = evaluarAceptaciones(await consultarAceptaciones(publicKey, baseUrlPasarela));
    if (!aceptaciones) {
      console.error('[pasarela/aceptaciones] las aceptaciones de Wompi llegaron incompletas (falta un token o un enlace)');
    }
  } catch (e) {
    console.error('[pasarela/aceptaciones] no se pudo consultar las aceptaciones de Wompi:', e);
  }
  if (!aceptaciones) return null;

  let metodosOtros: string[] = [];
  try {
    const [setting, cuenta] = await Promise.all([
      prisma.siteSetting.findUniqueOrThrow({ where: { id: 'default' }, select: { metodosPasarela: true } }),
      consultarMetodosAceptados(publicKey, baseUrlPasarela),
    ]);
    metodosOtros = metodosPasarelaParaComprador(metodosGuardadosDesde(setting.metodosPasarela), cuenta).map((d) => d.tipo);
  } catch (e) {
    console.error('[pasarela/aceptaciones] no se pudo leer los métodos de pasarela adicionales — se omiten:', e);
  }

  return { aceptaciones, publicKey, metodosOtros };
}

// PÚBLICA, SIN SESIÓN — el mismo criterio que `POST /api/checkout`: el checkout del comprador
// no tiene sesión de Better Auth, y este bloque no expone nada sensible (la llave es pública
// por diseño, § lib/pagos/llaves-pasarela.ts; las aceptaciones ya viajan al navegador desde el
// POST hoy).
//
// SIEMPRE 200, envelope `{ok, ...}` — mismo patrón que `/api/pasarela/metodos` (el panel del
// dueño): el checkout no necesita distinguir "el servidor falló" de "la pasarela no está
// disponible ahora mismo", los dos se traducen a lo mismo — no ofrecer la opción.
export async function GET() {
  if (!pasarelaDisponibleEnEsteDespliegue()) {
    return NextResponse.json({ ok: false, error: 'El pago con tarjeta, PSE y más no está disponible en este momento.' });
  }

  const bloque = await obtenerBloqueAceptacionPasarela();
  if (!bloque) {
    return NextResponse.json({ ok: false, error: 'No pudimos preparar el pago en línea. Intenta de nuevo más tarde.' });
  }

  return NextResponse.json({ ok: true, ...bloque });
}
