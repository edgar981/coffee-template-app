import { PREFIJO_LLAVE_PASARELA_PRODUCTIVA } from './llaves-pasarela';

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

// ── LA FORMA EXTENSIBLE PARA LOS MÉTODOS QUE NO SON TARJETA (§ API-DIRECTA-OTROS-METODOS-1,
//    REHECHA POR § API-DIRECTA-FORMA-TRES-DIMENSIONES-1) ─────────────────────────────────────
//
// TARJETA NO VIVE EN ESTE REGISTRO. Su formulario (`FormularioTarjeta.tsx`, § API-DIRECTA-
// CAPTURA-TARJETA-1) captura varios campos y TOKENIZA contra el proveedor antes de crear la
// transacción — un flujo bespoke que ya existe y no necesita esta forma. Lo que sigue es el
// registro para TODO LO DEMÁS.
//
// LA FORMA VIEJA ASUMÍA UN CAMPO DE TEXTO LIBRE POR MÉTODO, PORQUE SE DISEÑÓ CON NEQUI Y NEQUI
// PIDE UN TELÉFONO — `N = 1` se leyó como LA FORMA en vez de como EL CASO. Un spike midió el
// catálogo entero del proveedor (`API-DIRECTA-SPIKE-FORMA-DE-METODOS-1`, registrado en
// `API-DIRECTA-CATALOGO-METODOS-ASIENTO-1`, DECISIONS.md) y encontró que esa suposición queda
// corta en TRES ejes a la vez — y el owner ordenó (2026-09-17) que la forma NAZCA cubriendo el
// espacio medido, no que se ensanche un método por vez:
//
//   A) CUÁNTOS campos — el catálogo pide hasta SEIS en un mismo tipo, y MÁS DE LA MITAD de los
//      tipos piden más de uno. `campos` es un ARRAY, sin un número adentro.
//   B) DE QUÉ NATURALEZA es cada campo — TEXTO LIBRE (lo que NEQUI ya pedía), ELECCIÓN DE UNA
//      LISTA CERRADA que el proveedor enumera, o un DATO QUE SE TRAE DE OTRA CONSULTA (una
//      lista que hay que pedirle al proveedor antes de poder mostrar el campo — la forma
//      DECLARA de dónde sale, no la resuelve: resolverla es trabajo de quien construya el
//      tipo que la necesite). `CampoMetodoPasarela` es una unión discriminada por
//      `naturaleza`, no un solo shape con props opcionales.
//   C) SI EL MÉTODO NAVEGA AFUERA — más de la mitad de los tipos medidos sacan al comprador de
//      la página, y el campo de la RESPUESTA del proveedor donde viene esa dirección NO tiene
//      el mismo nombre en todos los tipos. `redireccion?.campoUrl` es DATO DEL DESCRIPTOR, no
//      una constante compartida — una forma que buscara un único nombre fallaría, SIN RUIDO,
//      con la mitad de los tipos que sí redirigen.
//
// Y UN CAMPO PUEDE EXISTIR SÓLO EN EL AMBIENTE DE PRUEBAS del proveedor (`soloPruebas`, §2 del
// spike): sirve para simular el resultado de la transacción y es un artefacto del SANDBOX, no
// del método — fuera del ambiente de pruebas ese campo no se ofrece al comprador
// (`camposVisibles`, más abajo).
//
// PSE SIGUE EXPLÍCITAMENTE AFUERA de este registro: exige un tipo `consulta_externa` (la lista
// de bancos) que ningún descriptor real usa todavía, y nadie midió su forma de redirección
// contra el sandbox — escribirla a partir de la documentación es exactamente lo que el spike
// existe para evitar. PSE sigue necesitando su propio spike antes de tener su descriptor; que
// la forma ADMITA `consulta_externa` no es lo mismo que CONSTRUIRLO (§ el reporte del slice).
//
// AGREGAR EL TIPO SIGUIENTE ES AGREGAR UNA ENTRADA A `DESCRIPTORES_METODO_PASARELA` — a nivel
// de la FORMA (este registro + `lib/pagos/creacion-transaccion.ts`, que sólo llama a
// `construirPaymentMethod` del descriptor elegido, sin un caso por tipo). Lo que SIGUE
// necesitando trabajo aparte para un tipo con más de un campo es el WIRE hacia
// `app/api/checkout/route.ts` — Tier 1, fuera de `touches` de este slice, ver la LEGACY de
// abajo y el reporte del slice.
//
// OJO CON EL NOMBRE: el `tipo` de este registro (p. ej. `'NEQUI'`) es el vocabulario del
// PROVEEDOR (`accepted_payment_methods` / `SiteSetting.metodosPasarela`, arriba en este mismo
// archivo) — DISTINTO de `MetodoPagoTipo` (`lib/checkout/metodos-pago.ts`, `'nequi'` en
// minúscula), que es el método de pago MANUAL que el checkout ya ofrecía (confirmación por
// WhatsApp, sin API directa). Son dos namespaces que sólo coinciden por casualidad de nombre.

interface CampoMetodoPasarelaBase {
  /** La CLAVE con la que el valor de este campo viaja en el mapa que recibe
   *  `DescriptorMetodoPasarela.construirPaymentMethod` (abajo) — NUNCA lo que el comprador
   *  lee (eso es `rotulo`). */
  nombre: string;
  /** Lo que el comprador lee junto al campo — TEXTO PROVISIONAL, PENDIENTE DE TEXTO DEL OWNER
   *  (§ el reporte del slice). */
  rotulo: string;
  /** `true` si este campo SÓLO EXISTE en el ambiente de PRUEBAS del proveedor — sirve para
   *  simular el resultado de la transacción y es un artefacto del sandbox, no del método
   *  (§2 del spike, `API-DIRECTA-CATALOGO-METODOS-ASIENTO-1`: si desaparece en una cuenta
   *  productiva SIGUE SIN MEDIRSE — este flag no afirma que sí; sólo evita hornear el campo a
   *  producción mientras nadie lo confirma). Ausente/`false` en cualquier campo normal.
   *  Fuera del ambiente de pruebas este campo NO se renderiza (`camposVisibles`, abajo). */
  soloPruebas?: boolean;
  /** `null` si `valor` es válido para este campo; si no, el mensaje de error — TEXTO
   *  PROVISIONAL, PENDIENTE DE TEXTO DEL OWNER. Nunca lanza: el llamador (la pantalla, y el
   *  servidor antes de construir el payload) decide qué hacer con el mensaje. */
  validar: (valor: string) => string | null;
}

/** Naturaleza A: el comprador TECLEA el valor — lo que NEQUI ya pedía. */
export interface CampoTextoLibre extends CampoMetodoPasarelaBase {
  naturaleza: 'texto_libre';
  /** TEXTO PROVISIONAL, PENDIENTE DE TEXTO DEL OWNER. */
  placeholder: string;
}

export interface OpcionCampoMetodoPasarela {
  /** El valor LITERAL que viaja al proveedor — no lo que el comprador lee. */
  valor: string;
  /** Lo que el comprador lee para elegir esta opción — TEXTO PROVISIONAL. */
  etiqueta: string;
}

/** Naturaleza B: el comprador ELIGE de una lista CERRADA que el proveedor enumera (en su
 *  propio error de validación, § el spike) — la lista es PARTE del campo, no una validación
 *  suelta contra un array externo. */
export interface CampoEleccionCerrada extends CampoMetodoPasarelaBase {
  naturaleza: 'eleccion_cerrada';
  opciones: OpcionCampoMetodoPasarela[];
}

/** Naturaleza C: el dato se TRAE de OTRA consulta al proveedor (la lista de bancos para PSE,
 *  por ejemplo) — la forma DECLARA de dónde sale (`fuenteConsulta`, un identificador legible,
 *  no una URL: quién resuelve la consulta decide cómo), pero NO la resuelve. Ningún descriptor
 *  de `DESCRIPTORES_METODO_PASARELA` usa esta naturaleza todavía (§ el reporte del slice). */
export interface CampoConsultaExterna extends CampoMetodoPasarelaBase {
  naturaleza: 'consulta_externa';
  /** De dónde sale la lista que hay que pedirle al proveedor antes de poder mostrar este
   *  campo — DECLARATIVO: no dispara la consulta ni sabe cómo hacerla. */
  fuenteConsulta: string;
}

/** Unión discriminada por `naturaleza` — la razón de ser su PROPIA dimensión (§ la cabecera de
 *  esta sección): una forma de "N campos de texto" no puede expresar "elegí una de estas" ni
 *  "esto se pide aparte". */
export type CampoMetodoPasarela = CampoTextoLibre | CampoEleccionCerrada | CampoConsultaExterna;

/** Ausente = el método NO saca al comprador de la página. Presente = SÍ navega afuera, y dice
 *  en qué campo DE LA RESPUESTA del proveedor viene la dirección — NO es el mismo nombre en
 *  todos los tipos (§ la cabecera de esta sección, dimensión C), así que cada descriptor
 *  declara el suyo. */
export interface RedireccionMetodoPasarela {
  /** El nombre del campo, en el objeto que el proveedor devuelve al crear la transacción,
   *  donde viene la URL a la que hay que mandar al comprador. La forma exacta de anidamiento
   *  de ese objeto NO está medida contra el sandbox (ningún tipo con redirección está
   *  habilitado en la cuenta que corrió el spike, § "lo que no se pudo medir" del asiento) —
   *  por eso `urlDeRedireccion` (abajo) recibe el objeto YA APLANADO a las claves que le
   *  interesan, en vez de asumir una ruta de anidamiento. */
  campoUrl: string;
}

// ── LA AGRUPACIÓN DE UI ES POR INSTRUMENTO (§3 de API-DIRECTA-DECISIONES-PROGRAMA-1,
//    DECISIONS.md — § CHECKOUT-PESTANAS-POR-INSTRUMENTO-1) ────────────────────────────────────
//
// El owner ya decidió los CUATRO grupos y su pregunta («¿con qué paga el comprador?»): tarjeta,
// débito bancario, billeteras, y financiación y puntos. Esta forma sólo los NOMBRA — no los
// reinventa ni los renombra.
//
// 'tarjeta' ESTÁ en la unión (la pestaña de tarjeta la necesita, § abajo), pero NINGÚN
// descriptor de este registro puede declararla: TARJETA NO VIVE ACÁ (su flujo es bespoke, § la
// cabecera de esta sección), así que `DescriptorMetodoPasarela.grupo` usa
// `GrupoDescriptorMetodoPasarela` —la unión SIN 'tarjeta'— para que sea ESTRUCTURALMENTE
// imposible que un descriptor de este archivo se declare a sí mismo tarjeta.
export type GrupoMetodoPasarela = 'tarjeta' | 'debito_bancario' | 'billeteras' | 'financiacion_puntos';

/** El orden CANÓNICO de los cuatro grupos — el mismo orden en que el owner los nombró (§3 de
 *  API-DIRECTA-DECISIONES-PROGRAMA-1): tarjeta, débito bancario, billeteras, financiación y
 *  puntos. Una pestaña aparece siempre en esta posición, nunca por el orden en que llegan del
 *  proveedor ni alfabético — así el instrumento que un comprador ya conoce queda donde lo dejó
 *  la vez anterior. */
export const ORDEN_GRUPOS_METODO_PASARELA: readonly GrupoMetodoPasarela[] = [
  'tarjeta', 'debito_bancario', 'billeteras', 'financiacion_puntos',
];

/** El universo de grupos que un DESCRIPTOR puede declarar — 'tarjeta' excluida a propósito
 *  (§ la cabecera de esta sección). */
export type GrupoDescriptorMetodoPasarela = Exclude<GrupoMetodoPasarela, 'tarjeta'>;

export interface DescriptorMetodoPasarela {
  /** El tipo tal como lo nombra el proveedor — la MISMA cadena que ya cruza
   *  `cruzarMetodosPasarela` (arriba). */
  tipo: string;
  /** Lo que el comprador lee para elegir esta opción — TEXTO PROVISIONAL, PENDIENTE DE TEXTO
   *  DEL OWNER. */
  nombreVisible: string;
  /** El GRUPO de instrumento al que pertenece este método, para la pestaña que lo agrupa
   *  (§ la cabecera de esta sección) — un atributo DEL DESCRIPTOR, junto a sus campos y su
   *  redirección, y NO una segunda lista tipo→grupo que pudiera desincronizarse del registro
   *  el día que entre un descriptor nuevo.
   *
   *  OPCIONAL A PROPÓSITO — no porque un descriptor real pueda vivir sin grupo (los dos de
   *  `DESCRIPTORES_METODO_PASARELA` lo declaran), sino para no forzarlo en los descriptores
   *  SINTÉTICOS que ya existían en otros archivos de test (`lib/pagos/creacion-transaccion.
   *  test.ts`, fuera de `touches` de § CHECKOUT-PESTANAS-POR-INSTRUMENTO-1) — ésos prueban la
   *  creación de la transacción, nunca la agrupación por instrumento, así que no tienen nada
   *  que decir sobre su pestaña. Un descriptor SIN `grupo` simplemente no agrupa
   *  (`agruparMetodosPasarelaPorInstrumento` lo omite, abajo) — el mismo trato que un tipo sin
   *  descriptor en el registro. */
  grupo?: GrupoDescriptorMetodoPasarela;
  /** Los campos que este tipo le pide al comprador — CERO, UNO o MUCHOS. Sin un número
   *  adentro: es un array, no una convención de cuántas propiedades declarar. */
  campos: CampoMetodoPasarela[];
  /** Declarado sólo si este método navega afuera del checkout (dimensión C, arriba). */
  redireccion?: RedireccionMetodoPasarela;
  /** Arma el `payment_method` que viaja al proveedor para este tipo, a partir de un MAPA
   *  nombre→valor —una entrada por cada `campos[i].nombre`, ya validados por su propio
   *  `validar`—. Puro: nunca toca la red — sólo construye el objeto que
   *  `lib/pagos/creacion-transaccion.ts` empaca junto a lo que la firma ya fija. */
  construirPaymentMethod: (valores: Record<string, string>) => Record<string, unknown>;
  /** LEGACY — SIEMPRE `campos[0]`, nunca se declara a mano (lo deriva `conCampoLegacy`,
   *  abajo). Existe ÚNICAMENTE porque `app/api/checkout/route.ts` (Tier 1, fuera de `touches`
   *  de este slice) todavía valida y construye por un ÚNICO campo, con la forma vieja
   *  (`descriptor.campo.validar(dato)`, `construirDatosCreacionTransaccion(comunes,
   *  descriptor, dato: string)` en `lib/pagos/creacion-transaccion.ts`) — tocar ese wire para
   *  que hable el mapa general es Tier 1 y queda fuera de este slice (§ el reporte). Todo
   *  descriptor de `DESCRIPTORES_METODO_PASARELA` tiene que declarar AL MENOS un campo por
   *  esto — `conCampoLegacy` lo hace fallar ruidoso si no. */
  campo: CampoMetodoPasarela;
}

/**
 * Deriva `campo` (LEGACY, arriba) de `campos[0]` — para que nunca se declare a mano y por
 * tanto nunca pueda divergir de `campos[0]`. Lanza si `campos` está vacío: un descriptor sin
 * ningún campo no puede satisfacer el wire LEGACY que `app/api/checkout/route.ts` todavía usa.
 *
 * `T` se restringe a `DescriptorMetodoPasarela` SIN `campo` (es lo que esta función agrega) —
 * quien llama pasa ese tipo EXPLÍCITO como argumento genérico (`conCampoLegacy<Omit<
 * DescriptorMetodoPasarela, 'campo'>>({...})`), nunca lo deja inferir del literal: inferido, el
 * contexto de una anotación `: DescriptorMetodoPasarela` en el call site fuerza a `T` a incluir
 * `campo` (circular — exactamente lo que esta función existe para no pedir).
 */
export function conCampoLegacy<T extends Omit<DescriptorMetodoPasarela, 'campo'>>(
  descriptor: T,
): T & { campo: CampoMetodoPasarela } {
  const primero = descriptor.campos[0];
  if (!primero) {
    throw new Error(
      `El descriptor "${descriptor.tipo}" no declara ningún campo — el wire LEGACY de ` +
      `app/api/checkout/route.ts exige al menos uno.`,
    );
  }
  return { ...descriptor, campo: primero };
}

/**
 * ¿Este campo se muestra en ESTE ambiente? Un campo `soloPruebas` sólo se ofrece cuando
 * `esAmbientePruebas` es verdadero (§2 del spike, arriba) — cualquier otro campo se muestra
 * siempre. Pura: quién decide "estamos en pruebas" es responsabilidad de quien llama
 * (`esAmbientePruebasPorLlave`, abajo, o el equivalente del servidor).
 */
export function camposVisibles(
  descriptor: DescriptorMetodoPasarela,
  esAmbientePruebas: boolean,
): CampoMetodoPasarela[] {
  return descriptor.campos.filter((c) => esAmbientePruebas || !c.soloPruebas);
}

/**
 * ¿Estamos en el ambiente de PRUEBAS del proveedor? Se deriva del PREFIJO de la llave pública
 * —el mismo hecho medido que ya usa `baseUrlPasarelaDesdeLlave`
 * (`services/checkout.service.ts`) para elegir el host—, no de una segunda variable de entorno:
 * `esDespliegueDemo()` lee `VERCEL_ENV`/`NOINDEX`, que no son `NEXT_PUBLIC_` y no existen en el
 * navegador. Reusa `PREFIJO_LLAVE_PASARELA_PRODUCTIVA` (`lib/pagos/llaves-pasarela.ts`) en vez
 * de repetir el literal — dos copias del mismo prefijo es cómo diverge una de la otra.
 */
export function esAmbientePruebasPorLlave(publicKeyPasarela: string): boolean {
  return !publicKeyPasarela.startsWith(PREFIJO_LLAVE_PASARELA_PRODUCTIVA);
}

/**
 * Extrae la URL de redirección de la respuesta de creación de la transacción, usando el
 * `campoUrl` que EL DESCRIPTOR declaró (dimensión C, arriba) — nunca un nombre fijo. `null` si
 * el método no redirige (`descriptor.redireccion` ausente), si el campo no vino, o si vino con
 * un valor que no es un string no vacío. `respuesta` es el objeto YA APLANADO a las claves que
 * interesan (la forma exacta de anidamiento de la respuesta real no está medida, § el
 * docstring de `RedireccionMetodoPasarela`) — quien llama decide qué nivel del payload pasar.
 */
export function urlDeRedireccion(
  descriptor: DescriptorMetodoPasarela,
  respuesta: Record<string, unknown>,
): string | null {
  if (!descriptor.redireccion) return null;
  const valor = respuesta[descriptor.redireccion.campoUrl];
  return typeof valor === 'string' && valor.length > 0 ? valor : null;
}

function soloDigitos(valor: string): string {
  return valor.replace(/\D/g, '');
}

// EL ÚNICO DESCRIPTOR REAL (§ API-DIRECTA-OTROS-METODOS-1): una billetera que sólo pide un
// número de celular colombiano — el mismo patrón de 10 dígitos que empieza por 3 que ya valida
// el resto del checkout (`phoneValid`, `app/(storefront)/checkout/page.tsx`). USA SÓLO UNA DE
// LAS TRES DIMENSIONES (un campo, texto libre, sin redirección) — es exactamente por lo que la
// PRUEBA de que la forma cubre las tres no se hace con este descriptor (§ el reporte del
// slice: "probar la forma con él sería probar otra vez el caso que la dejó corta"). TEXTO
// PROVISIONAL EN TODO EL DESCRIPTOR — PENDIENTE DE TEXTO DEL OWNER.
export const DESCRIPTOR_NEQUI = conCampoLegacy<Omit<DescriptorMetodoPasarela, 'campo'>>({
  tipo: 'NEQUI',
  nombreVisible: 'Nequi',
  // Nequi es una BILLETERA — «con qué paga el comprador» (§3 de API-DIRECTA-DECISIONES-
  // PROGRAMA-1), no débito bancario ni financiación: el comprador paga desde el saldo de su
  // app, sin pasar por su banco ni por una cuota.
  grupo: 'billeteras',
  campos: [
    {
      nombre: 'numero',
      rotulo: 'Número de celular Nequi',
      placeholder: '300 000 0000',
      naturaleza: 'texto_libre',
      validar: (valor) =>
        /^3\d{9}$/.test(soloDigitos(valor))
          ? null
          : 'Ingresa un número de celular colombiano válido (10 dígitos, empieza por 3).',
    },
  ],
  construirPaymentMethod: (valores) => ({ type: 'NEQUI', phone_number: soloDigitos(valores.numero ?? '') }),
});

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
 * `BANCOLOMBIA` ES LA ÚNICA ENTRADA, y es el identificador LITERAL que el proveedor espera en
 * el campo de tipo de método al crear una transacción — NO el nombre visible del banco. El
 * spike que midió el rechazo (`API-DIRECTA-SPIKE-FORMA-DE-METODOS-1`) lo registró en
 * `API-DIRECTA-CATALOGO-METODOS-ASIENTO-1` (DECISIONS.md, § "3 · Catálogo ≠ habilitado ≠
 * cobrable") sin nombrarlo — lo describía por su comportamiento, nunca por el identificador. El
 * slice que iba a construir este archivo buscó ese identificador en el ledger, en todo el
 * historial (`git log --all`) y en `.scratch/`, no lo encontró en ningún lado, y se negó a
 * fabricar un nombre — dejó esta lista vacía en vez de inventar (la misma familia que el rating
 * fabricado que este repo ya borró una vez, § El RATING fabricado se BORRÓ, CLAUDE.md). El
 * nombre lo agregó la corrección posterior, **`API-DIRECTA-CATALOGO-NOMBRA-TIPO-1`**
 * (DECISIONS.md, mismo párrafo, 2026-09-17). Es, casi con certeza, una etiqueta agregadora que
 * agrupa a sus hermanos bajo la marca de un banco para reportes, no un método que se pueda
 * cobrar.
 *
 * EL LÍMITE, con la entrada ya escrita, NO CAMBIÓ: se mide contra UNA cuenta. No hay evidencia
 * de que otra cuenta, con otra configuración, rechace el mismo tipo — la ausencia de una entrada
 * acá tampoco prueba que un tipo SEA cobrable, sólo que nadie lo vio rechazar siempre todavía. Y
 * si un tipo ya listado pasara a ser cobrable en el sandbox, esta lista no se entera sola: hay
 * que volver a medir y quitarlo a mano.
 */
export const TIPOS_NO_COBRABLES: ReadonlySet<string> = new Set<string>(['BANCOLOMBIA']);

/** ¿Este tipo está en la lista de lo que la pasarela nunca cobra? El segundo parámetro existe
 *  SOLO para que el mecanismo se pueda probar con un tipo sintético sin tocar el registro real
 *  (que hoy tiene UNA entrada, BANCOLOMBIA, § `TIPOS_NO_COBRABLES` arriba — corregido por
 *  § CHECKOUT-PESTANAS-POR-INSTRUMENTO-1: decía "vacío", y dejó de serlo con
 *  § PANEL-LISTA-NO-COBRABLES-1) — en producción siempre corre con el default. */
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

// ── LAS PESTAÑAS POR INSTRUMENTO (§ CHECKOUT-PESTANAS-POR-INSTRUMENTO-1) ─────────────────────

/** Un grupo con AL MENOS un método — la función de abajo nunca devuelve uno vacío
 *  (§ el reporte del slice: "una pestaña sin métodos NO se dibuja"). */
export interface GrupoDeMetodosPasarela {
  grupo: GrupoDescriptorMetodoPasarela;
  /** Los tipos de este grupo, en el orden en que `metodosPasarelaParaComprador`/
   *  `metodosOtros` los trajo — nunca reordenados dentro del grupo. */
  tipos: string[];
}

/**
 * Agrupa los tipos QUE NO SON TARJETA (típicamente `metodosOtros`, ya filtrado por el servidor
 * vía `metodosPasarelaParaComprador`) por su `grupo` declarado EN EL DESCRIPTOR — nunca una
 * segunda lista tipo→grupo, que se desincronizaría del registro el día que entre un descriptor
 * nuevo (§ la cabecera de la sección de arriba). La tarjeta NO pasa por acá: no tiene
 * descriptor en este registro, así que quien llama resuelve su propia pestaña por separado
 * (§ el reporte del slice, "decí explícitamente cómo resolviste su pestaña").
 *
 * Devuelve sólo los grupos que terminan con AL MENOS un método, en el orden CANÓNICO de
 * `ORDEN_GRUPOS_METODO_PASARELA` (nunca el orden de llegada) — una pestaña sin métodos no se
 * dibuja. Un tipo SIN descriptor en `registro`, o con descriptor pero SIN `grupo` (§ el
 * docstring de `DescriptorMetodoPasarela.grupo` — los descriptores sintéticos de otros tests
 * no lo declaran), se omite en silencio: la misma guarda defensiva que `SelectorMetodoPasarela`
 * ya aplicaba antes de esta agrupación, para el caso en que el registro del cliente y el del
 * servidor lleguen a divergir.
 *
 * `registro` es inyectable SOLO para que el mecanismo se pueda probar con un descriptor
 * sintético sin tocar `DESCRIPTORES_METODO_PASARELA` — mismo patrón que `esNoCobrable` arriba.
 */
export function agruparMetodosPasarelaPorInstrumento(
  tipos: string[],
  registro: Record<string, DescriptorMetodoPasarela> = DESCRIPTORES_METODO_PASARELA,
): GrupoDeMetodosPasarela[] {
  const porGrupo = new Map<GrupoDescriptorMetodoPasarela, string[]>();
  for (const tipo of tipos) {
    const descriptor = registro[tipo];
    if (!descriptor?.grupo) continue;
    const lista = porGrupo.get(descriptor.grupo);
    if (lista) lista.push(tipo);
    else porGrupo.set(descriptor.grupo, [tipo]);
  }

  return ORDEN_GRUPOS_METODO_PASARELA
    .filter((grupo): grupo is GrupoDescriptorMetodoPasarela => grupo !== 'tarjeta')
    .map((grupo) => ({ grupo, tipos: porGrupo.get(grupo) ?? [] }))
    .filter((g) => g.tipos.length > 0);
}
