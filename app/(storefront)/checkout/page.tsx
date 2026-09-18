"use client";
import { useState, useEffect } from 'react';
import Link from "next/link";
import { imagenPortada } from "@/lib/producto-imagen";
import { ArrowLeft, Shield, Lock, CreditCard, Clock, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCartStore } from '@/lib/cartStore';
import {
  createOrder, CheckoutError, pasarelaDisponibleEnEsteDespliegue, pasarelaModoApiDirecta,
  consultarBloqueAceptacionPasarela,
  type CheckoutResult, type CheckoutPayload, type BloqueAceptacionPasarela,
} from "@/services/checkout.service";
import PagoPasarela from '@/components/storefront/checkout/PagoPasarela';
import SelectorMetodoPasarela from '@/components/storefront/checkout/SelectorMetodoPasarela';
import { interpretarRespuestaReintento } from '@/components/storefront/checkout/interpretar-respuesta-reintento';
import { ETIQUETA_PAGO_PASARELA, subtituloPagoPasarela } from '@/lib/pagos/metodos-pasarela';
import { formatCOP } from '@duna/core/utils';
import { toast } from 'sonner';
import StatusBadge from '@/components/ui/StatusBadge';
import {
  computeShippingCost,
  getShippingMethod,
  findSlotLabel,
  type ShippingMethodId,
} from '@duna/core/shipping-config';
import { COLOMBIA_DEPARTMENTS, isBogotaDC } from '@duna/core/colombia-departments';
import { metodosDisponibles, type MetodoPagoTipo } from '@/lib/checkout/metodos-pago';
import { useSiteSettings } from '@/components/storefront/SiteSettingsProvider';

const STEPS = ['Información', 'Pago'];

export default function Checkout() {
  const { items, subtotal, clearCart } = useCartStore();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  // Al cambiar de paso (Continuar o Atrás), subir al inicio: el checkout son pasos por ESTADO en
  // una sola página (no rutas), así que la posición vertical del paso anterior se conserva y el
  // cliente aterriza a media pantalla —sin ver el encabezado del paso nuevo ni, en Pago, las
  // instrucciones de pago que están arriba—. `window.scrollTo` porque el scroll es del documento.
  // Respeta prefers-reduced-motion: salto instantáneo si el usuario lo pide. En el montaje (step 0)
  // la página ya está arriba → no-op.
  useEffect(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  }, [step]);
  // Authoritative, server-persisted order — sourced entirely from the
  // create-order response, never from the (soon-to-be-cleared) cart store.
  const [confirmation, setConfirmation] = useState<CheckoutResult | null>(null);

  const [info, setInfo] = useState({ nombre: '', apellido: '', email: '', telefono: '' });
  const [address, setAddress] = useState({ linea1: '', detalle: '', ciudad: '', departamento: '', cp: '' });
  const [slot, setSlot] = useState<string | null>(null);
  const [payment, setPayment] = useState<MetodoPagoTipo>('nequi');
  const [refTransfer, setRefTransfer] = useState('');
  // (d), mitad encendido (§ WOMPI-TOGGLE-DISPONIBILIDAD-1): lee la env var de despliegue
  // (§ el docstring de `pasarelaDisponibleEnEsteDespliegue`). Sin `NEXT_PUBLIC_PASARELA_
  // HABILITADA=1` sigue SIEMPRE `false` — la opción "Tarjeta, PSE y más" no se renderiza y
  // `pasarelaSeleccionada` no tiene forma de volverse `true`: byte-idéntico a antes de este
  // slice. La redirección tras el pago (la vuelta del comprador) sigue sin construirse: (c).
  const pasarelaDisponible = pasarelaDisponibleEnEsteDespliegue();
  // El SEGUNDO interruptor de despliegue (§ API-DIRECTA-CAPTURA-TARJETA-1): con la pasarela
  // disponible, decide cuál camino ocupa la MISMA ranura — el widget de Wompi (default) o la
  // captura de tarjeta por API directa. Nunca los dos a la vez (ver el branch de
  // `confirmation.wompi` más abajo).
  const modoApiDirecta = pasarelaModoApiDirecta();
  const [pasarelaSeleccionada, setPasarelaSeleccionada] = useState(false);
  // IDs de producto rechazados por stock en el último intento — el carrito se
  // conserva y se marca la línea afectada. Se limpia al reintentar.
  const [sinStockIds, setSinStockIds] = useState<string[]>([]);
  // El proveedor rechazó la creación de LA transacción de esta orden porque su cuenta ya no
  // tiene el método habilitado (§ API-DIRECTA-DESALINEO-CABLEADO-1, `FormularioTarjeta.
  // onMetodoNoHabilitado`). Es un hecho ESTRUCTURAL de ESTA sesión de checkout —no un toggle
  // de despliegue como `pasarelaDisponible`—, así que vive en estado LOCAL, nunca se
  // persiste: la orden y su intento YA EXISTEN y se quedan pendientes tal cual (§ el PATCH,
  // que no los toca). Una vez en `true` no vuelve a `false`: no hay "reintentar" para esta
  // orden (§ el reporte del slice, "no reintentar contra el mismo").
  const [pasarelaMetodoNoHabilitado, setPasarelaMetodoNoHabilitado] = useState(false);
  // § CHECKOUT-TRANSICION-DEFECTOS-1: el pago por pasarela fue APROBADO — bubbleado desde el
  // sondeo (`EsperaConfirmacionTarjeta.onAprobado`, vía `SelectorMetodoPasarela`). Local, nunca
  // se persiste: es el hecho de ESTA sesión de checkout, igual que `pasarelaMetodoNoHabilitado`.
  // Sólo puede pasar a `true` — no hay "reintentar" que la vuelva a `false` para la misma orden.
  const [pasarelaAprobada, setPasarelaAprobada] = useState(false);
  // § CHECKOUT-REINTENTO-OTRO-METODO-1 (opción A, DECISIONS.md — el owner): TRES intentos de
  // pago por orden, EN TOTAL — el servidor los cuenta y los aplica
  // (`crearIntentoPagoDeReintento`, `@duna/core/orders`); esta bandera sólo refleja que el
  // CUARTO no se ofreció. Local, nunca se persiste, igual que `pasarelaMetodoNoHabilitado` —
  // sólo puede pasar a `true`.
  const [intentosAgotados, setIntentosAgotados] = useState(false);
  // Cambia SÓLO cuando un reintento consigue un `PaymentIntent` nuevo — nunca en la creación
  // inicial (que no debe remontar `SelectorMetodoPasarela` a mitad de un `handlePagar` en
  // vuelo). Es la `key` que fuerza el remonte de ese componente con la `reference` nueva, para
  // que el formulario arranque LIMPIO (campos vacíos, sin el error de rechazo colgado) — el
  // mismo mecanismo que ya usa `key={descriptorElegido.tipo}` al cambiar de pestaña.
  const [reintentoKey, setReintentoKey] = useState(0);

  // § CHECKOUT-UNA-SOLA-PANTALLA-1: el bloque de aceptación de pasarela —las DOS aceptaciones,
  // la llave pública, los métodos QUE NO SON TARJETA— SIN CREAR NINGUNA ORDEN. Se pide una vez,
  // apenas el despliegue tiene la capacidad encendida (`pasarelaDisponible`), para saber si la
  // opción de pasarela se puede OFRECER antes de que el comprador la elija — nunca al confirmar
  // el pedido, que es cuando la orden nace. `null` = todavía no se pidió o no se pudo armar (las
  // dos aceptaciones incompletas, el despliegue sin llave…): en cualquiera de los dos casos la
  // opción NO se ofrece, la misma regla de siempre (antes se descubría recién al crear la orden).
  const [bloquePasarela, setBloquePasarela] = useState<BloqueAceptacionPasarela | null>(null);

  useEffect(() => {
    if (!pasarelaDisponible) return;
    let cancelado = false;
    consultarBloqueAceptacionPasarela().then((bloque) => {
      if (!cancelado) setBloquePasarela(bloque);
    });
    return () => { cancelado = true; };
  }, [pasarelaDisponible]);

  // Bogotá-ness is derived from departamento — the single source of truth.
  const isBogota = isBogotaDC(address.departamento);
  const metodoEnvio: ShippingMethodId | null = address.departamento
    ? (isBogota ? 'bogota' : 'nacional')
    : null;
  const shippingMethod = metodoEnvio ? getShippingMethod(metodoEnvio) : null;
  // null shipping = departamento not chosen yet → summary shows a placeholder.
  const shippingCost = metodoEnvio ? computeShippingCost(metodoEnvio, subtotal) : null;
  const total = subtotal + (shippingCost ?? 0);

  // § CHECKOUT-UNA-SOLA-PANTALLA-1: la opción de pasarela sólo se OFRECE cuando el bloque se
  // consiguió — "si las dos completas no se consiguen, la opción de pasarela no se ofrece".
  // Distinto de `pasarelaDisponible` (el interruptor de DESPLIEGUE, que sólo decide si se
  // INTENTA pedir el bloque): acá se decide si el radio se MUESTRA.
  const pasarelaOfrecida = pasarelaDisponible && bloquePasarela !== null;

  // El MONTO A MOSTRAR en el botón que paga: antes de crear la orden, el total en vivo del
  // carrito; después, el total que el SERVIDOR confirmó — el carrito ya se vació
  // (`clearCart()`), así que `total` (derivado del carrito) dejaría de ser el monto real apenas
  // la orden se crea. Mismo criterio que ya usa el Resumen del pedido más abajo.
  const montoAPagar = confirmation ? confirmation.total : total;

  // Phone: fixed +57 prefix, capture local digits, store normalized +57XXXXXXXXXX.
  const phoneDigits = info.telefono.replace(/\D/g, '');
  const phoneValid = /^3\d{9}$/.test(phoneDigits);

  const settings = useSiteSettings();

  // ¿HAY CANAL DE WHATSAPP? El checkout le PROMETE al comprador que el pago se confirma por WhatsApp,
  // y `SiteSetting.whatsapp` puede estar VACÍO (la migración neutral siembra `''`: un cliente nuevo
  // nace sin número). Sin canal, la copy NO ofrece ese camino — la MISMA regla que el CTA de
  // /suscripciones, que se oculta sin número (§ los enlaces se ocultan si el campo está vacío). Acá no
  // hay enlace que ocultar sino una PROMESA que retirar: cada frase se escribe ENTERA por rama (no un
  // prefijo con cola variable), así ninguna queda a medias ni deja un hueco donde estaba el canal. El
  // dueño se entera por el aviso de configuración del Dashboard (§ avisos-configuracion, #8).
  const tieneWhatsapp = settings.whatsapp.trim() !== '';

  // Los métodos que el checkout MUESTRA: ON + datos completos (§ metodos-pago). Cada uno se
  // enciende/apaga y edita en Configuración. Puede quedar VACÍO (todos apagados o sin datos) → la
  // guarda defensiva del paso de pago muestra "escríbenos para coordinar el pago" en vez de un paso
  // sin opciones. El SELECCIONADO se acota a lo disponible en el render (sin efecto): si el elegido
  // ya no está —apagado, o salió de Bogotá— cae al primero disponible, así nunca viaja un método
  // que la tienda no ofrece.
  const availablePayments = metodosDisponibles(settings.metodosPago, { isBogota });
  // Con `noUncheckedIndexedAccess` apagado en este tsconfig, `arr[0]` tipa como `MetodoCheckout`
  // (nunca `| undefined`) aunque el array esté vacío en runtime — un `?? null` sobre eso sería
  // letra muerta para el compilador (§ CHECKOUT-BREB-CAST-1: medido con tsc, no supuesto). Por
  // eso el `null` sale de chequear el LARGO explícito, no de indexar y esperar `undefined`. Se
  // descartó `.at(0)` (§ CHECKOUT-BREB-CAST-CIERRE-1): es ES2022 y Next no lo polyfillea
  // (cero apariciones en `polyfill-nomodule.js`), así que en Safari < 15.4 —dentro del rango que
  // cubre el target `ES2017` de este repo— tira `TypeError` y se lleva el checkout entero.
  const metodoActivo: MetodoPagoTipo | null = availablePayments.some((o) => o.id === payment)
    ? payment
    : availablePayments.length > 0
      ? availablePayments[0].id
      : null;

  // Changing departamento re-derives the method; leaving Bogotá clears the franja. (No hace falta
  // resetear el método: `metodoActivo` cae al primero disponible cuando efectivo deja de estarlo.)
  const selectDepartamento = (value: string) => {
    setAddress((a) => ({ ...a, departamento: value }));
    if (!isBogotaDC(value)) {
      setSlot(null);
    }
  };

  // El payload COMÚN a cualquier camino de creación de orden — sólo cambia `payment`. Extraído
  // para que `handleOrder` (métodos manuales y pasarela en modo WIDGET) y `crearOrdenPasarela`
  // (§ CHECKOUT-UNA-SOLA-PANTALLA-1, pasarela en modo API DIRECTA) no repitan la misma
  // construcción con el riesgo de que diverjan.
  const payloadDesdeFormulario = (payment: CheckoutPayload['payment']): CheckoutPayload => ({
    customer: {
      nombre:   info.nombre,
      apellido: info.apellido,
      email:    info.email,
      telefono: `+57${phoneDigits}`,   // normalized, WhatsApp-ready
    },
    shipping: {
      direccion:         address.linea1,
      direccion_detalle: address.detalle.trim() || null,
      ciudad:            address.ciudad,
      departamento:      address.departamento,
      franja:            slot,
    },
    payment,
    items: items.map((i) => ({
      slug:     i.slug,
      cantidad: i.quantity,
      molienda: typeof i.options?.molienda === 'string' ? i.options.molienda : null,
    })),
  });

  const handleOrder = async () => {
    // Sin método disponible no hay nada que enviar — el mismo caso que deshabilita el botón más
    // abajo (`availablePayments.length === 0 && !pasarelaOfrecida`), pero acá es el TIPO el que
    // lo exige: `metodoActivo` es `MetodoPagoTipo | null` (§ CHECKOUT-BREB-CAST-1) y el payload no
    // acepta null salvo por la rama de pasarela. Va ANTES de `setLoading(true)`: un `return`
    // después dejaría el botón clavado en "Procesando…" para siempre, y el `disabled` de arriba ya
    // impide llegar acá en ese estado — esto es la guarda de TIPO, no una segunda explicación para
    // el comprador.
    if (!pasarelaSeleccionada && !metodoActivo) return;

    // La rama de pago se decide ACÁ, antes de tocar `loading`, para que TypeScript narrowee
    // `metodoActivo` a no-nulo dentro de la rama que lo usa (§ WOMPI-WIDGET-EN-EL-CANONICO-1): el
    // guard de arriba sólo prueba la DISYUNCIÓN, no cada rama por separado.
    let payment: CheckoutPayload['payment'];
    if (pasarelaSeleccionada) {
      payment = { pasarela: true };
    } else if (metodoActivo) {
      // `CheckoutPayload.payment.metodo` acepta el mismo set cerrado que `metodoActivo`, sin cast.
      payment = { metodo: metodoActivo, referencia: refTransfer.trim() || undefined };
    } else {
      return; // inalcanzable: el guard de arriba ya lo descarta.
    }

    setLoading(true);
    setSinStockIds([]);
    try {
      // Trust only slugs + quantities and customer/shipping details. The server
      // recomputes every price, the shipping cost, the total and the order
      // number, and returns the authoritative order number to display.
      const result = await createOrder(payloadDesdeFormulario(payment));
      // Capture the server response before emptying the cart. La orden ya se creó (pendiente)
      // pase lo que pase con la pasarela — la limpieza del carrito no depende de `wompi`.
      setConfirmation(result);
      clearCart();
      // Este botón ("Confirmar pedido") sólo dispara para métodos MANUALES y para la pasarela
      // en modo WIDGET (§ CHECKOUT-UNA-SOLA-PANTALLA-1: en modo API DIRECTA la orden se crea
      // desde `crearOrdenPasarela`, dentro del click de "Pagar" del formulario — este botón no
      // se renderiza en ese caso, ver el paso de Pago más abajo). Para el widget SÍ hace falta
      // el toast: tras crear la orden, el comprador todavía tiene que clickear el botón propio
      // de Wompi que aparece debajo, y sin la señal esa confirmación se puede sentir perdida.
      // TEXTO PROVISIONAL — PENDIENTE DE TEXTO DEL OWNER (§ el reporte del slice).
      if (result.wompi) {
        toast.success('Pedido creado. Completa el pago abajo para confirmarlo.');
      }
    } catch (e) {
      if (e instanceof CheckoutError && e.productosSinStock?.length) {
        // No vaciamos el carrito: marcamos las líneas afectadas en el resumen
        // (siempre visible) para que el usuario decida quitarlas o reducirlas.
        setSinStockIds(e.productosSinStock);
      }
      toast.error(e instanceof Error ? e.message : 'Error al procesar la orden');
    }
    setLoading(false);
  };

  // § CHECKOUT-UNA-SOLA-PANTALLA-1: la ÚNICA función que crea la orden para la pasarela en modo
  // API DIRECTA — la llama el botón "Pagar" de `FormularioTarjeta`/`FormularioOtroMetodoPasarela`
  // (vía `SelectorMetodoPasarela`), nunca un botón de la página. IDEMPOTENTE: si `confirmation.
  // wompi` ya existe (un reintento tras un fallo de la confirmación de la transacción, § el
  // reporte del slice), reusa la MISMA orden en vez de crear una segunda — "la orden se crea al
  // apretar el botón de pagar" no dice "cada vez que se aprieta".
  //
  // NO usa `loading`/`setLoading`: ese estado gobierna el botón "Confirmar pedido" de
  // `handleOrder`, que no se renderiza mientras esta función es la que manda (el propio
  // formulario tiene su guarda de doble-submit — `tokenizando`/`enVuelo`).
  const crearOrdenPasarela = async (): Promise<string | null> => {
    if (confirmation?.wompi) return confirmation.wompi.reference;
    setSinStockIds([]);
    try {
      const result = await createOrder(payloadDesdeFormulario({ pasarela: true }));
      setConfirmation(result);
      clearCart();
      // `result.wompi` ausente es un caso raro (la disponibilidad cambió entre el fetch del
      // bloque y este submit) — la orden SÍ quedó creada (pendiente); el próximo render cae a
      // la confirmación manual de siempre (el early-return de arriba, `!confirmation.wompi`),
      // así que acá basta con no tener `reference` que devolver.
      return result.wompi ? result.wompi.reference : null;
    } catch (e) {
      if (e instanceof CheckoutError && e.productosSinStock?.length) {
        setSinStockIds(e.productosSinStock);
      }
      toast.error(e instanceof Error ? e.message : 'Error al procesar la orden');
      return null;
    }
  };

  // El proveedor rechazó la creación de la transacción de ESTA orden porque su cuenta ya no
  // tiene el método habilitado (§ API-DIRECTA-DESALINEO-CABLEADO-1, `FormularioTarjeta.
  // onMetodoNoHabilitado`). "El comprador ve sólo lo que funciona": no se le vuelve a ofrecer
  // la tarjeta para ESTA orden (`pasarelaMetodoNoHabilitado` gatea el branch de abajo), y en
  // su lugar la pantalla cae a la MISMA confirmación manual que ya usan los demás métodos
  // (nequi, efectivo, transferencia…) — el pedido queda reservado y el equipo coordina el
  // pago, sin perder la orden ni el intento ya creados (ninguno de los dos se toca acá).
  const handleMetodoNoHabilitado = () => {
    // TEXTO PROVISIONAL — PENDIENTE DE TEXTO DEL OWNER (§ el reporte del slice, igual que el
    // resto del copy de este programa). Explica la CONSECUENCIA que el comprador vive, no el
    // mecanismo: no tiene por qué saber que existe un "método de pasarela".
    toast.error('No pudimos procesar el pago con tarjeta: ese método no está disponible en este momento. Tu pedido queda reservado y te contactaremos para coordinar el pago.');
    setPasarelaMetodoNoHabilitado(true);
  };

  // § CHECKOUT-REINTENTO-OTRO-METODO-1 (opción A, DECISIONS.md `CHECKOUT-REINTENTO-CENSO-1` —
  // el owner): un pago rechazado por el EMISOR se reintenta con un intento de pago NUEVO sobre
  // la MISMA orden — nunca una orden nueva. Bubbleada desde `FormularioTarjeta`/
  // `FormularioOtroMetodoPasarela` (vía `SelectorMetodoPasarela`), después de que el comprador
  // clickea "Intentar con otro método" en la vista de rechazo.
  //
  // `POST /api/checkout/reintento` cuenta y aplica el TOPE en el SERVIDOR
  // (`crearIntentoPagoDeReintento`, `@duna/core/orders`) y pide aceptaciones FRESCAS
  // (`armarBloqueWompiPago`, el MISMO mecanismo — `obtenerBloqueAceptacionPasarela` — que ya usa
  // la creación original) — este cliente sólo manda el número de orden y reacciona a la
  // clasificación pura de la respuesta (`interpretarRespuestaReintento`).
  //
  // AL CONSEGUIRLO: se reemplaza `confirmation.wompi` por el bloque nuevo, se reemplaza
  // `bloquePasarela` por las aceptaciones frescas (para que `AceptacionesPasarela` las muestre,
  // no las viejas que el comprador ya vio), y `reintentoKey` avanza — lo que REMONTA
  // `SelectorMetodoPasarela` con la `reference` nueva, arrancando el picker desde cero (tarjeta
  // por defecto, formularios limpios). NUNCA se toca `items`/`clearCart`: la orden ya existe, no
  // hay nada del carrito que limpiar de nuevo.
  const reintentarConOtroMetodo = async (): Promise<void> => {
    if (!confirmation) return;
    let body: unknown = null;
    try {
      const res = await fetch('/api/checkout/reintento', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ numero_orden: confirmation.numero_orden }),
      });
      body = await res.json().catch(() => null);
    } catch (e) {
      toast.error(e instanceof Error ? `No pudimos comunicarnos con el servidor: ${e.message}` : 'No pudimos comunicarnos con el servidor.');
      return;
    }

    const resultado = interpretarRespuestaReintento(body, 'No pudimos procesar tu solicitud. Intenta de nuevo.');
    if (resultado.tipo === 'creado') {
      setConfirmation((c) => (c ? { ...c, wompi: resultado.wompi } : c));
      setBloquePasarela({
        aceptaciones: resultado.wompi.aceptaciones,
        publicKey:    resultado.wompi.publicKey,
        metodosOtros: resultado.wompi.metodosPasarelaOtros,
      });
      setReintentoKey((k) => k + 1);
      return;
    }
    if (resultado.tipo === 'ya_pagada') {
      // Otra pestaña pagó la orden mientras el comprador decidía reintentar — el servidor ya lo
      // verificó bajo lock (§ el docstring del endpoint); acá sólo se refleja el hecho.
      setPasarelaAprobada(true);
      return;
    }
    if (resultado.tipo === 'tope_alcanzado') {
      // TEXTO DEL OWNER (2026-09-18): "al agotarse, el comprador ve el número de orden y las
      // dos acciones, como el resto de los estados terminales" — se reusa la MISMA pantalla que
      // ya usa `pasarelaMetodoNoHabilitado` (abajo, el `if` de la confirmación completa).
      toast.error('Ya intentaste pagar varias veces y no fue posible completar el cobro. Tu pedido queda reservado y te contactaremos para coordinar el pago.');
      setIntentosAgotados(true);
      return;
    }
    toast.error(resultado.mensaje);
  };

  // CHECKOUT-PAGO-EN-EL-PASO-1: el pago por pasarela ("Tu pedido está reservado" + el widget/
  // formulario) ya NO es un `return` temprano que reemplaza toda la pantalla — se monta DENTRO
  // del paso de pago del checkout normal (`step === 1`, más abajo), con los pasos y el resumen
  // del pedido intactos alrededor. Ese branch de render vive junto al resto del paso de pago; lo
  // único que queda acá es EXCLUIRLO de la confirmación manual de abajo, que sigue siendo un
  // `return` completo — es la pantalla TERMINAL para el resto de los métodos (nequi, efectivo,
  // transferencia…), para el desvío `metodo_no_habilitado` (§ el reporte del slice: ese desvío
  // NO cambia, sigue cayendo acá tal cual) y, desde § CHECKOUT-TRANSICION-DEFECTOS-1, para el
  // pago de pasarela YA APROBADO (`pasarelaAprobada`).
  //
  // § CHECKOUT-TRANSICION-DEFECTOS-1: `pasarelaAprobada` reusa esta MISMA pantalla — el owner:
  // "buscá esa pantalla y reusala. No inventes una nueva". Antes, la única vista que un
  // comprador de pasarela veía al aprobarse era el ícono+título+frase de
  // `EsperaConfirmacionTarjeta`, sin número de orden, sin resumen y sin acciones — el camino que
  // SÍ cobra terminaba MÁS POBRE que el que no cobró. El resumen de ítems/costos y las DOS
  // acciones de abajo son EXACTAMENTE las mismas que ya usan los métodos manuales, sin tocar una
  // sola línea de esa parte — sólo el ícono, el título, el primer párrafo y el estado cambian
  // quién de los dos casos anuncian.
  //
  // § CHECKOUT-REINTENTO-OTRO-METODO-1: `intentosAgotados` reusa la MISMA pantalla, por la MISMA
  // razón — MISMO texto del owner ("el comprador ve el número de orden y las dos acciones, como
  // el resto de los estados terminales") y MISMO tratamiento que `pasarelaMetodoNoHabilitado`
  // (cae al "else" del ícono/título/párrafo de abajo, que no distingue entre las dos causas: las
  // dos son "no se pudo cobrar con tarjeta, el equipo coordina el pago").
  if (confirmation && (!confirmation.wompi || pasarelaMetodoNoHabilitado || pasarelaAprobada || intentosAgotados)) {
    // `confirmation.estado` es el de la CREACIÓN de la orden ('pendiente' — el pago de pasarela
    // se confirma después, por webhook). Con `pasarelaAprobada` el comprador no debe leer
    // "pendiente": el sondeo acaba de confirmar el pago, así que el badge muestra ESE hecho.
    const estadoMostrado = pasarelaAprobada ? 'pagado' : confirmation.estado;
    return (
        <div className="min-h-[80vh] flex items-center justify-center pt-16 px-4">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="max-w-md w-full text-center">
            <div className={`w-20 h-20 ${pasarelaAprobada ? 'bg-emerald-100' : 'bg-amber-100'} rounded-full flex items-center justify-center mx-auto mb-6`}>
              {pasarelaAprobada
                ? <CheckCircle className="w-10 h-10 text-emerald-600" />
                : <Clock className="w-10 h-10 text-amber-600" />}
            </div>
            <h1 className="text-3xl font-playfair text-[var(--sf-tinta)] mb-2">
              {pasarelaAprobada ? '¡Tu pago fue aprobado!' : '¡Pedido recibido!'}
            </h1>
            <p className="text-[var(--sf-texto)] mb-2">
              {pasarelaAprobada
                ? `Gracias, ${info.nombre}. Tu pedido queda confirmado y pasa a preparación.`
                : `Gracias, ${info.nombre}. Recibimos tu pedido.`}
            </p>
            {!pasarelaAprobada && (
              <p className="text-sm text-[var(--sf-texto-suave)] mb-4">
                {tieneWhatsapp
                  ? 'Tu pedido está reservado. Confirmaremos el pago por WhatsApp y luego preparamos tu envío.'
                  : 'Tu pedido está reservado. Confirmaremos el pago y luego preparamos tu envío.'}
              </p>
            )}
            <div className="flex items-center justify-center gap-2 mb-6">
              <span className="text-xs text-[var(--sf-texto-suave)]">Estado:</span>
              <StatusBadge status={estadoMostrado} theme="light" />
            </div>
            <div className="bg-[var(--sf-superficie)] rounded-2xl p-5 mb-6 text-left">
              <p className="text-xs text-[var(--sf-texto-suave)] mb-1 text-center">Número de orden</p>
              <p className="text-2xl font-bold text-[var(--sf-acento-texto)] mb-4 text-center">{confirmation.numero_orden}</p>
              <div className="space-y-2 pt-3 sf-divisor-t border-[var(--sf-linea)]">
                {confirmation.items.map((item, i) => (
                  <div key={i} className="flex justify-between text-xs text-[var(--sf-texto)]">
                    <span className="min-w-0 truncate pr-2">
                      {item.producto_nombre}
                      {item.moliendaSeleccionada ? ` · ${item.moliendaSeleccionada}` : ''} × {item.cantidad}
                    </span>
                    <span className="shrink-0 font-medium">{formatCOP(item.subtotal)}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-2 pt-3 mt-3 sf-divisor-t border-[var(--sf-linea)] text-sm">
                <div className="flex justify-between text-[var(--sf-texto)]">
                  <span>Subtotal</span><span>{formatCOP(confirmation.subtotal)}</span>
                </div>
                <div className="flex justify-between text-[var(--sf-texto)]">
                  <span>Envío</span>
                  <span className={confirmation.costo_envio === 0 ? 'text-emerald-600' : ''}>{confirmation.costo_envio === 0 ? 'Gratis' : formatCOP(confirmation.costo_envio)}</span>
                </div>
                {confirmation.metodo_envio && (
                  <div className="flex justify-between text-[var(--sf-texto)]">
                    <span>Entrega</span>
                    <span className="text-right">
                      {getShippingMethod(confirmation.metodo_envio)?.label ?? confirmation.metodo_envio}
                      {findSlotLabel(confirmation.franja) ? ` · ${findSlotLabel(confirmation.franja)}` : ''}
                    </span>
                  </div>
                )}
                {confirmation.direccion_detalle && (
                  <div className="flex justify-between text-[var(--sf-texto)]">
                    <span>Detalles</span>
                    <span className="text-right">{confirmation.direccion_detalle}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-[var(--sf-tinta)] text-base pt-1 sf-divisor-t border-[var(--sf-linea)]">
                  <span>Total</span><span>{formatCOP(confirmation.total)}</span>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <Link href={`/rastrear-pedido?orden=${encodeURIComponent(confirmation.numero_orden)}`} className="block w-full bg-[var(--sf-tinta)] text-[var(--sf-sobre)] font-semibold py-3.5 rounded-xl text-sm hover:bg-[var(--sf-tinta-2)] transition-colors">Rastrear mi pedido</Link>
              <Link href="/tienda" className="block w-full sf-borde border-[var(--sf-linea)] text-[var(--sf-texto)] font-medium py-3.5 rounded-xl text-sm hover:bg-[var(--sf-superficie)] transition-colors">Seguir comprando</Link>
            </div>
          </motion.div>
        </div>
    );
  }

  // Con la orden de pasarela ya creada (§ arriba), el carrito ya se vació —`clearCart()` en
  // `handleOrder`— y un array vacío acá NO significa "no hay nada que comprar": significa "ya
  // se compró y falta completar el pago". Sin esta excepción, el checkout caería al estado de
  // carrito vacío en vez de seguir mostrando el paso de pago con la pasarela montada.
  if (items.length === 0 && !confirmation) {
    return (
        <div className="min-h-[60vh] flex items-center justify-center pt-16">
          <div className="text-center">
            <p className="text-xl font-playfair mb-4">Tu carrito está vacío</p>
            <Link href="/" className="text-[var(--sf-acento-texto)] underline text-sm">← Explorar productos</Link>
          </div>
        </div>
    );
  }

  return (
      <div className="pt-16 min-h-screen bg-[var(--sf-fondo)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <Link href="/tienda" className="p-2 hover:bg-[var(--sf-superficie)] sf-radio-lg transition-colors cursor-pointer">
              <ArrowLeft className="w-5 h-5 text-[var(--sf-texto)]" />
            </Link>
            <h1 className="text-2xl font-playfair text-[var(--sf-tinta)]">Checkout</h1>
          </div>

          {/* Steps */}
          <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2">
            {STEPS.map((s, i) => (
              <div key={s} className="flex items-center gap-2 shrink-0">
                <div className={`flex items-center gap-2 ${i === step ? 'text-[var(--sf-acento-texto)]' : i < step ? 'text-emerald-600' : 'text-[var(--sf-tostado-3)]'}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i === step ? 'bg-[var(--sf-acento)] text-[var(--sf-acento-txt)]' : i < step ? 'bg-emerald-600 text-white' : 'bg-[var(--sf-linea)] text-[var(--sf-texto-suave)]'}`}>
                    {i < step ? '✓' : i + 1}
                  </div>
                  <span className="text-sm font-medium">{s}</span>
                </div>
                {i < STEPS.length - 1 && <div className="w-8 h-px bg-[var(--sf-linea)] mx-1" />}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Form */}
            <div className="lg:col-span-2">
              <div className="bg-[var(--sf-tarjeta)] rounded-2xl sf-borde border-[var(--sf-linea)] p-6">
                {/* Step 0: Info */}
                {step === 0 && (
                  <div className="space-y-4">
                    <h2 className="font-semibold text-[var(--sf-tinta)] mb-4">Información de contacto</h2>
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Nombre *" value={info.nombre} onChange={v => setInfo({ ...info, nombre: v })} />
                      <Field label="Apellido *" value={info.apellido} onChange={v => setInfo({ ...info, apellido: v })} />
                    </div>
                    <Field label="Correo electrónico *" type="email" value={info.email} onChange={v => setInfo({ ...info, email: v })} />
                    <div>
                      <label className="block text-xs font-medium text-[var(--sf-texto)] mb-1.5">Teléfono / WhatsApp *</label>
                      <div className="flex items-stretch">
                        <span className="inline-flex items-center px-3 rounded-l-xl sf-borde-t sf-borde-b sf-borde-l border-[var(--sf-linea)] bg-[var(--sf-superficie)] text-sm font-medium text-[var(--sf-texto)] select-none">+57</span>
                        <input
                          type="tel" inputMode="numeric" value={info.telefono}
                          onChange={e => setInfo({ ...info, telefono: e.target.value })} placeholder="300 000 0000"
                          className="w-full px-4 py-3 bg-[var(--sf-fondo)] sf-borde border-[var(--sf-linea)] rounded-r-xl text-sm text-[var(--sf-tinta)] focus:outline-none focus:ring-2 focus:ring-[var(--sf-acento)]/20 focus:border-[var(--sf-acento)]"
                        />
                      </div>
                      {info.telefono && !phoneValid && (
                        <p className="mt-1 text-xs text-red-600">Ingresa un celular colombiano de 10 dígitos (ej. 3XX XXX XXXX).</p>
                      )}
                    </div>
                    <div className="space-y-4">
                    <h2 className="font-semibold text-[var(--sf-tinta)] mb-4">Dirección de entrega</h2>
                    <Field label="Dirección *" value={address.linea1} onChange={v => setAddress({ ...address, linea1: v })} placeholder="Calle, Carrera, número" />
                    <Field label="Detalles adicionales (opcional)" value={address.detalle} onChange={v => setAddress({ ...address, detalle: v })} placeholder="Apto, torre, interior, indicaciones de entrega." />
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Ciudad *" value={address.ciudad} onChange={v => setAddress({ ...address, ciudad: v })} />
                      <div>
                        <label className="block text-xs font-medium text-[var(--sf-texto)] mb-1.5">Departamento *</label>
                        <select
                          value={address.departamento} onChange={e => selectDepartamento(e.target.value)}
                          className="w-full px-4 py-3 bg-[var(--sf-fondo)] sf-borde border-[var(--sf-linea)] rounded-xl text-sm text-[var(--sf-tinta)] focus:outline-none focus:ring-2 focus:ring-[var(--sf-acento)]/20 focus:border-[var(--sf-acento)]"
                        >
                          <option value="" disabled>Selecciona departamento</option>
                          {COLOMBIA_DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="space-y-3 mt-4">
                      <p className="text-sm font-semibold text-[var(--sf-tinta)]">Método de envío</p>
                      {/* Method, price and franja are derived from departamento. */}
                      {!shippingMethod ? (
                        <p className="text-sm text-[var(--sf-texto-suave)] p-4 rounded-xl border-2 border-dashed border-[var(--sf-linea)]">
                          Selecciona tu departamento para ver el método y el costo de envío.
                        </p>
                      ) : (
                        <div>
                          <div className="flex items-center justify-between p-4 rounded-xl border-2 border-[var(--sf-acento)] bg-[var(--sf-acento)]/5">
                            <div>
                              <span className="block text-sm font-medium text-[var(--sf-tinta)]">{shippingMethod.label}</span>
                              <span className="block text-xs text-[var(--sf-texto-suave)]">{shippingMethod.description}</span>
                            </div>
                            <span className="text-sm font-bold text-[var(--sf-acento-texto)] shrink-0">{shippingCost === 0 ? 'Gratis' : formatCOP(shippingCost!)}</span>
                          </div>
                          {/* Franja horaria — required for Bogotá D.C., framed as a preference */}
                          {isBogota && shippingMethod.slots && (
                            <div className="mt-3 ml-4 pl-4 border-l-2 border-[var(--sf-linea)] space-y-2">
                              <p className="text-xs font-semibold text-[var(--sf-texto)]">Franja horaria * <span className="font-normal text-[var(--sf-texto-suave)]">(preferencia)</span></p>
                              {shippingMethod.slots.map(s => (
                                <label key={s.id} className={`flex items-center gap-3 p-3 sf-radio-lg sf-borde cursor-pointer transition-all ${slot === s.id ? 'border-[var(--sf-acento)] bg-[var(--sf-acento)]/5' : 'border-[var(--sf-linea)]'}`}>
                                  <input type="radio" name="slot" value={s.id} checked={slot === s.id} onChange={() => setSlot(s.id)} className="accent-[var(--sf-acento)]" />
                                  <span className="text-sm text-[var(--sf-tinta)]">{s.label}</span>
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-3 mt-2">
                      {/* El paso Información no tiene "Atrás": es el primer paso, y la única
                          salida ya es la flecha del encabezado (→ /tienda). Un "Atrás" acá
                          hacía setStep(0) sobre el paso 0 — un botón activo que no hacía nada
                          (§ CHECKOUT-BOTON-ATRAS-MUERTO-1). El botón que queda ocupa el ancho
                          completo con flex-1: es la única acción del paso. */}
                      <button onClick={() => setStep(1)} disabled={!address.linea1 || !address.ciudad || !address.departamento || !phoneValid || (isBogota && !slot)} className="flex-1 bg-[var(--sf-tinta)] disabled:opacity-40 disabled:pointer-events-none text-[var(--sf-sobre)] font-semibold py-3.5 rounded-xl text-sm hover:bg-[var(--sf-tinta-2)]">Continuar al pago</button>
                    </div>
                  </div>
                  </div>
                )}

                {/* Step 1: Shipping */}
                

                {/* Step 2: Payment */}
                {step === 1 && (
                  <div className="space-y-4">
                    {confirmation && confirmation.wompi && !pasarelaMetodoNoHabilitado && !modoApiDirecta ? (
                      // § CHECKOUT-UNA-SOLA-PANTALLA-1: EXCEPCIÓN DECLARADA — el modo WIDGET no
                      // adopta el flujo de una sola pantalla, y es a propósito (§ el reporte del
                      // slice, "si en modo widget el flujo de una sola pantalla no aplica, decilo
                      // en vez de forzarlo"). El botón que Wompi renderiza (`PagoPasarela`) es SU
                      // botón, no el nuestro — necesita la transacción YA FIRMADA (reference,
                      // amountInCents, signature), y eso sólo existe con la orden creada. Acá el
                      // comprador SÍ pasa por "Confirmar pedido" primero y clickea el botón de
                      // Wompi después: dos clics, porque el segundo lo controla el proveedor, no
                      // este checkout. Esta rama queda TAL CUAL estaba antes de este slice.
                      //
                      // NINGUNA pantalla puede afirmar "pagado" acá — la verdad la trae el
                      // webhook (§4, WOMPI-WIDGET-EN-EL-CANONICO-1). NO SE RENDERIZA NINGÚN
                      // BOTÓN "Atrás" NI "Confirmar pedido" EN ESTA RAMA: Información/Dirección
                      // dejan de ser editables una vez que el servidor ya creó la orden.
                      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-center">
                        <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Clock className="w-7 h-7 text-amber-600" />
                        </div>
                        <h2 className="text-xl font-playfair text-[var(--sf-tinta)] mb-2">Tu pedido está reservado</h2>
                        <p className="text-sm text-[var(--sf-texto)] mb-4">Completa el pago abajo para confirmarlo.</p>
                        <div className="bg-[var(--sf-superficie)] rounded-2xl p-5 mb-6 text-left">
                          <p className="text-xs text-[var(--sf-texto-suave)] mb-1 text-center">Número de orden</p>
                          <p className="text-2xl font-bold text-[var(--sf-acento-texto)] text-center">{confirmation.numero_orden}</p>
                        </div>
                        <PagoPasarela
                          reference={confirmation.wompi.reference}
                          amountInCents={confirmation.wompi.amountInCents}
                          currency={confirmation.wompi.currency}
                          signature={confirmation.wompi.signature}
                          publicKey={confirmation.wompi.publicKey}
                        />
                      </motion.div>
                    ) : (
                    <>
                    {/* § CHECKOUT-UNA-SOLA-PANTALLA-1: el selector de método sólo se muestra
                        ANTES de que exista la orden — una vez creada, "Información"/"Dirección"
                        y el método elegido ya no son editables (misma garantía que antes tenía
                        el `return` temprano de arriba). */}
                    {!confirmation && (
                      <>
                        <h2 className="font-semibold text-[var(--sf-tinta)] mb-4">Método de pago</h2>
                        {availablePayments.length === 0 && !pasarelaOfrecida ? (
                          // Guarda defensiva: el dueño apagó TODOS los métodos (o ninguno tiene datos). El
                          // editor exige ≥1 encendido, así que casi no pasa —pero el checkout no puede quedar
                          // mudo—: en vez de un paso sin opciones se ofrece coordinar el pago por WhatsApp.
                          //
                          // ESTA GUARDA NO SE PUEDE GATEAR CON UN BORRADO, y es lo que la separa de las otras
                          // dos promesas de canal de esta página: aquéllas tienen una frase a la que caer (la
                          // misma sin el canal), y ÉSTA ES EL FALLBACK MISMO —quitarle el canal la dejaría
                          // muda—. Así que sin WhatsApp no se borra: se le cambia el DESTINO por uno honesto
                          // ("vuelve más tarde"), que no inventa un canal que no existe ni le enseña al
                          // comprador la mala configuración de la tienda. Cada rama se escribe ENTERA (§ el
                          // gate del canal, #8). El dueño se entera del combo —sin pago Y sin canal, que es
                          // una venta muerta— por el aviso `checkout-sin-salida` del Dashboard.
                          <div className="bg-[var(--sf-superficie)] rounded-xl p-4 text-sm text-[var(--sf-texto)]">
                            {tieneWhatsapp
                              ? 'No hay un método de pago disponible ahora mismo. Escríbenos por WhatsApp para coordinar el pago y completar tu pedido.'
                              : 'No podemos completar tu pedido en este momento. Vuelve a intentarlo más tarde.'}
                          </div>
                        ) : (
                          <>
                            <div className="space-y-3">
                              {availablePayments.map(opt => (
                                <label key={opt.id} className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${!pasarelaSeleccionada && metodoActivo === opt.id ? 'border-[var(--sf-acento)] bg-[var(--sf-acento)]/5' : 'border-[var(--sf-linea)]'}`}>
                                  <input type="radio" name="payment" value={opt.id} checked={!pasarelaSeleccionada && metodoActivo === opt.id} onChange={() => { setPayment(opt.id); setPasarelaSeleccionada(false); }} className="mt-0.5 accent-[var(--sf-acento)]" />
                                  <div>
                                    <p className="text-sm font-semibold text-[var(--sf-tinta)]">{opt.label}</p>
                                    <p className="text-xs text-[var(--sf-texto-suave)]">{opt.desc}</p>
                                  </div>
                                </label>
                              ))}
                              {/* La opción SÓLO se ofrece cuando el bloque de aceptación se consiguió
                                  (`pasarelaOfrecida`, § CHECKOUT-UNA-SOLA-PANTALLA-1 — "si las dos completas
                                  no se consiguen, la opción de pasarela no se ofrece"), no sólo por el
                                  interruptor de despliegue. § CHECKOUT-COPY-Y-ORDEN-PASARELA-1: LA ETIQUETA
                                  ES FIJA para las dos ramas (API directa y widget) — generarla desde
                                  `metodosOtros` colisionaba con un método MANUAL que comparte nombre (dos
                                  radios de "Nequi" uno debajo del otro). El SUBTÍTULO sí se genera
                                  (`subtituloPagoPasarela`, `lib/pagos/metodos-pasarela.ts`) y su cola nombra
                                  el eje real: QUIÉN CONFIRMA (instantáneo, nunca el equipo). TEXTO DEL OWNER
                                  (2026-09-17) — ya no provisional. */}
                              {pasarelaOfrecida && bloquePasarela && (
                                <label className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${pasarelaSeleccionada ? 'border-[var(--sf-acento)] bg-[var(--sf-acento)]/5' : 'border-[var(--sf-linea)]'}`}>
                                  <input type="radio" name="payment" checked={pasarelaSeleccionada} onChange={() => setPasarelaSeleccionada(true)} className="mt-0.5 accent-[var(--sf-acento)]" />
                                  <div>
                                    <p className="text-sm font-semibold text-[var(--sf-tinta)]">{ETIQUETA_PAGO_PASARELA}</p>
                                    <p className="text-xs text-[var(--sf-texto-suave)]">{subtituloPagoPasarela(bloquePasarela.metodosOtros)}</p>
                                  </div>
                                </label>
                              )}
                            </div>
                            {!pasarelaSeleccionada && (metodoActivo === 'nequi' || metodoActivo === 'daviplata' || metodoActivo === 'breb' || metodoActivo === 'transferencia') && (
                              <Field label="Referencia de pago (opcional)" value={refTransfer} onChange={setRefTransfer} placeholder="Número de confirmación" />
                            )}
                          </>
                        )}
                      </>
                    )}

                    {/* § CHECKOUT-UNA-SOLA-PANTALLA-1: el formulario de pasarela aparece BAJO el
                        selector, EN LA MISMA pantalla, apenas se elige el método — sin clic
                        intermedio, sin pantalla aparte. Es la MISMA instancia antes y después de
                        que "Pagar" cree la orden (no se remonta cuando `confirmation` aparece, ni
                        cuando desaparece el bloque de arriba): así conserva su progreso interno
                        (tokenizando, esperando confirmación) sin depender de en qué rama esté la
                        página. Su botón "Pagar · $X" es el ÚNICO que confirma.

                        § CHECKOUT-REINTENTO-OTRO-METODO-1: LA ÚNICA excepción a "no se remonta"
                        — `key={reintentoKey}` fuerza el remonte cuando un reintento consigue un
                        `PaymentIntent` nuevo (`reintentarConOtroMetodo`, arriba), para que el
                        picker arranque LIMPIO con la `reference` nueva en vez de seguir mostrando
                        el formulario ya rechazado. `reintentoKey` sólo avanza ahí — nunca durante
                        la creación inicial. */}
                    {pasarelaSeleccionada && modoApiDirecta && bloquePasarela && !pasarelaMetodoNoHabilitado && (
                      <SelectorMetodoPasarela
                        key={reintentoKey}
                        aceptaciones={bloquePasarela.aceptaciones}
                        publicKey={bloquePasarela.publicKey}
                        crearOrdenPasarela={crearOrdenPasarela}
                        monto={montoAPagar}
                        email={info.email}
                        metodosOtros={bloquePasarela.metodosOtros}
                        onMetodoNoHabilitado={handleMetodoNoHabilitado}
                        onAprobado={() => setPasarelaAprobada(true)}
                        onReintentarOtroMetodo={reintentarConOtroMetodo}
                      />
                    )}

                    {!confirmation && (
                      <div className="bg-[var(--sf-superficie)] rounded-xl p-4 flex items-start gap-2 text-xs text-[var(--sf-texto)]">
                        <Lock className="w-3.5 h-3.5 text-[var(--sf-acento-texto)] shrink-0 mt-0.5" />
                        {/* El PLAZO no lo promete el template: «en menos de 2 horas hábiles» era una
                            promesa horneada que ningún cliente eligió y que la tienda no puede garantizar
                            por despliegue (§ el censo de datos falsos: un literal que se hace pasar por
                            compromiso del negocio). Va «lo más pronto posible» en las DOS ramas de
                            confirmación HUMANA (con/sin WhatsApp).
                            LA TERCERA RAMA (pasarela) GANA sobre esas dos, y no promete plazo: dice el
                            HECHO — el pago en línea se confirma SOLO, sin que nadie del equipo lo mire
                            (§ WOMPI-B8-COPY-PASARELA-1). Aplicarle a un comprador de pasarela cualquiera
                            de las otras dos frases sería mentirle: nadie va a "confirmar" ese pago a mano.
                            Las tres van ENTERAS, nunca concatenadas (regla del repo) — así ninguna queda a
                            medias cuando falta un canal o cambia el camino de pago. */}
                        <span>
                          {pasarelaSeleccionada
                            ? 'Tu información está segura. El pago se confirma automáticamente y tu pedido pasa a preparación.'
                            : tieneWhatsapp
                              ? 'Tu información está segura. Nuestro equipo confirmará el pago por WhatsApp y procesará tu pedido lo más pronto posible.'
                              : 'Tu información está segura. Nuestro equipo confirmará el pago y procesará tu pedido lo más pronto posible.'}
                        </span>
                      </div>
                    )}
                    {!confirmation && (
                      pasarelaSeleccionada && modoApiDirecta ? (
                        // El botón "Pagar · $X" del formulario de arriba es el ÚNICO que
                        // confirma (§ CHECKOUT-UNA-SOLA-PANTALLA-1, "el único botón que
                        // confirma dice cuánto se paga") — acá sólo queda "Atrás".
                        <div className="flex gap-3">
                          <button onClick={() => setStep(0)} className="flex-1 sf-borde border-[var(--sf-linea)] text-[var(--sf-texto)] font-medium py-3.5 rounded-xl text-sm hover:bg-[var(--sf-superficie)]">Atrás</button>
                        </div>
                      ) : (
                        <div className="flex gap-3">
                          <button onClick={() => setStep(0)} className="flex-1 sf-borde border-[var(--sf-linea)] text-[var(--sf-texto)] font-medium py-3.5 rounded-xl text-sm hover:bg-[var(--sf-superficie)]">Atrás</button>
                          <button onClick={handleOrder} disabled={loading || (availablePayments.length === 0 && !pasarelaOfrecida)} className="flex-1 bg-[var(--sf-acento)] hover:bg-[var(--sf-acento-3)] disabled:opacity-60 disabled:pointer-events-none text-[var(--sf-acento-txt)] font-bold py-3.5 rounded-xl text-sm transition-colors">
                            {loading ? 'Procesando...' : `Confirmar pedido · ${formatCOP(total)}`}
                          </button>
                        </div>
                      )
                    )}
                    </>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Order Summary */}
            <div>
              <div className="bg-[var(--sf-tarjeta)] rounded-2xl sf-borde border-[var(--sf-linea)] p-5 sticky top-20">
                <h3 className="font-semibold text-[var(--sf-tinta)] mb-4">Resumen del pedido</h3>
                {confirmation ? (
                  // CHECKOUT-PAGO-EN-EL-PASO-1: con la orden de pasarela ya creada (§ el paso de
                  // pago, arriba) el carrito ya se vació —`clearCart()` en `handleOrder`—, así que
                  // este resumen deja de leer el carrito EN VIVO (mostraría $0/vacío) y pasa a leer
                  // la orden que el servidor confirmó: la MISMA fuente que usa la pantalla "¡Pedido
                  // recibido!" para el resto de los métodos de pago (arriba en el archivo). Llegar
                  // acá con `confirmation` truthy sólo puede ser la rama de pasarela en curso — las
                  // otras dos (métodos manuales, `metodo_no_habilitado`) ya devolvieron esa pantalla
                  // completa antes de alcanzar este layout.
                  <>
                    <div className="space-y-2 mb-4">
                      {confirmation.items.map((item, i) => (
                        <div key={i} className="flex justify-between text-xs text-[var(--sf-texto)]">
                          <span className="min-w-0 truncate pr-2">
                            {item.producto_nombre}
                            {item.moliendaSeleccionada ? ` · ${item.moliendaSeleccionada}` : ''} × {item.cantidad}
                          </span>
                          <span className="shrink-0 font-medium">{formatCOP(item.subtotal)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-2 pt-3 sf-divisor-t border-[var(--sf-linea)] text-sm">
                      <div className="flex justify-between text-[var(--sf-texto)]">
                        <span>Subtotal</span><span>{formatCOP(confirmation.subtotal)}</span>
                      </div>
                      <div className="flex justify-between text-[var(--sf-texto)]">
                        <span>Envío</span>
                        <span className={confirmation.costo_envio === 0 ? 'text-emerald-600' : ''}>{confirmation.costo_envio === 0 ? 'Gratis' : formatCOP(confirmation.costo_envio)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-[var(--sf-tinta)] text-base pt-1 sf-divisor-t border-[var(--sf-linea)]">
                        <span>Total</span><span>{formatCOP(confirmation.total)}</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-3 mb-4">
                      {items.map(item => {
                        const sinStock = sinStockIds.includes(item.id);
                        return (
                        <div key={item.key} className={`flex gap-3 ${sinStock ? 'sf-radio-lg -mx-1 px-1 ring-1 ring-red-300 bg-red-50/60' : ''}`}>
                          <div className="w-12 h-12 sf-radio-lg overflow-hidden bg-[var(--sf-superficie)] shrink-0">
                            <img src={imagenPortada(item.imagen)} alt={item.nombre} className="w-full h-full object-cover" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-[var(--sf-tinta)] line-clamp-2">{item.nombre}</p>
                            {typeof item.options?.molienda === 'string' && (
                              <p className="text-xs text-[var(--sf-tostado-3)]">Molienda: {item.options.molienda}</p>
                            )}
                            <p className="text-xs text-[var(--sf-texto-suave)]">× {item.quantity}</p>
                            {sinStock && (
                              <p className="text-xs font-medium text-red-600 mt-0.5">Cantidad no disponible</p>
                            )}
                          </div>
                          <p className="text-xs font-bold text-[var(--sf-tinta)] shrink-0">{formatCOP(item.precio * item.quantity)}</p>
                        </div>
                        );
                      })}
                    </div>
                    <div className="space-y-2 pt-3 sf-divisor-t border-[var(--sf-linea)] text-sm">
                      <div className="flex justify-between text-[var(--sf-texto)]">
                        <span>Subtotal</span><span>{formatCOP(subtotal)}</span>
                      </div>
                      <div className="flex justify-between text-[var(--sf-texto)]">
                        <span>Envío</span>
                        {shippingCost === null
                          ? <span className="text-[var(--sf-texto-suave)]">Selecciona departamento</span>
                          : <span className={shippingCost === 0 ? 'text-emerald-600' : ''}>{shippingCost === 0 ? 'Gratis' : formatCOP(shippingCost)}</span>}
                      </div>
                      <div className="flex justify-between font-bold text-[var(--sf-tinta)] text-base pt-1 sf-divisor-t border-[var(--sf-linea)]">
                        <span>Total</span><span>{formatCOP(total)}</span>
                      </div>
                    </div>
                  </>
                )}
                <div className="flex items-center gap-2 mt-4 text-xs text-[var(--sf-texto-suave)]">
                  <Shield className="w-3.5 h-3.5 text-[var(--sf-acento-texto)]" />
                  <span>Compra 100% segura y verificada</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
  );
}

interface FieldProps {
  label: string;

  value: string;

  onChange: (value: string) => void;

  type?: string;

  placeholder?: string;
}

function Field({ label, value, onChange, type = 'text', placeholder }: FieldProps) {
  return (
    <div>
      <label className="block text-xs font-medium text-[var(--sf-texto)] mb-1.5">{label}</label>
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-4 py-3 bg-[var(--sf-fondo)] sf-borde border-[var(--sf-linea)] rounded-xl text-sm text-[var(--sf-tinta)] focus:outline-none focus:ring-2 focus:ring-[var(--sf-acento)]/20 focus:border-[var(--sf-acento)]"
      />
    </div>
  );
}