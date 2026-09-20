'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Clock, ExternalLink } from 'lucide-react';
import { esperaSondeoSiguienteMs, TECHO_SONDEO_MS } from '@/lib/pagos/tres-ds';
import type { ResultadoRedireccionPasarela } from '@/types/payment';

/**
 * La ESPERA de un método de pasarela que NAVEGA AFUERA del checkout (§ API-DIRECTA-MECANISMO-
 * REDIRECCION-1) — la contraparte de `EsperaConfirmacionTarjeta.tsx` para un tipo con
 * `descriptor.redireccion` declarado (§ dimensión C, `lib/pagos/metodos-pasarela.ts`). NO es el
 * mismo caso: `EsperaConfirmacionTarjeta` espera a que el PAGO se confirme (tras volver de
 * fuera); este componente espera a que APAREZCA la dirección a la que hay que mandar al
 * comprador, y en cuanto aparece, LO SACA del sitio — nunca afirma "pagado" ni "fallido", eso
 * lo decide `/checkout/retorno` cuando el comprador vuelva.
 *
 * EL SONDEO REUSA LA MISMA POLÍTICA que el camino de 3DS (`esperaSondeoSiguienteMs`,
 * `TECHO_SONDEO_MS`, `lib/pagos/tres-ds.ts`) — no se escribe una tercera (§A del reporte del
 * slice). El SERVIDOR (`POST /api/pasarela/redireccion`) hace UNA consulta por llamada; este
 * componente es quien decide cuándo volver a llamar y cuándo rendirse, mismo patrón que
 * `EsperaConfirmacionTarjeta.tsx`/`RetornoCliente.tsx` con `/api/checkout/retorno`.
 *
 * SI EL TECHO SE CUMPLE SIN QUE LA DIRECCIÓN APAREZCA, NO SE INVENTA UN VEREDICTO (§A del
 * reporte del slice): la orden y el intento SIGUEN existiendo — el reconciliador
 * (`packages/core/src/pagos/reconciliador.ts`) es quien eventualmente se ocupa de un intento
 * que nunca resuelve. La vista `techo` lo dice así, sin afirmar éxito ni fracaso.
 *
 * § CHECKOUT-REDIRECCION-TECHO-SIN-ACCIONES-1 (2026-09-18, `CHECKOUT-REINTENTO-OTRO-METODO-1`
 * — "es la misma clase que acabás de cerrar, en el componente de al lado, y dejarlo abierto es
 * garantizar que vuelva", owner): esta vista `techo` tenía el MISMO defecto que
 * `EsperaConfirmacionTarjeta.techo` tenía antes de § CHECKOUT-TRANSICION-DEFECTOS-1 — decía
 * "sigue procesándose" sin número de orden ni ninguna acción, dejando al comprador sin saber
 * qué pedido es ni qué hacer mientras tanto. MISMA FORMA que esa vista: la caja de número de
 * orden + "Rastrear mi pedido" / "Seguir comprando". El `numeroOrden` sale de la MISMA
 * convención que ya usan `EsperaConfirmacionTarjeta`/`FormularioTarjeta`
 * (`reference.split(':')[0]`, `referenciaIntentoPago` en `packages/core/src/orders.ts`) — no
 * una tercera forma de leerlo.
 */
export interface EsperaRedireccionPasarelaProps {
  /** La `reference` del `PaymentIntent` que acaba de crear la transacción. */
  reference: string;
  /** El tipo del descriptor (`DescriptorMetodoPasarela.tipo`, vocabulario del proveedor) — el
   *  servidor lo usa para saber CUÁL `campoUrl` leer (§ `resolverRedireccionPasarela`,
   *  `app/api/pasarela/redireccion/route.ts`). */
  tipo: string;
}

type Vista = 'esperando' | 'redirigiendo' | 'techo';

// TEXTO PROVISIONAL — PENDIENTE DE TEXTO DEL OWNER (§ el reporte del slice, §1.C: "una señal
// honesta de que va a salir del sitio y va a volver, sin prometer plazos").
const TEXTO = {
  esperando: 'Vas a salir de este sitio para completar tu pago. Cuando termines, volverás aquí automáticamente.',
  redirigiendo: 'Te estamos llevando a la página de pago…',
  techoTitulo: 'Todavía no pudimos abrir la página de pago',
  techoCuerpo: 'Puedes revisar el estado de tu pedido más tarde con tu número de orden y tu correo.',
};

export default function EsperaRedireccionPasarela({ reference, tipo }: EsperaRedireccionPasarelaProps) {
  const [vista, setVista] = useState<Vista>('esperando');

  // `reference` se arma como `<numero_orden>:<cuid-de-la-propia-fila>` (`referenciaIntentoPago`,
  // `packages/core/src/orders.ts`) — MISMA convención que ya lee `EsperaConfirmacionTarjeta`.
  const numeroOrden = reference.split(':')[0];

  // El reloj del backoff vive en refs — no debe disparar un re-render por sí mismo, sólo el
  // RESULTADO de cada consulta cambia `vista` (mismo patrón que `EsperaConfirmacionTarjeta.tsx`
  // y `RetornoCliente.tsx`).
  const intentoRef = useRef(0);
  const inicioRef = useRef<number | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const programarSiguiente = useCallback(() => {
    if (inicioRef.current === null) inicioRef.current = Date.now();
    if (Date.now() - inicioRef.current >= TECHO_SONDEO_MS) {
      setVista((v) => (v === 'esperando' ? 'techo' : v));
      return;
    }

    const espera = esperaSondeoSiguienteMs(intentoRef.current);
    intentoRef.current += 1;

    timeoutRef.current = setTimeout(async () => {
      let url: string | null = null;
      try {
        const res = await fetch('/api/pasarela/redireccion', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ reference, tipo }),
        });
        if (res.ok) {
          const body = (await res.json().catch(() => null)) as Partial<ResultadoRedireccionPasarela> | null;
          url = typeof body?.url === 'string' && body.url.length > 0 ? body.url : null;
        }
        // Un status distinto de 200 (429, 502, 500) no es un veredicto — el próximo tick
        // reintenta, sin reiniciar el reloj del techo (mismo criterio que
        // `EsperaConfirmacionTarjeta.tsx` con un fallo transitorio de `/api/checkout/retorno`).
      } catch {
        // fallo de red: igual, el próximo tick reintenta.
      }
      if (url) {
        setVista('redirigiendo');
        window.location.href = url;
        return;
      }
      programarSiguiente();
    }, espera);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reference, tipo]);

  useEffect(() => {
    programarSiguiente();
    // Arranca UNA vez, al montar — `programarSiguiente` se re-encadena a sí misma vía
    // `setTimeout`, no por dependencias de efecto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (vista === 'techo') {
    return (
      <div className="text-center">
        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Clock className="w-8 h-8 text-amber-600" />
        </div>
        <h3 className="text-xl font-playfair text-[var(--sf-tinta)] mb-1">{TEXTO.techoTitulo}</h3>
        <p className="text-sm text-[var(--sf-texto-suave)] mb-3">{TEXTO.techoCuerpo}</p>
        {/* PALETA-MIGRAR-TEXTO-SOBRE-SUPERFICIE-1: texto directo sobre `--sf-superficie` migrado
            al par `var(--sf-sobre-superficie[-suave],<token de hoy>)` (§ TEMAS-P6-FAMILIAS-1) --
            salvo el número de orden, cuyo fallback era `--sf-acento-texto`: para un inquilino
            CON paleta ese par vale OTRO color que `--sf-acento-texto`. PALETA-MIGRACION-SACAR-
            LOS-QUE-MUEVEN-1 lo revirtió -- § PALETA-ACENTO-TINTA-SOBRE-SUPERFICIE-1,
            DECISIONS.md. */}
        <div className="bg-[var(--sf-superficie)] rounded-2xl p-4 mb-4 text-left">
          <p className="text-xs text-[var(--sf-sobre-superficie-suave,var(--sf-texto-suave))] mb-1 text-center">Número de orden</p>
          <p className="text-xl font-bold text-[var(--sf-acento-texto)] text-center">{numeroOrden}</p>
        </div>
        <div className="flex flex-col gap-3">
          <Link
            href={`/rastrear-pedido?orden=${encodeURIComponent(numeroOrden)}`}
            className="block w-full bg-[var(--sf-tinta)] text-[var(--sf-sobre)] font-semibold py-3 rounded-xl text-sm hover:bg-[var(--sf-tinta-2)] transition-colors"
          >
            Rastrear mi pedido
          </Link>
          <Link
            href="/tienda"
            className="block w-full sf-borde border-[var(--sf-linea)] text-[var(--sf-texto)] font-medium py-3 rounded-xl text-sm hover:bg-[var(--sf-superficie)] transition-colors"
          >
            Seguir comprando
          </Link>
        </div>
      </div>
    );
  }

  // PALETA-MIGRAR-TEXTO-SOBRE-SUPERFICIE-1: este `<p>` NO tiene fondo propio en este archivo — su
  // único llamador (`FormularioOtroMetodoPasarela.tsx`) lo monta DENTRO de un
  // `bg-[var(--sf-superficie)]`, así que el fondo real no se puede leer acá. DECIDIDO, no medido: se
  // trata como si estuviera sobre la superficie (la dirección conservadora — verificado con las 7
  // paletas del repo, `sobre-superficie` da MÁS contraste contra `fondo` que contra `superficie` en
  // las 7, nunca menos, así que el wrap es seguro caiga donde caiga).
  return (
    <div className="text-center">
      <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <ExternalLink className="w-8 h-8 text-amber-600 animate-pulse" />
      </div>
      <p className="text-sm text-[var(--sf-sobre-superficie,var(--sf-texto))]">
        {vista === 'redirigiendo' ? TEXTO.redirigiendo : TEXTO.esperando}
      </p>
    </div>
  );
}
