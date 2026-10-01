import prisma from '@duna/core';
import type { Prisma } from '@duna/core';
import { blobsHuerfanos } from './site-content-blobs';
import type { SiteContentEditable } from './site-content-schema';
import { validarPreset, mergePresetEnContent, type PresetTema, type FaltanteTema } from './themes';

// LA ESCRITURA del flujo borrador/publicado. Extraída del route (como aplicarAjusteInventario /
// aplicarTransicionEnvio) para afirmarla en el carril contra una base real. Devuelve los blobs a
// borrar (in-use = content ∪ borrador, § site-content-blobs); el borrado lo hace el route,
// best-effort, DESPUÉS del commit — un fallo del delete no revierte el write, y si el write falla
// no se borra nada (esta función lanza y el route no llega a borrar).
//
// SIN lock cross-operación, y es una DECISIÓN (§ doctrina): el race guardar↔publicar necesita dos
// writes en la ventana de milisegundos entre el read y el write de publicar, que un operador
// humano —aun con dos pestañas— no alcanza (actúa con segundos de separación), el doble-submit ya
// cubre el mismo tick, y el fallo (borrador perdido / publicar una versión vieja) es VISIBLE en la
// preview y RECUPERABLE, no un libro contable corrompido como el despacho. DISPARADOR del lock
// (advisory, porque la fila es SOFT y puede no existir): automatización que escriba borradores, o
// varios editores concurrentes de verdad.
//
// El borrador se guarda SIEMPRE como objeto (`{}` = sin borrador pendiente), nunca SQL NULL tras
// el primer write: evita el `Prisma.DbNull` y el loader ya trata `{}` y null igual (`?? {}`).

const esObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

async function leerFila(tx: Prisma.TransactionClient) {
  const row = await tx.siteContent.findUnique({ where: { id: 'default' } });
  return {
    content: esObj(row?.content) ? (row!.content as Record<string, unknown>) : {},
    borrador: esObj(row?.borrador) ? (row!.borrador as Record<string, unknown>) : {},
  };
}

// GUARDAR: escribe la(s) sección(es) entrante(s) en el BORRADOR (no en content). El editor manda
// la sección COMPLETA, así que el spread la reemplaza entera; las demás secciones del borrador
// quedan intactas.
export async function guardarBorrador(data: SiteContentEditable): Promise<{ blobsABorrar: string[] }> {
  return prisma.$transaction(async (tx) => {
    const { content, borrador } = await leerFila(tx);
    const nuevoBorrador = { ...borrador, ...data };
    const json = nuevoBorrador as unknown as Prisma.InputJsonValue;
    await tx.siteContent.upsert({
      where: { id: 'default' },
      update: { borrador: json },
      create: { id: 'default', content: {}, borrador: json },
    });
    return { blobsABorrar: blobsHuerfanos({ content, borrador }, { content, borrador: nuevoBorrador }) };
  });
}

// EL MERGE PURO que usa `guardarTemaBorrador` (§ PALETA-GUARDAR-CONSERVA-EJES-1): fusiona los CINCO
// campos que el panel edita (raíces + par + forma) SOBRE el tema existente, en vez de reemplazarlo
// entero. `TemaContent` tiene DOS ejes aditivos más (`origenTexto`/`origenAccion`/`escalaDisplay`,
// § site-content-defaults.ts) que SÓLO escribe `mergePresetEnContent` (un preset como CORTE, aplicado
// desde un runbook) — el panel no los conoce ni los edita (`paletaEditableSchema` no los declara).
// Antes de este fix, `guardarTemaBorrador` hacía `{...borrador, tema}` — un reemplazo TOTAL de la
// clave `tema` — así que el PRIMER guardado de un color desde el panel, sobre un tenant con esos ejes
// ya puestos, los resetearía a `null` EN SILENCIO al publicar (quedaban documentados como riesgo en
// `site-content-defaults.ts`, § el docstring de `CromoContent`, y confirmados por el censo de
// `PANEL-PREVIEW-COLORES-REALES-1`). El `{ ...base, ...nuevo }` preserva CUALQUIER campo del tema
// existente que el panel no declara —no sólo estos tres, cualquier eje futuro de la misma familia—,
// sin que `guardarTemaBorrador` tenga que conocerlos por nombre.
//
// Extraída PURA (sin `tx`, sin prisma) para afirmarla en el carril rápido sin tocar Postgres
// (`lib/config/site-content-write.test.ts`); el viaje completo contra una base real vive en
// `tests/integracion/paleta-ejes.test.ts`.
export function fusionarTema(
  base: Record<string, unknown>,
  nuevo: { fondo: string | null; tinta: string | null; acento: string | null; fuentePar: string | null; forma: string | null },
): Record<string, unknown> {
  return { ...base, ...nuevo };
}

// GUARDAR EL TEMA: escribe `borrador.tema` FUSIONADO (los cinco campos del panel sobre lo que ya
// había). Es el guardar del TEMA —clave no-sección (§ site-content-defaults), validado por
// `paletaEditableSchema` (3 hex o null + par del set cerrado + forma, no por el schema de
// secciones)—, así que tiene su propio guardar en vez de pasar por `guardarBorrador`.
// PUBLICAR/DESCARTAR el tema SÍ reusan `publicarSeccion('tema')`/`descartarSeccion('tema')` (son
// key-agnósticas) — y como `publicarSeccion` copia `borrador.tema` a `content.tema` ENTERO, el punto
// único donde hay que preservar lo no-editado es ACÁ, al escribir el borrador, no en el publish.
//
// LA BASE DEL MERGE ES EL BORRADOR SI YA HAY UNO, SI NO LO PUBLICADO: dos guardados seguidos sin
// publicar de por medio fusionan sobre el borrador anterior (que ya trae los ejes preservados de la
// primera vez), no sobre lo publicado —si no, un segundo guardado "olvidaría" lo que el primero ya
// había preservado en el borrador y volvería a leer `content`, que en ese punto todavía no cambió—.
//
// Sin blobs: el tema son strings, no imágenes —`imagenesDe` no toca `tema` (no está en el
// REGISTRY)—, así que no devuelve `blobsABorrar`.
export async function guardarTemaBorrador(
  tema: { fondo: string | null; tinta: string | null; acento: string | null; fuentePar: string | null; forma: string | null },
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const { content, borrador } = await leerFila(tx);
    const base = esObj(borrador.tema) ? borrador.tema : (esObj(content.tema) ? content.tema : {});
    const nuevoBorrador = { ...borrador, tema: fusionarTema(base, tema) };
    const json = nuevoBorrador as unknown as Prisma.InputJsonValue;
    await tx.siteContent.upsert({
      where: { id: 'default' },
      update: { borrador: json },
      create: { id: 'default', content: {}, borrador: json },
    });
  });
}

// PUBLICAR: mueve borrador[seccion] a content[seccion] y lo saca del borrador. Sin borrador para
// esa sección no hace nada (no hay fila que crear).
export async function publicarSeccion(seccion: string): Promise<{ blobsABorrar: string[] }> {
  return prisma.$transaction(async (tx) => {
    const { content, borrador } = await leerFila(tx);
    if (!(seccion in borrador)) return { blobsABorrar: [] };
    const nuevoContent = { ...content, [seccion]: borrador[seccion] };
    const nuevoBorrador = { ...borrador };
    delete nuevoBorrador[seccion];
    await tx.siteContent.update({
      where: { id: 'default' },
      data: {
        content: nuevoContent as unknown as Prisma.InputJsonValue,
        borrador: nuevoBorrador as unknown as Prisma.InputJsonValue,
      },
    });
    return { blobsABorrar: blobsHuerfanos({ content, borrador }, { content: nuevoContent, borrador: nuevoBorrador }) };
  });
}

// DESCARTAR: saca borrador[seccion] sin publicar. Sin borrador para esa sección no hace nada.
export async function descartarSeccion(seccion: string): Promise<{ blobsABorrar: string[] }> {
  return prisma.$transaction(async (tx) => {
    const { content, borrador } = await leerFila(tx);
    if (!(seccion in borrador)) return { blobsABorrar: [] };
    const nuevoBorrador = { ...borrador };
    delete nuevoBorrador[seccion];
    await tx.siteContent.update({
      where: { id: 'default' },
      data: { borrador: nuevoBorrador as unknown as Prisma.InputJsonValue },
    });
    return { blobsABorrar: blobsHuerfanos({ content, borrador }, { content, borrador: nuevoBorrador }) };
  });
}

// ENCENDER/APAGAR una página (`content.paginas[pagina].visible`). Va DIRECTO a lo PUBLICADO —no por
// el flujo borrador/publicar de secciones—: encender o apagar una página es un toggle de config, no
// contenido en revisión, así que se aplica en el acto. No mueve blobs.
export async function setPaginaVisible(pagina: string, visible: boolean): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const { content } = await leerFila(tx);
    const paginas = esObj(content.paginas) ? content.paginas : {};
    const previa = esObj(paginas[pagina]) ? paginas[pagina] : {};
    const nuevoContent = { ...content, paginas: { ...paginas, [pagina]: { ...previa, visible } } };
    await tx.siteContent.upsert({
      where: { id: 'default' },
      update: { content: nuevoContent as unknown as Prisma.InputJsonValue },
      create: { id: 'default', content: nuevoContent as unknown as Prisma.InputJsonValue },
    });
  });
}

// El theme pedido no está completo (§ programa THEMES, pieza 0(d)): al menos uno de sus seis ejes
// pide algo que el producto todavía no sabe hacer (una variante de sección sin slot, un par/forma
// sin decidir, una banda o un esquema que no existen). `faltantes` nombra CADA uno por separado
// (`validarPreset`, `lib/config/themes.ts`) — nunca un solo mensaje genérico.
export class PresetIncompletoError extends Error {
  constructor(public readonly preset: string, public readonly faltantes: FaltanteTema[]) {
    super(`El theme «${preset}» no se puede aplicar — le falta: ${faltantes.map((f) => f.detalle).join('; ')}`);
    this.name = 'PresetIncompletoError';
  }
}

// APLICAR UN PRESET DE THEME (§ programa THEMES, pieza 0(d)). Corre desde un RUNBOOK, no desde el
// panel — la composición (esquema · orden · variante) se arma en ONBOARDING, nunca la elige el
// cliente (DECISIONS.md, EJE-5-ORDEN-EDITOR-1/EJE-5-VARIANTES-EDITOR retirados). Precedente EXACTO:
// `setPaginaVisible` de arriba — escritura DIRECTA a `content` (lo PUBLICADO), merge quirúrgico, UN
// solo write transaccional, sin draft ni publish (un preset de theme es config, no contenido en
// revisión, igual que encender/apagar una página).
//
// VALIDA ANTES DE ESCRIBIR Y SE NIEGA COMPLETO: si `validarPreset` devuelve algo, esta función NO
// TOCA LA BASE — lanza `PresetIncompletoError` con cada faltante nombrado. Una validación parcial
// que escribiera la mitad sería peor que ninguna (§3).
//
// INVARIANTE QUE ESTA FUNCIÓN GARANTIZA POR CONSTRUCCIÓN (nunca por disciplina del caller): NI UN
// TEXTO NI UNA IMAGEN DEL DUEÑO se tocan. El cálculo del nuevo `content` vive en
// `mergePresetEnContent` (puro, `lib/config/themes.ts`) — sólo reemplaza `tema`/`esquemas`/`orden`
// (composición, no contenido) y el campo `variante` DENTRO de cada sección afectada, preservando
// cualquier otro campo que esa sección ya tuviera.
//
// IDEMPOTENTE: aplicar el mismo preset dos veces da el mismo `content` (el merge es una función
// pura del estado actual + el preset, sin acumular).
//
// PROPIEDAD CONOCIDA, no un olvido: no hay guarda contra reaplicar un preset DISTINTO sobre un
// tenant que un operador ya afinó a mano — hoy el dueño nunca compone desde el panel (§ arriba), así
// que el caso no existe; el día que exista, es una decisión aparte, no una que este slice tome.
export async function aplicarPreset(preset: PresetTema): Promise<void> {
  const faltantes = validarPreset(preset);
  if (faltantes.length > 0) throw new PresetIncompletoError(preset.clave, faltantes);

  await prisma.$transaction(async (tx) => {
    const { content } = await leerFila(tx);
    const nuevoContent = mergePresetEnContent(content, preset);
    await tx.siteContent.upsert({
      where: { id: 'default' },
      update: { content: nuevoContent as unknown as Prisma.InputJsonValue },
      create: { id: 'default', content: nuevoContent as unknown as Prisma.InputJsonValue },
    });
  });
}
