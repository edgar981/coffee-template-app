'use client';

import type { AceptacionesWompi } from '@/types/payment';

/**
 * Las DOS casillas de aceptación que Wompi exige antes de poder crear la transacción
 * (§ API-DIRECTA-DECISIONES-PROGRAMA-1 §4, DECISIONS.md). El copy es el que fijó el owner —
 * NO es texto provisional de este slice—, y los DOS enlaces se renderizan SIEMPRE desde la
 * respuesta del proveedor (`aceptaciones.terminos.enlace` / `aceptaciones.datosPersonales.
 * enlace`), nunca hardcodeados: el proveedor exige mostrar la versión más reciente del
 * documento, y un enlace fijo en el código podría apuntar a una versión vieja.
 *
 * SON DOS CASILLAS SEPARADAS a propósito (razón del owner): son dos aceptaciones distintas, y
 * juntarlas en una sola haría que el comprador acepte dos cosas con un solo gesto.
 */
export interface AceptacionesPasarelaProps {
  aceptaciones: AceptacionesWompi;
  terminosMarcado: boolean;
  datosMarcado: boolean;
  onTerminosChange: (marcado: boolean) => void;
  onDatosChange: (marcado: boolean) => void;
}

export default function AceptacionesPasarela({
  aceptaciones, terminosMarcado, datosMarcado, onTerminosChange, onDatosChange,
}: AceptacionesPasarelaProps) {
  return (
    <div className="space-y-2">
      <label className="flex items-start gap-2 text-xs text-[var(--sf-texto)] cursor-pointer">
        <input
          type="checkbox"
          checked={terminosMarcado}
          onChange={(e) => onTerminosChange(e.target.checked)}
          className="mt-0.5 accent-[var(--sf-acento)]"
        />
        <span>
          Acepto los{' '}
          <a
            href={aceptaciones.terminos.enlace}
            target="_blank"
            rel="noopener noreferrer"
            className="underline text-[var(--sf-acento-texto)]"
            onClick={(e) => e.stopPropagation()}
          >
            términos y condiciones de uso
          </a>
        </span>
      </label>
      <label className="flex items-start gap-2 text-xs text-[var(--sf-texto)] cursor-pointer">
        <input
          type="checkbox"
          checked={datosMarcado}
          onChange={(e) => onDatosChange(e.target.checked)}
          className="mt-0.5 accent-[var(--sf-acento)]"
        />
        <span>
          Autorizo el{' '}
          <a
            href={aceptaciones.datosPersonales.enlace}
            target="_blank"
            rel="noopener noreferrer"
            className="underline text-[var(--sf-acento-texto)]"
            onClick={(e) => e.stopPropagation()}
          >
            tratamiento de mis datos personales
          </a>
        </span>
      </label>
    </div>
  );
}
