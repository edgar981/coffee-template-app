'use client';

import { useState } from 'react';
import AceptacionesPasarela from './AceptacionesPasarela';
import type { AceptacionesWompi } from '@/types/payment';
import type { DescriptorMetodoPasarela } from '@/lib/pagos/metodos-pasarela';

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
 * LA CONFIRMACIÓN CONTRA NUESTRO SERVIDOR RESPONDE `no_implementado`, A PROPÓSITO — HONESTO
 * sobre el límite de este slice: enviar el pago de verdad a Wompi para un tipo que no es
 * tarjeta exige generalizar `lib/pagos/wompi-api.ts` (fuera de `touches` de este slice, ver el
 * reporte), y esta pantalla nunca pretende que el proveedor respondió algo que nunca se le
 * preguntó. El mensaje que se muestra es el que el servidor ya decide (`error`), NUNCA
 * inventado en el cliente.
 */
export interface FormularioOtroMetodoPasarelaProps {
  descriptor: DescriptorMetodoPasarela;
  aceptaciones: AceptacionesWompi;
  /** La `reference` del intento YA CREADO (§ el POST de `/api/checkout`). */
  reference: string;
}

// TEXTO PROVISIONAL — PENDIENTE DE TEXTO DEL OWNER (§ el reporte del slice, igual que
// `FormularioTarjeta.tsx`). Los rótulos del descriptor (`descriptor.campo.rotulo`/
// `.placeholder`) también son provisionales — se declaran en `lib/pagos/metodos-pasarela.ts`.
const TEXTO = {
  botonReposo: 'Pagar',
  botonEnVuelo: 'Procesando…',
  errorGenerico: 'No pudimos procesar tu pago. Intenta de nuevo o usa otro método.',
  errorRed: 'No pudimos comunicarnos con el servidor. Intenta de nuevo.',
};

export default function FormularioOtroMetodoPasarela({ descriptor, aceptaciones, reference }: FormularioOtroMetodoPasarelaProps) {
  const [terminosMarcado, setTerminosMarcado] = useState(false);
  const [datosMarcado, setDatosMarcado] = useState(false);
  const [dato, setDato] = useState('');
  const [errorDato, setErrorDato] = useState<string | null>(null);
  const [enVuelo, setEnVuelo] = useState(false);
  const [errorServidor, setErrorServidor] = useState<string | null>(null);

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
      const body = await res.json().catch(() => null) as { error?: string } | null;
      // El servidor SIEMPRE responde `no_implementado` para este camino hoy (§ el docstring
      // de este componente) — se muestra su `error` tal cual, nunca un texto inventado acá.
      setErrorServidor(typeof body?.error === 'string' ? body.error : TEXTO.errorGenerico);
    } catch (e) {
      setErrorServidor(e instanceof Error ? `${TEXTO.errorRed} (${e.message})` : TEXTO.errorRed);
    } finally {
      setEnVuelo(false);
    }
  };

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
        {enVuelo ? TEXTO.botonEnVuelo : TEXTO.botonReposo}
      </button>
    </div>
  );
}
