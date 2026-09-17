'use client';

import { useState } from 'react';
import {
  numeroTarjetaValido, parseVencimiento, vencimientoVigente, codigoSeguridadValido, nombreTitularValido,
} from '@/lib/checkout/tarjeta';
import {
  tokenizarTarjeta, TokenizacionError, CreacionTransaccionError,
} from '@/services/checkout.service';
import type { AceptacionesWompi, ResultadoCreacionTransaccionWompi } from '@/types/payment';
import { recolectarDatosNavegador3ds, type Resultado3ds } from '@/lib/pagos/tres-ds';
import { formatCOP } from '@duna/core/utils';
import AceptacionesPasarela from './AceptacionesPasarela';
import EsperaConfirmacionTarjeta from './EsperaConfirmacionTarjeta';

/**
 * El camino de API DIRECTA del pago con tarjeta (§ API-DIRECTA-CAPTURA-TARJETA-1): las dos
 * casillas de aceptación de Wompi + el formulario de tarjeta, tokenizado CONTRA EL PROVEEDOR
 * desde este mismo componente, y la transacción CONFIRMADA contra NUESTRO servidor
 * (§ API-DIRECTA-DESALINEO-CABLEADO-1) apenas se obtiene el token — con la autenticación 3DS
 * pedida SIEMPRE (§ API-DIRECTA-3DS-SIN-CHALLENGE-1, "no hay interruptor") y, tras crearse la
 * transacción, la ESPERA con sondeo hasta el estado final (`EsperaConfirmacionTarjeta`, § el
 * reporte del slice §C/§D) — que ahora también puede mostrar el marco aislado del DESAFÍO
 * (§ API-DIRECTA-3DS-CON-CHALLENGE-1) cuando el emisor lo pide. Ocupa la MISMA ranura que
 * `PagoPasarela` (el widget) — nunca se montan los dos a la vez; la elección la hace
 * `pasarelaModoApiDirecta()` en la página (`checkout/page.tsx`).
 *
 * § CHECKOUT-UNA-SOLA-PANTALLA-1: ESTE FORMULARIO YA NO RECIBE `reference` — la orden (y su
 * intento de pago) TODAVÍA NO EXISTEN cuando este componente se monta: se muestra apenas el
 * comprador elige la pasarela en el selector de método, bajo el radio, en la MISMA pantalla.
 * El botón "Pagar" de este formulario es el ÚNICO que confirma: tokeniza la tarjeta (no
 * necesita ninguna orden — el proveedor no la conoce), y SÓLO ENTONCES pide `crearOrdenPasarela`
 * —la orden se crea al apretar este botón, no antes— para obtener la `reference` que la
 * confirmación de la transacción necesita. `crearOrdenPasarela` es IDEMPOTENTE: si la orden ya
 * existe (un reintento tras un fallo de la confirmación), la reusa en vez de crear una segunda.
 *
 * LOS DATOS DE LA TARJETA NUNCA SALEN HACIA NUESTRO SERVIDOR: `campos` sólo se lee al armar
 * el body de `tokenizarTarjeta` (que llama directo a Wompi) y nunca se manda a `/api/checkout`
 * ni a ningún otro endpoint propio, ni se registra en consola. Lo único que SÍ viaja a
 * `/api/checkout` es el TOKEN opaco que Wompi ya devolvió (para crear la transacción) y los
 * DATOS DEL NAVEGADOR que 3DS pide (`recolectarDatosNavegador3ds`, `lib/pagos/tres-ds.ts`) —
 * entorno del navegador, NUNCA un campo de la tarjeta (§ el reporte del slice, §B).
 *
 * LA CONFIRMACIÓN NO PASA POR `confirmarTransaccionTarjeta` (`services/checkout.service.ts`):
 * ese archivo NO está en `touches:` de este slice, y extender su body/respuesta para 3DS
 * habría exigido tocarlo. Este componente hace su PROPIO `fetch` al mismo `PATCH /api/checkout`
 * (`confirmarConAutenticacion3ds`, abajo), reusando `CreacionTransaccionError` (importado, no
 * redefinido) para la forma del error. `confirmarTransaccionTarjeta` queda SIN llamadores desde
 * este archivo — anotado como open_followup del reporte del slice, no resuelto acá.
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
  /** Crea la orden (si todavía no existe) y devuelve la `reference` de su intento de pago, o
   *  `null` si la creación falló (la página ya mostró el motivo — stock, error del servidor).
   *  IDEMPOTENTE: si la orden ya existe (un reintento), la reusa. */
  crearOrdenPasarela: () => Promise<string | null>;
  /** El monto a pagar, en pesos — para el texto del botón ("Pagar · $X"), § el reporte del
   *  slice: "el único botón que confirma dice cuánto se paga". */
  monto: number;
  /** El correo que el comprador tecleó en el paso de Información del checkout (§ el reporte
   *  del slice, §C) — segundo factor YA CONOCIDO para sondear `/api/checkout/retorno` sin
   *  volver a pedirlo (a diferencia de `RetornoCliente.tsx`, que lo pide porque llega por una
   *  URL que un tercero podría leer). */
  email: string;
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
  botonEnVuelo: 'Verificando tarjeta…',
};

const TEXTO_CREACION_TRANSACCION_GENERICO = 'No pudimos procesar tu pago. Intenta de nuevo o usa otro método.';

/**
 * ESPEJO de `confirmarTransaccionTarjeta` (`services/checkout.service.ts`,
 * § API-DIRECTA-DESALINEO-CABLEADO-1) EXTENDIDO con los datos del navegador que 3DS exige y con
 * la lectura de `autenticacion3ds`/`desafioHtml` de la respuesta — ver el docstring de este
 * componente para el porqué de la duplicación (esa función no está en `touches:` de este
 * slice). Comparte `CreacionTransaccionError` (importado, no redefinido) para que `handlePagar`
 * no tenga que distinguir dos formas de fallo.
 *
 * `desafioHtml` (§ API-DIRECTA-3DS-CON-CHALLENGE-1) llega YA DECODIFICADO por el servidor
 * (`extraerContenidoDesafio3ds`, `lib/pagos/tres-ds.ts`, corrida en `PATCH /api/checkout`) —
 * este componente nunca decodifica nada, sólo lo recibe y lo reenvía a `EsperaConfirmacion
 * Tarjeta` para embeberlo. `null` cuando el servidor no lo mandó (sin fricción, desconocido, o
 * un desafío detectado sin contenido decodificable).
 */
async function confirmarConAutenticacion3ds(input: {
  reference: string;
  tokenTarjeta: string;
  aceptaciones: { terminos: string; datosPersonales: string };
  datosNavegador3ds: ReturnType<typeof recolectarDatosNavegador3ds>;
}): Promise<{ resultado3ds: Resultado3ds; desafioHtml: string | null }> {
  let res: Response;
  try {
    res = await fetch('/api/checkout', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(input),
    });
  } catch (e) {
    throw new CreacionTransaccionError(
      'otro_fallo',
      e instanceof Error ? `No pudimos comunicarnos con el servidor: ${e.message}` : TEXTO_CREACION_TRANSACCION_GENERICO,
    );
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new CreacionTransaccionError('otro_fallo', 'El servidor respondió algo que no pudimos leer. Intenta de nuevo.');
  }

  const resultado = body as Partial<ResultadoCreacionTransaccionWompi> | null;
  if (resultado?.tipo === 'creada') {
    return {
      resultado3ds: resultado.autenticacion3ds ?? 'desconocido',
      desafioHtml: typeof resultado.desafioHtml === 'string' && resultado.desafioHtml.trim() !== ''
        ? resultado.desafioHtml
        : null,
    };
  }

  const tipo: 'metodo_no_habilitado' | 'firma_invalida' | 'otro_fallo' =
    resultado?.tipo === 'metodo_no_habilitado' || resultado?.tipo === 'firma_invalida'
      ? resultado.tipo
      : 'otro_fallo';
  const mensaje = resultado && 'error' in resultado && typeof resultado.error === 'string'
    ? resultado.error
    : TEXTO_CREACION_TRANSACCION_GENERICO;
  throw new CreacionTransaccionError(tipo, mensaje);
}

export default function FormularioTarjeta({ aceptaciones, publicKey, crearOrdenPasarela, monto, email, onMetodoNoHabilitado }: FormularioTarjetaProps) {
  const [terminosMarcado, setTerminosMarcado] = useState(false);
  const [datosMarcado, setDatosMarcado] = useState(false);
  const [campos, setCampos] = useState<CamposTarjeta>(CAMPOS_VACIOS);
  const [errores, setErrores] = useState<ErroresTarjeta>({});
  const [tokenizando, setTokenizando] = useState(false);
  const [errorTokenizacion, setErrorTokenizacion] = useState<string | null>(null);
  // Presencia = éxito COMPLETO: el token se obtuvo Y la transacción quedó creada en Wompi
  // (§ API-DIRECTA-DESALINEO-CABLEADO-1) — nunca se pone en `true` sólo por tokenizar. Trae la
  // `reference` de la orden que `crearOrdenPasarela` acaba de crear (§ CHECKOUT-UNA-SOLA-
  // PANTALLA-1 — ya no llega por prop, se conoce recién acá) y la clasificación de 3DS
  // (§ API-DIRECTA-3DS-SIN-CHALLENGE-1) con el HTML del desafío YA DECODIFICADO (§ API-DIRECTA-
  // 3DS-CON-CHALLENGE-1) para que la espera (`EsperaConfirmacionTarjeta`) sepa qué copy/marco
  // mostrar.
  const [creada, setCreada] = useState<{ reference: string; resultado3ds: Resultado3ds; desafioHtml: string | null } | null>(null);

  const aceptado = terminosMarcado && datosMarcado;

  const handlePagar = async () => {
    // El botón ya está `disabled` sin las dos aceptaciones — esta es la guarda de tipo, no
    // una segunda explicación para el comprador (mismo patrón que `handleOrder` en la página).
    if (tokenizando || !aceptado) return;

    // VALIDACIÓN LOCAL PRIMERO, SIN NINGUNA LLAMADA DE RED: un formulario a medio llenar no es
    // un intento de pago fallido (decisión del orquestador, § API-DIRECTA-CAPTURA-TARJETA-1) —
    // "crear una orden por cada dígito equivocado llenaría el libro de Pagos de basura". Estos
    // reintentos NO tocan `/api/checkout` en absoluto — recién el envío del token, más abajo,
    // llega a pedir la orden (§ CHECKOUT-UNA-SOLA-PANTALLA-1).
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
      // El token es OPACO (nunca datos de tarjeta) — recién con él tiene sentido que exista la
      // orden (§ CHECKOUT-UNA-SOLA-PANTALLA-1): "la orden se crea al apretar el botón de
      // pagar", nunca antes. `crearOrdenPasarela` es IDEMPOTENTE — un reintento tras un fallo
      // de la confirmación reusa la MISMA orden en vez de crear una segunda. `null` = la
      // creación falló y la página YA mostró el motivo (stock, error del servidor); este
      // formulario no repite el error, sólo deja de avanzar.
      const reference = await crearOrdenPasarela();
      if (!reference) {
        setTokenizando(false);
        return;
      }
      // Recién con la `reference` se puede confirmar la transacción contra NUESTRO servidor
      // (§ API-DIRECTA-DESALINEO-CABLEADO-1). Las DOS aceptaciones que el comprador ya marcó
      // viajan de nuevo, tal cual las vio (no son secretas: § `FormularioTarjetaProps`) — junto
      // con los DATOS DEL NAVEGADOR que 3DS pide SIEMPRE (§ API-DIRECTA-3DS-SIN-CHALLENGE-1,
      // "no hay interruptor"; nunca un dato de la tarjeta — § el docstring de
      // `recolectarDatosNavegador3ds`, `lib/pagos/tres-ds.ts`).
      const { resultado3ds, desafioHtml } = await confirmarConAutenticacion3ds({
        reference,
        tokenTarjeta: token,
        aceptaciones: {
          terminos:        aceptaciones.terminos.token,
          datosPersonales: aceptaciones.datosPersonales.token,
        },
        datosNavegador3ds: recolectarDatosNavegador3ds(),
      });
      // SI LA CONFIRMACIÓN FALLA, el comprador se queda EN ESTE FORMULARIO con el error a la
      // vista — no hay redirección, no hay pantalla nueva, y ninguna orden nueva se crea (la
      // orden ya existente queda pendiente, y un reintento la reusa vía `crearOrdenPasarela`).
      // La ÚNICA excepción es el rechazo ESTRUCTURAL de abajo, que no vuelve a este formulario.
      setCreada({ reference, resultado3ds, desafioHtml });
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
        {tokenizando ? TEXTO.botonEnVuelo : `Pagar · ${formatCOP(monto)}`}
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
