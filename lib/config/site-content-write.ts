import prisma from '@duna/core';
import type { Prisma } from '@duna/core';
import { blobsHuerfanos } from './site-content-blobs';
import type { SiteContentEditable } from './site-content-schema';

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
