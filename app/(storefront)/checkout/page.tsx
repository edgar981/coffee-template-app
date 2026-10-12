"use client";
import { useState, useEffect, useRef } from 'react';
import Link from "next/link";
import { imagenPortada } from "@/lib/producto-imagen";
import { ArrowLeft, Lock, CreditCard, Clock, Paperclip, FileText, X, ChevronDown, MessageCircle } from 'lucide-react';
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
import { contenidoEstadoPedido, verboBotonPago, type MetodoPedido } from '@/lib/checkout/estado-pedido';
import EstadoPedido from '@/components/storefront/checkout/EstadoPedido';

const STEPS = ['Información', 'Pago'];

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
  const { navTratamiento } = useSiteContent();
  const contenedorClase = contenedorAnchoClase(navTratamiento.posicion);
  // EL RELLENO SUPERIOR (§ NAV-INTERNAS-CLARO-Y-OFFSET-1) — ver el docstring de `navOffsetClase`
  // (`lib/config/themes.ts`). `false` (todo tenant salvo CORTE) = `pt-16`, byte a byte.
  const offsetClase = navOffsetClase(navTratamiento.posicion);

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
  const verboBarraFija = step === 0 ? 'Continuar al pago' : verboBotonPago(metodoParaVerboBarra);
  const accionBarraFija: (() => void) | null =
    step === 0
      ? intentarContinuar
      : confirmation // la pasarela ya está en curso: el botón real es el de Wompi/el formulario
        ? null
      : (pasarelaSeleccionada && modoApiDirecta) // `SelectorMetodoPasarela` ya tiene su "Pagar"
        ? null
      : sinMetodoYsinPasarela
        ? (tieneWhatsapp ? () => window.open(whatsappUrl(settings.whatsapp, `Hola, quiero coordinar el pago de mi pedido por ${formatCOP(montoAPagar)}.`), '_blank') : null)
      : handleOrder;

  // El resumen plegable de arriba (§ el spec, sólo celular — ver el JSX): mismo total que la
  // barra fija; la cuenta de productos cambia de fuente según haya o no una orden ya creada.
  const totalItemsResumen = confirmation
    ? confirmation.items.reduce((sum, i) => sum + i.cantidad, 0)
    : items.reduce((sum, i) => sum + i.quantity, 0);

  return (
      <div className={`${offsetClase} min-h-screen bg-[var(--sf-fondo)]`}>
        {/* `pb-28`: deja sitio para la barra de total fija (§ abajo), para que no tape el
            último campo/botón del formulario. */}
        <div className={`${contenedorClase} mx-auto py-8 pb-28`}>
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

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Form */}
            <div className="lg:col-span-2">
              <div className="bg-[var(--sf-tarjeta)] rounded-2xl sf-borde border-[var(--sf-linea)] p-6">
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
                      <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
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
                    <h2 className="font-semibold text-[var(--sf-tinta)] mb-4">Información de contacto</h2>
                    {/* CHECKOUT-LISTO-PARA-VENDER-1: orden reordenado a correo → celular → nombre
                        → apellido (§ refero-compra.md §3: "correo → celular/WhatsApp → nombre").
                        Departamento (ancho completo) → ciudad quedan más abajo, § el spec
                        "Departamento primero". */}
                    <Field
                      id="campo-email" label="Correo electrónico *" type="email" value={info.email}
                      onChange={v => setInfo({ ...info, email: v })} onBlur={() => marcarTocado('campo-email')}
                      autoComplete="email" inputMode="email"
                      error={errorVisible('campo-email', 'Ingresa un correo válido.')}
                    />
                    <div>
                      <label htmlFor="campo-telefono" className="block text-xs font-medium text-[var(--sf-texto)] mb-1.5">Teléfono / WhatsApp *</label>
                      <div className="flex items-stretch">
                        {/* PALETA-MIGRAR-TEXTO-SOBRE-SUPERFICIE-1 */}
                        <span className="inline-flex items-center px-3 rounded-l-xl sf-borde-t sf-borde-b sf-borde-l border-[var(--sf-linea)] bg-[var(--sf-superficie)] text-base font-medium text-[var(--sf-sobre-superficie,var(--sf-texto))] select-none">+57</span>
                        <input
                          id="campo-telefono" name="campo-telefono" type="tel" inputMode="numeric" autoComplete="tel-national" value={info.telefono}
                          onChange={e => setInfo({ ...info, telefono: e.target.value })} onBlur={() => marcarTocado('campo-telefono')} placeholder="300 000 0000"
                          aria-invalid={!phoneValid ? true : undefined}
                          className={`w-full h-12 px-4 bg-[var(--sf-fondo)] sf-borde ${errorVisible('campo-telefono', 'x') ? 'border-red-400' : 'border-[var(--sf-linea)]'} rounded-r-xl text-base text-[var(--sf-tinta)] focus:outline-none focus:ring-2 focus:ring-[var(--sf-tinta)]/20 focus:border-[var(--sf-tinta)]`}
                        />
                      </div>
                      {errorVisible('campo-telefono', 'Ingresa un celular colombiano de 10 dígitos (ej. 3XX XXX XXXX).') && (
                        <p className="mt-1 text-xs text-red-600">Ingresa un celular colombiano de 10 dígitos (ej. 3XX XXX XXXX).</p>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <Field
                        id="campo-nombre" label="Nombre *" value={info.nombre} onChange={v => setInfo({ ...info, nombre: v })}
                        onBlur={() => marcarTocado('campo-nombre')} autoComplete="given-name"
                        error={errorVisible('campo-nombre', 'Ingresa tu nombre.')}
                      />
                      <Field
                        id="campo-apellido" label="Apellido *" value={info.apellido} onChange={v => setInfo({ ...info, apellido: v })}
                        onBlur={() => marcarTocado('campo-apellido')} autoComplete="family-name"
                        error={errorVisible('campo-apellido', 'Ingresa tu apellido.')}
                      />
                    </div>
                    <div className="space-y-4">
                    <h2 className="font-semibold text-[var(--sf-tinta)] mb-4">Dirección de entrega</h2>
                    <div>
                      <label htmlFor="campo-departamento" className="block text-xs font-medium text-[var(--sf-texto)] mb-1.5">Departamento *</label>
                      <select
                        id="campo-departamento" name="campo-departamento" autoComplete="address-level1"
                        value={address.departamento} onChange={e => selectDepartamento(e.target.value)} onBlur={() => marcarTocado('campo-departamento')}
                        aria-invalid={address.departamento === '' ? true : undefined}
                        className={`w-full h-12 px-4 bg-[var(--sf-fondo)] sf-borde ${errorVisible('campo-departamento', 'x') ? 'border-red-400' : 'border-[var(--sf-linea)]'} rounded-xl text-base text-[var(--sf-tinta)] focus:outline-none focus:ring-2 focus:ring-[var(--sf-tinta)]/20 focus:border-[var(--sf-tinta)]`}
                      >
                        <option value="" disabled>Selecciona departamento</option>
                        {COLOMBIA_DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                      {errorVisible('campo-departamento', 'Selecciona tu departamento.') && (
                        <p className="mt-1 text-xs text-red-600">Selecciona tu departamento.</p>
                      )}
                    </div>
                    <Field
                      id="campo-ciudad" label="Ciudad *" value={address.ciudad} onChange={v => setAddress({ ...address, ciudad: v })}
                      onBlur={() => marcarTocado('campo-ciudad')} autoComplete="address-level2"
                      error={errorVisible('campo-ciudad', 'Ingresa tu ciudad.')}
                    />
                    <Field
                      id="campo-direccion" label="Dirección *" value={address.linea1} onChange={v => setAddress({ ...address, linea1: v })}
                      onBlur={() => marcarTocado('campo-direccion')} autoComplete="address-line1" placeholder="Calle, Carrera, número"
                      error={errorVisible('campo-direccion', 'Ingresa tu dirección.')}
                    />
                    <Field
                      id="campo-detalle" label="Detalles adicionales (opcional)" value={address.detalle} onChange={v => setAddress({ ...address, detalle: v })}
                      autoComplete="address-line2" placeholder="Apto, torre, interior, indicaciones de entrega."
                    />
                    <div className="space-y-3 mt-4">
                      <p className="text-sm font-semibold text-[var(--sf-tinta)]">Método de envío</p>
                      {/* Method, price and franja are derived from departamento. */}
                      {!shippingMethod ? (
                        <p className="text-sm text-[var(--sf-texto-suave)] p-4 rounded-xl border-2 border-dashed border-[var(--sf-linea)]">
                          Selecciona tu departamento para ver el método y el costo de envío.
                        </p>
                      ) : (
                        <div>
                          {/* CHECKOUT-LISTO-PARA-VENDER-1: la selección va en TINTA, no en el
                              acento del botón principal (§ el spec, "la selección… va en
                              tinta") — ya no se confunde con un error cuando el acento del
                              tema es rojo (Onix). */}
                          <div className="flex items-center justify-between p-4 rounded-xl border-2 border-[var(--sf-tinta)] bg-[var(--sf-tinta)]/5">
                            <div>
                              <span className="block text-sm font-medium text-[var(--sf-tinta)]">{shippingMethod.label}</span>
                              <span className="block text-xs text-[var(--sf-texto-suave)]">{shippingMethod.description}</span>
                            </div>
                            <span className="text-sm font-bold text-[var(--sf-tinta)] shrink-0">{shippingCost === 0 ? 'Gratis' : formatCOP(shippingCost!)}</span>
                          </div>
                          {/* Franja horaria — required for Bogotá D.C., framed as a preference */}
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
                                <p className="text-xs text-red-600">Elige una franja horaria.</p>
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
                          <a
                            href={whatsappUrl(settings.whatsapp, `Hola, quiero coordinar el pago de mi pedido por ${formatCOP(montoAPagar)}.`)}
                            target="_blank" rel="noopener"
                            className="inline-flex items-center gap-1.5 font-semibold text-[var(--sf-tinta)] underline hover:no-underline"
                          >
                            <MessageCircle className="w-4 h-4" /> Escríbenos por WhatsApp
                          </a>
                        )}
                      </div>
                    ) : (
                      <>
                        <div className="space-y-3">
                          {availablePayments.map(opt => (
                            <label key={opt.id} className={`flex items-start gap-3 p-4 rounded-xl border-2 transition-all ${bloqueoMetodoDePago ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'} ${!pasarelaSeleccionada && metodoActivo === opt.id ? 'border-[var(--sf-tinta)] bg-[var(--sf-tinta)]/5' : 'border-[var(--sf-linea)]'}`}>
                              {/* CHECKOUT-LISTO-PARA-VENDER-1: selección en TINTA, no en el acento del
                                  botón principal (§ el spec: "la selección… va en tinta"). */}
                              <input type="radio" name="payment" value={opt.id} checked={!pasarelaSeleccionada && metodoActivo === opt.id} onChange={() => { setPayment(opt.id); setPasarelaSeleccionada(false); }} disabled={bloqueoMetodoDePago} className="mt-0.5 accent-[var(--sf-tinta)] disabled:pointer-events-none" />
                              <div>
                                <p className="text-sm font-semibold text-[var(--sf-tinta)]">{opt.label}</p>
                                <p className="text-xs text-[var(--sf-texto-suave)]">{opt.desc}</p>
                                {/* Transferencia con VARIAS cuentas (§ PAGOS-VARIAS-CUENTAS-1): la
                                    misma opción ÚNICA, con una línea por cuenta — `opt.cuentas`
                                    sólo existe con 2+ cuentas completas, así que con una sola
                                    cuenta esta rama no renderiza nada y el checkout queda
                                    byte-idéntico a como se veía antes de esta tanda. */}
                                {opt.cuentas && (
                                  <ul className="mt-1 space-y-0.5 list-disc pl-4">
                                    {opt.cuentas.map((cuenta, i) => (
                                      <li key={i} className="text-xs text-[var(--sf-texto-suave)]">{cuenta}</li>
                                    ))}
                                  </ul>
                                )}
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
                            <label className={`flex items-start gap-3 p-4 rounded-xl border-2 transition-all ${bloqueoMetodoDePago ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'} ${pasarelaSeleccionada ? 'border-[var(--sf-tinta)] bg-[var(--sf-tinta)]/5' : 'border-[var(--sf-linea)]'}`}>
                              <input type="radio" name="payment" checked={pasarelaSeleccionada} onChange={() => setPasarelaSeleccionada(true)} disabled={bloqueoMetodoDePago} className="mt-0.5 accent-[var(--sf-tinta)] disabled:pointer-events-none" />
                              <div>
                                <p className="text-sm font-semibold text-[var(--sf-tinta)]">{ETIQUETA_PAGO_PASARELA}</p>
                                <p className="text-xs text-[var(--sf-texto-suave)]">{subtituloPagoPasarela(bloquePasarela.metodosOtros)}</p>
                              </div>
                            </label>
                          )}
                        </div>
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
                            <label className="block text-xs font-medium text-[var(--sf-texto)] mb-1.5">Comprobante</label>
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
                                className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-[var(--sf-linea)] rounded-xl text-sm text-[var(--sf-texto-suave)] hover:border-[var(--sf-tinta)] hover:text-[var(--sf-texto)] transition-colors disabled:opacity-60 disabled:pointer-events-none"
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
                                    <FileText className="w-5 h-5 text-[var(--sf-texto-suave)]" />
                                  </span>
                                )}
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-medium text-[var(--sf-tinta)] truncate">{comprobanteFile.name}</p>
                                  <p className="text-xs text-[var(--sf-texto-suave)]">{formatearTamano(comprobanteFile.size)}</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={quitarComprobante}
                                  disabled={bloqueoMetodoDePago}
                                  className="p-1.5 rounded-lg hover:bg-[var(--sf-superficie)] text-[var(--sf-texto-suave)] disabled:opacity-60 disabled:pointer-events-none shrink-0"
                                  aria-label="Quitar comprobante"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                            {comprobanteErrorSeleccion ? (
                              <p className="mt-1 text-xs text-red-600">{comprobanteErrorSeleccion}</p>
                            ) : (
                              <p className="mt-1 text-xs text-[var(--sf-texto-suave)]">Opcional — ayuda a confirmar tu pago más rápido.</p>
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
                    {/* TIENDA-LEGAL-1 — van ACÁ, antes del botón de confirmar: la CASILLA
                        obligatoria de aceptación de términos/tratamiento de datos, y el
                        bloque «Vendedor» (razón social, documento, ciudad, enlaces). No se
                        inventan datos: sin esa configuración, este slice no renderiza nada
                        en su lugar. */}
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
                    {/* § CHECKOUT-RESUMEN-PIERDE-LA-FOTO-1: la miniatura vuelve, con el MISMO
                        tratamiento que la rama del carrito de abajo (mismo tamaño, misma forma,
                        misma posición) — copiado, no reinventado. `imagenPortada` cae al
                        placeholder de marca si `producto_imagen` viene vacía (producto sin foto,
                        o una orden anterior a este slice, que nace sin instantánea): la línea
                        sigue dibujándose, nunca una imagen rota. */}
                    <div className="space-y-3 mb-4">
                      {confirmation.items.map((item, i) => (
                        <div key={i} className="flex gap-3">
                          <div className="w-12 h-12 sf-radio-lg overflow-hidden bg-[var(--sf-superficie)] shrink-0">
                            <img src={imagenPortada(item.producto_imagen)} alt={item.producto_nombre} className="w-full h-full object-cover" />
                          </div>
                          <div className="flex-1 min-w-0 flex justify-between text-xs text-[var(--sf-texto)]">
                            <span className="min-w-0 truncate pr-2">
                              {item.producto_nombre}
                              {item.moliendaSeleccionada ? ` · ${item.moliendaSeleccionada}` : ''} × {item.cantidad}
                            </span>
                            <span className="shrink-0 font-medium">{formatCOP(item.subtotal)}</span>
                          </div>
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
              </div>
            </div>
          </div>
        </div>

        {/* CHECKOUT-LISTO-PARA-VENDER-1 — LA BARRA DE TOTAL FIJA (§ el spec del slice, §
            refero-compra.md §3): "Total $X · envío a [departamento] incluido" + el botón con
            el VERBO del método, en LOS DOS pasos, en escritorio y en celular. El botón
            DESAPARECE (nunca se deshabilita mudo) cuando la acción real vive en un control
            ajeno que ya está en pantalla — el widget de Wompi inyectado por el proveedor, o el
            formulario propio de `SelectorMetodoPasarela` que valida sus propios campos antes
            de poder confirmar (§ CHECKOUT-UNA-SOLA-PANTALLA-1: "el único botón que confirma
            dice cuánto se paga" — duplicarlo acá sería un segundo botón compitiendo con ése). */}
        <div className="fixed bottom-0 inset-x-0 z-30 bg-[var(--sf-tarjeta)] sf-divisor-t border-[var(--sf-linea)] px-4 py-3">
          <div className={`${contenedorClase} mx-auto flex items-center justify-between gap-4`}>
            <div className="min-w-0">
              <p className="text-xs text-[var(--sf-texto-suave)] truncate">
                {address.departamento ? `Envío a ${address.departamento} incluido` : 'Envío por confirmar'}
              </p>
              <p className="text-base font-bold text-[var(--sf-tinta)]">Total {formatCOP(montoAPagar)}</p>
            </div>
            {accionBarraFija && (
              <button
                onClick={accionBarraFija}
                disabled={loading}
                className="shrink-0 bg-[var(--sf-acento)] hover:bg-[var(--sf-accion-hover,var(--sf-tostado-4))] active:bg-[var(--sf-accion-active,var(--sf-tostado-3))] disabled:opacity-60 disabled:pointer-events-none text-[var(--sf-acento-txt)] font-bold px-5 py-3 rounded-xl text-sm transition-colors"
              >
                {loading ? 'Procesando…' : verboBarraFija}
              </button>
            )}
          </div>
        </div>
      </div>
  );
}

interface FieldProps {
  /** El `id` ESTABLE del campo — lo usa `intentarContinuar` (más arriba) para enfocar/saltar
   *  al primer campo que falta (§ CHECKOUT-LISTO-PARA-VENDER-1), y `<label htmlFor>` para
   *  asociar la etiqueta (§ `paginas-pendientes.md` §2.1: "las etiquetas no están asociadas a
   *  sus campos" — antes `Field` no tenía `id`, así que no había nada que asociar). */
  id: string;

  label: string;

  value: string;

  onChange: (value: string) => void;

  onBlur?: () => void;

  type?: string;

  placeholder?: string;

  /** `autoComplete`/`inputMode` del navegador (§ el spec del slice y §
   *  `paginas-pendientes.md` §2.1: "los campos no tienen autoComplete ni name… ni el
   *  autollenado del navegador ni el de Google llenan nombre, correo, teléfono ni dirección"). */
  autoComplete?: string;

  inputMode?: 'text' | 'tel' | 'email' | 'numeric' | 'decimal' | 'search' | 'url' | 'none';

  /** El mensaje de error a mostrar, o `undefined` si el campo está bien (o si todavía no toca
   *  mostrarlo — esa decisión la toma el llamador, vía `errorVisible`). */
  error?: string;
}

// § CHECKOUT-COMPROBANTE-CLIENTE-1: `disabled` se RETIRÓ de acá — su único motivo
// (bloquear "Referencia de pago" en su lugar mientras la orden ya existe, §
// CHECKOUT-SELECTOR-NO-SE-DESMONTA-1) desapareció con ese campo: ningún llamador
// de `Field` lo pasaba. Un prop sin un solo consumidor es la misma mina inerte de
// siempre (§ CLAUDE.md, `Customer.activo`/`Product.agotado`) — se borra, no se deja
// ambiguo. El picker de comprobante que reemplazó al campo bloquea los SUYOS
// (el input de archivo, el botón de quitar) directamente con `bloqueoMetodoDePago`.
//
// CHECKOUT-LISTO-PARA-VENDER-1 — 16px de texto (`text-base`, no `text-sm`/14px: § "iOS hace
// zoom al enfocar cualquier campo de menos de 16px", medido en `paginas-pendientes.md` §2.1)
// y 48px de alto (`h-12`). El foco va en TINTA (`--sf-tinta`), no en el acento del botón
// principal (§ el spec: "el color del botón principal sólo en ese botón; la selección y el
// foco van en tinta") — antes el mismo `--sf-acento` del botón "Confirmar pedido" pintaba
// también el aro de foco de CADA campo, lo que hacía parecer que un campo activo era un error
// (`paginas-pendientes.md` §2.1: "Ciudad con borde rojo" bajo Onix, donde el acento es rojo).
function Field({ id, label, value, onChange, onBlur, type = 'text', placeholder, autoComplete, inputMode, error }: FieldProps) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-[var(--sf-texto)] mb-1.5">{label}</label>
      <input
        id={id} name={id} type={type} value={value} onChange={e => onChange(e.target.value)} onBlur={onBlur}
        placeholder={placeholder} autoComplete={autoComplete} inputMode={inputMode}
        aria-invalid={error ? true : undefined}
        className={`w-full h-12 px-4 bg-[var(--sf-fondo)] sf-borde ${error ? 'border-red-400' : 'border-[var(--sf-linea)]'} rounded-xl text-base text-[var(--sf-tinta)] focus:outline-none focus:ring-2 focus:ring-[var(--sf-tinta)]/20 focus:border-[var(--sf-tinta)]`}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}