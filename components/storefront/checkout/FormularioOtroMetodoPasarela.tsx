'use client';

import { useState } from 'react';
import AceptacionesPasarela from './AceptacionesPasarela';
import EsperaConfirmacionTarjeta from './EsperaConfirmacionTarjeta';
import { interpretarRespuestaOtroMetodo } from './interpretar-respuesta-otro-metodo';
import type { AceptacionesWompi } from '@/types/payment';
import { type DescriptorMetodoPasarela, camposVisibles, esAmbientePruebasPorLlave } from '@/lib/pagos/metodos-pasarela';
import type { Resultado3ds } from '@/lib/pagos/tres-ds';
import { formatCOP } from '@duna/core/utils';

/**
 * El camino de API DIRECTA para un método de pasarela QUE NO ES TARJETA (§ API-DIRECTA-OTROS-
 * METODOS-1): las dos casillas de aceptación (`AceptacionesPasarela` — reusada TAL CUAL, sin
 * cambios; valen igual para este tipo que para la tarjeta, § el reporte del slice) + el campo
 * que el descriptor pide, validado con la MISMA función que el servidor vuelve a correr
 * (`descriptor.campos[0].validar`) antes de aceptar el dato.
 *
 * § API-DIRECTA-FORMA-TRES-DIMENSIONES-1: LEE `descriptor.campos`, NO `descriptor.campo` —
 * `campos` es el array general que la forma nueva declara (§ `lib/pagos/metodos-pasarela.ts`),
 * FILTRADO por `camposVisibles` para respetar `soloPruebas` (un campo que sólo existe en el
 * ambiente de pruebas del proveedor NO se renderiza fuera de él, §2 del reporte del slice) —
 * `esAmbientePruebasPorLlave(publicKey)` decide el ambiente por el MISMO hecho medido que ya
 * usa `baseUrlPasarelaDesdeLlave` (`services/checkout.service.ts`) para elegir el host, no una
 * segunda fuente. Sigue rindiendo UN SOLO campo a propósito: el wire hacia
 * `app/api/checkout/route.ts` (Tier 1, fuera de `touches` de ese slice) sólo sabe mandar un
 * `dato: string`, así que este formulario no puede someter más de uno todavía — el ÚNICO
 * descriptor real (`DESCRIPTOR_NEQUI`) declara exactamente uno, sin `soloPruebas`, así que hoy
 * esto no cambia nada de lo que el comprador ve (§ el reporte del slice, "la pantalla del
 * método que ya existía no cambió"). Renderizar N campos generales quedaría a medias mientras
 * el wire sólo lleve uno — ver el reporte del slice para el gap.
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
  /** La llave PÚBLICA de la pasarela — SÓLO para derivar el ambiente (`esAmbientePruebasPorLlave`,
   *  arriba) y decidir qué campos `soloPruebas` mostrar. La misma que `FormularioTarjeta` usa
   *  para tokenizar; acá nunca se manda a ningún lado, sólo se lee su prefijo. */
  publicKey: string;
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
// `FormularioTarjeta.tsx`). Los rótulos del descriptor (`campo.rotulo`/`.placeholder`, abajo)
// también son provisionales — se declaran en `lib/pagos/metodos-pasarela.ts`.
const TEXTO = {
  botonEnVuelo: 'Procesando…',
  errorGenerico: 'No pudimos procesar tu pago. Intenta de nuevo o usa otro método.',
  errorRed: 'No pudimos comunicarnos con el servidor. Intenta de nuevo.',
};

export default function FormularioOtroMetodoPasarela({ descriptor, aceptaciones, publicKey, crearOrdenPasarela, monto, email }: FormularioOtroMetodoPasarelaProps) {
  // § API-DIRECTA-FORMA-TRES-DIMENSIONES-1: EL PRIMER campo VISIBLE en este ambiente — filtra
  // `soloPruebas` antes de elegir cuál rendir (ver el docstring de arriba para por qué este
  // formulario sólo rinde uno pese a que la forma admite varios). Estructuralmente garantizado
  // no-vacío: el ÚNICO descriptor real (`DESCRIPTOR_NEQUI`) declara un campo que NO es
  // `soloPruebas`, así que sobrevive el filtro en cualquier ambiente.
  const campo = camposVisibles(descriptor, esAmbientePruebasPorLlave(publicKey))[0] ?? descriptor.campos[0];
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
    const motivo = campo.validar(dato);
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
    // § CHECKOUT-COPY-Y-ORDEN-PASARELA-1: EL ORDEN ES campos del método → ACEPTACIONES →
    // botón Pagar — mismo cambio que `FormularioTarjeta`, misma razón (las dos casillas van
    // justo encima del botón, donde se leen antes de apretar).
    <div className="space-y-4 text-left">
      <div>
        <label className="block text-xs font-medium text-[var(--sf-texto)] mb-1.5">{campo.rotulo}</label>
        <input
          type="text"
          inputMode="numeric"
          value={dato}
          onChange={(e) => setDato(e.target.value)}
          // `.placeholder` sólo existe en la naturaleza `texto_libre` (unión discriminada,
          // § `lib/pagos/metodos-pasarela.ts`) — el ÚNICO descriptor real hoy (NEQUI) es de esa
          // naturaleza, así que este ternario no cambia nada de lo que el comprador ve.
          placeholder={campo.naturaleza === 'texto_libre' ? campo.placeholder : undefined}
          className="w-full px-4 py-3 bg-[var(--sf-fondo)] sf-borde border-[var(--sf-linea)] rounded-xl text-sm text-[var(--sf-tinta)] focus:outline-none focus:ring-2 focus:ring-[var(--sf-acento)]/20 focus:border-[var(--sf-acento)]"
        />
        {errorDato && <p className="mt-1 text-xs text-red-600">{errorDato}</p>}
      </div>

      <AceptacionesPasarela
        aceptaciones={aceptaciones}
        terminosMarcado={terminosMarcado}
        datosMarcado={datosMarcado}
        onTerminosChange={setTerminosMarcado}
        onDatosChange={setDatosMarcado}
      />

      {errorServidor && (
        <p className="text-xs text-red-600">{errorServidor}</p>
      )}

      <button
        type="button"
        onClick={handlePagar}
        disabled={!aceptado || enVuelo}
        className="w-full bg-[var(--sf-acento)] hover:bg-[var(--sf-acento-3)] disabled:opacity-60 disabled:pointer-events-none text-[var(--sf-acento-txt)] font-bold py-3.5 rounded-xl text-sm transition-colors"
      >
        {enVuelo ? TEXTO.botonEnVuelo : `Pagar · ${formatCOP(monto)}`}
      </button>
    </div>
  );
}
