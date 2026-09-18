'use client';

import Image from 'next/image';
import { useLayoutEffect, useRef, useState, type ChangeEvent, type Ref } from 'react';
import {
  numeroTarjetaValido, parseVencimiento, vencimientoVigente, codigoSeguridadValido, nombreTitularValido,
  detectarRedTarjeta, formatearNumeroTarjeta, formatearVencimientoCampo, reformatearCampoTarjeta,
  type RedTarjeta,
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
 * LA RED EMISORA SE DETECTA MIENTRAS SE TECLEA (§ CHECKOUT-DETECCION-EMISOR-BIN-1),
 * PURAMENTE LOCAL: `detectarRedTarjeta` (`lib/checkout/tarjeta.ts`) sólo mira el prefijo de
 * `campos.numero` ya en memoria del formulario — el mismo estado que alimenta la validación de
 * Luhn — y nunca sale de este componente hacia una red ni hacia un log. Mientras no se sepa
 * (`estado !== 'reconocida'`) no se muestra nada, y jamás bloquea el botón "Pagar": es una pista
 * visual, no una autorización.
 *
 * § CHECKOUT-LOGOS-REDES-1 (2026-09-18, aprobado por el owner tras repetirlo tres veces): el
 * logo OFICIAL reemplaza al nombre+ícono neutro para la red que SÍ tiene archivo —hoy sólo
 * Mastercard; las otras cuatro no se pudieron bajar de su portal oficial sin registrarse o sin
 * aceptar un término interactivo, y esa condición del owner (§ el reporte del slice, y
 * `public/marcas-tarjetas/PROCEDENCIA.md`) NO se sortea buscando una fuente alternativa—.
 * `LOGO_RED` es un mapa PARCIAL a propósito: sólo declara las redes con archivo real; el resto
 * sigue con `NOMBRE_RED` + `IconoTarjetaGenerica` (abajo) hasta que el owner baje el resto. El
 * logo NO se muestra junto al nombre en texto —lo REEMPLAZA, mismo slot— porque repetir
 * "Mastercard" en texto al lado de su propio logo es ruido en un espacio de 14px de alto; el
 * `alt` de la imagen lleva el nombre para quien no ve la imagen.
 *
 * `public/marcas-tarjetas/` es el directorio nuevo de esta clase de archivo —`public/brand/` es
 * la marca de Duna, no de un tercero—, con su propio `PROCEDENCIA.md` (misma forma de tabla que
 * `public/images/PROCEDENCIA.md`) documentando de qué URL exacta salió cada logo, cuándo, y qué
 * bloqueó a los que faltan.
 *
 * EL NÚMERO Y EL VENCIMIENTO SE FORMATEAN MIENTRAS SE TECLEA (§ CHECKOUT-FORMATEO-CAMPOS-
 * TARJETA-1): grupos de 4 en el número ("4242 4242 4242 4242"), barra sola al segundo dígito del
 * vencimiento ("12/" antes de que el comprador la teclee). Es formateo de PANTALLA nomás — las
 * funciones puras viven en `lib/checkout/tarjeta.ts` (`formatearNumeroTarjeta`,
 * `formatearVencimientoCampo`, `reformatearCampoTarjeta`) y este componente sólo las invoca desde
 * `onChange`, reposicionando el cursor por CANTIDAD DE DÍGITOS vistos (no por índice de carácter)
 * para que borrar, pegar y corregir un dígito del medio no quede atrapado contra un separador ni
 * salte el cursor al final. Lo que sale de estos campos hacia `tokenizarTarjeta` sigue siendo
 * dígitos puros: el número se manda sin espacios (`campos.numero.replace(/\s+/g, '')`, ya
 * existía) y el vencimiento se manda como `{ mes, anio }` ya separados de la barra por
 * `parseVencimiento` — el string CON separador nunca sale de esta pantalla.
 *
 * SI EL PROVEEDOR RECHAZA LA CREACIÓN PORQUE LA CUENTA YA NO TIENE EL MÉTODO HABILITADO
 * (`CreacionTransaccionError.tipo === 'metodo_no_habilitado'`) — un rechazo ESTRUCTURAL, no
 * de la tarjeta que se tecleó—, este componente NO deja al comprador reintentando contra la
 * misma pared: llama a `onMetodoNoHabilitado` y la PÁGINA (`checkout/page.tsx`) es quien
 * decide qué mostrar en su lugar (§ el reporte del slice). Las otras dos ramas de fallo
 * (`firma_invalida`, `otro_fallo`) sí pueden ser transitorias y se muestran inline, como
 * cualquier error de tokenización.
 *
 * § CHECKOUT-ERROR-EN-LA-MISMA-PANTALLA-1: SI EL COBRO SE CREA PERO EL EMISOR LO RECHAZA — el
 * sondeo de `EsperaConfirmacionTarjeta` lo detecta de forma ASÍNCRONA, después de que este
 * `handlePagar` ya terminó—, `handleFallido` (abajo) vuelve a este mismo formulario, nunca a una
 * pantalla aparte: `creada` se limpia (deja de renderizar la espera) y el CVV se borra (es el
 * único campo de la tarjeta que cuenta como SECRETO — no sobrevive a un intento fallido). Antes
 * de este slice no había vuelta: la espera mostraba una pantalla terminal sin ningún camino de
 * regreso al formulario.
 *
 * § CHECKOUT-REINTENTO-OTRO-METODO-1 (2026-09-18, opción A del owner, DECISIONS.md
 * `CHECKOUT-REINTENTO-CENSO-1`): EL RECHAZO YA NO REACTIVA LOS MISMOS CAMPOS — los reemplaza por
 * el mensaje de rechazo (`rechazado`, abajo) y el botón "Intentar con otro método", que abre un
 * `PaymentIntent` NUEVO sobre la MISMA orden con aceptaciones FRESCAS (`onReintentarOtroMetodo`,
 * resuelto en `checkout/page.tsx`). Antes de este slice, "Pagar" seguía disponible sobre la
 * MISMA `reference` cerrada — un ciclo de 409 ("Este pago ya se resolvió") que nunca terminaba,
 * medido en `CHECKOUT-REINTENTO-CENSO-1`. TRES intentos por orden en total; el cuarto no se
 * ofrece — el servidor lo rechaza (`crearIntentoPagoDeReintento`, `@duna/core/orders`) y la
 * página reemplaza la pantalla entera por la confirmación con el número de orden y las dos
 * acciones, igual que los demás estados terminales.
 *
 * § CHECKOUT-TRANSICION-DEFECTOS-1 (2026-09-18, tres defectos que el owner vio en la PRIMERA
 * transacción real —`PRIMERA-TRANSACCION-REAL-ASIENTO-1`, DECISIONS.md—, § el reporte del
 * slice):
 *
 * (1) ESTE FORMULARIO YA NO SE REEMPLAZA A SÍ MISMO POR LA ESPERA. Antes, `if (creada) return
 * <EsperaConfirmacionTarjeta/>` cambiaba TODO el layout apenas la transacción nacía — el botón
 * ya decía "Verificando tarjeta…" un instante antes, así que el mismo momento se anunciaba DOS
 * VECES, en dos vistas distintas. Ahora los campos y el botón de este formulario se BLOQUEAN EN
 * SU LUGAR (`procesando`, abajo) durante TODO el camino — tokenizar, crear la orden, confirmar
 * la transacción, Y sondear hasta que resuelva —, y `EsperaConfirmacionTarjeta` sólo aporta,
 * DEBAJO del botón bloqueado, lo que el botón no puede decir por sí solo (el texto de espera, o
 * el marco del desafío 3DS). Es UNA sola vista, nunca un remonte, desde que el comprador aprieta
 * "Pagar" hasta que el pago se resuelve.
 *
 * (3) EL ÉXITO YA NO ES UN CALLEJÓN SIN SALIDA. Antes, un pago APROBADO terminaba en un ícono +
 * un título + una frase, sin número de orden, sin resumen, sin acciones — el camino que SÍ
 * cobra (pasarela) quedaba más pobre que el que NO cobró (los métodos manuales, que sí muestran
 * la confirmación completa). Ahora `onAprobado` (prop, bubbleada por `EsperaConfirmacionTarjeta`)
 * sube ese hecho hasta `checkout/page.tsx`, que reemplaza TODA la transición por la MISMA
 * pantalla "¡Pedido recibido!" que ya usan los métodos manuales — reusada, no rediseñada. Este
 * formulario no dibuja nada para ese caso: el `return` de más abajo deja de montarse en cuanto
 * el padre conmuta a esa pantalla.
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
  /** El pago fue APROBADO (§ CHECKOUT-TRANSICION-DEFECTOS-1) — bubbleado de
   *  `EsperaConfirmacionTarjeta.onAprobado`. Este formulario no dibuja nada para ese caso: la
   *  página reemplaza TODA la transición por la confirmación completa del pedido. */
  onAprobado: () => void;
  /** § CHECKOUT-REINTENTO-OTRO-METODO-1: el comprador pidió reintentar tras un rechazo del
   *  EMISOR (`handleFallido`, abajo) — abre un `PaymentIntent` NUEVO sobre la MISMA orden, con
   *  aceptaciones frescas, y hace que la página REMONTE `SelectorMetodoPasarela` con la
   *  `reference` nueva. Este formulario no decide nada de eso: sólo dispara la promesa y
   *  muestra un texto intermedio mientras viaja (`reintentando`, abajo) — si el pedido falla
   *  (tope alcanzado, la orden ya no está pendiente, un error de red), el llamador decide qué
   *  mostrar (la pantalla terminal, o un toast) y este componente queda intacto, listo para que
   *  el comprador vuelva a intentarlo. */
  onReintentarOtroMetodo: () => Promise<void>;
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
  // § CHECKOUT-TRANSICION-DEFECTOS-1: ESTE es el ÚNICO texto de progreso del botón, del click a
  // "Pagar" hasta que el pago resuelve (tokenizar, crear la orden, confirmar la transacción, Y
  // sondear) — nunca cambia de frase a mitad de camino, que era justo el defecto ("aparece dos
  // veces").
  botonEnVuelo: 'Verificando tarjeta…',
  // § CHECKOUT-ERROR-EN-LA-MISMA-PANTALLA-1 / CHECKOUT-REINTENTO-OTRO-METODO-1: el cobro se
  // creó pero el emisor lo RECHAZÓ (detectado por el sondeo de `EsperaConfirmacionTarjeta`, vía
  // `onFallido`) — TEXTO DEL OWNER, textual (2026-09-18), ya no provisional: DOS oraciones, sin
  // la tercera que invitaba a "revisar datos o intentar con otro método" — ese tercer trabajo
  // ahora lo hace el botón "Intentar con otro método" (abajo), no una frase que lo anticipa.
  pagoRechazado: 'Tu pago no fue aprobado. No se realizó ningún cobro.',
  // § CHECKOUT-REINTENTO-OTRO-METODO-1: TEXTO DEL OWNER, textual — dice qué va a pasar y no
  // promete que el mismo método vaya a funcionar.
  botonReintentar: 'Intentar con otro método',
  botonReintentarEnVuelo: 'Preparando…',
};

const TEXTO_CREACION_TRANSACCION_GENERICO = 'No pudimos procesar tu pago. Intenta de nuevo o usa otro método.';

// Nombre accesible de cada red — vive en el `alt` del logo (cuando hay uno, § LOGO_RED abajo)
// o como texto visible junto al ícono neutro (cuando no).
const NOMBRE_RED: Record<RedTarjeta, string> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  amex: 'American Express',
  diners: 'Diners Club',
  unionpay: 'UnionPay',
};

// § CHECKOUT-LOGOS-REDES-1: mapa PARCIAL a propósito — sólo las redes con logo oficial bajado
// del portal de marca del titular (§ `public/marcas-tarjetas/PROCEDENCIA.md`, que documenta de
// dónde salió cada archivo y qué bloqueó a las que faltan). Visa, American Express, Diners Club
// y UnionPay quedan PENDIENTES DEL OWNER: sus portales oficiales exigen login/registro
// (Visa, Amex) o un paso interactivo de aceptación de términos (UnionPay), o el único formato
// disponible es EPS, que este slice no puede convertir sin desobedecer la condición de "el
// oficial es el oficial" (Diners Club). Ninguna de las cuatro se completó con un archivo de
// otra procedencia.
const LOGO_RED: Partial<Record<RedTarjeta, string>> = {
  mastercard: '/marcas-tarjetas/mastercard-symbol-v1.svg',
};

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

export default function FormularioTarjeta({ aceptaciones, publicKey, crearOrdenPasarela, monto, email, onMetodoNoHabilitado, onAprobado, onReintentarOtroMetodo }: FormularioTarjetaProps) {
  const [terminosMarcado, setTerminosMarcado] = useState(false);
  const [datosMarcado, setDatosMarcado] = useState(false);
  const [campos, setCampos] = useState<CamposTarjeta>(CAMPOS_VACIOS);
  const [errores, setErrores] = useState<ErroresTarjeta>({});
  const [tokenizando, setTokenizando] = useState(false);
  const [errorTokenizacion, setErrorTokenizacion] = useState<string | null>(null);
  // § CHECKOUT-TRANSICION-DEFECTOS-1: el número de la orden que el cobro RECHAZADO dejó atrás —
  // `handleFallido` lo captura de `creada.reference` ANTES de limpiarla, para que el comprador
  // sepa CON QUÉ ORDEN está reintentando (antes no se mostraba ninguna). Se limpia al volver a
  // intentar (primera línea de `handlePagar`), igual que `errorTokenizacion`.
  const [numeroOrdenRechazado, setNumeroOrdenRechazado] = useState<string | null>(null);
  // § CHECKOUT-REINTENTO-OTRO-METODO-1: distingue el RECHAZO DEL EMISOR (tras crear la
  // transacción — `handleFallido`) de un error de VALIDACIÓN/TOKENIZACIÓN previo (que no creó
  // ninguna orden todavía): sólo el primero reemplaza los campos por la vista de reintento —
  // un error de validación deja los campos a la vista, con "Pagar" disponible para corregir y
  // reintentar SIN abrir un intento nuevo (no hace falta: nunca se creó ninguno).
  const [rechazado, setRechazado] = useState(false);
  // El clic en "Intentar con otro método" está en vuelo — bloquea el botón mientras
  // `onReintentarOtroMetodo` viaja al servidor (mismo criterio de doble-submit que `procesando`
  // más abajo, pero acotado a este botón: la página decide qué pasa después).
  const [reintentando, setReintentando] = useState(false);
  // Presencia = éxito COMPLETO: el token se obtuvo Y la transacción quedó creada en Wompi
  // (§ API-DIRECTA-DESALINEO-CABLEADO-1) — nunca se pone en `true` sólo por tokenizar. Trae la
  // `reference` de la orden que `crearOrdenPasarela` acaba de crear (§ CHECKOUT-UNA-SOLA-
  // PANTALLA-1 — ya no llega por prop, se conoce recién acá) y la clasificación de 3DS
  // (§ API-DIRECTA-3DS-SIN-CHALLENGE-1) con el HTML del desafío YA DECODIFICADO (§ API-DIRECTA-
  // 3DS-CON-CHALLENGE-1) para que la espera (`EsperaConfirmacionTarjeta`) sepa qué copy/marco
  // mostrar.
  const [creada, setCreada] = useState<{ reference: string; resultado3ds: Resultado3ds; desafioHtml: string | null } | null>(null);
  // § CHECKOUT-TRANSICION-DEFECTOS-1: el sondeo se AGOTÓ sin resolver (§4, "indeterminado") —
  // `EsperaConfirmacionTarjeta` sigue dibujando su propia pantalla (número de orden + acciones);
  // este flag sólo oculta los campos de la tarjeta bloqueados, para no mostrar dos respuestas al
  // mismo momento (la tarjeta "verificando" y "sigue procesándose" a la vez).
  const [techo, setTecho] = useState(false);

  const aceptado = terminosMarcado && datosMarcado;
  // § CHECKOUT-TRANSICION-DEFECTOS-1: UNA sola señal de "procesando", del click a "Pagar" hasta
  // que el pago resuelve — gobierna el disabled de TODOS los campos y del botón, para que el
  // formulario se BLOQUEE EN SU LUGAR en vez de reemplazarse por otra vista (§ el docstring).
  const procesando = tokenizando || !!creada;

  // Sólo una PISTA visual (§ el docstring de arriba): con pocos dígitos o con un prefijo que
  // ninguna red conocida completa, no se muestra nada — nunca se adivina y nunca se bloquea.
  const deteccionRed = detectarRedTarjeta(campos.numero);
  const marcaDetectada = deteccionRed.estado === 'reconocida' ? NOMBRE_RED[deteccionRed.red] : null;
  // `undefined` cuando la red se reconoció pero no tiene logo bajado todavía (§ LOGO_RED) — en
  // ese caso `CampoTarjeta` cae al ícono neutro + nombre en texto, igual que antes de este slice.
  const logoRedDetectada = deteccionRed.estado === 'reconocida' ? LOGO_RED[deteccionRed.red] : undefined;

  // § CHECKOUT-FORMATEO-CAMPOS-TARJETA-1: el número y el vencimiento se reformatean en cada
  // `onChange` (grupos de 4 / barra sola al 2° dígito), y el cursor que el navegador ya dejó
  // tras la edición hay que RECOLOCARLO tras el reformateo — si no, cualquier corrección en el
  // medio del valor manda el cursor al final. React no deja setear `selectionStart` en el mismo
  // ciclo que cambia `value` (el DOM todavía no tiene el string nuevo), así que la posición
  // deseada se guarda en un ref y se aplica en un `useLayoutEffect` que corre DESPUÉS de que
  // React pintó el valor reformateado — antes de que el navegador pinte el frame, para que no
  // se vea saltar.
  const numeroRef = useRef<HTMLInputElement>(null);
  const vencimientoRef = useRef<HTMLInputElement>(null);
  const cursorPendienteRef = useRef<{ campo: 'numero' | 'vencimiento'; cursor: number } | null>(null);

  useLayoutEffect(() => {
    const pendiente = cursorPendienteRef.current;
    if (!pendiente) return;
    cursorPendienteRef.current = null;
    const el = pendiente.campo === 'numero' ? numeroRef.current : vencimientoRef.current;
    el?.setSelectionRange(pendiente.cursor, pendiente.cursor);
  }, [campos.numero, campos.vencimiento]);

  const handleNumeroChange = (e: ChangeEvent<HTMLInputElement>) => {
    const el = e.target;
    const { valor, cursor } = reformatearCampoTarjeta(
      formatearNumeroTarjeta,
      el.value,
      el.selectionStart ?? el.value.length,
    );
    cursorPendienteRef.current = { campo: 'numero', cursor };
    setCampos((c) => ({ ...c, numero: valor }));
  };

  const handleVencimientoChange = (e: ChangeEvent<HTMLInputElement>) => {
    const el = e.target;
    const { valor, cursor } = reformatearCampoTarjeta(
      formatearVencimientoCampo,
      el.value,
      el.selectionStart ?? el.value.length,
    );
    cursorPendienteRef.current = { campo: 'vencimiento', cursor };
    setCampos((c) => ({ ...c, vencimiento: valor }));
  };

  const handlePagar = async () => {
    // El botón ya está `disabled` sin las dos aceptaciones o mientras procesa — esta es la
    // guarda de tipo, no una segunda explicación para el comprador (mismo patrón que
    // `handleOrder` en la página).
    if (procesando || !aceptado) return;

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
    setNumeroOrdenRechazado(null);
    setRechazado(false);
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

  // § CHECKOUT-ERROR-EN-LA-MISMA-PANTALLA-1: EL COBRO FUE RECHAZADO (el sondeo de
  // `EsperaConfirmacionTarjeta` encontró un estado final que no es `APROBADO`) — vuelve a este
  // mismo formulario, nunca a una pantalla aparte. `creada` se limpia para que `procesando`
  // vuelva a `false` y los campos se desbloqueen; el CVV se borra (§ el docstring de arriba, el
  // único campo SECRETO de la tarjeta) y el resto de `campos` — número, vencimiento, nombre del
  // titular — queda intacto. `errores` se limpia para que no quede un borde rojo colgado de un
  // intento anterior sobre un campo que ya se vació (el CVV).
  //
  // § CHECKOUT-TRANSICION-DEFECTOS-1: captura el número de orden ANTES de limpiar `creada` —
  // la orden ya existe (la creó `crearOrdenPasarela`, idempotente) y el comprador tiene derecho
  // a saber CON QUÉ ORDEN está reintentando; antes no se mostraba ninguna en el rechazo.
  const handleFallido = () => {
    setNumeroOrdenRechazado(creada ? creada.reference.split(':')[0] : null);
    setCreada(null);
    setCampos((c) => ({ ...c, cvv: '' }));
    setErrores({});
    setErrorTokenizacion(TEXTO.pagoRechazado);
    // § CHECKOUT-REINTENTO-OTRO-METODO-1: reemplaza los campos por la vista de reintento — el
    // owner: "el cuarto no se ofrece", pero el primero, segundo y tercero SÍ, con un intento de
    // pago NUEVO cada vez (nunca reintentando contra el mismo, que es lo que dejaba al
    // comprador en un ciclo de 409 antes de este slice).
    setRechazado(true);
  };

  // § CHECKOUT-REINTENTO-OTRO-METODO-1: dispara el reintento — la PÁGINA hace todo el trabajo
  // (pide el intento nuevo con aceptaciones frescas, y si lo consigue, REMONTA
  // `SelectorMetodoPasarela` con la `reference` nueva, lo que desmonta este propio componente).
  // Si el pedido falla (tope alcanzado, la orden ya no está pendiente, un error de red), la
  // página decide qué mostrar (la pantalla terminal, o un toast) y este componente sigue
  // montado, en `rechazado`, listo para un nuevo clic.
  const handleReintentarOtroMetodo = async () => {
    if (reintentando) return;
    setReintentando(true);
    try {
      await onReintentarOtroMetodo();
    } finally {
      setReintentando(false);
    }
  };

  return (
    // § CHECKOUT-COPY-Y-ORDEN-PASARELA-1: EL ORDEN ES campos del método → ACEPTACIONES →
    // botón Pagar — las dos casillas van JUSTO ENCIMA del botón, que es donde el owner dice que
    // se leen antes de apretar. Antes las aceptaciones abrían el formulario (entre las pestañas
    // del selector y estos campos); ahora cierran, pegadas al submit.
    //
    // § CHECKOUT-TRANSICION-DEFECTOS-1: ESTE CONTENEDOR YA NO SE REEMPLAZA POR OTRO — antes,
    // `creada` truthy hacía un `return` completo a `EsperaConfirmacionTarjeta`, dos layouts para
    // el mismo momento de "verificando". Ahora los campos y el botón se BLOQUEAN EN SU LUGAR
    // (`procesando`) y `EsperaConfirmacionTarjeta` se monta DEBAJO del botón, dentro del MISMO
    // `<div>` — una sola vista, del click a "Pagar" hasta que el pago resuelve. La ÚNICA
    // excepción es `techo` (§4, "indeterminado"): ahí SÍ se ocultan los campos —es un cambio de
    // estado real, y `EsperaConfirmacionTarjeta` ya dibuja la respuesta completa por su cuenta—.
    <div className="space-y-4 text-left">
      {!techo && !rechazado && (
        <>
          <div className="space-y-3">
            <CampoTarjeta
              label="Número de la tarjeta"
              value={campos.numero}
              onChangeEvento={handleNumeroChange}
              inputRef={numeroRef}
              error={errores.numero}
              inputMode="numeric"
              placeholder="0000 0000 0000 0000"
              marcaDetectada={marcaDetectada}
              logoRedDetectada={logoRedDetectada}
              disabled={procesando}
            />
            <div className="grid grid-cols-2 gap-3">
              <CampoTarjeta
                label="Fecha de vencimiento"
                value={campos.vencimiento}
                onChangeEvento={handleVencimientoChange}
                inputRef={vencimientoRef}
                error={errores.vencimiento}
                placeholder="MM/AA"
                disabled={procesando}
              />
              <CampoTarjeta
                label="Código de seguridad"
                value={campos.cvv}
                onChange={(v) => setCampos((c) => ({ ...c, cvv: v }))}
                error={errores.cvv}
                inputMode="numeric"
                placeholder="123"
                disabled={procesando}
              />
            </div>
            <CampoTarjeta
              label="Nombre del titular"
              value={campos.nombreTitular}
              onChange={(v) => setCampos((c) => ({ ...c, nombreTitular: v }))}
              error={errores.nombreTitular}
              placeholder="Como aparece en la tarjeta"
              disabled={procesando}
            />
          </div>

          <AceptacionesPasarela
            aceptaciones={aceptaciones}
            terminosMarcado={terminosMarcado}
            datosMarcado={datosMarcado}
            onTerminosChange={setTerminosMarcado}
            onDatosChange={setDatosMarcado}
            disabled={procesando}
          />

          {/* Sólo un error de VALIDACIÓN/TOKENIZACIÓN previo a crear la orden llega acá — un
              RECHAZO del emisor (`handleFallido`) pone `rechazado=true` y salta a la vista de
              abajo, que nunca comparte este bloque (§ CHECKOUT-REINTENTO-OTRO-METODO-1). */}
          {errorTokenizacion && (
            <div className="text-xs text-red-600">
              <p>{errorTokenizacion}</p>
            </div>
          )}

          <button
            type="button"
            onClick={handlePagar}
            disabled={!aceptado || procesando}
            className="w-full bg-[var(--sf-acento)] hover:bg-[var(--sf-acento-3)] disabled:opacity-60 disabled:pointer-events-none text-[var(--sf-acento-txt)] font-bold py-3.5 rounded-xl text-sm transition-colors"
          >
            {procesando ? TEXTO.botonEnVuelo : `Pagar · ${formatCOP(monto)}`}
          </button>
        </>
      )}

      {/* § CHECKOUT-REINTENTO-OTRO-METODO-1: EL RECHAZO DEL EMISOR — reemplaza los campos de la
          tarjeta (nunca los muestra a la vez que este mensaje: dos respuestas al mismo momento
          es justo lo que § CHECKOUT-TRANSICION-DEFECTOS-1 vino a cerrar para `techo`, y este
          caso es el mismo patrón). El botón abre un intento de pago NUEVO sobre la MISMA orden
          — nunca reintenta contra la `reference` ya cerrada, que es lo que dejaba al comprador
          en un ciclo de 409 antes de este slice. Al tercer rechazo el servidor responde
          `tope_alcanzado` y la PÁGINA reemplaza toda esta pantalla por la confirmación con el
          número de orden y las dos acciones — este componente no dibuja ese caso. */}
      {!techo && rechazado && (
        <div className="space-y-4 text-center">
          <div className="text-xs text-red-600">
            <p>{TEXTO.pagoRechazado}</p>
            {numeroOrdenRechazado && (
              <p className="mt-0.5 text-[var(--sf-texto-suave)]">Número de orden: <span className="font-semibold">{numeroOrdenRechazado}</span></p>
            )}
          </div>
          <button
            type="button"
            onClick={handleReintentarOtroMetodo}
            disabled={reintentando}
            className="w-full sf-borde border-[var(--sf-linea)] text-[var(--sf-texto)] font-medium py-3.5 rounded-xl text-sm hover:bg-[var(--sf-superficie)] disabled:opacity-60 disabled:pointer-events-none transition-colors"
          >
            {reintentando ? TEXTO.botonReintentarEnVuelo : TEXTO.botonReintentar}
          </button>
        </div>
      )}

      {creada && (
        <EsperaConfirmacionTarjeta
          reference={creada.reference}
          email={email}
          resultado3ds={creada.resultado3ds}
          desafioHtml={creada.desafioHtml}
          onAprobado={onAprobado}
          onFallido={handleFallido}
          onTecho={() => setTecho(true)}
        />
      )}
    </div>
  );
}

interface CampoTarjetaProps {
  label: string;
  value: string;
  /** El caso simple (CVV, nombre del titular): el valor ya listo, sin reformateo. */
  onChange?: (value: string) => void;
  /** El caso con formateo (número, vencimiento — § CHECKOUT-FORMATEO-CAMPOS-TARJETA-1): el
   *  consumidor necesita el evento crudo para leer `selectionStart` y recolocar el cursor tras
   *  reformatear. Cuando está presente, REEMPLAZA a `onChange` — nunca se pasan los dos. */
  onChangeEvento?: (e: ChangeEvent<HTMLInputElement>) => void;
  /** Sólo lo necesitan los campos con `onChangeEvento`, para aplicar la posición de cursor tras
   *  el reformateo (`useLayoutEffect` en el componente padre). */
  inputRef?: Ref<HTMLInputElement>;
  error?: string;
  placeholder?: string;
  inputMode?: 'numeric' | 'text';
  /** El nombre de la red emisora detectada (§ CHECKOUT-DETECCION-EMISOR-BIN-1), o `null` si
   *  todavía no se sabe o el prefijo no cae en ninguna red reconocida — en esos dos casos no se
   *  renderiza nada, ni el texto ni el ícono. Sólo lo usa el campo de número. */
  marcaDetectada?: string | null;
  /** La ruta del logo oficial de la red detectada (§ CHECKOUT-LOGOS-REDES-1, `LOGO_RED`), o
   *  `undefined` si esa red todavía no tiene archivo. Con logo, REEMPLAZA al nombre+ícono neutro
   *  en el mismo slot — nunca se muestran los dos juntos. */
  logoRedDetectada?: string;
  /** § CHECKOUT-TRANSICION-DEFECTOS-1: el campo se BLOQUEA EN SU LUGAR mientras el pago procesa
   *  (`procesando` en el componente padre) — nunca desaparece ni se reemplaza por otra vista. */
  disabled?: boolean;
}

/**
 * Ícono de tarjeta NEUTRO (§ CHECKOUT-ICONO-TARJETA-NEUTRO-1) — un rectángulo redondeado sin
 * ningún detalle interno. A propósito NO es el `CreditCard` de lucide-react (ese trae una línea
 * horizontal partiendo el rectángulo, la "franja" que la condición del owner prohíbe) ni nada con
 * círculos superpuestos: sólo el contorno de una tarjeta, que es lo más genérico que un ícono de
 * tarjeta puede ser. `aria-hidden` porque es decorativo — el nombre de la red ya está en el
 * `<span>` de al lado, en texto.
 */
function IconoTarjetaGenerica() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="w-3.5 h-3.5 shrink-0"
    >
      <rect x="2" y="5" width="20" height="14" rx="2" />
    </svg>
  );
}

function CampoTarjeta({ label, value, onChange, onChangeEvento, inputRef, error, placeholder, inputMode, marcaDetectada, logoRedDetectada, disabled }: CampoTarjetaProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="block text-xs font-medium text-[var(--sf-texto)]">{label}</label>
        {marcaDetectada && logoRedDetectada && (
          // § CHECKOUT-LOGOS-REDES-1: el logo REEMPLAZA al nombre+ícono — el `alt` lleva el
          // nombre para quien no ve la imagen. `width`/`height` son el tamaño INTRÍNSECO real
          // del SVG (`viewBox="0 0 152.4 108"` del Mastercard symbol, redondeado) — next/image
          // los usa para fijar el aspect-ratio, no el tamaño en pantalla; el tamaño en pantalla
          // lo da la clase (altura fija de 14px, la misma que el ícono neutro `w-3.5 h-3.5`; el
          // ancho sigue la proporción real con `w-auto`, nunca se estira).
          <Image src={logoRedDetectada} alt={marcaDetectada} width={152} height={108} className="h-3.5 w-auto" />
        )}
        {marcaDetectada && !logoRedDetectada && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--sf-texto)]/70">
            <IconoTarjetaGenerica />
            {marcaDetectada}
          </span>
        )}
      </div>
      <input
        ref={inputRef}
        type="text"
        inputMode={inputMode}
        value={value}
        onChange={onChangeEvento ?? ((e) => onChange?.(e.target.value))}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full px-4 py-3 bg-[var(--sf-fondo)] sf-borde border-[var(--sf-linea)] rounded-xl text-sm text-[var(--sf-tinta)] focus:outline-none focus:ring-2 focus:ring-[var(--sf-acento)]/20 focus:border-[var(--sf-acento)] disabled:opacity-60"
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
