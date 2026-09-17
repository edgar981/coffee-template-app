import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createOrderWithCustomer, resolveOrderLines, OrderLinesError } from '@duna/core/orders';
import { buildBrand } from '@/lib/config/brand';
import { getShippingSlot, computeShippingCost } from '@duna/core/shipping-config';
import { isBogotaDC } from '@duna/core/colombia-departments';
import { runEventAutomations } from '@/lib/automations/engine';
import {
  direccionField, direccionDetalleField, ciudadField, departamentoField, telefonoColombiaField,
} from '@duna/core/validation/address';
import { metodoPagoTipoSchema } from '@/lib/checkout/metodos-pago';
import { pesosACentavos, firmarIntegridadWompi } from '@/lib/pagos/wompi-firma';
import { consultarAceptaciones, consultarMetodosAceptados, crearTransaccion } from '@/lib/pagos/wompi-api';
import { evaluarAceptaciones } from '@/lib/pagos/aceptaciones';
import {
  clasificarCreacionTransaccion, construirDatosCreacionTransaccion, construirDatosCreacionTransaccionTarjeta,
} from '@/lib/pagos/creacion-transaccion';
import { clasificarAutenticacion3ds, extraerContenidoDesafio3ds } from '@/lib/pagos/tres-ds';
import { DESCRIPTORES_METODO_PASARELA, metodosPasarelaParaComprador } from '@/lib/pagos/metodos-pasarela';
import type { AceptacionesWompi } from '@/types/payment';
import { pasarelaDisponibleEnEsteDespliegue } from '@/services/checkout.service';
import { esDespliegueDemo } from '@/next.config';
import prisma from '@duna/core';

// La moneda del store es COP, sin selector: es lo único que el checkout maneja
// hoy (formatCOP, Order.total, todo el sistema). No es un valor inventado para
// Wompi — es el que YA rige el resto del sistema.
const MONEDA_WOMPI = 'COP';

// Guest checkout is intentionally unauthenticated — no Better Auth session.
// The client is trusted ONLY for product slugs, quantities and customer /
// shipping details. Every price, the shipping cost, the order total, the order
// number and the order status are computed server-side from Product records.

// Exportado para el test co-ubicado (`route.test.ts`, § WOMPI-WIDGET-EN-EL-CANONICO-1):
// afirmar la FORMA del schema (la unión `metodo`/`pasarela`) no necesita invocar `POST` ni
// tocar la base — mismo criterio que `procesarEventoWompi`/`PaymentIntentDb` exportados del
// webhook (`app/api/webhooks/wompi/route.ts`) por la misma razón.
export const checkoutSchema = z.object({
  customer: z.object({
    nombre:   z.string().trim().min(1),
    apellido: z.string().trim().default(''),
    email:    z.string().trim().email(),
    // Same phone standard as the admin add-address flow (shared validator).
    telefono: telefonoColombiaField,
  }),
  // Address fields share their validators with the admin "Agregar dirección"
  // flow (lib/validation/address) — one definition of a valid address.
  shipping: z.object({
    direccion:         direccionField,
    direccion_detalle: direccionDetalleField,
    ciudad:            ciudadField,
    departamento:      departamentoField,
    franja:            z.string().trim().min(1).nullish(),
  }),
  payment: z.union([
    z.object({
      // DERIVADO de `METODOS_PAGO_ORDEN` (§ METODOS-TRES-LISTAS-1) — antes era un arreglo literal
      // que no importaba `MetodoPagoTipo`/`METODOS_PAGO_ORDEN`, así que un método agregado a la
      // lista real (`lib/checkout/metodos-pago.ts`) quedaba OFRECIDO por el checkout y RECHAZADO
      // acá con 400 al confirmar, sin que nada lo delatara.
      metodo:     metodoPagoTipoSchema,
      referencia: z.string().trim().min(1).optional(),
    }),
    z.object({
      // El camino APARTE de la pasarela (§ WOMPI-WIDGET-EN-EL-CANONICO-1) — NUNCA un valor más
      // de `metodo`/`METODOS_PAGO_ORDEN`: ese set cerrado es lo que el dueño configura en su
      // panel, y la pasarela es un toggle de DESPLIEGUE que todavía no existe (ver (d) más abajo).
      pasarela: z.literal(true),
    }),
  ]),
  items: z
    .array(
      z.object({
        slug:     z.string().trim().min(1),
        cantidad: z.number().int().positive(),
        molienda: z.string().trim().min(1).nullish(),
      }),
    )
    .min(1),
});

// ── API-DIRECTA-OTROS-METODOS-1: qué métodos QUE NO SON TARJETA se le OFRECEN al comprador ──
//
// El MISMO cruce que ya usa el panel del dueño (`cruzarMetodosPasarela`, § API-DIRECTA-PANEL-
// METODOS-1) — reusado vía `metodosPasarelaParaComprador`, nunca reimplementado. Falla SUAVE a
// `[]`: si la cuenta no se puede consultar o `SiteSetting` no se puede leer, la tarjeta sigue
// disponible por su propio camino (ver el llamador, arriba en el bloque `wompi`) — esta lista
// es sólo para las opciones ADICIONALES, así que no vale bloquear el bloque entero por ella.
function metodosGuardadosDesde(valor: unknown): string[] {
  return Array.isArray(valor) ? valor.filter((v): v is string => typeof v === 'string') : [];
}

async function tiposPasarelaOtrosDisponibles(publicKey: string, baseUrl: string): Promise<string[]> {
  try {
    const [setting, cuenta] = await Promise.all([
      prisma.siteSetting.findUniqueOrThrow({ where: { id: 'default' }, select: { metodosPasarela: true } }),
      consultarMetodosAceptados(publicKey, baseUrl),
    ]);
    const guardado = metodosGuardadosDesde(setting.metodosPasarela);
    return metodosPasarelaParaComprador(guardado, cuenta).map((d) => d.tipo);
  } catch (e) {
    console.error('[checkout] no se pudo leer los métodos de pasarela adicionales — se omiten del bloque de pasarela:', e);
    return [];
  }
}

export async function POST(req: NextRequest) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo de la solicitud inválido' }, { status: 400 });
  }

  const parsed = checkoutSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos inválidos', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { customer, shipping, payment, items } = parsed.data;

  // `payment` es un discriminated union (§ WOMPI-WIDGET-EN-EL-CANONICO-1): o trae `metodo`
  // (el set cerrado de `METODOS_PAGO_ORDEN`) o trae `pasarela: true` — nunca los dos. Las dos
  // constantes derivadas abajo son la ÚNICA lectura del discriminador en toda la ruta.
  const metodoElegido = 'metodo' in payment ? payment.metodo : null;
  const pideWompi = 'pasarela' in payment;

  // Departamento is the single source of truth for Bogotá detection. It's
  // validated against the canonical list by `departamentoField` in the schema
  // above (shared with the admin add-address flow).

  // Derive the shipping tier from departamento. The client cannot select this.
  const metodoEnvio: 'bogota' | 'nacional' =
    isBogotaDC(shipping.departamento) ? 'bogota' : 'nacional';

  // Business rule: "Contra entrega" (efectivo) is only valid for Bogotá D.C.
  // deliveries. Client-side hiding is UX; the server is the enforcement point.
  if (metodoElegido === 'efectivo' && metodoEnvio !== 'bogota') {
    return NextResponse.json(
      { error: 'El pago contra entrega solo está disponible para entregas en Bogotá D.C.' },
      { status: 400 },
    );
  }

  // (d) EL TOGGLE POR DESPLIEGUE TODAVÍA NO EXISTE — la capacidad nace APAGADA en el
  // SERVIDOR, sin importar lo que pida el payload. La UI ya esconde la opción (§ el
  // checkout), pero esto es lo que impide que un POST directo con `pasarela: true` alcance
  // `crearIntentoPago` mientras `pasarelaDisponibleEnEsteDespliegue()` siga devolviendo
  // `false`. Va ANTES de tocar la base — ninguna fila se crea para una capacidad que este
  // despliegue no ofrece.
  if (pideWompi && !pasarelaDisponibleEnEsteDespliegue()) {
    return NextResponse.json(
      { error: 'El pago con tarjeta, PSE y más no está disponible en este momento.' },
      { status: 400 },
    );
  }

  // Bogotá deliveries carry a franja preference; validate it against config.
  const slot =
    metodoEnvio === 'bogota'
      ? getShippingSlot('bogota', shipping.franja)
      : undefined;
  if (metodoEnvio === 'bogota' && !slot) {
    return NextResponse.json(
      { error: 'Selecciona una franja horaria válida para tu entrega en Bogotá D.C.' },
      { status: 400 },
    );
  }

  // Resolve + price every line server-side via the shared resolver (product
  // existence, stock, molienda availability, unit prices) — the SAME rules the
  // admin manual order uses.
  let lines: Awaited<ReturnType<typeof resolveOrderLines>>['lines'];
  let orderSubtotal: number;
  try {
    const resolved = await resolveOrderLines(items);
    lines = resolved.lines;
    orderSubtotal = resolved.subtotal;
  } catch (error) {
    if (error instanceof OrderLinesError) {
      return NextResponse.json(
        { error: error.message, ...(error.productosSinStock ? { productosSinStock: error.productosSinStock } : {}) },
        { status: 400 },
      );
    }
    throw error;
  }

  // Shipping is checkout-specific: recompute from the server-derived method with
  // the shared free-shipping threshold. Never trust the client.
  const costo_envio = computeShippingCost(metodoEnvio, orderSubtotal);
  const total = orderSubtotal + costo_envio;

  const cliente_nombre = `${customer.nombre} ${customer.apellido}`.trim();

  // Single creation path — upserts the Customer + creates the Order & items in
  // one transaction (shared with the admin "Nueva Orden"). Checkout always brings
  // an email, so identity is by email (unchanged behavior). NO Payment here: the
  // order starts `pendiente`; the admin registers the received payment later.
  let order: Awaited<ReturnType<typeof createOrderWithCustomer>>;
  try {
    order = await createOrderWithCustomer({
      customer:          { nombre: cliente_nombre, email: customer.email, telefono: customer.telefono },
      canal:             'directo',
      // Sin método declarado (pago por pasarela) el string libre es `'wompi'` — NO entra a
      // `MetodoPagoTipo`/`METODOS_PAGO_ORDEN` (§ arriba); `Order.metodo_pago` es texto libre
      // (§ CLAUDE.md, Los MÉTODOS de pago son una LISTA) y `derivarCondicionPago` sólo
      // distingue el id EXACTO `'efectivo'`, así que esta orden deriva ANTICIPADO, correcto
      // para un cobro por adelantado.
      metodo_pago:       metodoElegido ?? 'wompi',
      total,
      costo_envio,
      direccion_entrega: shipping.direccion,
      direccion_detalle: shipping.direccion_detalle ?? null,
      ciudad_entrega:    shipping.ciudad,
      deliverySlot:      slot?.id ?? null,
      items:             lines,
      brand:             await buildBrand(),
      // Sólo llega a `true` si `pideWompi` pasó la guarda de arriba — hoy siempre `false`
      // (§ WOMPI-CREADOR-DE-INTENTOS-1, `pasarelaDisponibleEnEsteDespliegue`).
      crearIntentoPago:  pideWompi,
    });
  } catch (error) {
    console.error('Checkout order creation failed:', error);
    return NextResponse.json({ error: 'No se pudo procesar la orden' }, { status: 500 });
  }

  if (!order) {
    return NextResponse.json({ error: 'No se pudo procesar la orden' }, { status: 500 });
  }

  // ── WOMPI-WIDGET-EN-EL-CANONICO-1: el bloque firmado, TODAVÍA sin disparador real ──────
  // `order.paymentIntent` sólo existe si `pideWompi` pasó la guarda de disponibilidad de
  // arriba — y esa guarda devuelve `false` siempre hoy (§ `pasarelaDisponibleEnEsteDespliegue`,
  // (d) no existe). Esta rama queda CABLEADA de punta a punta —incluida la llave pública que
  // el widget necesita— para que el día que (d) encienda la capacidad, no haga falta tocar
  // esta respuesta (DECISIONS.md, WOMPI-CREADOR-DE-INTENTOS-1 · WOMPI-WIDGET-EN-EL-CANONICO-1).
  let wompi:
    | {
        reference: string; amountInCents: number; currency: string; signature: string; publicKey: string;
        aceptaciones: AceptacionesWompi;
        // Los tipos QUE NO SON TARJETA disponibles para ESTE comprador (§ API-DIRECTA-OTROS-
        // METODOS-1) — el dueño los encendió Y su cuenta los tiene, reusando el MISMO cruce que
        // ya usa el panel (`metodosPasarelaParaComprador`, abajo). Vacío cuando no hay ninguno o
        // cuando no se pudo consultar — la tarjeta sigue disponible por su propio camino sin
        // importar esto.
        metodosPasarelaOtros: string[];
      }
    | undefined;
  if (order.paymentIntent) {
    const secretoIntegridad = process.env.WOMPI_INTEGRITY_SECRET;
    const llavePublica = process.env.WOMPI_PUBLIC_KEY;
    if (!secretoIntegridad || !llavePublica) {
      // Fail ruidoso, mismo criterio que el webhook (`WOMPI_EVENTS_SECRET`): un intento sin
      // firma o sin llave pública no sirve para nada, y silenciarlo dejaría al cliente
      // creyendo que puede pagar cuando no hay con qué firmar la petición ni con qué montar
      // el widget. `WOMPI_PUBLIC_KEY` no es secreta (§ lib/pagos/llaves-pasarela.ts) — el
      // riesgo acá no es exponerla, es devolver un bloque `wompi` a medias.
      console.error('[checkout] falta WOMPI_INTEGRITY_SECRET o WOMPI_PUBLIC_KEY — no se puede firmar/mostrar el intento de pago');
      return NextResponse.json({ error: 'No se pudo procesar la orden' }, { status: 500 });
    }

    // ── API-DIRECTA-ACEPTACIONES-SERVIDOR-1: las DOS casillas de aceptación ──────────────
    // Sin las dos completas —token Y enlace, las dos aceptaciones— la transacción NO SE
    // PUEDE CREAR en el proveedor (§ API-DIRECTA-DECISIONES-PROGRAMA-1 §4, DECISIONS.md),
    // así que ofrecer el pago y fallar después es peor que no ofrecerlo: el bloque `wompi`
    // entero queda AUSENTE de la respuesta, nunca a medias — el comprador no ve la causa,
    // sólo deja de ver la opción de pagar en línea; el porqué queda en el log del servidor.
    const baseUrlPasarela = esDespliegueDemo() ? 'https://sandbox.wompi.co' : 'https://production.wompi.co';
    let aceptaciones: AceptacionesWompi | null = null;
    try {
      aceptaciones = evaluarAceptaciones(await consultarAceptaciones(llavePublica, baseUrlPasarela));
      if (!aceptaciones) {
        console.error('[checkout] las aceptaciones de Wompi llegaron incompletas (falta un token o un enlace) — se omite el bloque de pasarela');
      }
    } catch (e) {
      console.error('[checkout] no se pudo consultar las aceptaciones de Wompi — se omite el bloque de pasarela:', e);
    }

    if (aceptaciones) {
      const amountInCents = pesosACentavos(order.paymentIntent.monto_esperado);
      wompi = {
        reference: order.paymentIntent.reference,
        amountInCents,
        currency: MONEDA_WOMPI,
        signature: firmarIntegridadWompi(order.paymentIntent.reference, amountInCents, MONEDA_WOMPI, secretoIntegridad),
        publicKey: llavePublica,
        aceptaciones,
        metodosPasarelaOtros: await tiposPasarelaOtrosDisponibles(llavePublica, baseUrlPasarela),
      };
    }
  }

  // Campana del operador: entró una orden que nadie tecleó. Post-commit y
  // fire-and-forget — `runEventAutomations` nunca lanza, así que un aviso roto no
  // puede tumbar una venta ya cobrada al cliente.
  //
  // `origen: 'storefront'` lo declara ESTE endpoint, no el cuerpo de la petición:
  // es el code path lo que distingue una orden de la tienda de una manual, porque
  // `Order.canal` ('directo' aquí) también lo puede elegir el admin.
  //
  // Ojo, no confundir con "Notificación Nueva Orden": esa es WhatsApp al CLIENTE
  // y dispara en orden → `pagado`. El correo de orden creada ya sale desde
  // createOrderWithCustomer (notifyOrderCreated).
  await runEventAutomations({ tipo: 'order.creada', orderId: order.id, origen: 'storefront' });

  // Return the authoritative persisted figures so the confirmation screen can
  // render entirely from the server response (not from cleared cart state).
  return NextResponse.json(
    {
      numero_orden: order.numero_orden,
      estado:       order.estado,
      subtotal:     orderSubtotal,
      costo_envio,
      total,
      metodo_envio: metodoEnvio,
      franja:       slot?.id ?? null,
      direccion_detalle: shipping.direccion_detalle ?? null,
      items: lines.map((l) => ({
        producto_nombre: l.producto_nombre,
        moliendaSeleccionada: l.moliendaSeleccionada,
        cantidad:        l.cantidad,
        precio_unitario: l.precio_unitario,
        subtotal:        l.subtotal,
      })),
      // Ausente cuando no se creó ningún intento, O cuando las dos aceptaciones no
      // llegaron completas (§ API-DIRECTA-ACEPTACIONES-SERVIDOR-1, arriba) — en los
      // dos casos, spread de `{}`, ninguna clave nueva, ningún `null` de relleno.
      ...(wompi ? { wompi } : {}),
    },
    { status: 201 },
  );
}

// ── API-DIRECTA-CREACION-TRANSACCION-1: crear la transacción — CUALQUIER método, desde
//    § API-DIRECTA-ENVIO-GENERICO-1 ───────────────────────────────────────────────────────────
//
// SEGUNDO PASO, en un request APARTE del POST de arriba: el POST crea la orden y su intento
// —y, para el camino de pasarela, devuelve `publicKey` + `aceptaciones`—; recién CON ESA
// respuesta el comprador puede tokenizar la tarjeta en el navegador (§ API-DIRECTA-CAPTURA-
// TARJETA-1, `services/checkout.service.ts`, `tokenizarTarjeta`, que llama DIRECTO a Wompi,
// nunca a esta ruta), o teclear el dato de un método QUE NO ES TARJETA (§ API-DIRECTA-OTROS-
// METODOS-1). El dato del método no existe todavía cuando el POST responde, así que "crear la
// transacción" no puede vivir en esa misma llamada — vive acá, en un método HTTP nuevo sobre
// el MISMO path, para el intento que YA EXISTE.
//
// PATCH, no un endpoint nuevo: esta acción completa (parchea) el checkout ya creado con la
// pieza que faltaba —el método elegido tokenizado o tecleado, más las dos aceptaciones—, no
// reemplaza el recurso (PUT) ni crea uno nuevo bajo otra ruta.
//
// LO ÚNICO QUE DISTINGUE UN MÉTODO DE OTRO ES EL `payment_method` (§ API-DIRECTA-ENVIO-
// GENERICO-1): la firma, la referencia, el monto y las dos aceptaciones se computan UNA sola
// vez, y el handler sólo decide con qué `paymentMethod` llamar a `crearTransaccion`
// (`lib/pagos/wompi-api.ts`) — para tarjeta, `construirDatosCreacionTransaccionTarjeta`; para
// cualquier otro tipo, `construirDatosCreacionTransaccion` con su descriptor
// (`lib/pagos/metodos-pasarela.ts`). Ninguna de las dos ramas reimplementa el envío ni la
// clasificación de la respuesta (`clasificarCreacionTransaccion`, compartida).
//
// CABLEADO DEL LADO DEL CLIENTE (`FormularioTarjeta.tsx`, `services/checkout.service.ts`, y el
// selector de métodos que no son tarjeta) QUEDA PENDIENTE — fuera de `touches` de este slice
// (ver el reporte). Este handler es alcanzable y probado por su forma (zod) y por la
// clasificación pura que consume (`creacion-transaccion.test.ts`); nadie lo invoca todavía
// desde el navegador.
//
// EL TEXTO ES PROVISIONAL, PENDIENTE DE COPY DEL OWNER (igual que `FormularioTarjeta.tsx`,
// § API-DIRECTA-CAPTURA-TARJETA-1): son mensajes nuevos, sin texto fijado, elegidos claros y
// honestos para no bloquear el slice.
const TEXTO_ERROR_GENERICO_TRANSACCION = 'No pudimos procesar tu pago. Intenta de nuevo o usa otro método.';
const TEXTO_INTENTO_NO_ENCONTRADO = 'No encontramos el pedido al que corresponde este pago.';
const TEXTO_INTENTO_YA_RESUELTO = 'Este pago ya se resolvió.';
// § API-DIRECTA-OTROS-METODOS-1 — TEXTO PROVISIONAL, PENDIENTE DE COPY DEL OWNER, igual que el
// resto de esta constante. Sigue viva tras § API-DIRECTA-ENVIO-GENERICO-1: un `tipo` que no
// está en `DESCRIPTORES_METODO_PASARELA` (p. ej. PSE, que no tiene descriptor a propósito)
// sigue sin poder crearse — eso no cambió, sólo dejó de ser el ÚNICO desenlace del camino.
const TEXTO_METODO_PASARELA_DESCONOCIDO = 'Ese método de pago no está disponible.';

const aceptacionesPatchSchema = z.object({
  // Los DOS tokens de aceptación que el comprador marcó — los MISMOS que ya vio en
  // `AceptacionesPasarela` (§ API-DIRECTA-ACEPTACIONES-SERVIDOR-1), con sus enlaces a los
  // documentos exactos que aceptó. No son secretos (viajaron ya al navegador en la respuesta
  // del POST), así que el cliente los reenvía tal cual — Wompi es quien los valida. Las DOS
  // aceptaciones valen IGUAL para cualquier tipo de pasarela — no son de la tarjeta, son del
  // proveedor (§ API-DIRECTA-OTROS-METODOS-1, §2 del reporte del slice).
  terminos:        z.string().trim().min(1),
  datosPersonales: z.string().trim().min(1),
});

// § API-DIRECTA-3DS-SIN-CHALLENGE-1: los datos del NAVEGADOR del comprador, para que el
// emisor evalúe el riesgo de la autenticación 3DS — REQUERIDO, no opcional: "se pide siempre
// para tarjeta, no hay interruptor" (§0 del reporte del slice) se impone acá, en la puerta de
// entrada, tanto como en la firma de `construirDatosCreacionTransaccionTarjeta`
// (`lib/pagos/creacion-transaccion.ts`) que lo consume. NINGÚN campo de la tarjeta viaja en
// este objeto — sólo entorno del navegador (`DatosNavegador3ds`, `lib/pagos/tres-ds.ts`).
const datosNavegador3dsSchema = z.object({
  colorDepth: z.number().int().positive(),
  javaEnabled: z.boolean(),
  language: z.string().trim().min(1),
  screenHeight: z.number().int().positive(),
  screenWidth: z.number().int().positive(),
  timezoneOffsetMin: z.number().int(),
  userAgent: z.string().trim().min(1),
});

const crearTransaccionTarjetaSchema = z.object({
  reference:    z.string().trim().min(1),
  tokenTarjeta: z.string().trim().min(1),
  aceptaciones: aceptacionesPatchSchema,
  datosNavegador3ds: datosNavegador3dsSchema,
});

// § API-DIRECTA-OTROS-METODOS-1: el camino QUE NO ES TARJETA — el MISMO `reference` +
// `aceptaciones`, pero en vez de un token ya tokenizado, el dato que el comprador tecleó para
// el tipo elegido (`DatosMetodoPasarelaOtro`, `types/payment.ts`). El servidor VALIDA `dato`
// con el `campo.validar` del MISMO descriptor antes de usarlo — nunca confía en que el
// cliente ya lo hizo (ver el handler, abajo).
const crearTransaccionOtroMetodoSchema = z.object({
  reference:      z.string().trim().min(1),
  metodoPasarela: z.object({
    tipo: z.string().trim().min(1),
    dato: z.string().trim().min(1),
  }),
  aceptaciones: aceptacionesPatchSchema,
});

const crearTransaccionSchema = z.union([crearTransaccionTarjetaSchema, crearTransaccionOtroMetodoSchema]);

// § API-DIRECTA-DESALINEO-DUENO-1: el TIPO (vocabulario del PROVEEDOR — `'CARD'`,
// `'NEQUI'`...) que este intento pidió, para persistirlo en `PaymentIntent.metodo_rechazado`
// SI Y SÓLO SI la creación falla por `metodo_no_habilitado` (ver el `switch`, abajo). Para
// tarjeta no hay descriptor en `DESCRIPTORES_METODO_PASARELA` (§ metodos-pasarela.ts, "TARJETA
// NO VIVE EN ESTE REGISTRO") así que el tipo se nombra a mano, IDÉNTICO al `type: 'CARD'` que
// `construirDatosCreacionTransaccionTarjeta` ya manda a Wompi (`lib/pagos/creacion-
// transaccion.ts`) — no un literal nuevo que pudiera divergir.
//
// PURA, exportada para el test co-ubicado (`route.test.ts`), mismo criterio que
// `checkoutSchema` arriba: afirmar QUÉ tipo se persistiría no necesita invocar el handler ni
// tocar Prisma.
export function tipoMetodoDeIntento(datos: z.infer<typeof crearTransaccionSchema>): string {
  return 'metodoPasarela' in datos ? datos.metodoPasarela.tipo : 'CARD';
}

export async function PATCH(req: NextRequest) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo de la solicitud inválido' }, { status: 400 });
  }

  const parsed = crearTransaccionSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos inválidos', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { reference, aceptaciones } = parsed.data;

  // El intento YA EXISTE — lo crea el POST de arriba. Esta ruta NUNCA crea una orden nueva ni
  // un intento nuevo: sólo lee el que ya está, para el monto que YA se firmó una vez. Se
  // consulta ANTES de bifurcar por tipo: el hecho de que el intento exista y siga EN_VUELO no
  // depende de con qué método se lo quiera cerrar.
  const intent = await prisma.paymentIntent.findUnique({
    where:  { reference },
    select: { estado: true, monto_esperado: true },
  });

  if (!intent) {
    return NextResponse.json({ error: TEXTO_INTENTO_NO_ENCONTRADO }, { status: 404 });
  }

  // Ya lo cerró el webhook o el reconciliador (o ya se creó una transacción antes para esta
  // MISMA referencia): crear otra duplicaría el intento de cobro. El motor de dinero ya
  // existente es el único que mueve este estado — acá sólo se lee.
  if (intent.estado !== 'EN_VUELO') {
    return NextResponse.json({ error: TEXTO_INTENTO_YA_RESUELTO }, { status: 409 });
  }

  // ── EL CAMINO QUE NO ES TARJETA (§ API-DIRECTA-OTROS-METODOS-1) — VALIDADO ANTES DE GASTAR
  // NADA: el tipo tiene que existir en el registro y el dato tiene que pasar su
  // `campo.validar` (el MISMO que ya corrió, o debió correr, en la pantalla) — nunca se confía
  // en que el cliente ya lo hizo. Esto no cambió con § API-DIRECTA-ENVIO-GENERICO-1: lo que
  // cambió es lo que pasa DESPUÉS de validar (ver el `else` de abajo).
  if ('metodoPasarela' in parsed.data) {
    const { tipo, dato } = parsed.data.metodoPasarela;
    const descriptor = DESCRIPTORES_METODO_PASARELA[tipo];
    if (!descriptor) {
      return NextResponse.json({ tipo: 'no_implementado', error: TEXTO_METODO_PASARELA_DESCONOCIDO }, { status: 400 });
    }
    const errorDato = descriptor.campo.validar(dato);
    if (errorDato) {
      return NextResponse.json({ tipo: 'no_implementado', error: errorDato }, { status: 400 });
    }
  }

  const secretoIntegridad = process.env.WOMPI_INTEGRITY_SECRET;
  const llavePrivada = process.env.WOMPI_PRIVATE_KEY;
  if (!secretoIntegridad || !llavePrivada) {
    // Fail ruidoso, mismo criterio que el bloque `wompi` del POST de arriba: sin secreto ni
    // llave no hay con qué crear la transacción, y silenciarlo dejaría al comprador pensando
    // que su pago se está procesando cuando nunca se intentó.
    console.error('[checkout] falta WOMPI_INTEGRITY_SECRET o WOMPI_PRIVATE_KEY — no se puede crear la transacción');
    return NextResponse.json({ error: TEXTO_ERROR_GENERICO_TRANSACCION }, { status: 500 });
  }

  // El MISMO monto y la MISMA fórmula que ya produjeron la firma que el comprador vio en el
  // POST — recalculados acá, nunca recibidos del cliente, para que "el intento que ya existe"
  // (y no lo que el navegador diga) sea lo que se firma y se manda a Wompi. COMÚN a cualquier
  // método (§ API-DIRECTA-ENVIO-GENERICO-1): lo único que distingue tarjeta de cualquier otro
  // tipo es el `payment_method`, armado justo abajo.
  const amountInCents = pesosACentavos(intent.monto_esperado);
  const signature = firmarIntegridadWompi(reference, amountInCents, MONEDA_WOMPI, secretoIntegridad);
  const baseUrlPasarela = esDespliegueDemo() ? 'https://sandbox.wompi.co' : 'https://production.wompi.co';
  const comunes = {
    reference,
    amountInCents,
    currency: MONEDA_WOMPI,
    signature,
    acceptanceToken:         aceptaciones.terminos,
    acceptPersonalAuthToken: aceptaciones.datosPersonales,
  };

  // ── EL BLOQUE PROPIO DEL MÉTODO — lo único que cambia entre tarjeta y cualquier otro tipo
  // (§ API-DIRECTA-ENVIO-GENERICO-1). El `else` narrowea a la variante de tarjeta porque el
  // `if` de arriba ya cubrió — y siempre retorna en— la variante `metodoPasarela`.
  const datos = 'metodoPasarela' in parsed.data
    ? construirDatosCreacionTransaccion(
        comunes,
        DESCRIPTORES_METODO_PASARELA[parsed.data.metodoPasarela.tipo],
        parsed.data.metodoPasarela.dato,
      )
    : construirDatosCreacionTransaccionTarjeta(comunes, parsed.data.tokenTarjeta, parsed.data.datosNavegador3ds);

  let respuestaCruda: Awaited<ReturnType<typeof crearTransaccion>>;
  try {
    respuestaCruda = await crearTransaccion(datos, llavePrivada, baseUrlPasarela);
  } catch (e) {
    console.error('[checkout] fallo de red creando la transacción de Wompi:', e);
    return NextResponse.json({ error: TEXTO_ERROR_GENERICO_TRANSACCION }, { status: 502 });
  }

  const resultado = clasificarCreacionTransaccion(respuestaCruda);

  // LA ORDEN Y SU INTENTO YA EXISTEN Y SE QUEDAN PASE LO QUE PASE ACÁ — ninguna rama de abajo
  // los borra ni los marca a mano. Si la transacción nunca llega a existir en Wompi (método no
  // habilitado, firma inválida, cualquier otro fallo), el intento queda `EN_VUELO`, y el
  // reconciliador YA TIENE la regla para exactamente ese caso — «LA REGLA DEL ARRAY VACÍO»
  // (medida, WOMPI-REGLAS-IMPLEMENTACION-1; ver la cabecera de
  // `packages/core/src/pagos/reconciliador.ts:26-30`): un `200 {"data":[]}` de Wompi al
  // consultar por referencia es indistinguible de "sigue sin resolverse", así que el barrido
  // lo cierra por EDAD, nunca por la ausencia inmediata de una transacción. No se inventa acá
  // un segundo camino de limpieza que pueda desincronizarse de esa decisión.
  switch (resultado.tipo) {
    case 'creada': {
      // § API-DIRECTA-3DS-SIN-CHALLENGE-1: clasifica la transacción YA CREADA para distinguir
      // el camino SIN FRICCIÓN del de DESAFÍO. `resultado.transaccion` trae `payment_method`
      // TAL CUAL vino de Wompi (§ `esTransaccionWompi`, `lib/pagos/wompi-api.ts`, no valida ese
      // campo, sólo lo deja pasar).
      const autenticacion3ds = clasificarAutenticacion3ds(resultado.transaccion);
      // § API-DIRECTA-3DS-CON-CHALLENGE-1: el contenido del desafío se DECODIFICA ACÁ, una sola
      // vez en el servidor (`extraerContenidoDesafio3ds`, `lib/pagos/tres-ds.ts`) — el cliente
      // sólo recibe HTML YA decodificado, nunca el `step_data` codificado tal cual vino de
      // Wompi. Se computa SIEMPRE (no sólo cuando `autenticacion3ds === 'desafio'`): la función
      // es pura y nunca lanza, y calcularla incondicionalmente evita un `if` que pudiera
      // desincronizar la condición de acá con la de `clasificarAutenticacion3ds` — cuando no
      // hay `step_data` decodificable (el caso normal fuera de un desafío), da `null` y no se
      // manda nada (`?? undefined`, así el campo queda AUSENTE del JSON, no `desafioHtml: null`).
      const desafioHtml = extraerContenidoDesafio3ds(resultado.transaccion) ?? undefined;
      return NextResponse.json(
        {
          tipo: 'creada',
          id: resultado.transaccion.id,
          status: resultado.transaccion.status,
          autenticacion3ds,
          ...(desafioHtml ? { desafioHtml } : {}),
        },
        { status: 201 },
      );
    }
    case 'metodo_no_habilitado': {
      // § API-DIRECTA-DESALINEO-DUENO-1: la CAUSA EXACTA — nunca `firma_invalida` ni
      // `otro_fallo`, ver los otros dos `case` — así que ES el momento de dejar constancia
      // para el aviso del dueño (`lib/config/avisos-configuracion.ts`, #9). Envuelto en su
      // propio try/catch: que ESTA escritura de higiene falle no puede tumbar la respuesta
      // al comprador, que de por sí ya es un fallo (502) por la razón real (Wompi).
      try {
        await prisma.paymentIntent.update({
          where: { reference },
          data:  { metodo_rechazado: tipoMetodoDeIntento(parsed.data) },
        });
      } catch (e) {
        console.error('[checkout] no se pudo persistir metodo_rechazado en el intento (aviso del dueño):', e);
      }
      console.error('[checkout] Wompi rechazó el método de la transacción (no habilitado para la cuenta):', resultado.motivo);
      return NextResponse.json({ tipo: 'metodo_no_habilitado', error: TEXTO_ERROR_GENERICO_TRANSACCION }, { status: 502 });
    }
    case 'firma_invalida':
      console.error('[checkout] Wompi rechazó la firma de integridad de la transacción:', resultado.motivo);
      return NextResponse.json({ tipo: 'firma_invalida', error: TEXTO_ERROR_GENERICO_TRANSACCION }, { status: 502 });
    case 'otro_fallo':
      console.error(`[checkout] Wompi respondió ${resultado.status} al crear la transacción:`, resultado.motivo);
      return NextResponse.json({ tipo: 'otro_fallo', error: TEXTO_ERROR_GENERICO_TRANSACCION }, { status: 502 });
  }
}
