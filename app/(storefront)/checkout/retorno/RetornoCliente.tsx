"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { CheckCircle, Clock, MessageCircle, XCircle } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

import {
  consultarRetornoPago,
  type RetornoWompiEstado,
} from "@/services/checkout.service";
import { whatsappUrl } from "@/lib/config/site";
import { useSiteSettings } from "@/components/storefront/SiteSettingsProvider";

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
  const reference = searchParams.get("reference");

  // El NÚMERO de WhatsApp sale del contexto del storefront (ya inyectado por el layout,
  // misma request que resolvió `tieneWhatsapp` en el server, § `page.tsx`) — `tieneWhatsapp`
  // es sólo la señal de PRESENCIA que gatea si el CTA se pinta; el número en sí no viaja
  // por prop porque ya está disponible acá sin costo (StoreFooter lo lee igual).
  const settings = useSiteSettings();

  const [email, setEmail] = useState("");
  const [vista, setVista] = useState<Vista>(
    reference ? { fase: "pidiendo_email" } : { fase: "sin_referencia" },
  );

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
    if (!reference || !email.trim()) return;
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
    <div className="min-h-[80vh] flex items-center justify-center pt-16 px-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full text-center"
      >
        {vista.fase === "sin_referencia" && (
          <>
            <div className="w-20 h-20 bg-[var(--sf-superficie)] rounded-full flex items-center justify-center mx-auto mb-6">
              <XCircle className="w-10 h-10 text-[var(--sf-tostado-2)]" />
            </div>
            <h1 className="text-2xl font-playfair text-[var(--sf-tinta)] mb-2">
              No encontramos la información de tu pago
            </h1>
            <p className="text-sm text-[var(--sf-texto-suave)] mb-6">
              Si ya pagaste, revisa el estado de tu pedido con tu número de orden y tu correo.
            </p>
            <Link
              href="/rastrear-pedido"
              className="block w-full bg-[var(--sf-tinta)] text-[var(--sf-sobre)] font-semibold py-3.5 rounded-xl text-sm hover:bg-[var(--sf-tinta-2)] transition-colors"
            >
              Rastrear mi pedido
            </Link>
          </>
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
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleBuscar()}
                  placeholder="Ej: correo@ejemplo.com"
                  className="w-full px-4 py-3 bg-[var(--sf-fondo)] sf-borde border-[var(--sf-linea)] rounded-xl text-[var(--sf-tinta)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--sf-acento)]/20 focus:border-[var(--sf-acento)]"
                />
              </div>
              <button
                onClick={handleBuscar}
                disabled={vista.fase === "buscando" || !email.trim()}
                className="w-full bg-[var(--sf-acento)] hover:bg-[var(--sf-acento-3)] disabled:opacity-60 text-[var(--sf-acento-txt)] font-bold px-5 py-3 rounded-xl text-sm transition-colors"
              >
                {vista.fase === "buscando" ? "Consultando..." : "Ver el estado de mi pago"}
              </button>
              {vista.fase === "no_encontrado" && (
                <p className="text-xs text-red-600">
                  No pudimos confirmar estos datos. Verifica el correo con el que hiciste tu compra.
                </p>
              )}
            </div>
          </>
        )}

        {vista.fase === "en_vuelo" && (
          <>
            <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Clock className="w-10 h-10 text-amber-600 animate-pulse" />
            </div>
            <h1 className="text-2xl font-playfair text-[var(--sf-tinta)] mb-2">Estamos confirmando tu pago</h1>
            <p className="text-sm text-[var(--sf-texto-suave)] mb-6">
              Esto puede tardar unos minutos. No cierres esta página; se actualiza sola.
            </p>
            {/* PALETA-MIGRAR-TEXTO-SOBRE-SUPERFICIE-1: texto directo sobre `--sf-superficie`
                migrado al par `var(--sf-sobre-superficie[-suave],<token de hoy>)`
                (§ TEMAS-P6-FAMILIAS-1) — token viejo como fallback, byte-idéntico para Nayoli.
                El número de orden (fallback `--sf-acento-texto`) migró en PALETA-MIGRAR-ACENTO-
                TINTA-1 (§ PALETA-ACENTO-TINTA-SOBRE-SUPERFICIE-1, DECISIONS.md). */}
            <div className="bg-[var(--sf-superficie)] rounded-2xl p-5 text-left">
              <p className="text-xs text-[var(--sf-sobre-superficie-suave,var(--sf-texto-suave))] mb-1 text-center">Número de orden</p>
              <p className="text-2xl font-bold text-[var(--sf-sobre-superficie,var(--sf-acento-texto))] text-center">{vista.numeroOrden}</p>
            </div>
          </>
        )}

        {vista.fase === "techo" && (
          <>
            <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Clock className="w-10 h-10 text-amber-600" />
            </div>
            <h1 className="text-2xl font-playfair text-[var(--sf-tinta)] mb-2">Tu pago sigue procesándose</h1>
            <p className="text-sm text-[var(--sf-texto-suave)] mb-6">
              Te avisaremos apenas se confirme. Puedes revisar el estado de tu pedido más tarde con tu número de
              orden y tu correo.
            </p>
            {/* El número de orden (fallback `--sf-acento-texto`) migró en PALETA-MIGRAR-
                ACENTO-TINTA-1 -- § PALETA-ACENTO-TINTA-SOBRE-SUPERFICIE-1, DECISIONS.md. Este es
                uno de los TRES sitios que sólo se ven cuando el sondeo de retorno AGOTA su techo
                (5 min, `TECHO_MS` arriba). */}
            <div className="bg-[var(--sf-superficie)] rounded-2xl p-5 mb-6 text-left">
              <p className="text-xs text-[var(--sf-sobre-superficie-suave,var(--sf-texto-suave))] mb-1 text-center">Número de orden</p>
              <p className="text-2xl font-bold text-[var(--sf-sobre-superficie,var(--sf-acento-texto))] text-center">{vista.numeroOrden}</p>
            </div>
            {/* Jerarquía fijada por el owner (§2, WOMPI-RETORNO-307-Y-TECHO-1): principal = número +
                rastrear-pedido; secundaria = "Volver a consultar"; WhatsApp = terciaria y CONDICIONAL
                a `tieneWhatsapp` — sin canal configurado, no se ofrece un camino que no existe (misma
                guarda de veracidad que el checkout y el footer). No invertir el orden. */}
            <div className="flex flex-col gap-3">
              <Link
                href={`/rastrear-pedido?orden=${encodeURIComponent(vista.numeroOrden)}`}
                className="block w-full bg-[var(--sf-tinta)] text-[var(--sf-sobre)] font-semibold py-3.5 rounded-xl text-sm hover:bg-[var(--sf-tinta-2)] transition-colors"
              >
                Rastrear mi pedido
              </Link>
              <button
                type="button"
                onClick={handleBuscar}
                className="block w-full sf-borde border-[var(--sf-linea)] text-[var(--sf-texto)] font-medium py-3.5 rounded-xl text-sm hover:bg-[var(--sf-superficie)] transition-colors"
              >
                Volver a consultar
              </button>
              {tieneWhatsapp && (
                <a
                  href={whatsappUrl(
                    settings.whatsapp,
                    `Hola, quiero consultar el estado de mi pago de la orden ${vista.numeroOrden}`,
                  )}
                  target="_blank"
                  rel="noopener"
                  className="flex items-center justify-center gap-1.5 py-1 text-xs text-[var(--sf-texto-suave)] hover:text-[var(--sf-texto)] transition-colors"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  Escríbenos por WhatsApp
                </a>
              )}
            </div>
          </>
        )}

        {vista.fase === "aprobado" && (
          <>
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-emerald-600" />
            </div>
            <h1 className="text-3xl font-playfair text-[var(--sf-tinta)] mb-2">¡Tu pago fue aprobado!</h1>
            <p className="text-sm text-[var(--sf-texto-suave)] mb-6">
              Tu pedido queda confirmado y pasa a preparación.
            </p>
            {/* El número de orden (fallback `--sf-acento-texto`) migró en PALETA-MIGRAR-
                ACENTO-TINTA-1 -- § PALETA-ACENTO-TINTA-SOBRE-SUPERFICIE-1, DECISIONS.md. */}
            <div className="bg-[var(--sf-superficie)] rounded-2xl p-5 mb-6 text-left">
              <p className="text-xs text-[var(--sf-sobre-superficie-suave,var(--sf-texto-suave))] mb-1 text-center">Número de orden</p>
              <p className="text-2xl font-bold text-[var(--sf-sobre-superficie,var(--sf-acento-texto))] text-center">{vista.numeroOrden}</p>
            </div>
            <div className="flex flex-col gap-3">
              <Link
                href={`/rastrear-pedido?orden=${encodeURIComponent(vista.numeroOrden)}`}
                className="block w-full bg-[var(--sf-tinta)] text-[var(--sf-sobre)] font-semibold py-3.5 rounded-xl text-sm hover:bg-[var(--sf-tinta-2)] transition-colors"
              >
                Rastrear mi pedido
              </Link>
              <Link
                href="/tienda"
                className="block w-full sf-borde border-[var(--sf-linea)] text-[var(--sf-texto)] font-medium py-3.5 rounded-xl text-sm hover:bg-[var(--sf-superficie)] transition-colors"
              >
                Seguir comprando
              </Link>
            </div>
          </>
        )}

        {vista.fase === "fallido" && (
          <>
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <XCircle className="w-10 h-10 text-red-600" />
            </div>
            <h1 className="text-3xl font-playfair text-[var(--sf-tinta)] mb-2">Tu pago no fue aprobado</h1>
            <p className="text-sm text-[var(--sf-texto-suave)] mb-6">
              No te preocupes, no se realizó ningún cobro. Puedes volver a la tienda e intentarlo de nuevo.
            </p>
            {/* El número de orden (fallback `--sf-acento-texto`) migró en PALETA-MIGRAR-
                ACENTO-TINTA-1 -- § PALETA-ACENTO-TINTA-SOBRE-SUPERFICIE-1, DECISIONS.md. */}
            <div className="bg-[var(--sf-superficie)] rounded-2xl p-5 mb-6 text-left">
              <p className="text-xs text-[var(--sf-sobre-superficie-suave,var(--sf-texto-suave))] mb-1 text-center">Número de orden</p>
              <p className="text-2xl font-bold text-[var(--sf-sobre-superficie,var(--sf-acento-texto))] text-center">{vista.numeroOrden}</p>
            </div>
            <Link
              href="/tienda"
              className="block w-full bg-[var(--sf-tinta)] text-[var(--sf-sobre)] font-semibold py-3.5 rounded-xl text-sm hover:bg-[var(--sf-tinta-2)] transition-colors"
            >
              Volver a la tienda
            </Link>
          </>
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
  return (
    <Suspense fallback={<div className="pt-16 min-h-screen" />}>
      <RetornoInner tieneWhatsapp={tieneWhatsapp} />
    </Suspense>
  );
}
