'use client';

import { useState } from 'react';
import FormularioTarjeta from './FormularioTarjeta';
import FormularioOtroMetodoPasarela from './FormularioOtroMetodoPasarela';
import { DESCRIPTORES_METODO_PASARELA } from '@/lib/pagos/metodos-pasarela';
import type { AceptacionesWompi } from '@/types/payment';

// TEXTO PROVISIONAL — PENDIENTE DE TEXTO DEL OWNER (§ el reporte del slice). "Tarjeta" es la
// etiqueta de la opción que ya existía (antes sin picker, § API-DIRECTA-CAPTURA-TARJETA-1); la
// de cada método adicional sale de `descriptor.nombreVisible` (también provisional, declarado
// en `lib/pagos/metodos-pasarela.ts`).
const NOMBRE_TARJETA = 'Tarjeta de crédito o débito';

export interface SelectorMetodoPasarelaProps {
  aceptaciones: AceptacionesWompi;
  publicKey: string;
  reference: string;
  /** El correo que el comprador tecleó en Información — segundo factor YA CONOCIDO para
   *  sondear el estado del pago (§ API-DIRECTA-3DS-SIN-CHALLENGE-1). Lo usan LOS DOS
   *  formularios: `FormularioTarjeta` desde que nació, y `FormularioOtroMetodoPasarela` desde
   *  § CHECKOUT-NEQUI-EXITO-FIX-1 (antes de ese fix no lo necesitaba porque nunca llegaba a
   *  mostrar una espera de confirmación). */
  email: string;
  /** Los tipos QUE NO SON TARJETA disponibles para ESTE comprador — el dueño los encendió Y
   *  su cuenta los tiene (§ `metodosPasarelaParaComprador`, `lib/pagos/metodos-pasarela.ts`,
   *  calculado por el servidor en el POST de `/api/checkout`). Vacío → sólo tarjeta, sin
   *  picker (byte-idéntico al comportamiento previo a este slice). */
  metodosOtros: string[];
  /** El proveedor rechazó la creación de la transacción de TARJETA porque su cuenta ya no
   *  tiene ese método habilitado (§ API-DIRECTA-DESALINEO-CABLEADO-1). Sólo aplica al camino
   *  de tarjeta — `FormularioOtroMetodoPasarela` no lo dispara, § el reporte del slice. */
  onMetodoNoHabilitado: () => void;
}

/**
 * La ranura de API DIRECTA gana un SELECTOR de tipo cuando hay métodos QUE NO SON TARJETA
 * disponibles (§ API-DIRECTA-OTROS-METODOS-1). Con `metodosOtros` vacío —el caso de HOY, sin
 * ninguna billetera encendida por el dueño o soportada por su cuenta— se comporta
 * BYTE-IDÉNTICO a antes de este slice: sólo `FormularioTarjeta`, sin picker.
 *
 * AGREGAR EL TIPO SIGUIENTE NO TOCA ESTE COMPONENTE: itera `metodosOtros` y busca cada tipo en
 * `DESCRIPTORES_METODO_PASARELA` — un tipo con descriptor nuevo aparece solo.
 */
export default function SelectorMetodoPasarela({
  aceptaciones, publicKey, reference, email, metodosOtros, onMetodoNoHabilitado,
}: SelectorMetodoPasarelaProps) {
  const [tipoElegido, setTipoElegido] = useState<string>('tarjeta');

  if (metodosOtros.length === 0) {
    return (
      <FormularioTarjeta
        aceptaciones={aceptaciones}
        publicKey={publicKey}
        reference={reference}
        email={email}
        onMetodoNoHabilitado={onMetodoNoHabilitado}
      />
    );
  }

  const descriptorElegido = tipoElegido !== 'tarjeta' ? DESCRIPTORES_METODO_PASARELA[tipoElegido] : null;

  return (
    <div className="space-y-4 text-left">
      <div className="space-y-2">
        <label
          className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${tipoElegido === 'tarjeta' ? 'border-[var(--sf-acento)] bg-[var(--sf-acento)]/5' : 'border-[var(--sf-linea)]'}`}
        >
          <input
            type="radio" name="metodo-pasarela" checked={tipoElegido === 'tarjeta'}
            onChange={() => setTipoElegido('tarjeta')} className="accent-[var(--sf-acento)]"
          />
          <span className="text-sm font-medium text-[var(--sf-tinta)]">{NOMBRE_TARJETA}</span>
        </label>
        {metodosOtros.map((tipo) => {
          const descriptor = DESCRIPTORES_METODO_PASARELA[tipo];
          // Un tipo sin descriptor no debería llegar acá (el servidor ya filtra por
          // `metodosPasarelaParaComprador`), pero si el registro del cliente y el del
          // servidor llegaran a divergir, se omite en silencio en vez de romper el picker.
          if (!descriptor) return null;
          return (
            <label
              key={tipo}
              className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${tipoElegido === tipo ? 'border-[var(--sf-acento)] bg-[var(--sf-acento)]/5' : 'border-[var(--sf-linea)]'}`}
            >
              <input
                type="radio" name="metodo-pasarela" checked={tipoElegido === tipo}
                onChange={() => setTipoElegido(tipo)} className="accent-[var(--sf-acento)]"
              />
              <span className="text-sm font-medium text-[var(--sf-tinta)]">{descriptor.nombreVisible}</span>
            </label>
          );
        })}
      </div>

      {tipoElegido === 'tarjeta' ? (
        <FormularioTarjeta
          aceptaciones={aceptaciones}
          publicKey={publicKey}
          reference={reference}
          email={email}
          onMetodoNoHabilitado={onMetodoNoHabilitado}
        />
      ) : descriptorElegido ? (
        // `key` fuerza un remonte al cambiar de tipo: cada tipo tiene su propio estado de
        // campo/aceptaciones, y no debe sobrevivir al cambiar de selección.
        <FormularioOtroMetodoPasarela
          key={descriptorElegido.tipo}
          descriptor={descriptorElegido}
          aceptaciones={aceptaciones}
          reference={reference}
          email={email}
        />
      ) : null}
    </div>
  );
}
