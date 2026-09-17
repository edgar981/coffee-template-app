'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle, Clock, XCircle } from 'lucide-react';
import { consultarRetornoPago } from '@/services/checkout.service';
import {
  esperaSondeoSiguienteMs, TECHO_SONDEO_MS, TECHO_SONDEO_DESAFIO_MS, type Resultado3ds,
} from '@/lib/pagos/tres-ds';
import DesafioTarjeta from './DesafioTarjeta';

/**
 * La ESPERA, tras crear la transacción de tarjeta con 3DS pedido (§ API-DIRECTA-3DS-SIN-
 * CHALLENGE-1, §D del reporte del slice). La transacción NO resuelve al instante — hay que
 * SONDEAR hasta que el webhook cierre el `PaymentIntent` a un estado final, y esa espera con
 * backoff creciente es la MISMA política que ya usa `app/(storefront)/checkout/retorno/
 * RetornoCliente.tsx` para el mismo caso (esperar a que un `PaymentIntent EN_VUELO` resuelva),
 * reusando `/api/checkout/retorno` (vía `consultarRetornoPago`, YA EXPORTADO de
 * `services/checkout.service.ts` — sólo se IMPORTA, no se modifica ese archivo: está fuera de
 * `touches:` de este slice, ver el reporte).
 *
 * SIN SEGUNDO FACTOR TECLEADO: a diferencia de `RetornoCliente` (que pide el correo porque la
 * `reference` sola viaja en una URL que un tercero podría leer), acá el `email` YA ES CONOCIDO
 * —es el mismo que el comprador tecleó en el paso de Información del checkout, en la MISMA
 * sesión— así que no hay nada que re-preguntar.
 *
 * EL DESAFÍO (§ API-DIRECTA-3DS-CON-CHALLENGE-1) NO CAMBIA EL MECANISMO DE SONDEO — sólo qué se
 * DIBUJA mientras se espera, y CUÁNDO se declara "sigue sin resolver" (`TECHO_SONDEO_DESAFIO_MS`,
 * más alto que `TECHO_SONDEO_MS`, porque acá hay una PERSONA completando un paso en la pantalla
 * de su banco — ver `lib/pagos/tres-ds.ts`). Con `desafioHtml`, la vista `en_vuelo` embebe el
 * marco aislado (`DesafioTarjeta`) en vez de sólo texto; SIN `desafioHtml` (el desafío se
 * detectó pero no se pudo decodificar ningún contenido), sigue el texto honesto que ya existía
 * antes de este slice — un contenido inválido/ausente NUNCA rompe la pantalla.
 */
export interface EsperaConfirmacionTarjetaProps {
  reference: string;
  email: string;
  /** La clasificación de `clasificarAutenticacion3ds` (§ API-DIRECTA-3DS-SIN-CHALLENGE-1) —
   *  sólo cambia el COPY de la espera (honesto sobre qué está pasando), nunca el mecanismo de
   *  sondeo: los tres casos sondean IGUAL. */
  resultado3ds: Resultado3ds;
  /** El HTML del desafío, YA DECODIFICADO por el servidor (§ API-DIRECTA-3DS-CON-CHALLENGE-1) —
   *  `null` cuando no hay nada que embeber (sin fricción, desconocido, o un desafío sin
   *  contenido decodificable). Este componente nunca decodifica nada. */
  desafioHtml: string | null;
}

type Vista = 'en_vuelo' | 'aprobado' | 'fallido' | 'techo';

// TEXTO PROVISIONAL — PENDIENTE DE COPY DEL OWNER (§ el reporte del slice, igual que el resto
// del copy de este programa). Elegido claro y honesto para no bloquear el slice.
const TEXTO = {
  enVueloSinFriccion: 'Estamos confirmando tu pago con tu banco. Esto puede tardar unos minutos — no cierres esta página.',
  // SIN `desafioHtml` (§ API-DIRECTA-3DS-CON-CHALLENGE-1 — desafío detectado pero sin contenido
  // decodificable, el mismo texto honesto que ya existía antes de este slice): sigue esperando
  // por el MISMO sondeo, sin inventar una pantalla que no tiene con qué dibujarse. CON
  // `desafioHtml`, la vista `en_vuelo` embebe `DesafioTarjeta` en su lugar (ver el render, abajo)
  // y este texto NO se muestra — el marco aislado ya declara por su cuenta que es ajeno.
  enVueloDesafio: 'Tu banco pide un paso adicional para confirmar esta compra, que todavía no podemos completar desde aquí. Sigue esperando — si tu banco lo resuelve por su cuenta, confirmaremos el pago automáticamente.',
  aprobadoTitulo: '¡Tu pago fue aprobado!',
  aprobadoCuerpo: 'Tu pedido queda confirmado y pasa a preparación.',
  fallidoTitulo: 'Tu pago no fue aprobado',
  fallidoCuerpo: 'No te preocupes, no se realizó ningún cobro. Puedes intentarlo de nuevo o usar otro método.',
  techoTitulo: 'Tu pago sigue procesándose',
  techoCuerpo: 'Te avisaremos apenas se confirme. Puedes revisar el estado de tu pedido más tarde con tu número de orden y tu correo.',
};

export default function EsperaConfirmacionTarjeta({ reference, email, resultado3ds, desafioHtml }: EsperaConfirmacionTarjetaProps) {
  const [vista, setVista] = useState<Vista>('en_vuelo');

  // El reloj del backoff vive en refs — no debe disparar un re-render por sí mismo, sólo el
  // RESULTADO de cada consulta cambia `vista` (mismo patrón que RetornoCliente.tsx).
  const intentoRef = useRef(0);
  const inicioRef = useRef<number | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // § API-DIRECTA-3DS-CON-CHALLENGE-1: el techo del DESAFÍO es más alto — hay una persona
  // completando un paso en la pantalla de su banco, no sólo el emisor resolviendo solo.
  const techoMs = resultado3ds === 'desafio' ? TECHO_SONDEO_DESAFIO_MS : TECHO_SONDEO_MS;

  const programarSiguiente = useCallback(() => {
    if (inicioRef.current === null) inicioRef.current = Date.now();
    if (Date.now() - inicioRef.current >= techoMs) {
      setVista((v) => (v === 'en_vuelo' ? 'techo' : v));
      return;
    }

    const espera = esperaSondeoSiguienteMs(intentoRef.current);
    intentoRef.current += 1;

    timeoutRef.current = setTimeout(async () => {
      let resultado: Awaited<ReturnType<typeof consultarRetornoPago>> = null;
      try {
        resultado = await consultarRetornoPago(reference, email);
      } catch {
        // 429 u otro fallo transitorio: no rompe el ciclo, el próximo tick reintenta — sin
        // reiniciar el reloj del techo (mismo criterio que RetornoCliente.tsx).
      }
      if (!resultado || resultado.estado === 'EN_VUELO') {
        programarSiguiente();
        return;
      }
      setVista(resultado.estado === 'APROBADO' ? 'aprobado' : 'fallido');
    }, espera);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reference, email, techoMs]);

  useEffect(() => {
    programarSiguiente();
    // Arranca UNA vez, al montar — `programarSiguiente` se re-encadena a sí misma vía
    // `setTimeout`, no por dependencias de efecto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // `reference` se arma como `<numero_orden>:<cuid-de-la-propia-fila>`
  // (`referenciaIntentoPago`, `packages/core/src/orders.ts`) — el número de orden es la
  // primera mitad, y es lo único que hace falta mostrar/enlazar acá.
  const numeroOrden = reference.split(':')[0];

  if (vista === 'aprobado') {
    return (
      <div className="text-center">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8 text-emerald-600" />
        </div>
        <h3 className="text-xl font-playfair text-[var(--sf-tinta)] mb-1">{TEXTO.aprobadoTitulo}</h3>
        <p className="text-sm text-[var(--sf-texto-suave)]">{TEXTO.aprobadoCuerpo}</p>
      </div>
    );
  }

  if (vista === 'fallido') {
    return (
      <div className="text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <XCircle className="w-8 h-8 text-red-600" />
        </div>
        <h3 className="text-xl font-playfair text-[var(--sf-tinta)] mb-1">{TEXTO.fallidoTitulo}</h3>
        <p className="text-sm text-[var(--sf-texto-suave)]">{TEXTO.fallidoCuerpo}</p>
      </div>
    );
  }

  if (vista === 'techo') {
    return (
      <div className="text-center">
        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Clock className="w-8 h-8 text-amber-600" />
        </div>
        <h3 className="text-xl font-playfair text-[var(--sf-tinta)] mb-1">{TEXTO.techoTitulo}</h3>
        <p className="text-sm text-[var(--sf-texto-suave)] mb-3">
          {TEXTO.techoCuerpo}
          {resultado3ds === 'desafio' ? ` (${TEXTO.enVueloDesafio})` : ''}
        </p>
        <p className="text-xs text-[var(--sf-texto-suave)]">Número de orden: <span className="font-semibold">{numeroOrden}</span></p>
      </div>
    );
  }

  // § API-DIRECTA-3DS-CON-CHALLENGE-1: con contenido decodificable, la vista `en_vuelo`
  // EMBEBE el marco aislado del emisor en vez de sólo texto — el sondeo de arriba sigue
  // corriendo igual por debajo; `DesafioTarjeta` no lo toca ni se entera de él. SIN contenido
  // (desafío detectado pero nada que decodificar), cae al texto honesto que ya existía.
  if (vista === 'en_vuelo' && resultado3ds === 'desafio' && desafioHtml) {
    return (
      <div className="text-center space-y-3">
        <DesafioTarjeta html={desafioHtml} />
        <p className="text-xs text-[var(--sf-texto-suave)]">
          No cierres esta página — confirmaremos tu pago apenas tu banco resuelva el paso de arriba.
        </p>
      </div>
    );
  }

  return (
    <div className="text-center">
      <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <Clock className="w-8 h-8 text-amber-600 animate-pulse" />
      </div>
      <p className="text-sm text-[var(--sf-texto)]">
        {resultado3ds === 'desafio' ? TEXTO.enVueloDesafio : TEXTO.enVueloSinFriccion}
      </p>
    </div>
  );
}
