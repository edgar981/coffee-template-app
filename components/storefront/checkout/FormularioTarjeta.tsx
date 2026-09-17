'use client';

import { useState } from 'react';
import {
  numeroTarjetaValido, parseVencimiento, vencimientoVigente, codigoSeguridadValido, nombreTitularValido,
} from '@/lib/checkout/tarjeta';
import {
  tokenizarTarjeta, TokenizacionError, confirmarTransaccionTarjeta, CreacionTransaccionError,
} from '@/services/checkout.service';
import type { AceptacionesWompi } from '@/types/payment';
import AceptacionesPasarela from './AceptacionesPasarela';

/**
 * El camino de API DIRECTA del pago con tarjeta (§ API-DIRECTA-CAPTURA-TARJETA-1): las dos
 * casillas de aceptación de Wompi + el formulario de tarjeta, tokenizado CONTRA EL PROVEEDOR
 * desde este mismo componente, y la transacción CONFIRMADA contra NUESTRO servidor
 * (§ API-DIRECTA-DESALINEO-CABLEADO-1, `confirmarTransaccionTarjeta`) apenas se obtiene el
 * token. Ocupa la MISMA ranura que `PagoPasarela` (el widget) — nunca se montan los dos a la
 * vez; la elección la hace `pasarelaModoApiDirecta()` en la página (`checkout/page.tsx`).
 *
 * LOS DATOS DE LA TARJETA NUNCA SALEN HACIA NUESTRO SERVIDOR: `campos` sólo se lee al armar
 * el body de `tokenizarTarjeta` (que llama directo a Wompi) y nunca se manda a `/api/checkout`
 * ni a ningún otro endpoint propio, ni se registra en consola. Lo único que SÍ viaja a
 * `/api/checkout` es el TOKEN opaco que Wompi ya devolvió, para crear la transacción.
 *
 * SIN SELECTOR DE CUOTAS: se cobra en una — ofrecer cuotas es una decisión de negocio con
 * consecuencias de liquidación que nadie midió y nadie decidió (anotado por el orquestador,
 * no construido acá).
 *
 * SI EL PROVEEDOR RECHAZA LA CREACIÓN PORQUE LA CUENTA YA NO TIENE EL MÉTODO HABILITADO
 * (`CreacionTransaccionError.tipo === 'metodo_no_habilitado'`) — un rechazo ESTRUCTURAL, no
 * de la tarjeta que se tecleó—, este componente NO deja al comprador reintentando contra la
 * misma pared: llama a `onMetodoNoHabilitado` y la PÁGINA (`checkout/page.tsx`) es quien
 * decide qué mostrar en su lugar (§ el reporte del slice). Las otras dos ramas de fallo
 * (`firma_invalida`, `otro_fallo`) sí pueden ser transitorias y se muestran inline, como
 * cualquier error de tokenización.
 */
export interface FormularioTarjetaProps {
  aceptaciones: AceptacionesWompi;
  publicKey: string;
  /** La `reference` del intento YA CREADO (§ el POST de `/api/checkout`) — la misma que
   *  `confirmarTransaccionTarjeta` necesita para completarlo. */
  reference: string;
  /** El proveedor rechazó la creación porque la cuenta ya no tiene este método habilitado
   *  (§ arriba). La página decide cómo continuar — este componente no lo intenta de nuevo. */
  onMetodoNoHabilitado: () => void;
}

interface CamposTarjeta {
  numero: string;
  vencimiento: string;
  cvv: string;
  nombreTitular: string;
}

type ErroresTarjeta = Partial<Record<keyof CamposTarjeta, string>>;

const CAMPOS_VACIOS: CamposTarjeta = { numero: '', vencimiento: '', cvv: '', nombreTitular: '' };

// TEXTO PROVISIONAL — PENDIENTE DE TEXTO DEL OWNER (§ API-DIRECTA-CAPTURA-TARJETA-1, reporte
// del slice). Los mensajes de error de validación y el estado tras obtener el token son
// nuevos y no tienen copy fijado todavía; se eligieron claros y honestos para no bloquear el
// slice, no como el texto final.
const TEXTO = {
  numero:        'Revisa el número de la tarjeta.',
  vencimiento:   'La fecha de vencimiento no es válida.',
  cvv:            'El código de seguridad no es válido.',
  nombreTitular: 'Escribe el nombre tal como aparece en la tarjeta.',
  tokenizacionGenerico: 'No pudimos verificar tu tarjeta. Revisa los datos e intenta de nuevo.',
  botonReposo: 'Pagar',
  botonEnVuelo: 'Verificando tarjeta…',
  tokenObtenido: 'Tu tarjeta quedó verificada. Estamos procesando tu pago…',
};

export default function FormularioTarjeta({ aceptaciones, publicKey, reference, onMetodoNoHabilitado }: FormularioTarjetaProps) {
  const [terminosMarcado, setTerminosMarcado] = useState(false);
  const [datosMarcado, setDatosMarcado] = useState(false);
  const [campos, setCampos] = useState<CamposTarjeta>(CAMPOS_VACIOS);
  const [errores, setErrores] = useState<ErroresTarjeta>({});
  const [tokenizando, setTokenizando] = useState(false);
  const [errorTokenizacion, setErrorTokenizacion] = useState<string | null>(null);
  // Presencia = éxito COMPLETO: el token se obtuvo Y la transacción quedó creada en Wompi
  // (§ API-DIRECTA-DESALINEO-CABLEADO-1) — nunca se pone en `true` sólo por tokenizar.
  const [tokenObtenido, setTokenObtenido] = useState<string | null>(null);

  const aceptado = terminosMarcado && datosMarcado;

  const handlePagar = async () => {
    // El botón ya está `disabled` sin las dos aceptaciones — esta es la guarda de tipo, no
    // una segunda explicación para el comprador (mismo patrón que `handleOrder` en la página).
    if (tokenizando || !aceptado) return;

    // VALIDACIÓN LOCAL PRIMERO, SIN NINGUNA LLAMADA DE RED: un formulario a medio llenar no es
    // un intento de pago fallido (decisión del orquestador, § API-DIRECTA-CAPTURA-TARJETA-1) —
    // "crear una orden por cada dígito equivocado llenaría el libro de Pagos de basura". Estos
    // reintentos NO tocan `/api/checkout` en absoluto: la orden ya existe (se creó al confirmar
    // el pedido, antes de llegar a esta pantalla) y no se crea una nueva por cada intento.
    const nuevosErrores: ErroresTarjeta = {};
    if (!numeroTarjetaValido(campos.numero)) nuevosErrores.numero = TEXTO.numero;
    const venc = parseVencimiento(campos.vencimiento);
    if (!venc || !vencimientoVigente(venc)) nuevosErrores.vencimiento = TEXTO.vencimiento;
    if (!codigoSeguridadValido(campos.cvv)) nuevosErrores.cvv = TEXTO.cvv;
    if (!nombreTitularValido(campos.nombreTitular)) nuevosErrores.nombreTitular = TEXTO.nombreTitular;

    if (Object.keys(nuevosErrores).length > 0 || !venc) {
      setErrores(nuevosErrores);
      return;
    }
    setErrores({});
    setErrorTokenizacion(null);
    setTokenizando(true);
    try {
      const token = await tokenizarTarjeta(
        {
          numero:        campos.numero.replace(/\s+/g, ''),
          mes:            String(venc.mes).padStart(2, '0'),
          anio:           String(venc.anio % 100).padStart(2, '0'),
          cvv:            campos.cvv.trim(),
          nombreTitular:  campos.nombreTitular.trim(),
        },
        publicKey,
      );
      // El token es OPACO (nunca datos de tarjeta) — recién con él se puede confirmar la
      // transacción contra NUESTRO servidor (§ API-DIRECTA-DESALINEO-CABLEADO-1). Las DOS
      // aceptaciones que el comprador ya marcó viajan de nuevo, tal cual las vio (no son
      // secretas: § `FormularioTarjetaProps`).
      await confirmarTransaccionTarjeta({
        reference,
        tokenTarjeta: token,
        aceptaciones: {
          terminos:        aceptaciones.terminos.token,
          datosPersonales: aceptaciones.datosPersonales.token,
        },
      });
      // SI CUALQUIERA DE LAS DOS LLAMADAS FALLA, el comprador se queda EN ESTE FORMULARIO con
      // el error a la vista — no hay redirección, no hay pantalla nueva, y nada más se crea.
      // La ÚNICA excepción es el rechazo ESTRUCTURAL de abajo, que no vuelve a este formulario.
      setTokenObtenido(token);
    } catch (e) {
      if (e instanceof CreacionTransaccionError && e.tipo === 'metodo_no_habilitado') {
        // El proveedor YA RECHAZÓ el método para esta cuenta — no es la tarjeta que se
        // tecleó. Reintentar con otro número no cambia nada, así que este formulario no
        // ofrece reintentar: la página decide qué mostrar en su lugar (§ el docstring).
        onMetodoNoHabilitado();
        return;
      }
      setErrorTokenizacion(
        e instanceof TokenizacionError || e instanceof CreacionTransaccionError
          ? e.message
          : TEXTO.tokenizacionGenerico,
      );
    } finally {
      setTokenizando(false);
    }
  };

  if (tokenObtenido) {
    return (
      <div className="bg-[var(--sf-superficie)] rounded-xl p-4 text-sm text-[var(--sf-texto)] text-center">
        {TEXTO.tokenObtenido}
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

      <div className="space-y-3">
        <CampoTarjeta
          label="Número de la tarjeta"
          value={campos.numero}
          onChange={(v) => setCampos((c) => ({ ...c, numero: v }))}
          error={errores.numero}
          inputMode="numeric"
          placeholder="0000 0000 0000 0000"
        />
        <div className="grid grid-cols-2 gap-3">
          <CampoTarjeta
            label="Vencimiento"
            value={campos.vencimiento}
            onChange={(v) => setCampos((c) => ({ ...c, vencimiento: v }))}
            error={errores.vencimiento}
            placeholder="MM/AA"
          />
          <CampoTarjeta
            label="Código de seguridad"
            value={campos.cvv}
            onChange={(v) => setCampos((c) => ({ ...c, cvv: v }))}
            error={errores.cvv}
            inputMode="numeric"
            placeholder="123"
          />
        </div>
        <CampoTarjeta
          label="Nombre del titular"
          value={campos.nombreTitular}
          onChange={(v) => setCampos((c) => ({ ...c, nombreTitular: v }))}
          error={errores.nombreTitular}
          placeholder="Como aparece en la tarjeta"
        />
      </div>

      {errorTokenizacion && (
        <p className="text-xs text-red-600">{errorTokenizacion}</p>
      )}

      <button
        type="button"
        onClick={handlePagar}
        disabled={!aceptado || tokenizando}
        className="w-full bg-[var(--sf-acento)] hover:bg-[var(--sf-acento-3)] disabled:opacity-60 text-[var(--sf-acento-txt)] font-bold py-3.5 rounded-xl text-sm transition-colors"
      >
        {tokenizando ? TEXTO.botonEnVuelo : TEXTO.botonReposo}
      </button>
    </div>
  );
}

interface CampoTarjetaProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  placeholder?: string;
  inputMode?: 'numeric' | 'text';
}

function CampoTarjeta({ label, value, onChange, error, placeholder, inputMode }: CampoTarjetaProps) {
  return (
    <div>
      <label className="block text-xs font-medium text-[var(--sf-texto)] mb-1.5">{label}</label>
      <input
        type="text"
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-3 bg-[var(--sf-fondo)] sf-borde border-[var(--sf-linea)] rounded-xl text-sm text-[var(--sf-tinta)] focus:outline-none focus:ring-2 focus:ring-[var(--sf-acento)]/20 focus:border-[var(--sf-acento)]"
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
