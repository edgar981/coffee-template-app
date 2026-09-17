'use client';

import { useState } from 'react';
import FormularioTarjeta from './FormularioTarjeta';
import FormularioOtroMetodoPasarela from './FormularioOtroMetodoPasarela';
import {
  DESCRIPTORES_METODO_PASARELA, agruparMetodosPasarelaPorInstrumento,
  type GrupoMetodoPasarela,
} from '@/lib/pagos/metodos-pasarela';
import type { AceptacionesWompi } from '@/types/payment';

// TEXTO PROVISIONAL — PENDIENTE DE TEXTO DEL OWNER (§ el reporte del slice). "Tarjeta" es la
// etiqueta de la opción que ya existía (antes sin picker, § API-DIRECTA-CAPTURA-TARJETA-1); la
// de cada método adicional sale de `descriptor.nombreVisible` (también provisional, declarado
// en `lib/pagos/metodos-pasarela.ts`).
const NOMBRE_TARJETA = 'Tarjeta de crédito o débito';

// El rótulo de cada PESTAÑA — uno por `GrupoMetodoPasarela` (§3 de API-DIRECTA-DECISIONES-
// PROGRAMA-1, DECISIONS.md; § CHECKOUT-PESTANAS-POR-INSTRUMENTO-1). TEXTO PROVISIONAL,
// PENDIENTE DE TEXTO DEL OWNER (§ el reporte del slice) — salvo 'tarjeta', que reusa
// `NOMBRE_TARJETA`, ya provisional desde antes de este slice.
const NOMBRES_PESTANA_PASARELA: Record<GrupoMetodoPasarela, string> = {
  tarjeta: NOMBRE_TARJETA,
  debito_bancario: 'Débito bancario',
  billeteras: 'Billeteras',
  financiacion_puntos: 'Financiación y puntos',
};

/** Una pestaña del picker: su grupo de instrumento y los tipos que agrupa. Para 'tarjeta',
 *  `tipos` es SIEMPRE `['tarjeta']` — un marcador interno, nunca un tipo real de
 *  `DESCRIPTORES_METODO_PASARELA` (§ abajo, `PESTANA_TARJETA`). Tipo LOCAL del componente, a
 *  propósito distinto de `GrupoDeMetodosPasarela` (`lib/pagos/metodos-pasarela.ts`): aquél
 *  excluye 'tarjeta' de `grupo` porque la tarjeta no vive en el registro que agrupa; acá SÍ
 *  necesitamos poder nombrar la pestaña de tarjeta. */
interface Pestana {
  grupo: GrupoMetodoPasarela;
  tipos: string[];
}

/** La pestaña de tarjeta, fija — TARJETA NO VIVE EN `DESCRIPTORES_METODO_PASARELA` (su flujo
 *  es propio, § el registro), así que esta pestaña NO sale de
 *  `agruparMetodosPasarelaPorInstrumento` (que sólo agrupa lo que SÍ tiene descriptor): se
 *  resuelve acá, a mano, como la primera pestaña siempre presente cuando el picker se muestra. */
const PESTANA_TARJETA: Pestana = { grupo: 'tarjeta', tipos: ['tarjeta'] };

export interface SelectorMetodoPasarelaProps {
  aceptaciones: AceptacionesWompi;
  publicKey: string;
  /** Crea la orden (si todavía no existe) y devuelve la `reference` de su intento de pago, o
   *  `null` si la creación falló (§ CHECKOUT-UNA-SOLA-PANTALLA-1). YA NO se recibe `reference`
   *  directa: este selector se monta ANTES de que la orden exista, bajo el radio de método en
   *  el paso de Pago — la orden nace al apretar el botón "Pagar" de cualquiera de los dos
   *  formularios que envuelve. */
  crearOrdenPasarela: () => Promise<string | null>;
  /** El monto a pagar, en pesos — el botón final de cada formulario lo muestra ("Pagar · $X"),
   *  § el reporte del slice: "el único botón que confirma dice cuánto se paga". */
  monto: number;
  /** El correo que el comprador tecleó en Información — segundo factor YA CONOCIDO para
   *  sondear el estado del pago (§ API-DIRECTA-3DS-SIN-CHALLENGE-1). Lo usan LOS DOS
   *  formularios: `FormularioTarjeta` desde que nació, y `FormularioOtroMetodoPasarela` desde
   *  § CHECKOUT-NEQUI-EXITO-FIX-1 (antes de ese fix no lo necesitaba porque nunca llegaba a
   *  mostrar una espera de confirmación). */
  email: string;
  /** Los tipos QUE NO SON TARJETA disponibles para ESTE comprador — el dueño los encendió Y
   *  su cuenta los tiene (§ `metodosPasarelaParaComprador`, `lib/pagos/metodos-pasarela.ts`,
   *  calculado por el servidor y entregado SIN CREAR ORDEN por `GET /api/pasarela/aceptaciones`
   *  desde § CHECKOUT-UNA-SOLA-PANTALLA-1 — antes viajaba pegado a la respuesta del POST).
   *  Vacío → sólo tarjeta, sin picker (byte-idéntico al comportamiento previo a este slice). */
  metodosOtros: string[];
  /** El proveedor rechazó la creación de la transacción de TARJETA porque su cuenta ya no
   *  tiene ese método habilitado (§ API-DIRECTA-DESALINEO-CABLEADO-1). Sólo aplica al camino
   *  de tarjeta — `FormularioOtroMetodoPasarela` no lo dispara, § el reporte del slice. */
  onMetodoNoHabilitado: () => void;
}

/**
 * La ranura de API DIRECTA gana un PICKER POR PESTAÑAS DE INSTRUMENTO cuando hay métodos QUE NO
 * SON TARJETA disponibles (§ API-DIRECTA-OTROS-METODOS-1, § CHECKOUT-PESTANAS-POR-INSTRUMENTO-1
 * — reemplaza la lista de radios apilada que este componente tenía antes: dentro del bloque de
 * pago ya hay un radio por MÉTODO DE PAGO, y otra lista de radios encima —una por MÉTODO DE
 * PASARELA— era "dos niveles de radios", exactamente lo que el owner pidió sacar). Con
 * `metodosOtros` vacío —el caso de HOY, sin ninguna billetera encendida por el dueño o
 * soportada por su cuenta— se comporta BYTE-IDÉNTICO a antes de este slice: sólo
 * `FormularioTarjeta`, sin picker ni pestañas.
 *
 * LAS PESTAÑAS SON POR INSTRUMENTO (tarjeta · débito bancario · billeteras · financiación y
 * puntos, § agruparMetodosPasarelaPorInstrumento, `lib/pagos/metodos-pasarela.ts`), NO una por
 * tipo: dos tipos del MISMO instrumento comparten pestaña. Una pestaña sin métodos NO SE
 * DIBUJA — con el registro de hoy (sólo NEQUI, billeteras) el resultado son DOS pestañas,
 * tarjeta y billeteras; débito bancario y financiación y puntos no aparecen.
 *
 * SI EL AGRUPADO DEJA UNA SOLA PESTAÑA (tarjeta sola, porque ningún tipo de `metodosOtros`
 * resolvió a un grupo con métodos — el registro del cliente y el del servidor divergieron), NO
 * SE DIBUJA NINGUNA PESTAÑA: una sola pestaña no sirve para elegir nada, así que se cae al MISMO
 * camino que `metodosOtros` vacío — `FormularioTarjeta` directo, sin chrome de picker.
 *
 * DENTRO de una pestaña con MÁS de un tipo (hoy no ocurre — billeteras sólo tiene NEQUI), una
 * fila de chips secundaria (BOTONES, no radios) deja elegir cuál — sigue siendo UN nivel de
 * radio (el formulario final), con selección por botones arriba, nunca una segunda lista de
 * `<input type="radio">`.
 *
 * AGREGAR EL TIPO SIGUIENTE NO TOCA ESTE COMPONENTE: declara su `grupo` en el descriptor
 * (`lib/pagos/metodos-pasarela.ts`) y aparece solo — en su pestaña existente si comparte grupo
 * con otro tipo, o en una pestaña nueva si es el primero de su grupo.
 */
export default function SelectorMetodoPasarela({
  aceptaciones, publicKey, crearOrdenPasarela, monto, email, metodosOtros, onMetodoNoHabilitado,
}: SelectorMetodoPasarelaProps) {
  const [tipoElegido, setTipoElegido] = useState<string>('tarjeta');

  const gruposOtros = agruparMetodosPasarelaPorInstrumento(metodosOtros);

  // `metodosOtros` vacío YA cae acá (agrupar [] da []) — la misma rama cubre las dos causas de
  // "no hay nada más que tarjeta" (§ el docstring de arriba, "SI EL AGRUPADO DEJA UNA SOLA
  // PESTAÑA"), sin dos checks separados.
  if (gruposOtros.length === 0) {
    return (
      <FormularioTarjeta
        aceptaciones={aceptaciones}
        publicKey={publicKey}
        crearOrdenPasarela={crearOrdenPasarela}
        monto={monto}
        email={email}
        onMetodoNoHabilitado={onMetodoNoHabilitado}
      />
    );
  }

  const pestanas: Pestana[] = [PESTANA_TARJETA, ...gruposOtros];
  // Derivado de `tipoElegido`, nunca estado propio — un `grupoElegido` separado podría
  // desincronizarse del tipo realmente activo (la misma razón por la que `loading` se deriva en
  // otras pantallas del panel en vez de setearse aparte).
  const pestanaActiva = pestanas.find((p) => p.tipos.includes(tipoElegido)) ?? pestanas[0];
  const descriptorElegido = tipoElegido !== 'tarjeta' ? DESCRIPTORES_METODO_PASARELA[tipoElegido] : null;

  return (
    <div className="space-y-4 text-left">
      <div role="tablist" aria-label="Elige cómo quieres pagar" className="flex gap-1 border-b-2 border-[var(--sf-linea)]">
        {pestanas.map((p) => (
          <button
            key={p.grupo}
            type="button"
            role="tab"
            aria-selected={pestanaActiva.grupo === p.grupo}
            onClick={() => setTipoElegido(p.tipos[0])}
            className={`px-4 py-2.5 -mb-0.5 text-sm font-medium border-b-2 transition-colors ${
              pestanaActiva.grupo === p.grupo
                ? 'border-[var(--sf-acento)] text-[var(--sf-tinta)]'
                : 'border-transparent text-[var(--sf-texto-suave)] hover:text-[var(--sf-tinta)]'
            }`}
          >
            {NOMBRES_PESTANA_PASARELA[p.grupo]}
          </button>
        ))}
      </div>

      {/* Selector SECUNDARIO, sólo si la pestaña activa agrupa MÁS de un tipo (§ el docstring
          de arriba) — botones, no radios: el instrumento ya se eligió arriba; esto elige CUÁL
          método de ese instrumento, un nivel más abajo, sin apilar una segunda lista de radios. */}
      {pestanaActiva.tipos.length > 1 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Elige el método">
          {pestanaActiva.tipos.map((tipo) => {
            const descriptor = DESCRIPTORES_METODO_PASARELA[tipo];
            if (!descriptor) return null;
            return (
              <button
                key={tipo}
                type="button"
                onClick={() => setTipoElegido(tipo)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  tipoElegido === tipo
                    ? 'border-[var(--sf-acento)] bg-[var(--sf-acento)]/10 text-[var(--sf-tinta)]'
                    : 'border-[var(--sf-linea)] text-[var(--sf-texto-suave)]'
                }`}
              >
                {descriptor.nombreVisible}
              </button>
            );
          })}
        </div>
      )}

      {tipoElegido === 'tarjeta' ? (
        <FormularioTarjeta
          aceptaciones={aceptaciones}
          publicKey={publicKey}
          crearOrdenPasarela={crearOrdenPasarela}
          monto={monto}
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
          publicKey={publicKey}
          crearOrdenPasarela={crearOrdenPasarela}
          monto={monto}
          email={email}
        />
      ) : null}
    </div>
  );
}
