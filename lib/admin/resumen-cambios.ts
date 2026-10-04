// EL RESUMEN DE PUBLICAR, en palabras (§ EDITOR-TIENDA-PUBLICAR-RESUMEN-1, docs/editor-tienda/
// REDISENO.md § 3/§ 9, slice 8). Módulo PURO —sin React, sin `fetch`, sin DOM— que compara el
// contenido en BORRADOR contra lo PUBLICADO, sección por sección, y devuelve la lista que el
// popover de «Publicar» muestra: «Hero · Titular · nuevo», «Hero · Composición «Portada»»,
// «Nosotros · Tercer párrafo · nuevo». Los nombres son los que YA usa el panel —`SECCIONES_TIENDA`
// (`components/admin/tienda-secciones.ts`, datos puros, sin JSX) y `ELEMENTOS_ESTILO`
// (`lib/config/estilo-elemento.ts`, también puro)— nunca una segunda lista de labels.
//
// EL LLAMADOR decide QUÉ comparar y CÓMO conseguirlo (`lib/admin/resumen-cambios` no sabe de
// `/api/site-content`, igual que `historial-editor.ts` no sabe de React): recibe el contenido
// draft-merged y lo publicado, YA RESUELTOS (misma forma, `SiteContentData` por sección — el
// resolver de `site-content-defaults.ts` corre sobre los dos, así que comparar campo a campo es
// comparar manzanas con manzanas, nunca un valor crudo contra uno resuelto).
//
// `sonIguales` (de `historial-editor.ts`, § ese archivo) es la MISMA igualdad estructural que ya usa
// el historial de deshacer/rehacer — dos declaraciones de "¿son el mismo valor?" podrían divergir
// (la misma clase de defecto que CLAUDE.md ya documenta dos veces: "cuando dos declaraciones
// describen el mismo conjunto…"), así que este módulo la REUSA en vez de escribir la suya.

import { SECCIONES_TIENDA, type SeccionConfig, type SeccionVista } from '@/components/admin/tienda-secciones';
import { ELEMENTOS_ESTILO } from '@/lib/config/estilo-elemento';
import { sonIguales } from '@/lib/admin/historial-editor';

export type TipoCambio = 'nuevo' | 'cambiado' | 'quitado';

export interface CambioResumen {
  /** La clave de lo que cambió: una `SeccionVista` del REGISTRY, o las dos claves META `'orden'`/
   *  `'tema'` — el MISMO vocabulario que `TiendaPaginas.listaPendientes()` ya usa para "Publicar"/
   *  "Descartar" en lote. Es lo que el popover manda a `onIrAItem` al tocar la fila. */
  clave: string;
  /** El título que YA muestra el panel para esto (`SeccionConfig.titulo`, o "Orden de las
   *  secciones"/"Estilo" para las dos claves META). */
  tituloSeccion: string;
  /** El nombre del campo/elemento que cambió, en las MISMAS palabras del panel (`.label`). */
  elemento: string;
  tipo: TipoCambio;
  /** La frase completa, lista para mostrar — «Hero · Titular · nuevo». */
  etiqueta: string;
}

const PALABRA_TIPO: Record<TipoCambio, string> = { nuevo: 'nuevo', cambiado: 'cambiado', quitado: 'quitado' };

function hecho(clave: string, tituloSeccion: string, elemento: string, tipo: TipoCambio, etiqueta: string): CambioResumen {
  return { clave, tituloSeccion, elemento, tipo, etiqueta };
}

// `undefined`/`null`/`''`/`[]` cuentan como "sin contenido" — el mismo criterio que ya usa el
// resolver de SiteContent para un campo OPCIONAL vacío (§ CLAUDE.md, "la FRONTERA fina de
// defaults-como-fallback"): un string vacío y un array vacío son la forma en que este dominio dice
// "nada que mostrar", nunca basura de otro tipo.
function esVacio(v: unknown): boolean {
  if (v === undefined || v === null || v === '') return true;
  if (Array.isArray(v) && v.length === 0) return true;
  return false;
}

/** `null` si los dos valores son el mismo contenido relevante (los dos vacíos, o iguales
 *  estructuralmente); si no, la DIRECCIÓN de la transición. Vacío→con-valor es "nuevo";
 *  con-valor→vacío es "quitado"; con-valor→con-valor-distinto es "cambiado". */
function tipoDeTransicion(antes: unknown, despues: unknown): TipoCambio | null {
  if (sonIguales(antes, despues)) return null;
  const a = esVacio(antes);
  const d = esVacio(despues);
  if (a && d) return null; // dos formas distintas de "nada" (p. ej. `undefined` vs `''`) no es cambio
  if (a && !d) return 'nuevo';
  if (!a && d) return 'quitado';
  return 'cambiado';
}

// LOS CAMPOS EFECTIVOS de una sección — los suyos propios MENOS los que son `seccionCruzada` de
// OTRA (se muestran acá pero viven allá, § `CampoTexto.seccionCruzada` en tienda-secciones.ts) MÁS
// los que OTRA sección declara como `seccionCruzada` de ÉSTA (viven acá aunque se muestren allá).
// Es la MISMA derivación que `TiendaPaginas.tsx` ya hace para `SECCIONES_CON_CAMPOS_CRUZADOS`, leída
// desde el lado del campo en vez de desde el lado del Set — sin esto, `marquesina.texto`/
// `.productoSlug` (mostrados en la tarjeta "Hero de la home" pero guardados en `content.marquesina`)
// jamás aparecerían en el resumen: `HERO.campos` los declara con `seccionCruzada`, así que no
// pertenecen al contenido de `hero`, y `MARQUESINA.campos` no los declara en absoluto.
function camposEfectivos(seccion: SeccionVista) {
  const propia = SECCIONES_TIENDA.find((c) => c.seccion === seccion);
  const propios = (propia?.campos ?? []).filter((f) => !f.seccionCruzada);
  const cruzados = SECCIONES_TIENDA.flatMap((c) => c.campos.filter((f) => f.seccionCruzada === seccion));
  return [...propios, ...cruzados];
}

function cambiosDeSeccion(config: SeccionConfig, publicado: Record<string, unknown>, borrador: Record<string, unknown>): CambioResumen[] {
  const antes = publicado;
  const despues = borrador;
  const out: CambioResumen[] = [];
  const tituloSeccion = config.titulo;

  // 1 · LA COMPOSICIÓN (`variante`), si la sección la ofrece desde el panel (§ `composiciones`,
  // EDITOR-TIENDA-COMPOSICION-1). Nunca "nuevo"/"quitado": es un escalar que SIEMPRE tiene un valor
  // (la canónica si nadie lo tocó), así que cambiar de composición es siempre un REEMPLAZO — se
  // muestra el NOMBRE de la elegida, entre comillas, en vez de la palabra "cambiado".
  if (config.composiciones) {
    const a = antes.variante;
    const d = despues.variante;
    if (!sonIguales(a, d)) {
      const opcion = config.composiciones.find((o) => o.value === d);
      const label = opcion?.label ?? String(d ?? '');
      out.push(hecho(config.seccion, tituloSeccion, 'Composición', 'cambiado', `${tituloSeccion} · Composición «${label}»`));
    }
  }

  // 2 · LOS CAMPOS DE TEXTO (incluye los `seccionCruzada` de otra sección, § `camposEfectivos`).
  // Un campo con `opciones` (select de opciones fijas, SIEMPRE con un valor — `alto`/`veloIntensidad`/
  // `puntoFocal`/etc.) sigue el MISMO trato que la composición: se reemplaza, nunca "nuevo"/"quitado".
  for (const campo of camposEfectivos(config.seccion)) {
    const a = antes[campo.name];
    const d = despues[campo.name];
    if (sonIguales(a, d)) continue;
    if (campo.opciones) {
      const opcion = campo.opciones.find((o) => o.value === d);
      const label = opcion?.label ?? String(d ?? '');
      out.push(hecho(config.seccion, tituloSeccion, campo.label, 'cambiado', `${tituloSeccion} · ${campo.label} «${label}»`));
      continue;
    }
    const tipo = tipoDeTransicion(a, d);
    if (!tipo) continue;
    out.push(hecho(config.seccion, tituloSeccion, campo.label, tipo, `${tituloSeccion} · ${campo.label} · ${PALABRA_TIPO[tipo]}`));
  }

  // 3 · LAS IMÁGENES.
  for (const img of config.imagenes) {
    const a = antes[img.name];
    const d = despues[img.name];
    const tipo = tipoDeTransicion(a, d);
    if (!tipo) continue;
    out.push(hecho(config.seccion, tituloSeccion, img.label, tipo, `${tituloSeccion} · ${img.label} · ${PALABRA_TIPO[tipo]}`));
  }

  // 4 · LOS INTERRUPTORES (switches de CAPACIDAD, § `CampoBooleano`) — siempre "cambiado": un switch
  // no nace ni se quita, se prende o se apaga.
  for (const b of config.booleanos ?? []) {
    const a = antes[b.name];
    const d = despues[b.name];
    if (sonIguales(a, d)) continue;
    const encendido = d === true;
    out.push(hecho(config.seccion, tituloSeccion, b.label, 'cambiado', `${tituloSeccion} · ${b.label}: ${encendido ? 'Sí' : 'No'}`));
  }

  // 5 · EL ESTILO POR ELEMENTO (`estilos.<elemento>`, § EDITOR-TIENDA-BARRA-FLOTANTE-1) — letra,
  // tamaño, color y alineación de un elemento de texto. `ELEMENTOS_ESTILO` es la fuente ÚNICA de qué
  // elemento de qué sección es estilizable (lib/config/estilo-elemento.ts); acá sólo se compara el
  // objeto resuelto de cada uno, sin desarmar sus cuatro subcampos — el dueño no necesita saber SI
  // cambió la letra o el color, sólo QUE el estilo de ese elemento cambió.
  for (const [nombreElemento, meta] of Object.entries(ELEMENTOS_ESTILO[config.seccion] ?? {})) {
    const a = (antes.estilos as Record<string, unknown> | undefined)?.[nombreElemento];
    const d = (despues.estilos as Record<string, unknown> | undefined)?.[nombreElemento];
    if (sonIguales(a, d)) continue;
    out.push(hecho(config.seccion, tituloSeccion, `Estilo de ${meta.label}`, 'cambiado', `${tituloSeccion} · Estilo de ${meta.label} · cambiado`));
  }

  // 6 · EL REPEATER (la lista de ítems) — comparación POSICIONAL: un ítem nuevo en una posición que
  // antes no existía es "nuevo"; uno que ya no está, "quitado"; uno que sigue en su posición pero con
  // otro contenido, "cambiado". No intenta detectar un reordenamiento como "el mismo ítem movido" —
  // es una aproximación EN PALABRAS, no un diff de listas por identidad (no hay id estable por ítem).
  if (config.repeater) {
    const rep = config.repeater;
    const itemsAntes = Array.isArray(antes[rep.itemsKey]) ? (antes[rep.itemsKey] as unknown[]) : [];
    const itemsDespues = Array.isArray(despues[rep.itemsKey]) ? (despues[rep.itemsKey] as unknown[]) : [];
    const max = Math.max(itemsAntes.length, itemsDespues.length);
    for (let i = 0; i < max; i++) {
      const a = itemsAntes[i];
      const d = itemsDespues[i];
      const nombreItem = `${rep.itemLabel} ${i + 1}`;
      if (a === undefined && d !== undefined) {
        out.push(hecho(config.seccion, tituloSeccion, nombreItem, 'nuevo', `${tituloSeccion} · ${nombreItem} · nuevo`));
      } else if (a !== undefined && d === undefined) {
        out.push(hecho(config.seccion, tituloSeccion, nombreItem, 'quitado', `${tituloSeccion} · ${nombreItem} · quitado`));
      } else if (!sonIguales(a, d)) {
        out.push(hecho(config.seccion, tituloSeccion, nombreItem, 'cambiado', `${tituloSeccion} · ${nombreItem} · cambiado`));
      }
    }
  }

  return out;
}

// EL ORDEN DE LAS SECCIONES (§ EDITOR-TIENDA-ORDEN-1) — meta fuera del REGISTRY, un array de
// `BandaId`. Un solo ítem si el orden cambió: no hay "nuevo"/"quitado" para un reordenamiento, y
// decir QUÉ banda subió o bajó exigiría una gramática de posiciones que el spec no pide ("Incluye…
// el orden", sin ejemplo de detalle) — se declara el HECHO, que es lo que el dueño necesita para
// decidir si lo publica.
function cambiosOrden(publicado: unknown, borrador: unknown): CambioResumen[] {
  const a = Array.isArray(publicado) ? publicado : [];
  const d = Array.isArray(borrador) ? borrador : [];
  if (sonIguales(a, d)) return [];
  return [hecho('orden', 'Orden de las secciones', 'Orden', 'cambiado', 'Orden de las secciones · cambiado')];
}

// EL ESTILO (`tema`, la pestaña «Estilo» del riel — § EDITOR-TIENDA-SHELL-1) — SÓLO los CINCO campos
// que el panel deja escribir hoy (`paletaEditableSchema`/`guardarTemaBorrador`, fuera de `touches:`
// de este slice): `origenTexto`/`origenAccion`/`escalaDisplay` los escribe ÚNICAMENTE un preset, y
// comparar campos sin escritor del panel sería un "cambio" que el dueño nunca pidió. Las etiquetas
// son las MISMAS palabras que `PaletaSeccion.tsx` ya usa para cada eje — "Fondo"/"Tinta"/"Letras" (el
// nombre que esa pantalla usa EN EL EDITOR, distinto de "Tipografía" fuera de él) — y no "cambiado a
// Por defecto"/"cambiado a un color": `null` es una elección legítima ("Por defecto"), no un vacío.
const LABEL_TEMA: Record<string, string> = {
  fondo: 'Fondo',
  tinta: 'Tinta',
  acento: 'Acento de marca',
  fuentePar: 'Letras',
  forma: 'Forma',
};

function cambiosTema(publicado: unknown, borrador: unknown): CambioResumen[] {
  const a = (publicado ?? {}) as Record<string, unknown>;
  const d = (borrador ?? {}) as Record<string, unknown>;
  const out: CambioResumen[] = [];
  for (const clave of Object.keys(LABEL_TEMA)) {
    if (sonIguales(a[clave], d[clave])) continue;
    const label = LABEL_TEMA[clave];
    out.push(hecho('tema', 'Estilo', label, 'cambiado', `Estilo · ${label} · cambiado`));
  }
  return out;
}

/** Compara el BORRADOR contra lo PUBLICADO para cada clave de `pendientes` (una `SeccionVista` del
 *  REGISTRY, o las dos claves META `'orden'`/`'tema'` — el MISMO vocabulario que
 *  `TiendaPaginas.listaPendientes()`) y devuelve la lista EN PALABRAS que el popover de «Publicar»
 *  muestra. `borrador`/`publicado` son mapas clave→valor YA RESUELTOS (la forma que
 *  `readSiteContentParaEditor`/`readSiteContent` devuelven) — este módulo no sabe de dónde vinieron.
 *
 *  Una clave de `pendientes` sin config conocida (ni del REGISTRY, ni `'orden'`/`'tema'`) se IGNORA
 *  en silencio: no hay cómo resumir un cambio cuya forma no se conoce, y lanzar por eso dejaría el
 *  popover entero sin lista por una sección ajena al resumen. */
export function resumenCambios(
  pendientes: readonly string[],
  borrador: Readonly<Record<string, unknown>>,
  publicado: Readonly<Record<string, unknown>>,
): CambioResumen[] {
  const out: CambioResumen[] = [];
  for (const clave of pendientes) {
    if (clave === 'orden') {
      out.push(...cambiosOrden(publicado.orden, borrador.orden));
      continue;
    }
    if (clave === 'tema') {
      out.push(...cambiosTema(publicado.tema, borrador.tema));
      continue;
    }
    const config = SECCIONES_TIENDA.find((c) => c.seccion === clave);
    if (!config) continue;
    const a = (publicado[clave] ?? {}) as Record<string, unknown>;
    const d = (borrador[clave] ?? {}) as Record<string, unknown>;
    out.push(...cambiosDeSeccion(config, a, d));
  }
  return out;
}
