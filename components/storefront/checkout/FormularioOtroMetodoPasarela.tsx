'use client';

import { useState } from 'react';
import AceptacionesPasarela from './AceptacionesPasarela';
import EsperaConfirmacionTarjeta from './EsperaConfirmacionTarjeta';
import { interpretarRespuestaOtroMetodo } from './interpretar-respuesta-otro-metodo';
import type { AceptacionesWompi } from '@/types/payment';
import type { DescriptorMetodoPasarela } from '@/lib/pagos/metodos-pasarela';
import type { Resultado3ds } from '@/lib/pagos/tres-ds';
import { formatCOP } from '@duna/core/utils';

/**
 * El camino de API DIRECTA para un método de pasarela QUE NO ES TARJETA (§ API-DIRECTA-OTROS-
 * METODOS-1): las dos casillas de aceptación (`AceptacionesPasarela` — reusada TAL CUAL, sin
 * cambios; valen igual para este tipo que para la tarjeta, § el reporte del slice) + el ÚNICO
 * campo que el descriptor pide, validado con la MISMA función que el servidor vuelve a correr
 * (`descriptor.campo.validar`) antes de aceptar el dato.
 *
 * OCUPA LA MISMA RANURA que `FormularioTarjeta` — la elige `SelectorMetodoPasarela.tsx` según
 * el tipo que el comprador seleccionó en el picker.
 *
 * CHECKOUT-NEQUI-EXITO-FIX-1: ESTE COMPONENTE RECONOCE EL ÉXITO, A DIFERENCIA DE ANTES. El
 * docstring viejo decía que el servidor SIEMPRE respondía `no_implementado` — cierto cuando se
 * escribió, falso desde que § API-DIRECTA-ENVIO-GENERICO-1 generalizó `lib/pagos/wompi-api.ts`
 * para aceptar cualquier `payment_method`: `PATCH /api/checkout` responde HOY `{ tipo:
 * 'creada', ... }` para este camino también (la MISMA forma que ya usa `FormularioTarjeta`,
 * `ResultadoCreacionTransaccionWompi`). El componente nunca miraba `body?.tipo` — sólo
 * `body?.error`, `undefined` en éxito — así que un pago que sí se cobró se mostraba como
 * fallido. La clasificación vive en `interpretarRespuestaOtroMetodo` (pura, testeada) y el
 * ÉXITO cae en el MISMO molde que `FormularioTarjeta`: `EsperaConfirmacionTarjeta` (sondeo
 * hasta el estado final, con 3DS si el proveedor lo pide). Los demás casos siguen mostrando el
 * `error` que el servidor decide, tal cual — nunca inventado acá.
 *
 * § CHECKOUT-UNA-SOLA-PANTALLA-1: MISMO CAMBIO QUE `FormularioTarjeta` — ya no recibe
 * `reference`; la orden se crea al apretar "Pagar", vía `crearOrdenPasarela` (idempotente).
 */
export interface FormularioOtroMetodoPasarelaProps {
  descriptor: DescriptorMetodoPasarela;
  aceptaciones: AceptacionesWompi;
  /** Crea la orden (si todavía no existe) y devuelve la `reference` de su intento de pago, o
   *  `null` si la creación falló (la página ya mostró el motivo). IDEMPOTENTE: si la orden ya
   *  existe (un reintento), la reusa — § `FormularioTarjetaProps.crearOrdenPasarela`. */
  crearOrdenPasarela: () => Promise<string | null>;
  /** El monto a pagar, en pesos — para el texto del botón ("Pagar · $X"). */
  monto: number;
  /** El correo que el comprador tecleó en el paso de Información del checkout — segundo
   *  factor YA CONOCIDO para sondear `/api/checkout/retorno` tras el éxito, igual que
   *  `FormularioTarjeta` (§ CHECKOUT-NEQUI-EXITO-FIX-1: antes de este fix este componente no
   *  lo necesitaba porque nunca llegaba a mostrar una espera). */
  email: string;
}

// TEXTO PROVISIONAL — PENDIENTE DE TEXTO DEL OWNER (§ el reporte del slice, igual que
// `FormularioTarjeta.tsx`). Los rótulos del descriptor (`descriptor.campo.rotulo`/
// `.placeholder`) también son provisionales — se declaran en `lib/pagos/metodos-pasarela.ts`.
const TEXTO = {
  botonEnVuelo: 'Procesando…',
  errorGenerico: 'No pudimos procesar tu pago. Intenta de nuevo o usa otro método.',
  errorRed: 'No pudimos comunicarnos con el servidor. Intenta de nuevo.',
};

export default function FormularioOtroMetodoPasarela({ descriptor, aceptaciones, crearOrdenPasarela, monto, email }: FormularioOtroMetodoPasarelaProps) {
  const [terminosMarcado, setTerminosMarcado] = useState(false);
  const [datosMarcado, setDatosMarcado] = useState(false);
  const [dato, setDato] = useState('');
  const [errorDato, setErrorDato] = useState<string | null>(null);
  const [enVuelo, setEnVuelo] = useState(false);
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  // Presencia = éxito: la transacción quedó CREADA en Wompi (§ CHECKOUT-NEQUI-EXITO-FIX-1).
  // Mismo campo que `FormularioTarjeta.creada` — trae la `reference` de la orden que
  // `crearOrdenPasarela` acaba de crear (§ CHECKOUT-UNA-SOLA-PANTALLA-1), la clasificación de
  // 3DS y el desafío ya decodificado para que `EsperaConfirmacionTarjeta` sepa qué copy/marco
  // mostrar.
  const [creada, setCreada] = useState<{ reference: string; resultado3ds: Resultado3ds; desafioHtml: string | null } | null>(null);

  const aceptado = terminosMarcado && datosMarcado;

  const handlePagar = async () => {
    // Misma guarda de tipo que `FormularioTarjeta.handlePagar`: el botón ya está `disabled`
    // sin las dos aceptaciones — esto corta la re-entrada, no explica nada nuevo al comprador.
    if (enVuelo || !aceptado) return;

    // VALIDACIÓN LOCAL PRIMERO, SIN NINGUNA LLAMADA DE RED — mismo criterio que
    // `FormularioTarjeta`: un campo a medio llenar no dispara un intento de pago.
    const motivo = descriptor.campo.validar(dato);
    if (motivo) {
      setErrorDato(motivo);
      return;
    }
    setErrorDato(null);
    setErrorServidor(null);
    setEnVuelo(true);
    try {
      // § CHECKOUT-UNA-SOLA-PANTALLA-1: la orden se crea al apretar "Pagar", no antes —
      // IDEMPOTENTE (un reintento reusa la orden ya creada). `null` = la creación falló y la
      // página ya mostró el motivo; este formulario deja de avanzar sin repetir el error.
      const reference = await crearOrdenPasarela();
      if (!reference) {
        setEnVuelo(false);
        return;
      }
      const res = await fetch('/api/checkout', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reference,
          metodoPasarela: { tipo: descriptor.tipo, dato },
          aceptaciones: {
            terminos:        aceptaciones.terminos.token,
            datosPersonales: aceptaciones.datosPersonales.token,
          },
        }),
      });
      const body = await res.json().catch(() => null);
      // La clasificación PURA y testeada (§ CHECKOUT-NEQUI-EXITO-FIX-1) — ya NO se asume que
      // el servidor siempre falla: reconoce `tipo: 'creada'` y sigue el MISMO molde que
      // `FormularioTarjeta` para ese caso (`EsperaConfirmacionTarjeta`, abajo).
      const resultado = interpretarRespuestaOtroMetodo(body, TEXTO.errorGenerico);
      if (resultado.tipo === 'exito') {
        setCreada({ reference, resultado3ds: resultado.resultado3ds, desafioHtml: resultado.desafioHtml });
        return;
      }
      // Los dos casos de rechazo (`metodo_no_habilitado` y `error`) muestran su PROPIO mensaje
      // —el que el servidor decide, nunca inventado acá— inline: este formulario no tiene un
      // camino de salida distinto para el rechazo estructural (a diferencia de
      // `FormularioTarjeta.onMetodoNoHabilitado`, § el docstring de `SelectorMetodoPasarela`).
      setErrorServidor(resultado.mensaje);
    } catch (e) {
      setErrorServidor(e instanceof Error ? `${TEXTO.errorRed} (${e.message})` : TEXTO.errorRed);
    } finally {
      setEnVuelo(false);
    }
  };

  if (creada) {
    return (
      <div className="bg-[var(--sf-superficie)] rounded-xl p-4">
        <EsperaConfirmacionTarjeta
          reference={creada.reference}
          email={email}
          resultado3ds={creada.resultado3ds}
          desafioHtml={creada.desafioHtml}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 text-left">
      <AceptacionesPasarela
        aceptaciones={aceptaciones}
        terminosMarcado={terminosMarcado}
        datosMarcado={datosMarcado}
        onTerminosChange={setTerminosMarcado}
        onDatosChange={setDatosMarcado}
      />

      <div>
        <label className="block text-xs font-medium text-[var(--sf-texto)] mb-1.5">{descriptor.campo.rotulo}</label>
        <input
          type="text"
          inputMode="numeric"
          value={dato}
          onChange={(e) => setDato(e.target.value)}
          placeholder={descriptor.campo.placeholder}
          className="w-full px-4 py-3 bg-[var(--sf-fondo)] sf-borde border-[var(--sf-linea)] rounded-xl text-sm text-[var(--sf-tinta)] focus:outline-none focus:ring-2 focus:ring-[var(--sf-acento)]/20 focus:border-[var(--sf-acento)]"
        />
        {errorDato && <p className="mt-1 text-xs text-red-600">{errorDato}</p>}
      </div>

      {errorServidor && (
        <p className="text-xs text-red-600">{errorServidor}</p>
      )}

      <button
        type="button"
        onClick={handlePagar}
        disabled={!aceptado || enVuelo}
        className="w-full bg-[var(--sf-acento)] hover:bg-[var(--sf-acento-3)] disabled:opacity-60 text-[var(--sf-acento-txt)] font-bold py-3.5 rounded-xl text-sm transition-colors"
      >
        {enVuelo ? TEXTO.botonEnVuelo : `Pagar · ${formatCOP(monto)}`}
      </button>
    </div>
  );
}
