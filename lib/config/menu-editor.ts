import type { MenuContent, MenuItemId } from './site-content-defaults';

// El editor BESPOKE del menú (§ CROMO-MENU-PANEL-EDITOR-1, sobre el modelo de
// § CROMO-MENU-COMO-DATO-1) necesita DOS piezas de conducta de formulario que NO son del modelo —
// construir la etiqueta de una opción de reorden, y reordenar sin poder producir un duplicado— y
// por eso viven ACÁ, no en `site-content-defaults.ts` (declara el DATO y su resolución de lectura,
// no la conducta de un formulario concreto) ni inline en `MenuSeccion.tsx` (es '.tsx', y este repo
// no tiene jsdom para testear componentes — § CLAUDE.md, "los tests de COMPONENTE necesitan
// jsdom"). Puras, sin React, para afirmarlas en capa 1.

export type CampoPosicionMenu = 'posicion1' | 'posicion2' | 'posicion3';
type CampoLabelMenu = 'labelTienda' | 'labelSuscripciones' | 'labelNosotros';

const POSICIONES_MENU: readonly CampoPosicionMenu[] = ['posicion1', 'posicion2', 'posicion3'];

// El nombre CANÓNICO de cada ítem (§ REGISTRY.menu — la ruta es estructura, no hay editor de
// identidad), para cuando su etiqueta editable todavía está vacía.
const ETIQUETA_CANONICA_MENU: Record<MenuItemId, string> = {
  tienda: 'Tienda',
  suscripciones: 'Suscripciones',
  nosotros: 'Nosotros',
};

export const CAMPO_LABEL_MENU: Record<MenuItemId, CampoLabelMenu> = {
  tienda: 'labelTienda',
  suscripciones: 'labelSuscripciones',
  nosotros: 'labelNosotros',
};

/** La etiqueta de una OPCIÓN de ítem en el editor: el label EN VIVO que el dueño está tecleando
 *  para ese ítem, o su nombre canónico si aún está vacío — nunca una opción muda (un `<option>`
 *  con texto '' es indistinguible de las otras dos). La usan los TRES selects de posición Y el
 *  select del ítem con badge (§ PANEL-EDITOR-MENU-BADGE-1, `MenuSeccion.tsx`) — misma pregunta
 *  ("¿cómo se llama este ítem, en vivo?"), dos sitios que la hacen. */
export function etiquetaOpcionMenu(form: Pick<MenuContent, CampoLabelMenu>, id: MenuItemId): string {
  const v = form[CAMPO_LABEL_MENU[id]].trim();
  return v || ETIQUETA_CANONICA_MENU[id];
}

/** Un PAR label+destino (el CTA del menú, el CTA de intro del panel, el CTA de la tarjeta, § MUESTRARIO-
 *  MEGA-MENU-1) está A MEDIAS cuando exactamente UNO de los dos trae texto — el otro caso donde el
 *  botón no se muestra (§ `resolverCtaSeccion`) pero no es porque el dueño lo dejó apagado a propósito.
 *  Generaliza el `ctaLabelPresente !== ctaDestinoPresente` que ya vivía inline en `MenuSeccion.tsx` para
 *  el CTA del menú, para no repetir la misma comparación tres veces (menú, intro del panel, tarjeta). */
export function parAMedias(a: string, b: string): boolean {
  return (a.trim() !== '') !== (b.trim() !== '');
}

/** Reordenar por SWAP: elegir un ítem para una posición JAMÁS puede dejar dos posiciones con el
 *  mismo ítem — `menuEditableSchema` lo rechazaría con un 400 al guardar (§ site-content-schema.ts,
 *  el `.refine()` de posiciones únicas)—, así que si el ítem elegido YA ocupaba otra posición, esa
 *  otra posición se lleva el valor que la elegida tenía. El resultado es siempre una PERMUTACIÓN de
 *  `MENU_ITEM_IDS`: el estado inválido queda IMPOSIBLE de producir desde el editor, no rechazado
 *  después de intentarlo. Devuelve el PARCIAL a aplicar sobre el form (uno o dos campos; vacío si
 *  el valor elegido ya era el de esa posición). */
export function intercambiarPosicionMenu(
  form: Pick<MenuContent, CampoPosicionMenu>,
  campo: CampoPosicionMenu,
  nuevoId: MenuItemId,
): Partial<Pick<MenuContent, CampoPosicionMenu>> {
  const viejoValor = form[campo];
  if (viejoValor === nuevoId) return {};
  const otroCampo = POSICIONES_MENU.find((c) => c !== campo && form[c] === nuevoId);
  const parcial: Partial<Pick<MenuContent, CampoPosicionMenu>> = { [campo]: nuevoId };
  if (otroCampo) parcial[otroCampo] = viejoValor;
  return parcial;
}
