// El CRUCE entre lo GUARDADO (`SiteSetting.metodosPasarela`, lo que el dueño eligió ofrecer)
// y lo que la CUENTA del proveedor tiene realmente habilitado (`consultarMetodosAceptados`,
// `lib/pagos/wompi-api.ts`) — puro, capa 1 (§ API-DIRECTA-PANEL-METODOS-1). La pantalla sólo
// dibuja lo que esta función devuelve; no reimplementa el cruce.
//
// TRES ESTADOS produce ESTA función (`cruzarMetodosPasarela`), y son los únicos que puede
// asignar — el panel los REFINA con dos más (`paraElPanel`, § PANEL-FILTRA-IMPLEMENTADOS-1,
// más abajo), pero esta función no cambió de comportamiento por eso:
//   - 'disponible'            : está en las DOS listas — el dueño lo ofrece y su cuenta lo
//                                sostiene. Editable: apagarlo lo saca de lo guardado.
//   - 'guardado_no_disponible': está guardado, pero la cuenta YA NO lo tiene. No se borra
//                                solo (sería una escritura que nadie pidió, y escondería el
//                                desalineo) — el dueño lo ve marcado y sólo puede QUITARLO.
//   - 'disponible_no_ofrecido': la cuenta lo tiene, pero el dueño no lo ofrece todavía.
//                                Editable: prenderlo lo agrega a lo guardado.
//
// LOS OTROS DOS ESTADOS DEL ENUM ('no_implementado' / 'no_cobrable') los asigna `paraElPanel`,
// NUNCA esta función — `cruzarMetodosPasarela` sólo conoce guardado×cuenta, no sabe nada de si
// el checkout puede dibujar un tipo ni de si la pasarela lo cobra. Viven en el MISMO enum
// (`EstadoMetodoPasarela`) para no mantener dos tipos que describen la misma pregunta ("¿qué
// ve el dueño de este método?"), no porque esta función pueda producirlos.

export type EstadoMetodoPasarela =
  | 'disponible'
  | 'guardado_no_disponible'
  | 'disponible_no_ofrecido'
  | 'no_implementado'
  | 'no_cobrable';

export interface MetodoPasarelaCruzado {
  tipo: string;
  estado: EstadoMetodoPasarela;
}

/**
 * Cruza la lista GUARDADA contra la lista de la CUENTA. El orden del resultado es: primero
 * los tipos de la CUENTA (en el orden que el proveedor los devuelve, que es la lista que el
 * dueño va a leer para decidir qué prender), y al final los GUARDADOS que la cuenta ya no
 * sostiene — para que un método rancio no se mezcle entre los vigentes.
 */
export function cruzarMetodosPasarela(guardados: string[], cuenta: string[]): MetodoPasarelaCruzado[] {
  const guardadosSet = new Set(guardados);
  const cuentaSet = new Set(cuenta);

  const out: MetodoPasarelaCruzado[] = cuenta.map(tipo => ({
    tipo,
    estado: guardadosSet.has(tipo) ? 'disponible' : 'disponible_no_ofrecido',
  }));

  for (const tipo of guardados) {
    if (!cuentaSet.has(tipo)) out.push({ tipo, estado: 'guardado_no_disponible' });
  }

  return out;
}

// ── LA FORMA EXTENSIBLE PARA LOS MÉTODOS QUE NO SON TARJETA (§ API-DIRECTA-OTROS-METODOS-1) ──
//
// TARJETA NO VIVE EN ESTE REGISTRO. Su formulario (`FormularioTarjeta.tsx`, § API-DIRECTA-
// CAPTURA-TARJETA-1) captura varios campos y TOKENIZA contra el proveedor antes de crear la
// transacción — un flujo bespoke que ya existe y no necesita esta forma. Lo que sigue es el
// registro para TODO LO DEMÁS: un tipo que le pide al comprador, COMO MUCHO, UN dato, y lo
// manda directo en el `payment_method` de la creación — sin tokenización previa.
//
// PSE QUEDA EXPLÍCITAMENTE AFUERA de este registro (§ el reporte del slice): exige una
// REDIRECCIÓN a la banca del comprador que no existe en ningún lado de este repositorio y
// que nadie midió contra el sandbox — escribirla a partir de la documentación es exactamente
// lo que el spike de sandbox existe para evitar. PSE necesita su propio spike antes de tener
// su descriptor.
//
// AGREGAR EL TIPO SIGUIENTE ES AGREGAR UNA ENTRADA A `DESCRIPTORES_METODO_PASARELA` — nada
// más. Ni la pantalla (que sólo itera el registro, § `components/storefront/checkout/
// SelectorMetodoPasarela.tsx`) ni la creación (`lib/pagos/creacion-transaccion.ts`, que sólo
// llama a `construirPaymentMethod` del descriptor elegido) necesitan un caso nuevo por tipo.
//
// OJO CON EL NOMBRE: el `tipo` de este registro (p. ej. `'NEQUI'`) es el vocabulario del
// PROVEEDOR (`accepted_payment_methods` / `SiteSetting.metodosPasarela`, arriba en este mismo
// archivo) — DISTINTO de `MetodoPagoTipo` (`lib/checkout/metodos-pago.ts`, `'nequi'` en
// minúscula), que es el método de pago MANUAL que el checkout ya ofrecía (confirmación por
// WhatsApp, sin API directa). Son dos namespaces que sólo coinciden por casualidad de nombre.

export interface CampoMetodoPasarela {
  /** Lo que el comprador lee junto al campo — TEXTO PROVISIONAL, PENDIENTE DE TEXTO DEL OWNER
   *  (§ el reporte del slice). */
  rotulo: string;
  /** TEXTO PROVISIONAL, PENDIENTE DE TEXTO DEL OWNER. */
  placeholder: string;
  /** `null` si `valor` es válido para este campo; si no, el mensaje de error — TEXTO
   *  PROVISIONAL, PENDIENTE DE TEXTO DEL OWNER. Nunca lanza: el llamador (la pantalla, y el
   *  servidor antes de construir el payload) decide qué hacer con el mensaje. */
  validar: (valor: string) => string | null;
}

export interface DescriptorMetodoPasarela {
  /** El tipo tal como lo nombra el proveedor — la MISMA cadena que ya cruza
   *  `cruzarMetodosPasarela` (arriba). */
  tipo: string;
  /** Lo que el comprador lee para elegir esta opción — TEXTO PROVISIONAL, PENDIENTE DE TEXTO
   *  DEL OWNER. */
  nombreVisible: string;
  /** El único dato que este tipo le pide al comprador. */
  campo: CampoMetodoPasarela;
  /** Arma el `payment_method` que viaja al proveedor para este tipo, a partir de un dato YA
   *  VALIDADO por `campo.validar`. Puro: nunca toca la red — sólo construye el objeto que
   *  `lib/pagos/creacion-transaccion.ts` empaca junto a lo que la firma ya fija. */
  construirPaymentMethod: (dato: string) => Record<string, unknown>;
}

function soloDigitos(valor: string): string {
  return valor.replace(/\D/g, '');
}

// EL TIPO DE PRUEBA (§ API-DIRECTA-OTROS-METODOS-1): una billetera que sólo pide un número de
// celular colombiano — el mismo patrón de 10 dígitos que empieza por 3 que ya valida el resto
// del checkout (`phoneValid`, `app/(storefront)/checkout/page.tsx`). TEXTO PROVISIONAL EN
// TODO EL DESCRIPTOR — PENDIENTE DE TEXTO DEL OWNER (§ el reporte del slice).
export const DESCRIPTOR_NEQUI: DescriptorMetodoPasarela = {
  tipo: 'NEQUI',
  nombreVisible: 'Nequi',
  campo: {
    rotulo: 'Número de celular Nequi',
    placeholder: '300 000 0000',
    validar: (valor) =>
      /^3\d{9}$/.test(soloDigitos(valor))
        ? null
        : 'Ingresa un número de celular colombiano válido (10 dígitos, empieza por 3).',
  },
  construirPaymentMethod: (dato) => ({ type: 'NEQUI', phone_number: soloDigitos(dato) }),
};

/** El registro completo — agregar un tipo nuevo es agregar una entrada acá (§ la cabecera de
 *  esta sección). */
export const DESCRIPTORES_METODO_PASARELA: Record<string, DescriptorMetodoPasarela> = {
  NEQUI: DESCRIPTOR_NEQUI,
};

// ── EL PANEL DEJA DE OFRECER LO QUE NO SE PUEDE ENTREGAR (§ PANEL-FILTRA-IMPLEMENTADOS-1) ────
//
// El panel cruzaba `guardado`×`cuenta` (arriba) y dejaba encender CUALQUIER tipo que la cuenta
// tuviera habilitado — sin preguntar si el checkout sabe DIBUJARLO ni si la pasarela lo COBRA.
// El owner encendió tres tipos que el checkout no sabe dibujar, y uno de ellos NUNCA se puede
// cobrar (§ el asiento citado abajo) — sus compradores no habrían visto nada de eso, sin
// ninguna advertencia.
//
// CATÁLOGO, HABILITADO y COBRABLE SON TRES CONJUNTOS DISTINTOS, y sólo el tercero decide si un
// tipo puede ENCENDERSE — el segundo (`cuenta`, arriba) sigue decidiendo si aparece en el panel
// SIQUIERA (`cruzarMetodosPasarela` no cambió: un tipo que la cuenta no tiene sigue siendo
// `guardado_no_disponible`, un problema DISTINTO de éste).

/**
 * ¿El checkout SABE DIBUJAR este tipo? TARJETA es su propio flujo bespoke ("TARJETA NO VIVE EN
 * ESTE REGISTRO", § la cabecera de arriba) y siempre cuenta; cualquier otro tipo cuenta sólo si
 * tiene un descriptor en `DESCRIPTORES_METODO_PASARELA`. Un tipo sin ninguna de las dos cosas
 * es "Disponible pronto" en el panel: la cuenta lo tiene, pero todavía no construimos cómo
 * pedírselo al comprador (PSE es el caso real de hoy — tiene su propio spike, sin descriptor
 * a propósito).
 */
export function checkoutSabeDibujar(tipo: string): boolean {
  return tipo === 'CARD' || tipo in DESCRIPTORES_METODO_PASARELA;
}

/**
 * LOS TIPOS QUE LA PASARELA NUNCA COBRA, aunque la cuenta los tenga habilitados y el catálogo
 * los enumere — un tercer conjunto, distinto de "está habilitado" y de "el checkout sabe
 * dibujarlo" (§ la cabecera de esta sección). Cada entrada es un HALLAZGO MEDIDO, no una
 * sospecha: sólo entra un tipo cuando alguien probó crear la transacción, con cualquier
 * combinación de campos, y el proveedor la rechazó SIEMPRE.
 *
 * HOY ESTÁ VACÍA, Y ESO ES DELIBERADO — no un placeholder olvidado. El spike que midió la
 * EXISTENCIA de un tipo así (`API-DIRECTA-SPIKE-FORMA-DE-METODOS-1`, registrado en
 * `API-DIRECTA-CATALOGO-METODOS-ASIENTO-1`, DECISIONS.md, "casi con certeza una etiqueta
 * agregadora que agrupa a sus hermanos bajo la marca de un banco para reportes, no un método
 * que se pueda cobrar") no dejó escrito en NINGÚN lugar del repositorio —ni ese asiento, ni su
 * commit, ni ningún otro— el identificador exacto del tipo. Se buscó antes de escribir este
 * archivo (grep sobre DECISIONS.md, el historial completo de `git log --all`, y `.scratch/`) y
 * no aparece en ninguno. Escribir acá un nombre de proveedor plausible pero no medido sería
 * fabricar un dato en la ruta del dinero — la misma familia que el rating fabricado que este
 * repo ya borró una vez (§ El RATING fabricado se BORRÓ, CLAUDE.md) — así que la lista se deja
 * vacía a propósito hasta que exista la cita puntual del tipo real. El MECANISMO (`esNoCobrable`,
 * `paraElPanel`, abajo) queda construido y probado con un tipo sintético
 * (`tests/…metodos-pasarela.test.ts`); agregar la entrada real es un paso posterior, con su
 * propia cita.
 *
 * EL LÍMITE, aunque llegue a tener una entrada: se mide contra UNA cuenta. No hay evidencia de
 * que otra cuenta, con otra configuración, rechace el mismo tipo — la ausencia de una entrada
 * acá tampoco prueba que un tipo SEA cobrable, sólo que nadie lo vio rechazar siempre todavía.
 */
export const TIPOS_NO_COBRABLES: ReadonlySet<string> = new Set<string>([]);

/** ¿Este tipo está en la lista de lo que la pasarela nunca cobra? El segundo parámetro existe
 *  SOLO para que el mecanismo se pueda probar con un tipo sintético sin tocar el registro real
 *  (que hoy está vacío, § `TIPOS_NO_COBRABLES` arriba) — en producción siempre corre con el
 *  default. */
export function esNoCobrable(tipo: string, tiposNoCobrables: ReadonlySet<string> = TIPOS_NO_COBRABLES): boolean {
  return tiposNoCobrables.has(tipo);
}

/**
 * REFINA el cruce guardado×cuenta (`cruzarMetodosPasarela`) con la pregunta que el PANEL
 * necesita para decidir qué dejar ENCENDER: de los tipos que la cuenta SÍ tiene
 * (`'disponible'`/`'disponible_no_ofrecido'`), ¿el checkout sabe DIBUJARLO (`checkoutSabeDibujar`)
 * y la pasarela lo COBRA (`!esNoCobrable`)? Si cualquiera de las dos falla, el tipo deja de ser
 * encendible aunque la cuenta lo tenga — `'guardado_no_disponible'` (la cuenta ya no lo tiene,
 * un problema DISTINTO: ni de dibujo ni de cobro) NO se toca.
 *
 * NO COBRABLE GANA SOBRE NO IMPLEMENTADO cuando un tipo fuera las dos cosas a la vez: un tipo
 * que la pasarela nunca cobra tampoco merece la promesa de "Disponible pronto" — esa frase dice
 * "todavía no lo construimos", y construirlo no cambiaría nada para un tipo que rechaza siempre.
 *
 * UN TIPO QUE YA ESTABA GUARDADO Y CAE ACÁ NO SE BORRA SOLO (§ PANEL-FILTRA-IMPLEMENTADOS-1):
 * esta función sólo cambia el ESTADO que ve el panel; `guardados` sigue teniendo el tipo hasta
 * que el dueño lo quite explícitamente — el llamador decide si mostrar "Quitar" comparando
 * contra su propia lista de guardados, esta función no la necesita para clasificar.
 */
export function paraElPanel(
  cruzado: MetodoPasarelaCruzado[],
  tiposNoCobrables: ReadonlySet<string> = TIPOS_NO_COBRABLES,
): MetodoPasarelaCruzado[] {
  return cruzado.map(({ tipo, estado }) => {
    if (estado === 'guardado_no_disponible') return { tipo, estado };
    if (esNoCobrable(tipo, tiposNoCobrables)) return { tipo, estado: 'no_cobrable' as const };
    if (!checkoutSabeDibujar(tipo)) return { tipo, estado: 'no_implementado' as const };
    return { tipo, estado };
  });
}

/**
 * Los tipos QUE NO SON TARJETA que se le OFRECEN AL COMPRADOR: reusa `cruzarMetodosPasarela`
 * (arriba) — el MISMO cruce que ya usa el panel del dueño — filtrado a `'disponible'` (la
 * cuenta del proveedor lo tiene habilitado Y el dueño lo encendió) y, además, a los tipos
 * para los que este registro sabe dibujar un formulario (TARJETA se ofrece por su propio
 * camino; PSE no tiene descriptor — § la cabecera de esta sección). El ORDEN que devuelve
 * `cruzarMetodosPasarela` (el de la cuenta primero) se conserva.
 */
export function metodosPasarelaParaComprador(guardados: string[], cuenta: string[]): DescriptorMetodoPasarela[] {
  return cruzarMetodosPasarela(guardados, cuenta)
    .filter((m) => m.estado === 'disponible')
    .map((m) => DESCRIPTORES_METODO_PASARELA[m.tipo])
    .filter((d): d is DescriptorMetodoPasarela => d !== undefined);
}
