"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";

import { useSearchParams } from "next/navigation";

import { Clock } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

import {
  consultarRetornoPago,
  type RetornoWompiEstado,
} from "@/services/checkout.service";
import { whatsappUrl } from "@/lib/config/site";
import { useSiteSettings } from "@/components/storefront/SiteSettingsProvider";
import { useSiteContent } from "@/components/storefront/SiteContentProvider";
import { navOffsetClase } from "@/lib/config/themes";
import { referenciaDesdeQuery, resolverReferenciaPorId } from "@/lib/checkout/retorno-wompi";
import EstadoPedido from "@/components/storefront/checkout/EstadoPedido";

// ── LA PANTALLA DE RETORNO — Wompi devuelve al comprador acá ─────────────────────
//
// (c), WOMPI-RUTA-DE-RETORNO-1. LA REGLA QUE GOBIERNA TODO LO DE ABAJO: el retorno
// del navegador NO ES LA FUENTE DE VERDAD — el webhook lo es. Wompi puede traer un
// `status` en el query del redirect; esta pantalla NO LO LEE NI SE LO CREE. Sólo
// afirma lo que `PaymentIntent.estado` dice, vía `/api/checkout/retorno`
// (`consultarRetornoPago`), y ese endpoint sólo lee lo que el webhook ya escribió.
//
// SEGUNDO FACTOR TECLEADO, como `rastrear-pedido`: la `reference` llega por query
// (Wompi la agrega al redirect), pero SOLA no puede revelar el estado de un pago
// ajeno — viaja en una URL que un tercero podría leer (historial, referrer,
// analítica). Por eso el correo de la compra se pide SIEMPRE tecleado en esta
// pantalla, nunca por query param (aceptar `?email=` acá anularía el segundo
// factor: cualquiera con el link tendría los dos).
//
// SIN DATOS DEL COMPRADOR en pantalla — ni nombre, ni dirección, ni el email de
// vuelta: sólo el estado del pago y el número de orden, igual que la respuesta del
// servidor (§2 del slice).
//
// CERO DEPENDENCIA DE THEME (§4 del slice): vocabulario visual del storefront
// canónico, igual que `rastrear-pedido` y el resto del checkout.
//
// ESTE ARCHIVO ES LA MITAD CLIENTE (WOMPI-RETORNO-307-Y-TECHO-1). `page.tsx`, ahora
// SERVER, decide el 307 del tenant sin pasarela ANTES de montar nada de esto (§1) y
// baja `tieneWhatsapp` por prop (§2) — la lógica de esta pantalla no cambió, sólo se
// movió de archivo.

// El backoff de reintentos del polling — 2, 4, 8, 16, 30s y de ahí en más cada 30s
// — y el techo de 5 minutos son del diseño del slice (§3, WOMPI-RUTA-DE-RETORNO-1);
// no se ajustan sin volver a esa decisión.
const BACKOFF_SEGUNDOS = [2, 4, 8, 16, 30];
const TECHO_MS = 5 * 60 * 1000;

function esperaSiguienteMs(intento: number): number {
  const segundos = BACKOFF_SEGUNDOS[intento] ?? BACKOFF_SEGUNDOS[BACKOFF_SEGUNDOS.length - 1];
  return segundos * 1000;
}

type Vista =
  | { fase: "resolviendo_id" }
  | { fase: "sin_referencia" }
  | { fase: "pidiendo_email" }
  | { fase: "buscando" }
  | { fase: "no_encontrado" }
  | { fase: "en_vuelo"; numeroOrden: string }
  | { fase: "aprobado"; numeroOrden: string }
  | { fase: "fallido"; numeroOrden: string }
  | { fase: "techo"; numeroOrden: string };

function estadoAVista(estado: RetornoWompiEstado, numeroOrden: string): Vista {
  if (estado === "EN_VUELO") return { fase: "en_vuelo", numeroOrden };
  if (estado === "APROBADO") return { fase: "aprobado", numeroOrden };
  return { fase: "fallido", numeroOrden };
}

interface RetornoInnerProps {
  tieneWhatsapp: boolean;
}

function RetornoInner({ tieneWhatsapp }: RetornoInnerProps) {
  const searchParams = useSearchParams();
  // CHECKOUT-LISTO-PARA-VENDER-1 — EL REGRESO DEL WIDGET (§ el spec del slice,
  // `pagos-estado.md` §3.4): Wompi redirige el widget con `?id=<transacción>`, no
  // `?reference=`. `referenciaDesdeQuery` decide cuál de los dos hay, y si es `id`, lo resuelve
  // contra el endpoint PÚBLICO de transacciones de Wompi (`resolverReferenciaPorId`, § el
  // `useEffect` de abajo) antes de poder pedir el correo. `reference` directo sigue
  // funcionando EXACTAMENTE igual que antes — nunca se llama a Wompi para ese caso.
  const decisionReferencia = referenciaDesdeQuery({
    reference: searchParams.get("reference"),
    id: searchParams.get("id"),
  });

  // El NÚMERO de WhatsApp sale del contexto del storefront (ya inyectado por el layout,
  // misma request que resolvió `tieneWhatsapp` en el server, § `page.tsx`) — `tieneWhatsapp`
  // es sólo la señal de PRESENCIA que gatea si el CTA se pinta; el número en sí no viaja
  // por prop porque ya está disponible acá sin costo (StoreFooter lo lee igual).
  const settings = useSiteSettings();
  // EL RELLENO SUPERIOR (§ NAV-INTERNAS-CLARO-Y-OFFSET-1) — ver el docstring de `navOffsetClase`
  // (`lib/config/themes.ts`). `false` (todo tenant salvo CORTE) = `pt-16`, byte a byte.
  const { navTratamiento } = useSiteContent();
  const offsetClase = navOffsetClase(navTratamiento.posicion);

  const [email, setEmail] = useState("");
  const [errorCorreo, setErrorCorreo] = useState<string | null>(null);
  // `reference` es la referencia YA RESUELTA que el resto de la pantalla usa — directa desde
  // el query, o la que `resolverReferenciaPorId` devuelva (§ el efecto de abajo). `null`
  // mientras se resuelve el `id` o cuando no hay ninguna de las dos.
  const [reference, setReference] = useState<string | null>(
    decisionReferencia.tipo === "directa" ? decisionReferencia.referencia : null,
  );
  const [vista, setVista] = useState<Vista>(
    decisionReferencia.tipo === "directa"
      ? { fase: "pidiendo_email" }
      : decisionReferencia.tipo === "por_id"
        ? { fase: "resolviendo_id" }
        : { fase: "sin_referencia" },
  );

  useEffect(() => {
    if (decisionReferencia.tipo !== "por_id") return;
    let cancelado = false;
    resolverReferenciaPorId(decisionReferencia.id, fetch).then((referenciaResuelta) => {
      if (cancelado) return;
      if (referenciaResuelta) {
        setReference(referenciaResuelta);
        setVista({ fase: "pidiendo_email" });
      } else {
        // Ningún host de Wompi reconoce esa transacción — misma vista que "no había ningún
        // dato en la URL" (§ el spec: "Sin referencia: «No encontramos este pago»").
        setVista({ fase: "sin_referencia" });
      }
    });
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // El reloj del backoff vive en refs — no debe disparar un re-render por sí
  // mismo, sólo el RESULTADO de cada consulta cambia `vista`.
  const intentoRef = useRef(0);
  const inicioEnVueloRef = useRef<number | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // Programa la SIGUIENTE consulta con el backoff (§3). Si ya se cruzó el techo de
  // 5 minutos desde el PRIMER `EN_VUELO` visto, deja de programar y declara el
  // estado indeterminado final — sin afirmar éxito ni fracaso.
  const programarSiguiente = useCallback((ref: string, correo: string) => {
    if (inicioEnVueloRef.current === null) inicioEnVueloRef.current = Date.now();
    if (Date.now() - inicioEnVueloRef.current >= TECHO_MS) {
      setVista((v) => (v.fase === "en_vuelo" ? { fase: "techo", numeroOrden: v.numeroOrden } : v));
      return;
    }

    const espera = esperaSiguienteMs(intentoRef.current);
    intentoRef.current += 1;

    timeoutRef.current = setTimeout(async () => {
      let resultado: Awaited<ReturnType<typeof consultarRetornoPago>> = null;
      try {
        resultado = await consultarRetornoPago(ref, correo);
      } catch {
        // 429 u otro fallo transitorio: no rompe el ciclo, el próximo tick
        // reintenta — sin reiniciar el reloj del techo.
      }
      if (!resultado) {
        programarSiguiente(ref, correo);
        return;
      }
      if (resultado.estado === "EN_VUELO") {
        setVista({ fase: "en_vuelo", numeroOrden: resultado.numero_orden });
        programarSiguiente(ref, correo);
      } else {
        setVista(estadoAVista(resultado.estado, resultado.numero_orden));
      }
    }, espera);
  }, []);

  // Usada TANTO por el submit del formulario de email COMO por "Volver a consultar" en la
  // vista `techo` (§2, WOMPI-RETORNO-307-Y-TECHO-1): reintentar es exactamente lo mismo que
  // buscar por primera vez — reinicia el reloj del backoff (`intentoRef`/`inicioEnVueloRef`
  // en cero) y consulta de inmediato, sin esperar el primer tramo. `email`/`reference` ya
  // están en scope (la vista `techo` sólo se alcanza tras un `EN_VUELO` exitoso previo), así
  // que no hace falta volver a pedir el correo.
  const handleBuscar = async () => {
    // CHECKOUT-LISTO-PARA-VENDER-1 — «el botón nunca queda gris y mudo» (§ el spec): antes
    // "Ver el estado de mi pago" se deshabilitaba con el correo vacío, sin decir nada. Ahora
    // queda activo y, al tocarlo sin correo, lo dice en vez de no hacer nada.
    if (!email.trim()) { setErrorCorreo("Ingresa el correo de tu compra."); return; }
    setErrorCorreo(null);
    if (!reference) return; // defensivo — este formulario sólo se monta con la referencia ya resuelta.
    const correo = email.trim();
    setVista({ fase: "buscando" });
    intentoRef.current = 0;
    inicioEnVueloRef.current = null;
    try {
      const resultado = await consultarRetornoPago(reference, correo);
      if (!resultado) {
        setVista({ fase: "no_encontrado" });
        return;
      }
      if (resultado.estado === "EN_VUELO") {
        setVista({ fase: "en_vuelo", numeroOrden: resultado.numero_orden });
        programarSiguiente(reference, correo);
      } else {
        setVista(estadoAVista(resultado.estado, resultado.numero_orden));
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo consultar el estado de tu pago");
      setVista({ fase: "pidiendo_email" });
    }
  };

  return (
    <div className={`min-h-[80vh] flex items-center justify-center ${offsetClase} px-4`}>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full text-center"
      >
        {vista.fase === "resolviendo_id" && (
          // CHECKOUT-LISTO-PARA-VENDER-1 — mientras se resuelve la `reference` a partir del
          // `id` del widget (§ el `useEffect` de arriba): un instante, nunca más de dos
          // requests livianos. No es uno de los cinco estados de la página — es la espera
          // ANTES de poder mostrar cualquiera de ellos.
          <div className="w-20 h-20 bg-[var(--sf-superficie)] rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
            <Clock className="w-10 h-10 text-[var(--sf-tostado-2)]" />
          </div>
        )}

        {vista.fase === "sin_referencia" && (
          <EstadoPedido
            estado="sin_referencia"
            metodo={null}
            numeroOrden={null}
            acciones={[
              { label: 'Rastrear mi pedido', variante: 'primaria', href: '/rastrear-pedido' },
              ...(tieneWhatsapp ? [{ label: 'Escríbenos por WhatsApp', variante: 'whatsapp' as const, externo: true, href: whatsappUrl(settings.whatsapp, 'Hola, no encuentro la confirmación de mi pago.') }] : []),
            ]}
          />
        )}

        {(vista.fase === "pidiendo_email" || vista.fase === "buscando" || vista.fase === "no_encontrado") && (
          <>
            <div className="w-20 h-20 bg-[var(--sf-superficie)] rounded-full flex items-center justify-center mx-auto mb-6">
              <Clock className="w-10 h-10 text-[var(--sf-tostado-2)]" />
            </div>
            <h1 className="text-2xl font-playfair text-[var(--sf-tinta)] mb-2">Confirma tu pago</h1>
            <p className="text-sm text-[var(--sf-texto-suave)] mb-6">
              Ingresa el correo con el que hiciste tu compra para ver el estado de tu pago.
            </p>
            <div className="bg-[var(--sf-tarjeta)] rounded-2xl shadow-lg sf-borde border-[var(--sf-linea)] p-5 space-y-4 text-left">
              <div>
                <label htmlFor="retorno-email" className="block text-xs font-medium text-[var(--sf-texto)] mb-1.5">
                  Correo de tu compra
                </label>
                <input
                  id="retorno-email"
                  name="retorno-email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleBuscar()}
                  placeholder="Ej: correo@ejemplo.com"
                  className="w-full h-12 px-4 bg-[var(--sf-fondo)] sf-borde border-[var(--sf-linea)] rounded-xl text-[var(--sf-tinta)] text-base focus:outline-none focus:ring-2 focus:ring-[var(--sf-tinta)]/20 focus:border-[var(--sf-tinta)]"
                />
              </div>
              <button
                onClick={handleBuscar}
                disabled={vista.fase === "buscando"}
                className="w-full bg-[var(--sf-acento)] hover:bg-[var(--sf-accion-hover,var(--sf-tostado-4))] active:bg-[var(--sf-accion-active,var(--sf-tostado-3))] disabled:opacity-60 text-[var(--sf-acento-txt)] font-bold px-5 py-3 rounded-xl text-sm transition-colors"
              >
                {vista.fase === "buscando" ? "Consultando..." : "Ver el estado de mi pago"}
              </button>
              {errorCorreo && (
                <p className="text-xs text-red-600">{errorCorreo}</p>
              )}
              {vista.fase === "no_encontrado" && (
                <p className="text-xs text-red-600">
                  No pudimos confirmar estos datos. Verifica el correo con el que hiciste tu compra.
                </p>
              )}
            </div>
          </>
        )}

        {vista.fase === "en_vuelo" && (
          <EstadoPedido estado="pendiente" metodo="wompi" numeroOrden={vista.numeroOrden} correo={email} acciones={[]} />
        )}

        {vista.fase === "techo" && (
          // Jerarquía fijada por el owner (§2, WOMPI-RETORNO-307-Y-TECHO-1): principal = número +
          // rastrear-pedido; secundaria = "Volver a consultar"; WhatsApp = terciaria y CONDICIONAL
          // a `tieneWhatsapp` — sin canal configurado, no se ofrece un camino que no existe (misma
          // guarda de veracidad que el checkout y el footer). No invertir el orden.
          <EstadoPedido
            estado="pendiente"
            metodo="wompi"
            numeroOrden={vista.numeroOrden}
            correo={email}
            acciones={[
              { label: 'Rastrear mi pedido', variante: 'primaria', href: `/rastrear-pedido?orden=${encodeURIComponent(vista.numeroOrden)}&email=${encodeURIComponent(email)}` },
              { label: 'Volver a consultar', variante: 'secundaria', onClick: handleBuscar },
              ...(tieneWhatsapp ? [{ label: 'Escríbenos por WhatsApp', variante: 'whatsapp' as const, externo: true, href: whatsappUrl(settings.whatsapp, `Hola, quiero consultar el estado de mi pago de la orden ${vista.numeroOrden}`) }] : []),
            ]}
          />
        )}

        {vista.fase === "aprobado" && (
          <EstadoPedido
            estado="aprobado"
            metodo="wompi"
            numeroOrden={vista.numeroOrden}
            correo={email}
            acciones={[
              { label: 'Rastrear mi pedido', variante: 'primaria', href: `/rastrear-pedido?orden=${encodeURIComponent(vista.numeroOrden)}&email=${encodeURIComponent(email)}` },
              { label: 'Seguir comprando', variante: 'secundaria', href: '/tienda' },
            ]}
          />
        )}

        {vista.fase === "fallido" && (
          // CHECKOUT-LISTO-PARA-VENDER-1 — PENDIENTE (§ el reporte del slice): el spec pide
          // «Intentar de nuevo» (reabre el widget) y «Elegir otro método» sobre la MISMA
          // orden, vía `POST /api/checkout/reintento` (igual que `reintentarConOtroMetodo` en
          // `checkout/page.tsx`). Montar ESE flujo acá exige repetir el picker de método
          // (`SelectorMetodoPasarela`/`PagoPasarela`) fuera del carrito/paso de pago donde
          // vive hoy — se detuvo ese ítem en vez de ofrecer un "Intentar de nuevo" que en
          // realidad no reintenta nada (el carrito ya está vacío). "Volver a la tienda" sigue
          // siendo un reintento real, desde cero.
          <EstadoPedido
            estado="rechazado"
            metodo="wompi"
            numeroOrden={vista.numeroOrden}
            correo={email}
            acciones={[
              { label: 'Volver a la tienda', variante: 'primaria', href: '/tienda' },
              ...(tieneWhatsapp ? [{ label: 'Escríbenos por WhatsApp', variante: 'whatsapp' as const, externo: true, href: whatsappUrl(settings.whatsapp, `Hola, mi pago de la orden ${vista.numeroOrden} no fue aprobado y quiero coordinar otra forma de pagar.`) }] : []),
            ]}
          />
        )}
      </motion.div>
    </div>
  );
}

interface RetornoClienteProps {
  /** La señal de presencia de WhatsApp, resuelta SERVER-SIDE en `page.tsx` (§1,
   *  WOMPI-RETORNO-307-Y-TECHO-1) — mismo patrón que `checkout/page.tsx`
   *  (`settings.whatsapp.trim() !== ''`). Gatea el CTA terciario de la vista `techo` (§2). */
  tieneWhatsapp: boolean;
}

// `useSearchParams()` (la `reference` del redirect de Wompi) exige un límite
// Suspense para prerenderizar — Next.js CSR bailout, mismo patrón que `rastrear-pedido`.
export default function RetornoCliente({ tieneWhatsapp }: RetornoClienteProps) {
  // El fallback de Suspense se renderiza ANTES de que `RetornoInner` monte, así que necesita su
  // propio `navOffsetClase` (§ NAV-INTERNAS-CLARO-Y-OFFSET-1).
  const { navTratamiento } = useSiteContent();
  return (
    <Suspense fallback={<div className={`${navOffsetClase(navTratamiento.posicion)} min-h-screen`} />}>
      <RetornoInner tieneWhatsapp={tieneWhatsapp} />
    </Suspense>
  );
}
