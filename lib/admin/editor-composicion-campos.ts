// EL MECANISMO de composición-por-campo (§ EDITOR-COMPOSICION-CAMPOS-1). PURO, capa 1: no monta
// nada, no sabe de React. `TiendaSeccionEditor.tsx` lo consume para decidir qué campo/bloque va
// ARRIBA (la composición activa) y cuál queda PLEGADO bajo «Sólo con…».
//
// EL DEFECTO QUE ESTO CIERRA (auditoría del 2026-10-12, hallazgos S1/SC1): el editor renderizaba
// TODO campo de `bloquesResueltos(config)` sin mirar `form.variante`, así que bajo «Taquilla» el
// panel seguía mostrando el formulario entero de «Tarjetas» (Encabezado, Planes, las 4 tarjetas de
// plan) y el owner no encontraba dónde editar el texto que acababa de clickear en el lienzo. La
// única señal que existía eran hints sueltos ("Sólo con la composición…"), que nadie obliga a
// mantener al agregar una composición nueva — de ahí que S2 encontrara una ZONA («Encabezado» de
// Taquilla) nombrando campos que la propia tienda nunca renderiza bajo esa composición.
//
// POR QUÉ NO SE TOCÓ `lib/tienda/bloques.ts`: ese resolvedor está fuera de `touches:` de este slice
// (es la RED DE SEGURIDAD de la migración a bloques, § su propio docstring) y no hace falta tocarlo
// — `bloquesResueltos` ya devuelve los descriptores REALES (`CampoTexto`/`CampoImagen`) por
// referencia, así que el tag `composiciones` que se le agrega a esos tipos viaja solo a través de
// él. Este módulo sólo LEE lo que `bloquesResueltos` ya resuelve.

import type { BloqueResuelto } from '@/lib/tienda/bloques';
import type { CampoTexto, CampoImagen, SeccionConfig, ComposicionOpcion } from '@/components/admin/tienda-secciones';

type Etiquetado = { name: string; composiciones?: string[] };

/** `true` si `declarado` aplica a la composición `activa`. Sin `composiciones` (o vacío) = aplica a
 *  TODAS — el default, y lo que ya hace el 99% de los campos. Sin `activa` (la sección no declara
 *  `composiciones`) todo aplica: no hay nada que plegar. */
export function aplicaAComposicion(declarado: { composiciones?: string[] } | undefined, activa: string | undefined): boolean {
  if (!declarado?.composiciones || declarado.composiciones.length === 0) return true;
  if (activa === undefined) return true;
  return declarado.composiciones.includes(activa);
}

/** Un grupo de piezas PLEGADAS, todas restringidas al MISMO conjunto de composiciones — se agrupan
 *  así, no una por campo, para que el fold sea «Sólo con la composición "Taquilla"» una sola vez.
 *  `campos`/`imagenes` son piezas sueltas (de un bloque `seccion` mixto); `bloques` son bloques
 *  ENTEROS (`tarjeta`/`lista`/`collage`) que no se pueden partir sin reescribir su renderer. */
export interface GrupoPlegado {
  composiciones: string[];
  campos: CampoTexto[];
  imagenes: CampoImagen[];
  bloques: BloqueResuelto[];
}

/** Las piezas (con su `composiciones`) que un bloque RESUELTO trae adentro — para decidir si el
 *  bloque ENTERO aplica a la composición activa. `lista` sólo trae `slots` (nombres), así que se
 *  resuelven contra `config.campos`/`.imagenes`; los demás tipos ya traen los descriptores reales. */
function piezasDelBloque(bloque: BloqueResuelto, porNombre: Map<string, Etiquetado>): Etiquetado[] {
  if (bloque.tipo === 'seccion') return [...bloque.campos, ...bloque.imagenes];
  if (bloque.tipo === 'tarjeta') return [...bloque.campos, ...(bloque.imagen ? [bloque.imagen] : [])];
  if (bloque.tipo === 'collage') return bloque.imagenes;
  return bloque.slots.map((s) => porNombre.get(s)).filter((x): x is Etiquetado => x !== undefined);
}

/** El resultado de partir los bloques RESUELTOS de una sección por la composición activa:
 *  - `visibles`: los bloques a renderizar arriba, con sus `campos`/`imagenes` ya recortados a los
 *    que aplican (sólo afecta a `tipo:'seccion'`, que puede mezclar campos universales con
 *    restringidos — § brandStory, donde `eyebrow`/`titulo`/`ctaLabel` conviven con `parrafo1`/
 *    `parrafo2`, restringidos a «Columnas»/«Centrada»).
 *  - `plegados`: lo que no aplica, agrupado por su conjunto de composiciones. Para `tarjeta`/
 *    `lista`/`collage` —que no se pueden partir en dos sin reescribir su renderer— el bloque ENTERO
 *    pliega en cuanto NINGUNA de sus piezas aplica; si ALGUNA aplica, el bloque se muestra entero
 *    (documentado: un bloque con piezas MIXTAS no se divide más fino que esto, § DECISIONS.md). */
export function particionarBloques(
  bloques: BloqueResuelto[],
  config: SeccionConfig,
  activa: string | undefined,
): { visibles: BloqueResuelto[]; plegados: GrupoPlegado[] } {
  const porNombre = new Map<string, Etiquetado>([
    ...config.campos.map((c): [string, Etiquetado] => [c.name, c]),
    ...config.imagenes.map((i): [string, Etiquetado] => [i.name, i]),
  ]);
  const visibles: BloqueResuelto[] = [];
  const porClave = new Map<string, GrupoPlegado>();
  const grupoDe = (comps: string[]): GrupoPlegado => {
    const clave = [...comps].sort().join('·');
    let g = porClave.get(clave);
    if (!g) { g = { composiciones: comps, campos: [], imagenes: [], bloques: [] }; porClave.set(clave, g); }
    return g;
  };

  bloques.forEach((b, i) => {
    if (b.tipo === 'seccion') {
      const camposVisibles = b.campos.filter((c) => aplicaAComposicion(c, activa));
      const imagenesVisibles = b.imagenes.filter((i) => aplicaAComposicion(i, activa));
      for (const c of b.campos) if (!aplicaAComposicion(c, activa)) grupoDe(c.composiciones ?? []).campos.push(c);
      for (const im of b.imagenes) if (!aplicaAComposicion(im, activa)) grupoDe(im.composiciones ?? []).imagenes.push(im);
      if (camposVisibles.length > 0 || imagenesVisibles.length > 0) {
        visibles.push({ ...b, campos: camposVisibles, imagenes: imagenesVisibles });
      }
      return;
    }
    // § EDITOR-COMPOSICION-CAMPOS-1 — el TAG DE BLOQUE (`config.bloques[i].composiciones`) es el
    // FALLBACK para cuando las piezas no tienen descriptor propio (`suscripcionPlanes.benN_M`, § el
    // docstring de `BloqueConfig` en tienda-secciones.ts). Si el bloque original lo declara, MANDA
    // sobre el cálculo por-pieza — es la fuente más confiable porque no depende de que cada slot
    // tenga un `CampoTexto` en `config.campos`.
    const tagBloque = config.bloques?.[i]?.composiciones;
    if (tagBloque) {
      if (aplicaAComposicion({ composiciones: tagBloque }, activa)) { visibles.push(b); return; }
      grupoDe(tagBloque).bloques.push(b);
      return;
    }
    const piezas = piezasDelBloque(b, porNombre);
    const aplica = piezas.length === 0 || piezas.some((p) => aplicaAComposicion(p, activa));
    if (aplica) { visibles.push(b); return; }
    const comps = Array.from(new Set(piezas.flatMap((p) => p.composiciones ?? [])));
    grupoDe(comps).bloques.push(b);
  });
  return { visibles, plegados: [...porClave.values()] };
}

/** Todos los nombres de campo/imagen que aparecen en un `BloqueResuelto`, para el test de "nada se
 *  pierde" (§ el recorrido de la auditoría, item 1: ningún campo declarado desaparece sin estar ni
 *  visible ni plegado). */
export function nombresDelBloque(bloque: BloqueResuelto): string[] {
  if (bloque.tipo === 'seccion') return [...bloque.campos.map((c) => c.name), ...bloque.imagenes.map((i) => i.name)];
  if (bloque.tipo === 'tarjeta') return [...bloque.campos.map((c) => c.name), ...(bloque.imagen ? [bloque.imagen.name] : [])];
  if (bloque.tipo === 'collage') return bloque.imagenes.map((i) => i.name);
  return [...bloque.slots];
}

/** La etiqueta "Sólo con la composición «X»" / "Sólo con las composiciones «X» y «Y»" para un grupo
 *  plegado, usando los `label` legibles de `opciones` (§ `SeccionConfig.composiciones`). */
export function tituloPlegado(composiciones: string[], opciones: ComposicionOpcion[]): string {
  const labels = composiciones.map((v) => opciones.find((o) => o.value === v)?.label ?? v);
  if (labels.length === 0) return 'Sólo con otra composición';
  if (labels.length === 1) return `Sólo con la composición «${labels[0]}»`;
  const todas = labels.map((l) => `«${l}»`);
  const ultima = todas.pop()!;
  return `Sólo con las composiciones ${todas.join(', ')} y ${ultima}`;
}
