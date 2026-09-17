// El CRUCE entre lo GUARDADO (`SiteSetting.metodosPasarela`, lo que el dueño eligió ofrecer)
// y lo que la CUENTA del proveedor tiene realmente habilitado (`consultarMetodosAceptados`,
// `lib/pagos/wompi-api.ts`) — puro, capa 1 (§ API-DIRECTA-PANEL-METODOS-1). La pantalla sólo
// dibuja lo que esta función devuelve; no reimplementa el cruce.
//
// TRES ESTADOS, y son los únicos que un tipo puede tener:
//   - 'disponible'            : está en las DOS listas — el dueño lo ofrece y su cuenta lo
//                                sostiene. Editable: apagarlo lo saca de lo guardado.
//   - 'guardado_no_disponible': está guardado, pero la cuenta YA NO lo tiene. No se borra
//                                solo (sería una escritura que nadie pidió, y escondería el
//                                desalineo) — el dueño lo ve marcado y sólo puede QUITARLO.
//   - 'disponible_no_ofrecido': la cuenta lo tiene, pero el dueño no lo ofrece todavía.
//                                Editable: prenderlo lo agrega a lo guardado.

export type EstadoMetodoPasarela = 'disponible' | 'guardado_no_disponible' | 'disponible_no_ofrecido';

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
