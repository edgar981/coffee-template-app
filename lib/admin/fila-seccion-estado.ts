// lib/admin/fila-seccion-estado.ts — § CHAMISAS-APERTURA-ALBUM-AJUSTES-1.
//
// EL CÁLCULO de "esta sección no se muestra en la tienda, aunque el interruptor diga que sí" —
// extraído de `TiendaSeccionEditor.tsx` (donde vivía inline, repartido entre `oculta`/
// `repeaterVacio`/`campoGateVacio`/`creditosPisoIncompleto`/`noSeMuestra`) a una función PURA con su
// test, por el motivo de siempre en este repo: ese componente NO se puede montar (el carril no tiene
// React Testing Library para render con interacción, § CLAUDE.md), así que una regla que vive sólo
// ahí dentro no se puede afirmar — sólo mirar.
//
// EL DEFECTO QUE ESTO INVESTIGA (reporte del owner, 2026-10-14): la fila «Apertura» del editor de
// /nosotros aparecía atenuada con el ojo tachado —como oculta— con contenido PUBLICADO y
// `visible:true`. Medido contra el código de `TiendaSeccionEditor.tsx` ANTES de esta extracción:
// `NOSOTROS_APERTURA` (tienda-secciones.ts) no declara `seMuestraSiCampo` ni `repeater`, así que de
// las cuatro causas de `noSeMuestra` sólo `oculta` (`config.ocultable && form.visible === false`)
// podía aplicarle — y con `visible:true` esa condición da `false`. Los cuatro tests de abajo que
// cubren exactamente `visible:true` bajo la composición «album» PASAN con la lógica tal como estaba:
// no se encontró una condición del lado del CLIENTE que, con `visible:true`, calculara `noSeMuestra`
// en `true` para esta sección. Queda declarado como UNKNOWN (no reproducido) en el reporte del
// slice — no se inventa una causa para cerrar el caso.
//
// LO QUE SÍ ERA UNA REGLA INCOMPLETA, y esta extracción CIERRA: el piso de completitud de
// `tiendaCreditos` (§ `creditosVisibles`, lib/tienda/creditos.ts — menos de 3 filas con etiqueta+
// valor) sólo se evaluaba para la FILA DE `tiendaCreditos` consigo misma. `nosotrosFicha` depende
// del MISMO piso (§ NosotrosFicha.tsx: `if (!creditosVisibles(tiendaCreditos.items)) return null`,
// corre ANTES de la rama «etiqueta») pero su fila en el editor nunca lo sabía — por eso "Ficha de la
// finca" podía no aparecer, sin que el panel dijera por qué. `pisoCruzadoItems` es el parámetro
// nuevo: la sección que declara `SeccionConfig.pisoCruzado` (hoy, sólo `nosotrosFicha` →
// `tiendaCreditos`) pasa los `items` REALES de esa otra sección (vía `valoresCruzados`,
// TiendaPaginas.tsx), y esta función aplica el MISMO `creditosVisibles` que ya gobierna el render
// real — nunca una segunda cuenta que pudiera divergir.

import { creditosVisibles, type CreditoItem } from '@/lib/tienda/creditos';

export interface FilaSeccionEstadoParams {
  /** `config.ocultable`. */
  ocultable: boolean;
  /** `form.visible`, SIN resolver — `undefined`/cualquier valor que no sea `false` cuenta como
   *  visible (mismo criterio que el componente: `form.visible === false`, nunca `!== true`). */
  formVisible: unknown;
  /** `config.seccion === 'tiendaCreditos'` — la ÚNICA sección con el piso de completitud SOBRE SUS
   *  PROPIOS ítems (las demás, si dependen del piso, lo hacen vía `pisoCruzadoItems`). */
  esTiendaCreditos: boolean;
  /** `config.repeater?.itemsKey` — presente sólo si la sección es un repeater. */
  repeaterItemsKey: string | undefined;
  /** `form[repeaterItemsKey]` cuando hay repeater (o `form[tiendaCreditos.itemsKey]` cuando
   *  `esTiendaCreditos`); `undefined` si la sección no es un repeater. */
  items: unknown;
  /** `config.seMuestraSiCampo`. */
  seMuestraSiCampo: string | undefined;
  /** `form[seMuestraSiCampo]`. */
  valorCampoGate: unknown;
  /** § el piso cruzado, arriba — los `items` REALES de la sección que `config.pisoCruzado` nombra.
   *  `undefined` = esta sección no declara `pisoCruzado` (la inmensa mayoría). */
  pisoCruzadoItems: readonly CreditoItem[] | undefined;
}

export interface FilaSeccionEstado {
  /** El interruptor de sección está apagado. */
  oculta: boolean;
  /** Es un repeater y su lista está vacía (hide-on-empty). */
  repeaterVacio: boolean;
  /** `seMuestraSiCampo` declarado y ese campo está vacío. */
  campoGateVacio: boolean;
  /** El piso de `tiendaCreditos` (≥3 filas completas) no se cumple — propio o cruzado. */
  creditosPisoIncompleto: boolean;
  /** La fila se atenúa en el editor y el banner "No se muestra en la tienda" se enciende. */
  noSeMuestra: boolean;
}

export function filaSeccionEstado(p: FilaSeccionEstadoParams): FilaSeccionEstado {
  const oculta = p.ocultable && p.formVisible === false;
  const tieneItems = Array.isArray(p.items) && p.items.length > 0;
  const repeaterVacio = !!p.repeaterItemsKey && !tieneItems;
  const campoGateVacio = !!p.seMuestraSiCampo && String(p.valorCampoGate ?? '').trim() === '';
  // `tiendaCreditos` consigo misma: el piso sólo aplica si NO está vacía (vacía ya la cubre
  // `repeaterVacio` con su propio mensaje — "agrega la primera", no "agrega una más"). Cruzado
  // (`pisoCruzadoItems`): la sección dependiente no tiene repeater propio que distinga "vacía" de
  // "incompleta", así que el piso aplica siempre que el destino esté declarado — 0 filas también
  // reprueba `creditosVisibles`, y es justo el caso que más necesita el aviso (nada que mostrar Y
  // nada que lo explique).
  const creditosPisoIncompleto = p.esTiendaCreditos
    ? !repeaterVacio && !creditosVisibles((p.items as CreditoItem[] | undefined) ?? [])
    : p.pisoCruzadoItems !== undefined && !creditosVisibles(p.pisoCruzadoItems);
  const noSeMuestra = oculta || repeaterVacio || campoGateVacio || creditosPisoIncompleto;
  return { oculta, repeaterVacio, campoGateVacio, creditosPisoIncompleto, noSeMuestra };
}
