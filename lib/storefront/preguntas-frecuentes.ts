// LA PÁGINA /preguntas-frecuentes COMO AYUDA GENERAL (§ PREGUNTAS-FRECUENTES-1). PURO (capa 1): sin
// red, sin DOM. El modelo es una LISTA PLANA de preguntas (`PreguntaItem`), cada una con su propio
// `grupo` (string) — NO un array anidado de grupos-con-preguntas. Es la misma decisión que ya evitó
// un repeater anidado en `tiendaCreditos` (etiqueta/valor): `resolverItems` (site-content-defaults.ts)
// sólo resuelve campos STRING de un ítem, y una lista anidada (grupos → items) no tiene precedente en
// el REGISTRY ni en `RepeaterEditor` (que edita filas, no filas-de-filas). Aplanar deja que el
// repeater GENÉRICO de siempre (3 campos de texto por fila: grupo/question/answer) sirva sin tocar
// `RepeaterEditor.tsx` ni inventar un editor nuevo — "a qué grupo pertenece" (el pedido explícito del
// spec) se vuelve una función DERIVADA, no un dato anidado que guardar.

export interface PreguntaItem {
  grupo: string;
  question: string;
  answer: string;
}

export interface GrupoPreguntas {
  grupo: string;
  items: PreguntaItem[];
}

/** Una pregunta se RENDERIZA sólo si sus TRES campos tienen contenido tras recortar espacios — una
 *  fila a medias (el operador agregó la fila y todavía no la llenó) no es un grupo ni una pregunta,
 *  es trabajo en curso. Mismo criterio que `filasCompletas` de `tiendaCreditos`. */
export function preguntaCompleta(item: PreguntaItem): boolean {
  return !!item.grupo?.trim() && !!item.question?.trim() && !!item.answer?.trim();
}

/** Las preguntas que se RENDERIZAN: las completas, en el orden en que llegaron. */
export function preguntasCompletas(items: readonly PreguntaItem[]): PreguntaItem[] {
  return items.filter(preguntaCompleta);
}

/**
 * A QUÉ GRUPO PERTENECE cada pregunta — derivado, no guardado. Agrupa las preguntas COMPLETAS por su
 * campo `grupo` (comparado tal cual, sin normalizar mayúsculas: dos filas que el operador escribió
 * con el MISMO texto son el mismo grupo; "Envíos" y "envíos" NO lo son — igual que
 * `moliendaAceptada` exige el nombre EXACTO, para que el owner vea en el editor justo lo que agrupa
 * en la tienda, sin una segunda regla de normalización que pueda sorprenderlo). El ORDEN de los
 * grupos es el de PRIMERA APARICIÓN en `items` — estable mientras no se reordenen las preguntas,
 * nunca alfabético ni por conteo (mismo criterio que `categoriasDelCatalogo`… pero ahí es alfabético
 * porque no hay "orden de captura"; acá sí lo hay, y es el que el operador ya eligió al escribir).
 * Un grupo sin ninguna pregunta completa simplemente no aparece — así `grupos.length === 0` significa
 * "no hay ninguna pregunta cargada", la condición real de hide-on-empty, no "cero grupos con nombre
 * puesto y cero preguntas adentro".
 */
export function agruparPreguntas(items: readonly PreguntaItem[]): GrupoPreguntas[] {
  const completas = preguntasCompletas(items);
  const orden: string[] = [];
  const porGrupo = new Map<string, PreguntaItem[]>();
  for (const it of completas) {
    if (!porGrupo.has(it.grupo)) {
      porGrupo.set(it.grupo, []);
      orden.push(it.grupo);
    }
    porGrupo.get(it.grupo)!.push(it);
  }
  return orden.map((grupo) => ({ grupo, items: porGrupo.get(grupo)! }));
}

/** Quita acentos y pasa a minúsculas, para que el buscador encuentre "cafe" escribiendo "café" y
 *  viceversa — el mismo trato que el buscador de la maqueta aprobada (busca por substring, sin
 *  distinguir mayúscula ni acento). */
export function normalizarBusqueda(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/** ¿La pregunta coincide con la búsqueda? Busca en la PREGUNTA y en la RESPUESTA (como la maqueta:
 *  "indexOf" sobre pregunta+respuesta concatenadas) — así un término que sólo aparece en la
 *  respuesta ("Wompi", "WhatsApp") también encuentra su fila. Consulta vacía → coincide siempre. */
export function preguntaCoincide(item: PreguntaItem, query: string): boolean {
  const q = normalizarBusqueda(query);
  if (!q) return true;
  const texto = normalizarBusqueda(`${item.question} ${item.answer}`);
  return texto.includes(q);
}

/**
 * El buscador de Créditos (Onix): filtra las preguntas de cada grupo por la consulta, y DESCARTA el
 * grupo entero si queda sin ninguna — igual que la maqueta oculta `.grupo` sin filas visibles. Sin
 * consulta, es `agruparPreguntas` tal cual (todas las preguntas, todos los grupos).
 */
export function gruposFiltrados(grupos: readonly GrupoPreguntas[], query: string): GrupoPreguntas[] {
  const q = normalizarBusqueda(query);
  if (!q) return grupos.map((g) => ({ grupo: g.grupo, items: [...g.items] }));
  return grupos
    .map((g) => ({ grupo: g.grupo, items: g.items.filter((it) => preguntaCoincide(it, query)) }))
    .filter((g) => g.items.length > 0);
}

/** El total de preguntas visibles tras filtrar — para el contador del buscador ("3 de 11"). */
export function totalPreguntas(grupos: readonly GrupoPreguntas[]): number {
  return grupos.reduce((acc, g) => acc + g.items.length, 0);
}

export interface Segmento {
  texto: string;
  resaltado: boolean;
}

/**
 * Parte `texto` en segmentos resaltado/no-resaltado según la PRIMERA aparición de `query` (sin
 * acentos ni mayúsculas) — el mismo alcance que la maqueta («resalta lo que escribes», una coincidencia
 * por pregunta, no todas). Consulta vacía, o sin coincidencia → un solo segmento sin resaltar, para
 * que el llamador pueda mapear siempre sin una rama especial.
 */
export function resaltarCoincidencia(texto: string, query: string): Segmento[] {
  const q = normalizarBusqueda(query);
  if (!q) return [{ texto, resaltado: false }];
  const idx = normalizarBusqueda(texto).indexOf(q);
  if (idx === -1) return [{ texto, resaltado: false }];
  const antes = texto.slice(0, idx);
  const encontrado = texto.slice(idx, idx + q.length);
  const despues = texto.slice(idx + q.length);
  const segmentos: Segmento[] = [];
  if (antes) segmentos.push({ texto: antes, resaltado: false });
  segmentos.push({ texto: encontrado, resaltado: true });
  if (despues) segmentos.push({ texto: despues, resaltado: false });
  return segmentos;
}
