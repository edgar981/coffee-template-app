"use client";
import { useState, useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import Link from "next/link";
import { imagenPortada } from "@/lib/producto-imagen";
import { Lock, CreditCard, Clock, Paperclip, FileText, X, ChevronDown, MessageCircle, Check } from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
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
import {
  computeShippingCost,
  getShippingMethod,
  findSlotLabel,
  type ShippingMethodId,
} from '@duna/core/shipping-config';
import { COLOMBIA_DEPARTMENTS, isBogotaDC } from '@duna/core/colombia-departments';
import { metodosDisponibles, type MetodoPagoTipo } from '@/lib/checkout/metodos-pago';
import { aceptaComprobanteCliente } from '@/lib/checkout/comprobante-cliente';
import { validarArchivoComprobante, esImagen, formatearTamano } from '@/lib/comprobante';
import { ACCEPT_COMPROBANTE } from '@/constants/comprobante';
import { useSiteSettings } from '@/components/storefront/SiteSettingsProvider';
import { useSiteContent } from '@/components/storefront/SiteContentProvider';
import { contenedorAnchoClase, navOffsetClase } from '@/lib/config/themes';
import { whatsappUrl } from '@/lib/config/site';
import { contenidoEstadoPedido, type MetodoPedido } from '@/lib/checkout/estado-pedido';
import EstadoPedido from '@/components/storefront/checkout/EstadoPedido';
import { vendedorEstaCompleto, lineaVendedor } from '@/lib/legal/plantillas';
import { composicionPasos, verboCTACompra, fraseFalta } from '@/lib/checkout/composiciones-compra';
import CampoFlotante from '@/components/storefront/checkout/CampoFlotante';

// § CHECKOUT-COMPROBANTE-TOKEN-1: el código privado que `POST /api/checkout` emite para ESTA
// orden (`CheckoutResult.codigoComprobante`) se guarda en DOS lugares, NUNCA en la URL —
// memoria de la página (el ref de abajo, siempre fresco, sin el problema de un closure stale) y
// `sessionStorage`, para que un reintento de subida que ocurra tras un remonte de la pantalla de
// confirmación siga teniendo con qué autorizar la subida. Las dos funciones de storage son
// módulo-level porque no necesitan estado de React; las dos van en `try/catch` — `sessionStorage`
// puede lanzar en navegación privada/bloqueada, y perderla ahí sólo baja la resiliencia, nunca
// debe tumbar el checkout.
function claveCodigoComprobante(numeroOrden: string): string {
  return `checkout:codigoComprobante:${numeroOrden}`;
}

function guardarCodigoComprobante(numeroOrden: string, codigo: string): void {
  try {
    window.sessionStorage.setItem(claveCodigoComprobante(numeroOrden), codigo);
  } catch {
    // Privado/bloqueado: el código sigue disponible en memoria para ESTA carga de página.
  }
}

function leerCodigoComprobante(numeroOrden: string): string | null {
  try {
    return window.sessionStorage.getItem(claveCodigoComprobante(numeroOrden));
  } catch {
    return null;
  }
}

export default function Checkout() {
  // CHECKOUT-LISTO-PARA-VENDER-1 — `departamentoCarrito` es el que el comprador ya eligió en
  // el cajón del carrito (si lo hizo): el `useEffect` de abajo lo usa para ARRANCAR
  // `address.departamento` sin volver a preguntarlo. `setDepartamentoCarrito` mantiene el
  // CartContext al día si el comprador lo cambia DESDE acá (p. ej. porque el cajón lo tenía
  // vacío) — una sola fuente para los dos sitios donde se puede elegir.
  const { items, subtotal, clearCart, departamento: departamentoCarrito, setDepartamento: setDepartamentoCarrito } = useCartStore();
  const [step, setStep] = useState(0);
  // CHECKOUT-LISTO-PARA-VENDER-1 — el resumen plegable de arriba («Tu pedido · n productos ·
  // $total ▾», § el spec del slice): sólo en celular (`lg:hidden`), porque en escritorio el
  // resumen YA está siempre a la vista en la columna fija de la derecha.
  const [resumenAbierto, setResumenAbierto] = useState(false);
  const [loading, setLoading] = useState(false);
  // EL CONTENEDOR (§ PARIDAD-ANCHO-CONTENIDO-1) — ver el docstring de `contenedorAnchoClase`
  // (`lib/config/themes.ts`) para el porqué de reusar `navTratamiento.posicion` acá. `false`
  // (todo tenant salvo CORTE) = el literal de HOY, byte a byte.
  const { navTratamiento, vendedor, compra } = useSiteContent();
  const contenedorClase = contenedorAnchoClase(navTratamiento.posicion);
  // EL RELLENO SUPERIOR (§ NAV-INTERNAS-CLARO-Y-OFFSET-1) — ver el docstring de `navOffsetClase`
  // (`lib/config/themes.ts`). `false` (todo tenant salvo CORTE) = `pt-16`, byte a byte.
  const offsetClase = navOffsetClase(navTratamiento.posicion);
  // § COMPRA-FIDELIDAD-3 — el TRATAMIENTO de los dos pasos (Entrega/Pago), clampado al set cerrado
  // (comun/ficha/tejido). `STEP_LABELS` es el ÚNICO texto del encabezado del paso que cambia por
  // línea; el resto de la mejora de base (el campo, la validación, el bloque plegado, el método
  // como radio…) es igual en los tres valores.
  const pasos = composicionPasos(compra.pasos);
  const STEP_LABELS = pasos === 'ficha' ? ['01 ENTREGA', '02 PAGO'] : ['Entrega', 'Pago'];
  // § COMPRA-FIDELIDAD-4 — el TÍTULO GRANDE del paso ("ENTREGA"/"PAGO" en serif versal para Onix;
  // "Entrega"/"Pago" en serif para Las Chamisas y la común), medido contra `onix-entrega.png` ("01
  // ENTREGA" arriba, "ENTREGA" grande debajo — sin el "01") y `cham-1440-entrega-vacia.png`
  // ("① Entrega" arriba, "Entrega" grande debajo).
  const STEP_TITLE = pasos === 'ficha' ? ['ENTREGA', 'PAGO'] : ['Entrega', 'Pago'];
  // § COMPRA-FIDELIDAD-3 — "EL RESUMEN QUE RESPONDE" (§ refero.md §3: "el total cambia con un
  // fundido de 200ms"). El dato YA respondía (React recalcula al elegir departamento); lo que
  // faltaba era el AVISO visual de que cambió — un fundido corto en el número, apagado si el
  // visitante pide menos movimiento.
  const reduceMovimiento = useReducedMotion();

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

  // CHECKOUT-LISTO-PARA-VENDER-1 — arranca con el departamento que el cajón del carrito ya
  // tenía elegido (si lo tenía), UNA sola vez al montar. Nunca pisa una elección que el
  // comprador ya haya hecho en ESTE formulario (§ el principio del admin, "un default jamás
  // pisa un valor que ya existe" — aplica igual del lado del storefront).
  useEffect(() => {
    if (departamentoCarrito && !address.departamento) {
      setAddress((a) => ({ ...a, departamento: departamentoCarrito }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [slot, setSlot] = useState<string | null>(null);
  const [payment, setPayment] = useState<MetodoPagoTipo>('nequi');
  // § CHECKOUT-COMPROBANTE-CLIENTE-1: reemplaza al viejo "Referencia de pago
  // (opcional)" — un campo de TEXTO que `/api/checkout` validaba pero nunca
  // guardaba en ningún lado (ni en `Order` ni en ningún `Payment`; medido
  // leyendo `app/api/checkout/route.ts` antes de tocar esto). Lo que el
  // operador necesita para confirmar un pago manual es la FOTO del comprobante,
  // no una cadena de texto que se perdía. `comprobanteFile` sobrevive a un
  // intento de subida fallido (para poder reintentar con el MISMO archivo); se
  // sube DESPUÉS de crear la orden, nunca antes (§ `intentarSubirComprobante`).
  const comprobanteInputRef = useRef<HTMLInputElement | null>(null);
  const [comprobanteFile, setComprobanteFile] = useState<File | null>(null);
  const [comprobantePreviewUrl, setComprobantePreviewUrl] = useState<string | null>(null);
  const [comprobanteErrorSeleccion, setComprobanteErrorSeleccion] = useState<string | null>(null);
  type EstadoSubidaComprobante = 'ninguno' | 'subiendo' | 'listo' | 'error';
  const [comprobanteEstado, setComprobanteEstado] = useState<EstadoSubidaComprobante>('ninguno');
  const [comprobanteErrorSubida, setComprobanteErrorSubida] = useState<string | null>(null);
  // § CHECKOUT-COMPROBANTE-TOKEN-1: el código de ESTA carga de página, por numero_orden — un
  // `useRef` (no `useState`) porque se lee en el MISMO tick en que se escribe (justo después de
  // `setConfirmation`, antes de que React vuelva a renderizar), y un closure sobre `confirmation`
  // ahí leería el valor del render ANTERIOR, no el que `result` acaba de traer.
  const codigosComprobanteRef = useRef<Record<string, string>>({});

  const registrarCodigoComprobante = (result: CheckoutResult) => {
    if (!result.codigoComprobante) return;
    codigosComprobanteRef.current[result.numero_orden] = result.codigoComprobante;
    guardarCodigoComprobante(result.numero_orden, result.codigoComprobante);
  };

  // El preview de imagen es un object URL del archivo local — hay que revocarlo al
  // cambiar de archivo o salir de la página, o la pestaña retiene el blob en memoria.
  useEffect(() => {
    if (!comprobanteFile || !esImagen(comprobanteFile.type)) { setComprobantePreviewUrl(null); return; }
    const url = URL.createObjectURL(comprobanteFile);
    setComprobantePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [comprobanteFile]);

  const elegirComprobante = (file: File) => {
    const problema = validarArchivoComprobante({ type: file.type, size: file.size, name: file.name });
    if (problema) { setComprobanteErrorSeleccion(problema); return; }
    setComprobanteErrorSeleccion(null);
    setComprobanteEstado('ninguno');
    setComprobanteErrorSubida(null);
    setComprobanteFile(file);
  };

  const quitarComprobante = () => {
    setComprobanteFile(null);
    setComprobanteErrorSeleccion(null);
    setComprobanteEstado('ninguno');
    setComprobanteErrorSubida(null);
  };

  // Sube el comprobante YA ELEGIDO contra una orden YA CREADA — nunca antes
  // (§ el reporte del slice: "primero la plata/el pedido, después la evidencia",
  // la misma asimetría que ya rige el adjunto del modal de Registrar Pago). Si
  // falla, NO se pierde el pedido ni se duplica nada: sólo queda `comprobanteEstado
  // === 'error'`, y el botón de la pantalla de confirmación reintenta con el MISMO
  // archivo — nunca lanza, así que nunca puede tumbar el flujo que ya tuvo éxito
  // (crear la orden).
  const intentarSubirComprobante = async (numeroOrden: string) => {
    if (!comprobanteFile) return;
    // El código vive en el ref (fresco, sin el problema de closure stale) y, si no está ahí
    // —por ejemplo tras un remonte de la página—, en `sessionStorage` (§ arriba). Sin ninguno
    // de los dos no hay con qué autorizar la subida — nunca se intenta sin código.
    const codigo = codigosComprobanteRef.current[numeroOrden] ?? leerCodigoComprobante(numeroOrden);
    if (!codigo) {
      setComprobanteErrorSubida('No pudimos verificar tu pedido para subir el comprobante.');
      setComprobanteEstado('error');
      return;
    }
    setComprobanteEstado('subiendo');
    setComprobanteErrorSubida(null);
    try {
      const form = new FormData();
      form.set('codigo', codigo);
      form.set('file', comprobanteFile);
      const res = await fetch(`/api/orders/${encodeURIComponent(numeroOrden)}/comprobante-cliente`, {
        method: 'POST',
        body:   form,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setComprobanteErrorSubida(data?.error ?? 'No se pudo subir el comprobante.');
        setComprobanteEstado('error');
        return;
      }
      setComprobanteEstado('listo');
    } catch (e) {
      setComprobanteErrorSubida(e instanceof Error ? `No pudimos comunicarnos con el servidor: ${e.message}` : 'No pudimos comunicarnos con el servidor.');
      setComprobanteEstado('error');
    }
  };

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

  // TIENDA-LEGAL-1 — la casilla de términos es OBLIGATORIA en TODO camino de confirmación:
  // métodos manuales y pasarela-widget (`handleOrder`), pasarela API DIRECTA (`crearOrdenPasarela`,
  // la ÚNICA función que crea esa orden — cubre el botón "Pagar" de `FormularioTarjeta`/
  // `FormularioOtroMetodoPasarela` sin tocar esos dos archivos) y el escape de WhatsApp cuando no
  // hay método disponible. Sin marcarla, la acción real NO corre — el control resalta la casilla y
  // hace scroll hasta ella (§ el spec, "si no está marcada, el botón lleva a ella y la resalta,
  // como la maqueta"), nunca un botón deshabilitado mudo.
  const [aceptaTerminos, setAceptaTerminos] = useState(false);
  const [terminosResaltado, setTerminosResaltado] = useState(false);
  const resaltarCasillaTerminos = () => {
    setTerminosResaltado(true);
    const el = document.getElementById('casilla-terminos');
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    el?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
  };

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

  // § CHECKOUT-SELECTOR-NO-SE-DESMONTA-1: la razón que hacía desmontar el bloque "Método de
  // pago" al crear la orden ("el método ya no sería editable") quedó FALSA con
  // CHECKOUT-REINTENTO-OTRO-METODO-1: el botón "Intentar con otro método" (dentro de
  // `SelectorMetodoPasarela`, más abajo) SÍ deja al comprador volver a elegir método una vez que
  // la orden existe. El bloque se queda VISIBLE y se BLOQUEA (`disabled` + el mismo tratamiento
  // visual que los campos de `FormularioTarjeta`/`AceptacionesPasarela`) mientras dura el pago
  // de pasarela, en vez de desaparecer. Sólo puede ser `true` en el camino de pasarela API
  // DIRECTA: los métodos manuales y el widget de Wompi ya reemplazan la pantalla entera (el
  // `return` de arriba, o la rama `modoApiDirecta === false`) antes de llegar a este bloque.
  const bloqueoMetodoDePago = !!confirmation;

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
  // CHECKOUT-LISTO-PARA-VENDER-1: también escribe al CartContext (`setDepartamentoCarrito`), para
  // que el cajón del carrito —si el comprador vuelve a abrirlo— muestre el mismo departamento.
  const selectDepartamento = (value: string) => {
    setAddress((a) => ({ ...a, departamento: value }));
    setDepartamentoCarrito(value || null);
    if (!isBogotaDC(value)) {
      setSlot(null);
    }
  };

  // ── CHECKOUT-LISTO-PARA-VENDER-1 — VALIDACIÓN DEL PASO 1 (§ el spec del slice) ──────────
  //
  // «El botón nunca queda gris y mudo: sigue activo y, al tocarlo, lleva al primer dato que
  // falta.» Antes, "Continuar al pago" se DESHABILITABA con la condición entera y no decía
  // nada — un botón apagado es una pregunta sin respuesta (misma doctrina que ya rige el resto
  // del panel, § Principio rector del admin, aplicada acá del lado del storefront).
  //
  // `tocados` marca qué campo ya perdió el foco una vez (§ "el error se muestra al salir del
  // campo"); `intentoEnviar` fuerza TODOS los errores a la vista de una vez cuando el
  // comprador intenta avanzar sin completar algo — el resumen de arriba y el salto al primer
  // campo faltante dependen de esa misma bandera.
  const [tocados, setTocados] = useState<Record<string, boolean>>({});
  const [intentoEnviar, setIntentoEnviar] = useState(false);
  const marcarTocado = (campo: string) => setTocados((t) => ({ ...t, [campo]: true }));

  const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(info.email.trim());

  // El ORDEN es el orden VISUAL del formulario (§ refero-compra.md §3: correo → celular →
  // nombre → apellido → departamento → ciudad → dirección) — el mismo que usa "saltar al
  // primer campo que falta": saltar a un campo que no es el primero en pantalla confundiría
  // más de lo que ayuda.
  const CAMPOS_PASO1: { id: string; invalido: boolean; mensaje: string }[] = [
    { id: 'campo-email', invalido: info.email.trim() === '' || !emailValido, mensaje: 'Ingresa un correo válido.' },
    { id: 'campo-telefono', invalido: !phoneValid, mensaje: 'Ingresa un celular colombiano de 10 dígitos.' },
    { id: 'campo-nombre', invalido: info.nombre.trim() === '', mensaje: 'Ingresa tu nombre.' },
    { id: 'campo-apellido', invalido: info.apellido.trim() === '', mensaje: 'Ingresa tu apellido.' },
    { id: 'campo-departamento', invalido: address.departamento === '', mensaje: 'Selecciona tu departamento.' },
    { id: 'campo-ciudad', invalido: address.ciudad.trim() === '', mensaje: 'Ingresa tu ciudad.' },
    { id: 'campo-direccion', invalido: address.linea1.trim() === '', mensaje: 'Ingresa tu dirección.' },
    { id: 'campo-franja', invalido: isBogota && !slot, mensaje: 'Elige una franja horaria.' },
  ];
  const camposInvalidosPaso1 = CAMPOS_PASO1.filter((c) => c.invalido);

  const intentarContinuar = () => {
    const primero = camposInvalidosPaso1[0];
    if (!primero) {
      setStep(1);
      return;
    }
    setIntentoEnviar(true);
    const el = document.getElementById(primero.id);
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    el?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
    el?.focus();
  };

  // El error de UN campo se muestra si se tocó (perdió el foco) O si ya se intentó enviar —
  // nunca antes: pintar de rojo un formulario recién abierto le echaría en cara algo que
  // todavía no se hizo mal (regla ya fijada para el resto del panel, aplicada acá).
  const errorVisible = (campoId: string, mensaje: string): string | undefined => {
    const c = CAMPOS_PASO1.find((x) => x.id === campoId);
    if (!c?.invalido) return undefined;
    return (tocados[campoId] || intentoEnviar) ? mensaje : undefined;
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

    // TIENDA-LEGAL-1 — sin aceptar, la orden no se crea: resalta la casilla y vuelve.
    if (!aceptaTerminos) { resaltarCasillaTerminos(); return; }

    // La rama de pago se decide ACÁ, antes de tocar `loading`, para que TypeScript narrowee
    // `metodoActivo` a no-nulo dentro de la rama que lo usa (§ WOMPI-WIDGET-EN-EL-CANONICO-1): el
    // guard de arriba sólo prueba la DISYUNCIÓN, no cada rama por separado.
    let payment: CheckoutPayload['payment'];
    if (pasarelaSeleccionada) {
      payment = { pasarela: true };
    } else if (metodoActivo) {
      // `CheckoutPayload.payment.metodo` acepta el mismo set cerrado que `metodoActivo`, sin cast.
      // SIN `referencia`: el campo de texto que la llevaba se retiró (§ CHECKOUT-COMPROBANTE-
      // CLIENTE-1, arriba) — el comprobante se sube APARTE, después de crear la orden.
      payment = { metodo: metodoActivo };
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
      registrarCodigoComprobante(result);
      // El comprobante, si el comprador elegió uno, se sube DESPUÉS — contra la orden
      // que el servidor acaba de confirmar, nunca antes (§ `intentarSubirComprobante`).
      // Sólo aplica a los métodos manuales que lo aceptan; la pasarela nunca muestra
      // este campo, así que `comprobanteFile` queda `null` en esa rama.
      if (comprobanteFile && !pasarelaSeleccionada && metodoActivo && aceptaComprobanteCliente(metodoActivo)) {
        await intentarSubirComprobante(result.numero_orden);
      }
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
    // TIENDA-LEGAL-1 — sin aceptar, ni la pasarela API DIRECTA crea su orden.
    if (!aceptaTerminos) { resaltarCasillaTerminos(); return null; }
    setSinStockIds([]);
    try {
      const result = await createOrder(payloadDesdeFormulario({ pasarela: true }));
      setConfirmation(result);
      clearCart();
      registrarCodigoComprobante(result);
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
    // CHECKOUT-LISTO-PARA-VENDER-1 — LA PÁGINA DE ESTADO ÚNICA (§ `EstadoPedido.tsx`, § el
    // spec del slice): esta pantalla ("¡Pedido recibido!"/"¡Tu pago fue aprobado!") y las
    // cinco vistas de `RetornoCliente.tsx` comparten AHORA la misma plantilla y la misma
    // fuente de texto (`lib/checkout/estado-pedido.ts`), para que no puedan divergir sobre el
    // mismo hecho. `metodoParaEstado` es `null` en los dos desvíos de pasarela fallida
    // (`pasarelaMetodoNoHabilitado`/`intentosAgotados`): el método elegido era la pasarela,
    // que ya falló, así que lo que sigue es la confirmación humana GENÉRICA, no la frase de
    // un método manual que el comprador nunca elegió.
    const metodoParaEstado: MetodoPedido = pasarelaAprobada
      ? 'wompi'
      : (pasarelaSeleccionada ? null : metodoActivo);
    return (
        <div className={`min-h-[80vh] flex items-center justify-center ${offsetClase} px-4`}>
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
            <EstadoPedido
              estado={pasarelaAprobada ? 'aprobado' : 'manual'}
              metodo={metodoParaEstado}
              numeroOrden={confirmation.numero_orden}
              correo={info.email}
              nombre={info.nombre}
              resumen={{
                items: confirmation.items.map((item) => ({
                  nombre: item.producto_nombre,
                  cantidad: item.cantidad,
                  subtotal: item.subtotal,
                  molienda: item.moliendaSeleccionada,
                })),
                subtotal: confirmation.subtotal,
                envio: confirmation.costo_envio,
                total: confirmation.total,
                metodoEnvioLabel: confirmation.metodo_envio
                  ? `${getShippingMethod(confirmation.metodo_envio)?.label ?? confirmation.metodo_envio}${findSlotLabel(confirmation.franja) ? ` · ${findSlotLabel(confirmation.franja)}` : ''}`
                  : null,
                direccionDetalle: confirmation.direccion_detalle,
              }}
              acciones={[
                { label: 'Rastrear mi pedido', variante: 'primaria', href: `/rastrear-pedido?orden=${encodeURIComponent(confirmation.numero_orden)}&email=${encodeURIComponent(info.email)}` },
                ...(tieneWhatsapp ? [{ label: 'Escríbenos por WhatsApp', variante: 'whatsapp' as const, externo: true, href: whatsappUrl(settings.whatsapp, `Hola, quiero consultar mi pedido ${confirmation.numero_orden}`) }] : []),
                { label: 'Seguir comprando', variante: 'secundaria', href: '/tienda' },
              ]}
            >
              {/* § CHECKOUT-COMPROBANTE-CLIENTE-1: el comprobante se sube DESPUÉS de crear la
                  orden (arriba, en `handleOrder`). Si eso falla, la orden NO se pierde ni se
                  duplica — queda exactamente como la pantalla de estado la muestra, y este
                  bloque es la única diferencia: dice que falta la foto y ofrece reintentar con
                  el MISMO archivo, sin tocar nada más del pedido ya confirmado. */}
              {comprobanteEstado === 'subiendo' && (
                <div className="bg-[var(--sf-superficie)] rounded-xl p-3 mb-4 text-xs text-[var(--sf-sobre-superficie,var(--sf-texto-suave))] text-center">
                  Subiendo tu comprobante…
                </div>
              )}
              {comprobanteEstado === 'error' && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 mb-4 text-left">
                  <p className="text-xs font-medium text-red-700">
                    Tu pedido quedó registrado, pero no pudimos subir el comprobante.
                  </p>
                  {comprobanteErrorSubida && (
                    <p className="text-xs text-red-600 mt-0.5">{comprobanteErrorSubida}</p>
                  )}
                  <button
                    type="button"
                    onClick={() => intentarSubirComprobante(confirmation.numero_orden)}
                    className="mt-2 text-xs font-semibold text-red-700 underline hover:no-underline"
                  >
                    Reintentar subir el comprobante
                  </button>
                </div>
              )}
            </EstadoPedido>
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
        <div className={`min-h-[60vh] flex items-center justify-center ${offsetClase}`}>
          <div className="text-center">
            <p className="text-xl font-playfair mb-4">Tu carrito está vacío</p>
            {/* § CHECKOUT-VACIO-A-TIENDA-1: el enlace promete "productos" — su destino es el
                catálogo (/tienda), no la home. Antes apuntaba a "/", que no muestra productos. */}
            <Link href="/tienda" className="text-[var(--sf-acento-texto)] underline text-sm">← Explorar productos</Link>
          </div>
        </div>
    );
  }

  // ── CHECKOUT-LISTO-PARA-VENDER-1 — LA BARRA DE TOTAL FIJA (§ el spec del slice) ─────────
  //
  // Verbo (step 0: siempre "Continuar al pago"; step 1: el verbo del MÉTODO — "Pagar con
  // Wompi", "Enviar por WhatsApp", "Confirmar pedido") y a qué dispara el botón. `null` =
  // sin botón: la acción real vive en un control que YA está en pantalla (ver el comentario
  // junto al JSX de la barra, más abajo).
  const sinMetodoYsinPasarela = availablePayments.length === 0 && !pasarelaOfrecida;
  const metodoParaVerboBarra: MetodoPedido = pasarelaSeleccionada
    ? 'wompi'
    : sinMetodoYsinPasarela
      ? (tieneWhatsapp ? 'whatsapp' : null)
      : metodoActivo;
  const verboBarraFija = step === 0 ? 'Continuar al pago' : verboCTACompra(metodoParaVerboBarra);
  const accionBarraFija: (() => void) | null =
    step === 0
      ? intentarContinuar
      : confirmation // la pasarela ya está en curso: el botón real es el de Wompi/el formulario
        ? null
      : (pasarelaSeleccionada && modoApiDirecta) // `SelectorMetodoPasarela` ya tiene su "Pagar"
        ? null
      : sinMetodoYsinPasarela
        // TIENDA-LEGAL-1 — también antes de abrir WhatsApp: sin aceptar, resalta la casilla en vez
        // de abrir la conversación.
        ? (tieneWhatsapp ? () => {
            if (!aceptaTerminos) { resaltarCasillaTerminos(); return; }
            window.open(whatsappUrl(settings.whatsapp, `Hola, quiero coordinar el pago de mi pedido por ${formatCOP(montoAPagar)}.`), '_blank');
          } : null)
      : handleOrder;

  // El resumen plegable de arriba (§ el spec, sólo celular — ver el JSX): mismo total que la
  // barra fija; la cuenta de productos cambia de fuente según haya o no una orden ya creada.
  const totalItemsResumen = confirmation
    ? confirmation.items.reduce((sum, i) => sum + i.cantidad, 0)
    : items.reduce((sum, i) => sum + i.quantity, 0);

  // § COMPRA-FIDELIDAD-4 — «FALTA: …» del bloque oscuro de «Tu pedido» (§ el spec, punto 2;
  // `fraseFalta`, `lib/checkout/composiciones-compra.ts`, pura). QUÉ falta reusa el MISMO estado
  // ya validado por `CAMPOS_PASO1`/`aceptaTerminos` — nombre y apellido se COMBINAN en una sola
  // etiqueta (medido en `onix-entrega.png`: el bloque plegado ya los junta en "NOMBRE Y
  // APELLIDO"), orden visual del formulario. Nunca se calcula dos veces lo que ya decide si el
  // botón de paso 1 avanza: `camposInvalidosPaso1` es la fuente, esto sólo la REDACTA distinto.
  const faltantesEntrega: string[] = [
    (info.email.trim() === '' || !emailValido) ? 'correo' : null,
    !phoneValid ? 'celular / whatsapp' : null,
    (info.nombre.trim() === '' || info.apellido.trim() === '') ? 'nombre y apellido' : null,
    address.departamento === '' ? 'departamento' : null,
    address.ciudad.trim() === '' ? 'ciudad' : null,
    address.linea1.trim() === '' ? 'dirección' : null,
    (isBogota && !slot) ? 'franja horaria' : null,
  ].filter((x): x is string => x !== null);
  // Paso 2: el método sólo falta de verdad en el caso límite ya guardado (`!pasarelaSeleccionada
  // && !metodoActivo`, § `handleOrder` arriba) — `metodoActivo` cae al primero disponible, así
  // que en el camino normal siempre hay uno elegido.
  const faltantesPago: string[] = [
    (!pasarelaSeleccionada && !metodoActivo) ? 'el método de pago' : null,
    !aceptaTerminos ? 'aceptar los términos' : null,
  ].filter((x): x is string => x !== null);
  const textoFaltaColumna = fraseFalta(step === 0 ? faltantesEntrega : faltantesPago);

  // La línea de envío del bloque oscuro y de la fila de «Envío» (§ el spec, punto 2: "Envío a
  // Bogotá D.C." / "Se calcula con tu departamento" — medido en `cham-1440-entrega-vacia.png` y
  // `onix-entrega.png`). Usa `address.departamento`, que sigue disponible aunque la orden ya se
  // haya creado (el form no se desmonta al confirmar).
  const envioLineaColumna = address.departamento
    ? `Envío a ${address.departamento} incluido`
    : 'Se calcula con tu departamento';

  // § COMPRA-FIDELIDAD-5 — el RÓTULO de «Subtotal»/«Envío a …» en la columna «Tu pedido» (§ el
  // spec, punto 1: "en tinta y no en el color de acento… Onix: «SUBTOTAL» y «ENVÍO A …» en versal
  // chica"). Onix (`ficha`) lo pinta en versal con tracking, como el resto de sus encabezados de
  // grupo (`"Contacto"`, línea ~1051); Las Chamisas/común se quedan en frase normal — las DOS en
  // `--chk-tinta-suave`, nunca `--sf-texto-suave` (deriva del acento, § el docstring de
  // `--chk-tinta-suave` abajo). El VALOR de cada fila va en `--sf-tinta` directo en el JSX —no
  // necesita este helper, es un solo token sin variante por composición.
  const etiquetaResumenClase = pasos === 'ficha'
    ? 'text-[10px] uppercase tracking-[0.12em] text-[var(--chk-tinta-suave)]'
    : 'text-[var(--chk-tinta-suave)]';

  // § COMPRA-FIDELIDAD-5 — el botón de Onix en VERSAL con tracking (§ el spec, punto 3; medido en
  // `.scratch/checkout-rediseno/maqueta.html`, `onix-1440-pago-nequi.png`/`onix-390-entrega-llena.png`:
  // "CONTINUAR AL PAGO"/"CONFIRMAR PEDIDO", siempre mayúsculas). Las Chamisas/común se quedan en
  // frase normal ("Confirmar pedido"). Es presentación CSS (`uppercase`), no reescribe
  // `verboBarraFija`/`verboCTACompra` — el texto sigue siendo el mismo, sólo cambia cómo se pinta,
  // igual que "Contacto"→"CONTACTO" ya hace en el resto de `ficha`. Compartido por los DOS botones
  // que reusan `accionBarraFija`/`verboBarraFija` (el bloque de escritorio y la barra fija de
  // celular) — nunca una tercera definición de "cómo se ve el CTA".
  const botonCTAClaseExtra = pasos === 'ficha' ? 'uppercase tracking-[0.08em]' : '';

  // § COMPRA-FIDELIDAD-4 — DOS roles de color que el checkout necesita y que la paleta compartida
  // (`lib/config/palette-derive.ts`, fuera de `touches:`) no ofrece tal cual:
  //   · `--chk-tinta-suave`: un gris/tinta SUAVE DE VERDAD. `--sf-texto-suave` deriva del ACENTO
  //     (`RECETA['texto-suave'] = {a:'acento', b:'tinta', w:0.12}` → 88% acento + 12% tinta), así
  //     que con un acento rojo (Onix, acento medido `#a70004`) cada rótulo/ayuda del formulario
  //     salía CASI del mismo rojo que «Continuar al pago» — medido por ejecución contra
  //     `.scratch/compra-fidelidad/app/onix-1440-entrega-vacia.png` (COMPRA-FIDELIDAD-3): "CONTACTO",
  //     "CORREO ELECTRÓNICO", las ayudas, todo en ese rojo. Acá se deriva de TINTA + FONDO, sin
  //     pasar por el acento — por construcción no puede coincidir con el botón, en NINGÚN tema.
  //   · `--chk-error`: su propio tono, distinto del acento aunque el acento sea rojo (Onix) — un
  //     `color-mix` que nunca lee `--sf-acento`. El rojo semilla (`#dc2626`) es el que este
  //     checkout YA usaba para errores antes de esta tanda (Tailwind `red-600`), no un hex sacado
  //     de la maqueta; mezclarlo con la tinta del tema es lo que lo vuelve "a partir de la
  //     paleta" en vez de un literal Tailwind suelto repetido en cada borde/ícono/texto de error.
  // Las dos se definen UNA vez acá, en la raíz de este árbol, y se heredan por cascada de CSS a
  // todo descendiente — incluido `CampoFlotante.tsx` (su único consumidor), que las usa por
  // nombre sin redefinirlas.
  const estiloRaizCheckout = {
    '--chk-tinta-suave': 'color-mix(in oklab, var(--sf-tinta) 62%, var(--sf-fondo) 38%)',
    '--chk-error': 'color-mix(in oklab, #dc2626 82%, var(--sf-tinta) 18%)',
  } as CSSProperties;

  return (
      <div className={`${offsetClase} min-h-screen bg-[var(--sf-fondo)]`} style={estiloRaizCheckout}>
        {/* `pb-28`: deja sitio para la barra de total fija EN CELULAR (§ más abajo, gateada a
            <820px — § COMPRA-FIDELIDAD-4, cifra de decisión). A ≥820px la barra no existe —el
            botón real vive en el bloque oscuro de la columna «Tu pedido»— así que ahí el padding
            extra es inocuo pero innecesario; se retira con `min-[820px]:pb-8`. */}
        <div className={`${contenedorClase} mx-auto py-8 pb-28 min-[820px]:pb-8`}>
          {/* § COMPRA-FIDELIDAD-4 — "Pago seguro · Volver al carrito" reemplaza al "← Checkout" de
              siempre, como pide la maqueta. La navegación REAL de la tienda (StoreNav) ya vive en
              el layout compartido y NO se esconde acá —tocar `app/(storefront)/layout.tsx` está
              fuera de `touches:`—, así que esta línea se agrega ARRIBA del paso en vez de
              reemplazar la nav, tal como el spec pide cuando esconderla no es una opción. */}
          <div className="flex items-center justify-between gap-3 mb-6 text-xs text-[var(--chk-tinta-suave)]">
            <span className="inline-flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" aria-hidden="true" /> Pago seguro
            </span>
            <Link href="/tienda" className="font-medium text-[var(--sf-tinta)] underline hover:no-underline">
              Volver al carrito
            </Link>
          </div>

          {/* Steps — § COMPRA-FIDELIDAD-3, el TRATAMIENTO por línea (§ refero.md §3: "Los pasos
              se titulan «01 ENTREGA / 02 PAGO» en serif mayúscula sobre un filete. El paso hecho
              queda en gris con «EDITAR»" — Onix; "El progreso lo marca el tejido" — Las
              Chamisas). La mecánica (qué paso está activo/hecho) es la misma en los tres; sólo
              cambia la FORMA.
              § COMPRA-FIDELIDAD-4 — EL MARCO DEL PASO gana DOS piezas que la maqueta pide y la
              tanda anterior no tenía: el INDICADOR con su affordance propia por línea (Onix:
              casillas CUADRADAS, medido en `onix-entrega.png`/`onix-pago.png` — "1"/"2"/"✓" dentro
              de un cuadrado; Las Chamisas: CÍRCULOS con ✓, medido en `cham-1440-entrega-vacia.png`/
              `cham-1440-pago.png` — "①"/"②"/"✓" dentro de un círculo) y el TÍTULO GRANDE del paso
              (`STEP_TITLE`, serif). La franja de progreso tejida de Las Chamisas y el sticker
              «Entrega lista» NO se tocan —ya estaban correctos (§ el spec, "están")—, sólo se les
              agregan los círculos arriba y el título debajo. */}
          {pasos === 'ficha' ? (
            <div className="mb-8">
              <div className="flex items-center gap-3 pb-3 border-b border-[var(--sf-linea)] overflow-x-auto">
                {STEP_LABELS.map((s, i) => (
                  <div key={s} className="flex items-center gap-2 shrink-0">
                    <span
                      aria-hidden="true"
                      className={`flex h-5 w-5 items-center justify-center border text-[10px] font-bold ${
                        i < step
                          ? 'border-[var(--sf-tinta)] bg-[var(--sf-tinta)] text-[var(--sf-fondo)]'
                          : i === step
                            ? 'border-[var(--sf-tinta)] text-[var(--sf-tinta)]'
                            : 'border-[var(--chk-tinta-suave)] text-[var(--chk-tinta-suave)]'
                      }`}
                    >
                      {i < step ? <Check className="h-3 w-3" strokeWidth={3} /> : i + 1}
                    </span>
                    <span className={`font-playfair text-xs uppercase tracking-[0.14em] ${i === step ? 'font-semibold text-[var(--sf-tinta)]' : 'text-[var(--chk-tinta-suave)]'}`}>
                      {s}{i < step && <span className="ml-1.5 underline">· EDITAR</span>}
                    </span>
                    {i < STEP_LABELS.length - 1 && <span className="h-px w-10 bg-[var(--sf-linea)]" aria-hidden="true" />}
                  </div>
                ))}
              </div>
              <h2 className="font-playfair text-3xl uppercase tracking-wide text-[var(--sf-tinta)] mt-4">{STEP_TITLE[step]}</h2>
            </div>
          ) : pasos === 'tejido' ? (
            <div className="mb-8">
              <div className="flex items-center gap-3 flex-wrap">
                {STEP_LABELS.map((s, i) => (
                  <div key={s} className="flex items-center gap-2 shrink-0">
                    <span
                      aria-hidden="true"
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                        i < step
                          ? 'bg-emerald-600 text-white'
                          : i === step
                            ? 'bg-[var(--sf-tinta)] text-[var(--sf-fondo)]'
                            : 'border border-[var(--chk-tinta-suave)] text-[var(--chk-tinta-suave)]'
                      }`}
                    >
                      {i < step ? '✓' : i + 1}
                    </span>
                    <span className={`text-sm ${i === step ? 'font-semibold text-[var(--sf-tinta)]' : 'text-[var(--chk-tinta-suave)]'}`}>{s}</span>
                    {i < STEP_LABELS.length - 1 && <span className="h-px w-8 bg-[var(--sf-linea)]" aria-hidden="true" />}
                  </div>
                ))}
                {step === 1 && (
                  <span className="inline-block -rotate-3 rounded-md bg-[var(--sf-acento)] px-2.5 py-1 text-[11px] font-bold text-[var(--sf-acento-txt)] shadow-sm">
                    Entrega lista
                  </span>
                )}
              </div>
              <h2 className="font-playfair text-3xl text-[var(--sf-tinta)] mt-3 mb-2">{STEP_TITLE[step]}</h2>
              <div className="h-2 w-full rounded-full bg-[var(--sf-linea)] overflow-hidden" role="progressbar" aria-valuenow={step === 0 ? 50 : 100} aria-valuemin={0} aria-valuemax={100}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: step === 0 ? '50%' : '100%',
                    backgroundImage: 'repeating-linear-gradient(45deg, var(--sf-acento) 0, var(--sf-acento) 6px, var(--sf-tostado-4,var(--sf-acento-4)) 6px, var(--sf-tostado-4,var(--sf-acento-4)) 12px)',
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="mb-8">
              <div className="flex items-center gap-2 overflow-x-auto pb-2">
                {STEP_LABELS.map((s, i) => (
                  <div key={s} className="flex items-center gap-2 shrink-0">
                    <div className={`flex items-center gap-2 ${i === step ? 'text-[var(--sf-acento-texto)]' : i < step ? 'text-emerald-600' : 'text-[var(--chk-tinta-suave)]'}`}>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i === step ? 'bg-[var(--sf-acento)] text-[var(--sf-acento-txt)]' : i < step ? 'bg-emerald-600 text-white' : 'bg-[var(--sf-linea)] text-[var(--chk-tinta-suave)]'}`}>
                        {i < step ? '✓' : i + 1}
                      </div>
                      <span className="text-sm font-medium">{s}</span>
                    </div>
                    {i < STEP_LABELS.length - 1 && <div className="w-8 h-px bg-[var(--sf-linea)] mx-1" />}
                  </div>
                ))}
              </div>
              <h2 className="font-playfair text-3xl text-[var(--sf-tinta)] mt-3">{STEP_TITLE[step]}</h2>
            </div>
          )}

          {/* CHECKOUT-LISTO-PARA-VENDER-1 — «Tu pedido · n productos · $total ▾», SIEMPRE
              arriba (§ el spec, § refero-compra.md §3). Sólo en celular (`lg:hidden`): en
              escritorio el resumen ya está fijo en la columna de la derecha, mostrarlo dos
              veces sería redundante. */}
          <div className="lg:hidden mb-4">
            <button
              type="button"
              onClick={() => setResumenAbierto((v) => !v)}
              className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl bg-[var(--sf-superficie)] text-sm text-[var(--sf-texto)]"
              aria-expanded={resumenAbierto}
            >
              <span className="truncate">
                Tu pedido · {totalItemsResumen} producto{totalItemsResumen === 1 ? '' : 's'} · {formatCOP(montoAPagar)}
              </span>
              <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${resumenAbierto ? 'rotate-180' : ''}`} />
            </button>
            {resumenAbierto && (
              <div className="mt-2 rounded-xl bg-[var(--sf-superficie)] p-4 space-y-2">
                {(confirmation ? confirmation.items : items).map((item, i) => {
                  const esConfirmado = 'producto_nombre' in item;
                  const nombre = esConfirmado ? item.producto_nombre : item.nombre;
                  const cantidad = esConfirmado ? item.cantidad : item.quantity;
                  const monto = esConfirmado ? item.subtotal : item.precio * item.quantity;
                  const key = esConfirmado ? `${nombre}-${i}` : item.key;
                  return (
                    <div key={key} className="flex justify-between text-xs text-[var(--sf-texto)]">
                      <span className="min-w-0 truncate pr-2">{nombre} × {cantidad}</span>
                      <span className="shrink-0 font-medium">{formatCOP(monto)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* § COMPRA-FIDELIDAD-4 — el grid pasa de `lg:` (1024px) a `min-[820px]:` — la cifra de
              decisión de esta tanda, la misma que ya usa `Spotlight.tsx` (§ el docstring de
              cabecera) — para que el momento en que la columna «Tu pedido» aparece COINCIDA con
              el momento en que la barra fija desaparece (más abajo). Con dos breakpoints
              distintos (1024 para el grid, 820 para la barra) habría una franja 820–1023px sin
              NINGÚN total visible. */}
          <div className="grid grid-cols-1 min-[820px]:grid-cols-3 gap-8">
            {/* Form */}
            <div className="min-[820px]:col-span-2">
              {/* § COMPRA-FIDELIDAD-3 — la caja del formulario adopta el tratamiento de línea:
                  `ficha` (Onix) la aplana (sin radio, un filete arriba, como una ficha de
                  ledger); `tejido` (Las Chamisas) la deja en papel con borde punteado. */}
              <div className={
                pasos === 'ficha'
                  ? 'bg-[var(--sf-tarjeta)] rounded-none border-t-2 border-[var(--sf-linea)] p-6'
                  : pasos === 'tejido'
                    ? 'bg-[var(--sf-tarjeta)] rounded-2xl border-2 border-dashed border-[var(--sf-linea)] p-6'
                    : 'bg-[var(--sf-tarjeta)] rounded-2xl sf-borde border-[var(--sf-linea)] p-6'
              }>
                {/* CHECKOUT-STEP-SIN-TRANSICION-1: el cambio entre step===0 y step===1 usa la
                    misma gramática de AnimatePresence + motion.div que el resto de CORTE (fade +
                    desplazamiento vertical de 8px, 200ms), en vez de un `{cond && (<div>…)}`
                    plano que cambiaba de golpe. */}
                <AnimatePresence mode="wait">
                {/* Step 0: Info */}
                {step === 0 && (
                  <motion.div key="step-0" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="space-y-4">
                    {/* CHECKOUT-LISTO-PARA-VENDER-1 — el resumen de errores, arriba de TODO el
                        formulario (§ el spec: "el error se muestra al salir del campo, más un
                        resumen arriba al enviar"). Sólo aparece tras un intento de avanzar con
                        algo incompleto — nunca antes. */}
                    {intentoEnviar && camposInvalidosPaso1.length > 0 && (
                      <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-[var(--chk-error)]">
                        <p className="font-medium mb-1">Revisa estos datos antes de continuar:</p>
                        <ul className="list-disc pl-4 space-y-0.5">
                          {camposInvalidosPaso1.map((c) => (
                            <li key={c.id}>
                              <button type="button" onClick={() => { document.getElementById(c.id)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); document.getElementById(c.id)?.focus(); }} className="underline hover:no-underline">
                                {c.mensaje}
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {/* § COMPRA-FIDELIDAD-3 — "Contacto"/"Envío" son los nombres de grupo de la
                        maqueta (`.gtit`), comunes a las dos líneas; sólo su FORMA cambia por
                        composición (micro-etiqueta versal en `ficha`, encabezado serif en
                        `tejido`). Los campos pasan a `CampoFlotante` (rótulo flotante,
                        validación al salir del campo) — la MISMA regla de `errorVisible` que ya
                        regía `Field`, nada cambia en CUÁNDO se muestra un error. */}
                    <p className={pasos === 'ficha' ? 'text-xs uppercase tracking-[0.18em] text-[var(--chk-tinta-suave)] font-semibold mb-3' : pasos === 'tejido' ? 'font-playfair text-lg text-[var(--sf-tinta)] mb-3' : 'font-semibold text-[var(--sf-tinta)] mb-4'}>Contacto</p>
                    {/* CHECKOUT-LISTO-PARA-VENDER-1: orden reordenado a correo → celular → nombre
                        → apellido (§ refero-compra.md §3: "correo → celular/WhatsApp → nombre").
                        Departamento (ancho completo) → ciudad quedan más abajo, § el spec
                        "Departamento primero". */}
                    <div className="space-y-4">
                    <CampoFlotante
                      id="campo-email" label="Correo electrónico" value={info.email} tipo="email"
                      onChange={v => setInfo({ ...info, email: v })} onBlur={() => marcarTocado('campo-email')}
                      autoComplete="email" inputMode="email" linea={pasos}
                      valido={emailValido} ayuda="Te mandamos la confirmación del pedido aquí."
                      error={errorVisible('campo-email', 'Ingresa un correo válido.')}
                    />
                    <CampoFlotante
                      id="campo-telefono" label="Celular / WhatsApp" value={info.telefono} tipo="tel"
                      onChange={v => setInfo({ ...info, telefono: v })} onBlur={() => marcarTocado('campo-telefono')}
                      autoComplete="tel-national" inputMode="numeric" prefijo="+57" linea={pasos}
                      valido={phoneValid} ayuda="Te escribimos aquí sobre tu pedido. No enviamos publicidad."
                      error={errorVisible('campo-telefono', 'Ingresa un celular colombiano de 10 dígitos (ej. 3XX XXX XXXX).')}
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <CampoFlotante
                        id="campo-nombre" label="Nombre" value={info.nombre} onChange={v => setInfo({ ...info, nombre: v })}
                        onBlur={() => marcarTocado('campo-nombre')} autoComplete="given-name" linea={pasos}
                        error={errorVisible('campo-nombre', 'Ingresa tu nombre.')}
                      />
                      <CampoFlotante
                        id="campo-apellido" label="Apellido" value={info.apellido} onChange={v => setInfo({ ...info, apellido: v })}
                        onBlur={() => marcarTocado('campo-apellido')} autoComplete="family-name" linea={pasos}
                        error={errorVisible('campo-apellido', 'Ingresa tu apellido.')}
                      />
                    </div>
                    </div>
                    <div className="space-y-4 mt-6">
                    <p className={pasos === 'ficha' ? 'text-xs uppercase tracking-[0.18em] text-[var(--chk-tinta-suave)] font-semibold mb-3' : pasos === 'tejido' ? 'font-playfair text-lg text-[var(--sf-tinta)] mb-3' : 'font-semibold text-[var(--sf-tinta)] mb-4'}>Envío</p>
                    <CampoFlotante
                      id="campo-departamento" label="Departamento" tipo="select" value={address.departamento}
                      onChange={selectDepartamento} onBlur={() => marcarTocado('campo-departamento')}
                      autoComplete="address-level1" linea={pasos}
                      // § COMPRA-FIDELIDAD-3 — la opción vacía lleva TEXTO VISIBLE en blanco (§
                      // refero.md §2: "La primera opción va vacía, así el label se queda en
                      // reposo hasta que elijan"). Un texto como "Selecciona departamento" se
                      // dibuja DENTRO de la caja del `<select>` y choca con el rótulo flotante,
                      // que también descansa centrado mientras no hay valor — medido en la
                      // primera captura del arnés: las dos cadenas se superponían.
                      opciones={[{ value: '', label: '', disabled: true }, ...COLOMBIA_DEPARTMENTS.map(d => ({ value: d, label: d }))]}
                      error={errorVisible('campo-departamento', 'Selecciona tu departamento.')}
                    />
                    {/* § COMPRA-FIDELIDAD-4 — Ciudad y Dirección EN UNA FILA en escritorio (≥820px,
                        medido en `onix-entrega.png`/`cham-1440-entrega-vacia.png`: "CIUDAD O
                        MUNICIPIO" | "DIRECCIÓN" lado a lado); apiladas en celular, como siempre.
                        Nombre/Apellido NO se tocan acá — siguen siendo dos campos uno al lado del
                        otro (§ el spec, "la regla no cambia"), ya lo eran antes de este slice. */}
                    <div className="grid grid-cols-1 min-[820px]:grid-cols-2 gap-4">
                      <CampoFlotante
                        id="campo-ciudad" label="Ciudad" value={address.ciudad} onChange={v => setAddress({ ...address, ciudad: v })}
                        onBlur={() => marcarTocado('campo-ciudad')} autoComplete="address-level2" linea={pasos}
                        error={errorVisible('campo-ciudad', 'Ingresa tu ciudad.')}
                      />
                      <CampoFlotante
                        id="campo-direccion" label="Dirección" value={address.linea1} onChange={v => setAddress({ ...address, linea1: v })}
                        onBlur={() => marcarTocado('campo-direccion')} autoComplete="address-line1" linea={pasos}
                        error={errorVisible('campo-direccion', 'Ingresa tu dirección.')}
                      />
                    </div>
                    <CampoFlotante
                      id="campo-detalle" label="Apartamento, torre o indicaciones" value={address.detalle} onChange={v => setAddress({ ...address, detalle: v })}
                      autoComplete="address-line2" linea={pasos} tipo="textarea" maxLength={200} opcional
                    />
                    <div className="space-y-3 mt-4">
                      <p className="text-sm font-semibold text-[var(--sf-tinta)]">Método de envío</p>
                      {/* Method, price and franja are derived from departamento. */}
                      {!shippingMethod ? (
                        <p className="text-sm text-[var(--chk-tinta-suave)] p-4 rounded-xl border-2 border-dashed border-[var(--sf-linea)]">
                          Selecciona tu departamento para ver el método y el costo de envío.
                        </p>
                      ) : (
                        <div>
                          {/* CHECKOUT-LISTO-PARA-VENDER-1: la selección va en TINTA, no en el
                              acento del botón principal (§ el spec, "la selección… va en
                              tinta") — ya no se confunde con un error cuando el acento del
                              tema es rojo (Onix). */}
                          {/* § COMPRA-FIDELIDAD-3 — el tratamiento de la opción de envío sigue al
                              de los métodos de pago, § refero.md: barra a la izquierda en Onix,
                              pastel sólido en Las Chamisas.
                              § COMPRA-FIDELIDAD-4 — gana el RADIO relleno que la maqueta pinta
                              (`onix-entrega.png`: "⬤ Envío estándar a Bogotá D.C."): hay un único
                              método posible por departamento (determinista, sin elección real),
                              así que el bullet queda SIEMPRE marcado — no es un control, es la
                              misma afordancia visual que ya usan los métodos de pago, aplicada a
                              la única opción de envío que existe. */}
                          <div className={
                            pasos === 'ficha'
                              ? 'flex items-start gap-3 p-4 rounded-none border-l-[3px] border-y border-r border-[var(--sf-tinta)] bg-[var(--sf-fondo)]'
                              : pasos === 'tejido'
                                ? 'flex items-start gap-3 p-4 rounded-xl border-2 border-[var(--sf-tinta)] bg-emerald-50'
                                : 'flex items-start gap-3 p-4 rounded-xl border-2 border-[var(--sf-tinta)] bg-[var(--sf-tinta)]/5'
                          }>
                            <span aria-hidden="true" className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 border-[var(--sf-tinta)]">
                              <span className="h-1.5 w-1.5 rounded-full bg-[var(--sf-tinta)]" />
                            </span>
                            <div className="min-w-0 flex-1 flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <span className="block text-sm font-medium text-[var(--sf-tinta)]">{shippingMethod.label}</span>
                                <span className="block text-xs text-[var(--chk-tinta-suave)]">{shippingMethod.description}</span>
                              </div>
                              <span className="text-sm font-bold text-[var(--sf-tinta)] shrink-0">{shippingCost === 0 ? 'Gratis' : formatCOP(shippingCost!)}</span>
                            </div>
                          </div>
                          {/* Franja horaria — required for Bogotá D.C., framed as a preference.
                              § COMPRA-FIDELIDAD-4: "se queda debajo, con el mismo estilo" (§ el
                              spec, punto 6) — sin cambios de forma, sólo el error migra a
                              `--chk-error` (§ el docstring de cabecera). */}
                          {isBogota && shippingMethod.slots && (
                            <div id="campo-franja" tabIndex={-1} className="mt-3 ml-4 pl-4 border-l-2 border-[var(--sf-linea)] space-y-2">
                              <p className="text-xs font-semibold text-[var(--sf-texto)]">Franja horaria *</p>
                              {shippingMethod.slots.map(s => (
                                <label key={s.id} className={`flex items-center gap-3 p-3 sf-radio-lg sf-borde cursor-pointer transition-all ${slot === s.id ? 'border-[var(--sf-tinta)] bg-[var(--sf-tinta)]/5' : 'border-[var(--sf-linea)]'}`}>
                                  <input type="radio" name="slot" value={s.id} checked={slot === s.id} onChange={() => setSlot(s.id)} className="accent-[var(--sf-tinta)]" />
                                  <span className="text-sm text-[var(--sf-tinta)]">{s.label}</span>
                                </label>
                              ))}
                              {errorVisible('campo-franja', 'Elige una franja horaria.') && (
                                <p className="text-xs text-[var(--chk-error)]">Elige una franja horaria.</p>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    {/* CHECKOUT-LISTO-PARA-VENDER-1: el botón "Continuar al pago" de este paso
                        VIVE AHORA en la barra de total fija (§ más abajo, `accionBarraFija`) —
                        ahí nunca se deshabilita mudo, y es el único CTA del paso, sin un
                        segundo botón inline compitiendo por la misma acción. */}
                  </div>
                  </motion.div>
                )}

                {/* Step 1: Shipping */}
                

                {/* Step 2: Payment */}
                {step === 1 && (
                  <motion.div key="step-1" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="space-y-4">
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
                        {/* PALETA-MIGRAR-TEXTO-SOBRE-SUPERFICIE-1, y el número de orden (fallback
                            `--sf-acento-texto`) migrado en PALETA-MIGRAR-ACENTO-TINTA-1
                            (§ PALETA-ACENTO-TINTA-SOBRE-SUPERFICIE-1, DECISIONS.md). */}
                        <div className="bg-[var(--sf-superficie)] rounded-2xl p-5 mb-6 text-left">
                          <p className="text-xs text-[var(--sf-sobre-superficie-suave,var(--sf-texto-suave))] mb-1 text-center">Número de orden</p>
                          <p className="text-2xl font-bold text-[var(--sf-sobre-superficie,var(--sf-acento-texto))] text-center">{confirmation.numero_orden}</p>
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
                    {/* § CHECKOUT-SELECTOR-NO-SE-DESMONTA-1: este bloque YA NO SE DESMONTA al
                        crear la orden. Antes lo hacía porque "el método elegido ya no sería
                        editable una vez creada la orden" — esa premisa quedó FALSA con
                        CHECKOUT-REINTENTO-OTRO-METODO-1 (una hora antes, en este mismo
                        programa): el botón "Intentar con otro método" de `SelectorMetodoPasarela`
                        (más abajo) SÍ deja al comprador volver a elegir. Se queda VISIBLE y se
                        BLOQUEA (`bloqueoMetodoDePago`, arriba) con el mismo tratamiento que los
                        campos de `FormularioTarjeta`/`AceptacionesPasarela` — nunca desaparece. */}
                    {/* § COMPRA-FIDELIDAD-3 — el BLOQUE PLEGADO DE ENTREGA (§ refero.md §3: "Entrega
                        se pliega en un bloque de 3 líneas con «Editar»… como Aesop y Saint
                        Laurent"). Es la mejora de base: aparece en las TRES composiciones; sólo el
                        texto del botón de vuelta cambia por línea ("EDITAR" versal en `ficha`). */}
                    <div className={
                      pasos === 'ficha'
                        ? 'mb-5 flex items-start justify-between gap-3 border-y border-[var(--sf-linea)] py-3 text-sm'
                        : 'mb-5 flex items-start justify-between gap-3 rounded-xl bg-[var(--sf-superficie)] p-4 text-sm'
                    }>
                      {/* § COMPRA-FIDELIDAD-5 — las líneas de este bloque dejan `--sf-sobre-superficie(-
                          suave)` (§ el spec, punto 1): ese par resuelve `mezclar(acento,tinta,0.34/0.12)`
                          para un cliente de raíces CUSTOM (Onix/Las Chamisas) — tan acento-derivado como
                          `--sf-texto`/`-suave`, así que su FALLBACK nunca se alcanzaba y el bloque salía
                          rojo igual (medido en `onix-1440-pago-nequi.png`, pasada-2). `--sf-tinta`/
                          `--chk-tinta-suave` son neutros por construcción, legibles tanto sobre
                          `--sf-fondo` (`ficha`, sin superficie propia) como sobre `--sf-superficie`
                          (`tejido`/`comun`). */}
                      <div className="min-w-0 space-y-0.5 text-[var(--sf-tinta)]">
                        <p className="font-medium text-[var(--sf-tinta)]">{info.nombre} {info.apellido}</p>
                        <p className="text-xs text-[var(--chk-tinta-suave)]">{info.email} · +57 {info.telefono}</p>
                        <p className="text-xs text-[var(--chk-tinta-suave)]">
                          {address.linea1}{address.detalle ? `, ${address.detalle}` : ''}, {address.ciudad}, {address.departamento}
                        </p>
                        {shippingMethod && (
                          <p className="text-xs text-[var(--chk-tinta-suave)]">
                            {shippingMethod.label} · {shippingCost === 0 ? 'Gratis' : formatCOP(shippingCost!)}
                          </p>
                        )}
                      </div>
                      <button
                        type="button" onClick={() => setStep(0)}
                        className={`shrink-0 font-semibold text-[var(--sf-tinta)] underline hover:no-underline ${pasos === 'ficha' ? 'text-xs uppercase tracking-[0.1em]' : 'text-xs'}`}
                      >
                        {pasos === 'ficha' ? 'Editar' : 'Cambiar'}
                      </button>
                    </div>
                    <h2 className={pasos === 'ficha' ? 'text-xs uppercase tracking-[0.18em] text-[var(--chk-tinta-suave)] font-semibold mb-3' : pasos === 'tejido' ? 'font-playfair text-lg text-[var(--sf-tinta)] mb-3' : 'font-semibold text-[var(--sf-tinta)] mb-4'}>Método de pago</h2>
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
                      // PALETA-MIGRAR-TEXTO-SOBRE-SUPERFICIE-1
                      //
                      // CHECKOUT-LISTO-PARA-VENDER-1 — «Paso 2 siempre con salida por
                      // WhatsApp» (§ el spec del slice, § `refero-compra.md` §5 P0): la frase
                      // mencionaba WhatsApp sin dar ningún enlace (`paginas-pendientes.md`
                      // §2.1, Onix: "esa frase no es un enlace. El comprador tiene que ir a
                      // buscar el número al pie"). Ahora es un `<a href="wa.me/…">` real, con
                      // el pedido ya resumido en el mensaje.
                      <div className="bg-[var(--sf-superficie)] rounded-xl p-4 text-sm text-[var(--sf-sobre-superficie,var(--sf-texto))] space-y-2">
                        <p>
                          {tieneWhatsapp
                            ? 'No hay un método de pago disponible ahora mismo.'
                            : 'No podemos completar tu pedido en este momento. Vuelve a intentarlo más tarde.'}
                        </p>
                        {tieneWhatsapp && (
                          // TIENDA-LEGAL-1 — también antes de abrir WhatsApp acá: sin aceptar, el
                          // click resalta la casilla en vez de navegar.
                          <a
                            href={whatsappUrl(settings.whatsapp, `Hola, quiero coordinar el pago de mi pedido por ${formatCOP(montoAPagar)}.`)}
                            target="_blank" rel="noopener"
                            onClick={(e) => { if (!aceptaTerminos) { e.preventDefault(); resaltarCasillaTerminos(); } }}
                            className="inline-flex items-center gap-1.5 font-semibold text-[var(--sf-tinta)] underline hover:no-underline"
                          >
                            <MessageCircle className="w-4 h-4" /> Escríbenos por WhatsApp
                          </a>
                        )}
                      </div>
                    ) : (
                      <>
                        {/* § COMPRA-FIDELIDAD-3 — LOS MÉTODOS COMO UN `fieldset` CON RADIOS REALES,
                            UNO ABIERTO A LA VEZ (§ refero.md §3: "Los métodos son un fieldset con
                            input type=radio reales, así funcionan las flechas del teclado. Solo
                            uno abierto a la vez"). El panel que se abre bajo el método elegido es
                            NUEVO (antes el detalle —`cuentas`— estaba siempre a la vista); lo que
                            decide qué método está disponible y qué dice su `desc`/`cuentas` sigue
                            siendo `metodosDisponibles` (lib/checkout/metodos-pago.ts, intocado). */}
                        <fieldset className={pasos === 'ficha' ? 'border-y border-[var(--sf-linea)] divide-y divide-[var(--sf-linea)]' : 'space-y-3'}>
                          <legend className="sr-only">Método de pago</legend>
                          {availablePayments.map(opt => {
                            const elegido = !pasarelaSeleccionada && metodoActivo === opt.id;
                            // Lo único copiable es la instrucción de pago (nequi/daviplata/breb/
                            // transferencia) — `efectivo` no tiene nada que copiar.
                            const textosACopiar = opt.cuentas ?? (opt.id !== 'efectivo' ? [opt.desc] : []);
                            const filaClase = pasos === 'ficha'
                              ? `flex items-start gap-3 p-4 transition-all ${bloqueoMetodoDePago ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'} ${elegido ? 'border-l-[3px] border-[var(--sf-tinta)] bg-[var(--sf-fondo)] -ml-px' : 'border-l-[3px] border-transparent'}`
                              : pasos === 'tejido'
                                ? `flex items-start gap-3 p-4 rounded-2xl border-2 transition-all ${bloqueoMetodoDePago ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'} ${elegido ? 'border-[var(--sf-tinta)] bg-emerald-50' : 'border-[var(--sf-linea)]'}`
                                : `rounded-xl border-2 transition-all ${bloqueoMetodoDePago ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'} ${elegido ? 'border-[var(--sf-tinta)] bg-[var(--sf-tinta)]/5' : 'border-[var(--sf-linea)]'}`;
                            return (
                              <div key={opt.id} className={pasos === 'comun' ? filaClase : undefined}>
                                <label className={pasos === 'comun' ? 'flex items-start gap-3 p-4' : filaClase}>
                                  {/* CHECKOUT-LISTO-PARA-VENDER-1: selección en TINTA, no en el acento del
                                      botón principal (§ el spec: "la selección… va en tinta").
                                      § COMPRA-FIDELIDAD-4 — Onix usa CASILLA CUADRADA, no el radio
                                      redondo nativo (medido en `onix-pago.png`: los cinco métodos
                                      llevan un cuadrado, nunca un círculo). El input sigue siendo
                                      un `<input type=radio>` real —teclado, foco, grupo— sólo que
                                      se esconde visualmente (`sr-only`) y `IndicadorMetodoPago`
                                      pinta el cuadrado al lado. */}
                                  <input type="radio" name="payment" value={opt.id} checked={elegido} onChange={() => { setPayment(opt.id); setPasarelaSeleccionada(false); }} disabled={bloqueoMetodoDePago} className={pasos === 'ficha' ? 'sr-only' : 'mt-0.5 accent-[var(--sf-tinta)] disabled:pointer-events-none'} />
                                  {pasos === 'ficha' && <IndicadorMetodoPago elegido={elegido} />}
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm font-semibold text-[var(--sf-tinta)]">{opt.label}</p>
                                    <p className="text-xs text-[var(--chk-tinta-suave)]">{opt.desc}</p>
                                  </div>
                                </label>
                                {/* EL PANEL — `grid-template-rows: 0fr → 1fr` (refero.md §2/§3), sólo
                                    para el método elegido y sólo si hay algo copiable. */}
                                {textosACopiar.length > 0 && (
                                  <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${elegido ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                                    <div className="overflow-hidden">
                                      <div className="space-y-1.5 px-4 pb-4 pl-11">
                                        {textosACopiar.map((texto, i) => (
                                          <div key={i} className="flex items-center justify-between gap-3 rounded-lg bg-[var(--sf-superficie)] px-3 py-2">
                                            <span className="min-w-0 truncate text-xs text-[var(--sf-sobre-superficie,var(--sf-texto))]">{texto}</span>
                                            <BotonCopiar texto={texto} />
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
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
                            <label className={
                              pasos === 'ficha'
                                ? `flex items-start gap-3 p-4 transition-all ${bloqueoMetodoDePago ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'} border-l-[3px] ${pasarelaSeleccionada ? 'border-[var(--sf-tinta)] bg-[var(--sf-fondo)]' : 'border-transparent'}`
                                : pasos === 'tejido'
                                  ? `flex items-start gap-3 p-4 rounded-2xl border-2 transition-all ${bloqueoMetodoDePago ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'} ${pasarelaSeleccionada ? 'border-[var(--sf-tinta)] bg-emerald-50' : 'border-[var(--sf-linea)]'}`
                                  : `flex items-start gap-3 p-4 rounded-xl border-2 transition-all ${bloqueoMetodoDePago ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'} ${pasarelaSeleccionada ? 'border-[var(--sf-tinta)] bg-[var(--sf-tinta)]/5' : 'border-[var(--sf-linea)]'}`
                            }>
                              <input type="radio" name="payment" checked={pasarelaSeleccionada} onChange={() => setPasarelaSeleccionada(true)} disabled={bloqueoMetodoDePago} className={pasos === 'ficha' ? 'sr-only' : 'mt-0.5 accent-[var(--sf-tinta)] disabled:pointer-events-none'} />
                              {pasos === 'ficha' && <IndicadorMetodoPago elegido={pasarelaSeleccionada} />}
                              <div>
                                <p className="text-sm font-semibold text-[var(--sf-tinta)]">{ETIQUETA_PAGO_PASARELA}</p>
                                <p className="text-xs text-[var(--chk-tinta-suave)]">{subtituloPagoPasarela(bloquePasarela.metodosOtros)}</p>
                              </div>
                            </label>
                          )}
                        </fieldset>
                        {/* § CHECKOUT-COMPROBANTE-CLIENTE-1: reemplaza al viejo campo de texto
                            "Referencia de pago (opcional)" — el operador necesita la FOTO del
                            comprobante, no una cadena que `/api/checkout` validaba y después no
                            guardaba en ningún lado (medido). Opcional, sin decirlo con la palabra
                            "(opcional)" en la etiqueta — el spec del slice lo pide así; el hint de
                            abajo ya aclara que no bloquea nada. `aceptaComprobanteCliente` es la
                            MISMA lista que decide esto en el servidor (`lib/checkout/comprobante-
                            cliente.ts`), no un OR repetido de los cuatro ids a mano. */}
                        {!pasarelaSeleccionada && aceptaComprobanteCliente(metodoActivo) && (
                          <div>
                            {/* § COMPRA-FIDELIDAD-5 — el rótulo en tinta, no en `--sf-texto` (§ el spec,
                                punto 1; `--sf-texto` deriva 66% del acento, § el docstring de
                                `--chk-tinta-suave` abajo — medido rojo en `onix-1440-pago-nequi.png`).
                                Mismo tratamiento que "Método de envío" (línea ~1145). */}
                            <label className="block text-xs font-medium text-[var(--sf-tinta)] mb-1.5">Comprobante</label>
                            <input
                              ref={comprobanteInputRef}
                              type="file"
                              accept={ACCEPT_COMPROBANTE}
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                // Se limpia SIEMPRE: elegir el mismo archivo otra vez debe volver
                                // a disparar `change` (igual que `SelectorComprobante` del admin).
                                e.target.value = '';
                                if (f) elegirComprobante(f);
                              }}
                            />
                            {!comprobanteFile ? (
                              <button
                                type="button"
                                onClick={() => comprobanteInputRef.current?.click()}
                                disabled={bloqueoMetodoDePago}
                                className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-[var(--sf-linea)] rounded-xl text-sm text-[var(--chk-tinta-suave)] hover:border-[var(--sf-tinta)] hover:text-[var(--sf-texto)] transition-colors disabled:opacity-60 disabled:pointer-events-none"
                              >
                                <Paperclip className="w-4 h-4" /> Adjuntar comprobante
                              </button>
                            ) : (
                              <div className="flex items-center gap-3 p-3 border-2 border-[var(--sf-linea)] rounded-xl">
                                {esImagen(comprobanteFile.type) && comprobantePreviewUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={comprobantePreviewUrl} alt="Vista previa del comprobante" className="w-12 h-12 rounded-lg object-cover shrink-0" />
                                ) : (
                                  <span className="w-12 h-12 rounded-lg bg-[var(--sf-superficie)] flex items-center justify-center shrink-0">
                                    <FileText className="w-5 h-5 text-[var(--chk-tinta-suave)]" />
                                  </span>
                                )}
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-medium text-[var(--sf-tinta)] truncate">{comprobanteFile.name}</p>
                                  <p className="text-xs text-[var(--chk-tinta-suave)]">{formatearTamano(comprobanteFile.size)}</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={quitarComprobante}
                                  disabled={bloqueoMetodoDePago}
                                  className="p-1.5 rounded-lg hover:bg-[var(--sf-superficie)] text-[var(--chk-tinta-suave)] disabled:opacity-60 disabled:pointer-events-none shrink-0"
                                  aria-label="Quitar comprobante"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                            {comprobanteErrorSeleccion ? (
                              <p className="mt-1 text-xs text-[var(--chk-error)]">{comprobanteErrorSeleccion}</p>
                            ) : (
                              <p className="mt-1 text-xs text-[var(--chk-tinta-suave)]">Opcional — ayuda a confirmar tu pago más rápido.</p>
                            )}
                          </div>
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
                      // PALETA-MIGRAR-TEXTO-SOBRE-SUPERFICIE-1: sólo el TEXTO migra (§ el patrón es
                      // para lectura, no para color de ícono decorativo — el ícono se deja).
                      <div className="bg-[var(--sf-superficie)] rounded-xl p-4 flex items-start gap-2 text-xs text-[var(--sf-sobre-superficie,var(--sf-texto))]">
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
                    {/* TIENDA-LEGAL-1 — el bloque «Vendedor» (razón social, documento, ciudad,
                        enlaces) y la casilla obligatoria de aceptación, justo antes del botón de
                        confirmar (§ el spec, § la maqueta aprobada). Gateado por
                        `vendedorEstaCompleto`: sin esa configuración, no se renderiza nada acá —
                        nunca un dato inventado. Fuera de `{!confirmation}`, a propósito: se queda
                        visible mientras un pago de pasarela está en curso. */}
                    {vendedorEstaCompleto(vendedor) && (
                      <div className="bg-[var(--sf-superficie)] rounded-xl p-4 text-xs text-[var(--sf-sobre-superficie,var(--sf-texto))]">
                        <p className="font-semibold mb-0.5">Vendedor</p>
                        <p>{lineaVendedor(vendedor)}</p>
                        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                          <Link href="/legal/terminos-y-condiciones" className="underline hover:no-underline">Términos y condiciones</Link>
                          <Link href="/legal/tratamiento-de-datos" className="underline hover:no-underline">Tratamiento de datos</Link>
                          <Link href="/legal/envios-y-devoluciones" className="underline hover:no-underline">Cambios y devoluciones</Link>
                        </div>
                      </div>
                    )}
                    <div
                      id="casilla-terminos"
                      className={`rounded-xl p-3 transition-colors ${terminosResaltado ? 'ring-2 ring-[var(--chk-error)]' : ''}`}
                    >
                      <label className="flex items-start gap-2.5 text-xs text-[var(--sf-texto)] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={aceptaTerminos}
                          disabled={bloqueoMetodoDePago}
                          onChange={(e) => { setAceptaTerminos(e.target.checked); if (e.target.checked) setTerminosResaltado(false); }}
                          className="mt-0.5 accent-[var(--sf-tinta)] disabled:pointer-events-none"
                        />
                        <span>
                          Acepto los <Link href="/legal/terminos-y-condiciones" className="underline hover:no-underline">términos y condiciones</Link> y autorizo el{' '}
                          <Link href="/legal/tratamiento-de-datos" className="underline hover:no-underline">tratamiento de mis datos personales</Link>.
                        </span>
                      </label>
                      {terminosResaltado && (
                        <p className="mt-1 text-xs text-[var(--chk-error)]" role="alert">Marca esta casilla para continuar.</p>
                      )}
                    </div>
                    {!confirmation && (
                      pasarelaSeleccionada && modoApiDirecta ? (
                        // El botón "Pagar · $X" del formulario de arriba es el ÚNICO que
                        // confirma (§ CHECKOUT-UNA-SOLA-PANTALLA-1, "el único botón que
                        // confirma dice cuánto se paga") — acá sólo queda "Atrás".
                        <div className="flex gap-3">
                          <button onClick={() => setStep(0)} className="flex-1 sf-borde border-[var(--sf-linea)] text-[var(--sf-texto)] font-medium py-3.5 rounded-xl text-sm hover:bg-[var(--sf-superficie)] transition-colors">Atrás</button>
                        </div>
                      ) : (
                        // CHECKOUT-LISTO-PARA-VENDER-1: "Confirmar pedido" vive ahora en la
                        // barra de total fija (`accionBarraFija` → `handleOrder`, igual que
                        // acá) — un solo botón que confirma, visible siempre, no uno inline
                        // que además podía quedar fuera de la pantalla en celular.
                        <div className="flex gap-3">
                          <button onClick={() => setStep(0)} className="flex-1 sf-borde border-[var(--sf-linea)] text-[var(--sf-texto)] font-medium py-3.5 rounded-xl text-sm hover:bg-[var(--sf-superficie)] transition-colors">Atrás</button>
                        </div>
                      )
                    )}
                    </>
                    )}
                  </motion.div>
                )}
                </AnimatePresence>
              </div>
            </div>

            {/* § COMPRA-FIDELIDAD-4 — LA COLUMNA «TU PEDIDO» (§ el spec, punto 2; medido contra
                `onix-entrega.png`/`cham-1440-entrega-vacia.png`). SÓLO EN ESCRITORIO
                (`hidden min-[820px]:block`): en celular el mismo total y el mismo botón viven en
                la barra fija de abajo (§ más abajo) — las dos a la vez duplicarían el CTA. El
                resumen plegable de arriba (`resumenAbierto`, sin cambios de esta tanda seguía
                siendo correcto) sigue cubriendo el celular. */}
            <div className="hidden min-[820px]:block">
              <div className="sticky top-20 space-y-4">
                <div className="bg-[var(--sf-tarjeta)] rounded-2xl sf-borde border-[var(--sf-linea)] p-5">
                  <h3 className={pasos === 'ficha' ? 'text-xs uppercase tracking-[0.18em] text-[var(--sf-tinta)] font-semibold mb-4' : pasos === 'tejido' ? 'font-playfair text-lg text-[var(--sf-tinta)] mb-4' : 'font-semibold text-[var(--sf-tinta)] mb-4'}>Tu pedido</h3>
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
                      {/* § CHECKOUT-RESUMEN-PIERDE-LA-FOTO-1 + § COMPRA-FIDELIDAD-4: la miniatura
                          gana el GLOBO DE CANTIDAD (medido en `onix-entrega.png`: "①"/"②" sobre la
                          esquina de la foto) y la variante pasa a su propia línea debajo del
                          nombre, en vez de ir pegada con "×N". Sin peso disponible en
                          `CheckoutResultItem` (`services/checkout.service.ts`, fuera de
                          `touches:`) — sólo se muestra la molienda cuando existe; no se inventa un
                          dato que la orden confirmada no snapshotea. */}
                      <div className="space-y-3 mb-4">
                        {confirmation.items.map((item, i) => (
                          <div key={i} className="flex gap-3">
                            <div className="relative w-12 h-12 shrink-0">
                              <div className="w-12 h-12 sf-radio-lg overflow-hidden bg-[var(--sf-superficie)]">
                                <img src={imagenPortada(item.producto_imagen)} alt={item.producto_nombre} className="w-full h-full object-cover" />
                              </div>
                              <span aria-hidden="true" className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--sf-tinta)] text-[9px] font-bold text-[var(--sf-fondo)]">
                                {item.cantidad}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0 flex justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-[var(--sf-tinta)] truncate">{item.producto_nombre}</p>
                                {item.moliendaSeleccionada && (
                                  <p className="text-[11px] uppercase tracking-wide text-[var(--chk-tinta-suave)]">{item.moliendaSeleccionada}</p>
                                )}
                              </div>
                              <span className="shrink-0 text-xs font-medium text-[var(--sf-tinta)]">{formatCOP(item.subtotal)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="space-y-2 pt-3 sf-divisor-t border-[var(--sf-linea)] text-sm">
                        <div className="flex justify-between">
                          <span className={etiquetaResumenClase}>Subtotal</span><span className="text-[var(--sf-tinta)]">{formatCOP(confirmation.subtotal)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className={etiquetaResumenClase}>{address.departamento ? `Envío a ${address.departamento}` : 'Envío'}</span>
                          <span className={confirmation.costo_envio === 0 ? 'text-emerald-600' : 'text-[var(--sf-tinta)]'}>{confirmation.costo_envio === 0 ? 'Gratis' : formatCOP(confirmation.costo_envio)}</span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="space-y-3 mb-4">
                        {items.map(item => {
                          const sinStock = sinStockIds.includes(item.id);
                          const variante = [
                            typeof item.options?.molienda === 'string' ? item.options.molienda : null,
                            typeof item.peso_gramos === 'number' ? `${item.peso_gramos} g` : null,
                          ].filter((v): v is string => v !== null).join(' · ');
                          return (
                          <div key={item.key} className={`flex gap-3 ${sinStock ? 'sf-radio-lg -mx-1 px-1 ring-1 ring-[var(--chk-error)] bg-red-50/60' : ''}`}>
                            <div className="relative w-12 h-12 shrink-0">
                              <div className="w-12 h-12 sf-radio-lg overflow-hidden bg-[var(--sf-superficie)]">
                                <img src={imagenPortada(item.imagen)} alt={item.nombre} className="w-full h-full object-cover" />
                              </div>
                              <span aria-hidden="true" className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--sf-tinta)] text-[9px] font-bold text-[var(--sf-fondo)]">
                                {item.quantity}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0 flex justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-[var(--sf-tinta)] line-clamp-2">{item.nombre}</p>
                                {variante && (
                                  <p className="text-[11px] uppercase tracking-wide text-[var(--chk-tinta-suave)]">{variante}</p>
                                )}
                                {sinStock && (
                                  <p className="text-xs font-medium text-[var(--chk-error)] mt-0.5">Cantidad no disponible</p>
                                )}
                              </div>
                              <p className="shrink-0 text-xs font-bold text-[var(--sf-tinta)]">{formatCOP(item.precio * item.quantity)}</p>
                            </div>
                          </div>
                          );
                        })}
                      </div>
                      <div className="space-y-2 pt-3 sf-divisor-t border-[var(--sf-linea)] text-sm">
                        <div className="flex justify-between">
                          <span className={etiquetaResumenClase}>Subtotal</span><span className="text-[var(--sf-tinta)]">{formatCOP(subtotal)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className={etiquetaResumenClase}>{address.departamento ? `Envío a ${address.departamento}` : 'Envío'}</span>
                          {shippingCost === null
                            ? <span className="text-[var(--chk-tinta-suave)]">Se calcula con tu departamento</span>
                            : <span className={shippingCost === 0 ? 'text-emerald-600' : 'text-[var(--sf-tinta)]'}>{shippingCost === 0 ? 'Gratis' : formatCOP(shippingCost)}</span>}
                        </div>
                      </div>
                    </>
                  )}
                  {/* § COMPRA-FIDELIDAD-5 — Las Chamisas: el total vive DENTRO de la MISMA tarjeta
                      clara de «Tu pedido» (§ el spec, punto 2; medido en
                      `.scratch/compra-fidelidad/pasada-2/maqueta/cham-1440-pago-nequi.png`), no en un
                      bloque oscuro aparte — antes compartía la rama `else` con `comun` (el mismo
                      `rounded-2xl bg-[var(--sf-tinta)]` de Onix, sólo con la esquina redondeada). El
                      botón se oscurece ÉL MISMO (`bg-[var(--sf-tinta)]`) para seguir leyéndose como el
                      CTA, ya que la tarjeta ya no tiene fondo oscuro que lo resalte. */}
                  {pasos === 'tejido' && (
                    <div className="space-y-2.5 mt-4 pt-4 sf-divisor-t border-[var(--sf-linea)]">
                      <p className="font-playfair text-2xl font-bold text-[var(--sf-tinta)]">
                        Total {formatCOP(montoAPagar)}
                      </p>
                      <p className="text-xs text-[var(--chk-tinta-suave)]">{envioLineaColumna}</p>
                      {accionBarraFija && (
                        <button
                          onClick={accionBarraFija}
                          disabled={loading}
                          className="mt-1.5 w-full rounded-xl bg-[var(--sf-tinta)] hover:opacity-90 active:opacity-80 disabled:opacity-60 disabled:pointer-events-none py-3.5 text-sm font-bold text-[var(--sf-fondo)] transition-opacity"
                        >
                          {loading ? 'Procesando…' : verboBarraFija}
                        </button>
                      )}
                      <p className="text-center text-[11px] text-[var(--chk-tinta-suave)]">{textoFaltaColumna}</p>
                    </div>
                  )}
                </div>
                {/* § COMPRA-FIDELIDAD-4/5 — EL BLOQUE OSCURO DEL TOTAL, SÓLO PARA `ficha`/`comun`
                    (§ el spec, punto 2: "El bloque oscuro queda sólo para Onix" — `comun` no tiene
                    maqueta propia, § `pasada-2/README.md`, así que se deja con el tratamiento que ya
                    tenía). "Total $X" grande + "envío… incluido" + el botón ADENTRO + "Falta: …"/"Todo
                    listo para pagar" debajo. Reusa `accionBarraFija`/`verboBarraFija`/`loading` de la
                    barra fija de celular —NUNCA una segunda copia de esa lógica—; en escritorio ESTE
                    botón es el real, la barra de abajo no se renderiza (`min-[820px]:hidden`). Cuando
                    `accionBarraFija` es `null` (el widget de Wompi o `SelectorMetodoPasarela` ya
                    tienen su propio botón en pantalla) este bloque tampoco ofrece uno — mismo criterio
                    que la barra. */}
                {pasos !== 'tejido' && (
                <div className={pasos === 'ficha' ? 'rounded-none bg-[var(--sf-tinta)] p-5 text-[var(--sf-fondo)]' : 'rounded-2xl bg-[var(--sf-tinta)] p-5 text-[var(--sf-fondo)]'}>
                  <p className="text-2xl font-bold">
                    Total {formatCOP(montoAPagar)}
                  </p>
                  <p className="mt-0.5 text-xs opacity-70">{envioLineaColumna}</p>
                  {accionBarraFija && (
                    <button
                      onClick={accionBarraFija}
                      disabled={loading}
                      className={`mt-4 w-full rounded-xl bg-[var(--sf-acento)] hover:bg-[var(--sf-accion-hover,var(--sf-tostado-4))] active:bg-[var(--sf-accion-active,var(--sf-tostado-3))] disabled:opacity-60 disabled:pointer-events-none py-3.5 text-sm font-bold text-[var(--sf-acento-txt)] transition-colors ${botonCTAClaseExtra}`}
                    >
                      {loading ? 'Procesando…' : verboBarraFija}
                    </button>
                  )}
                  <p className="mt-2.5 text-center text-[11px] opacity-70">{textoFaltaColumna}</p>
                </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* CHECKOUT-LISTO-PARA-VENDER-1 — LA BARRA DE TOTAL FIJA (§ el spec del slice, §
            refero-compra.md §3): "Total $X · envío a [departamento] incluido" + el botón con
            el VERBO del método. El botón DESAPARECE (nunca se deshabilita mudo) cuando la
            acción real vive en un control ajeno que ya está en pantalla — el widget de Wompi
            inyectado por el proveedor, o el formulario propio de `SelectorMetodoPasarela` que
            valida sus propios campos antes de poder confirmar (§ CHECKOUT-UNA-SOLA-PANTALLA-1:
            "el único botón que confirma dice cuánto se paga" — duplicarlo acá sería un segundo
            botón compitiendo con ése).
            § COMPRA-FIDELIDAD-4 — SÓLO EN CELULAR (`min-[820px]:hidden`, § el spec, punto 3): en
            escritorio tapaba el formulario ("en TODOS los anchos", medido contra la maqueta, que
            la gatea a <820px); el botón real de escritorio vive ahora en el bloque oscuro de la
            columna «Tu pedido» (arriba), que reusa ESTE MISMO `accionBarraFija`/`verboBarraFija`
            — nunca una segunda definición de la acción. */}
        <div className="fixed bottom-0 inset-x-0 z-30 bg-[var(--sf-tarjeta)] sf-divisor-t border-[var(--sf-linea)] px-4 py-3 min-[820px]:hidden">
          <div className={`${contenedorClase} mx-auto flex items-center justify-between gap-4`}>
            <div className="min-w-0">
              <p className="text-xs text-[var(--chk-tinta-suave)] truncate">
                {address.departamento ? `Envío a ${address.departamento} incluido` : 'Envío por confirmar'}
              </p>
              <motion.p
                key={montoAPagar} initial={reduceMovimiento ? false : { opacity: 0.4 }} animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }} className="text-base font-bold text-[var(--sf-tinta)]"
              >
                Total {formatCOP(montoAPagar)}
              </motion.p>
            </div>
            {accionBarraFija && (
              <button
                onClick={accionBarraFija}
                disabled={loading}
                className={`shrink-0 bg-[var(--sf-acento)] hover:bg-[var(--sf-accion-hover,var(--sf-tostado-4))] active:bg-[var(--sf-accion-active,var(--sf-tostado-3))] disabled:opacity-60 disabled:pointer-events-none text-[var(--sf-acento-txt)] font-bold px-5 py-3 rounded-xl text-sm transition-colors ${botonCTAClaseExtra}`}
              >
                {loading ? 'Procesando…' : verboBarraFija}
              </button>
            )}
          </div>
        </div>
      </div>
  );
}

// § COMPRA-FIDELIDAD-3 — `Field` (y su `FieldProps`) SE RETIRARON: todo llamador migró a
// `CampoFlotante` (§ `components/storefront/checkout/CampoFlotante.tsx`, el rótulo flotante de
// refero.md §2). Un componente sin un solo consumidor es la misma mina inerte de siempre
// (§ CLAUDE.md, `Customer.activo`/`Product.agotado`) — se borra, no se deja ambiguo.

// § COMPRA-FIDELIDAD-4 — LA CASILLA CUADRADA de los métodos de pago de Onix (§ el spec, punto 5;
// medido en `onix-pago.png`: los cinco métodos llevan un cuadrado con "✓" cuando están elegidos,
// nunca el círculo del radio nativo). Puramente VISUAL — el `<input type=radio>` real sigue
// montado al lado (`sr-only`), así que teclado/foco/grupo de radios no cambian; esto sólo pinta.
function IndicadorMetodoPago({ elegido }: { elegido: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center border ${
        elegido ? 'border-[var(--sf-tinta)] bg-[var(--sf-tinta)]' : 'border-[var(--chk-tinta-suave)]'
      }`}
    >
      {elegido && <Check className="h-3 w-3 text-[var(--sf-fondo)]" strokeWidth={3} />}
    </span>
  );
}

// EL BOTÓN «COPIAR» (§ refero.md §2/§3, "«Copiar»… pasa a «Copiado ✓» por 2 segundos, con
// `aria-live`"). Copia el TEXTO que el método ya muestra (`opt.desc`/cada línea de `opt.cuentas`,
// `lib/checkout/metodos-pago.ts`) — esa función es la ruta del dinero y queda intocada por este
// slice: no hay un valor "en bruto" (sólo el número, sólo el banco) separado de la frase que ya se
// ve, así que lo que se copia es la frase completa. DESVIACIÓN MEDIDA contra la maqueta (que copia
// cada campo —banco/número/titular— por separado): `MetodoCheckout.desc`/`cuentas` sólo exponen
// una línea combinada por cuenta; separarla en campos propios tocaría `metodos-pago.ts`, fuera de
// `touches:` de este slice.
function BotonCopiar({ texto }: { texto: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <button
      type="button"
      onClick={async (e) => {
        e.preventDefault();
        try { await navigator.clipboard.writeText(texto); } catch { /* best-effort: no hay fallback decente sin permiso */ }
        setCopiado(true);
        setTimeout(() => setCopiado(false), 2000);
      }}
      aria-live="polite"
      className={`shrink-0 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${copiado ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-[var(--sf-linea)] text-[var(--sf-texto)] hover:bg-[var(--sf-tarjeta)]'}`}
    >
      {copiado ? 'Copiado ✓' : 'Copiar'}
    </button>
  );
}