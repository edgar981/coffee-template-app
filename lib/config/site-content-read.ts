import prisma from '@duna/core';
import { REGISTRY, mezclarBorrador, resolverSiteContent, type SiteContentData } from './site-content-defaults';

const esObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

// Lector RAW del contenido del storefront — sin `server-only` ni `react/cache`, para los
// contextos que NO son renders (route handlers, carril). Mismo motivo que readSiteSettings:
// `server-only` no resuelve en tsx.
//
// SOFT: sin fila devuelve los defaults resueltos; NUNCA lanza (a diferencia de
// `readSiteSettings`, que usa `findUniqueOrThrow` y falla ruidoso). El vacío es legítimo.

// PUBLICADO — lo que lee la tienda EN VIVO. Sólo `content`, jamás el borrador.
export async function readSiteContent(): Promise<SiteContentData> {
  const row = await prisma.siteContent.findUnique({ where: { id: 'default' } });
  return resolverSiteContent(row?.content ?? {});
}

// PARA EL EDITOR del panel: el contenido draft-merged (lo que el editor muestra y edita —el
// borrador sobre lo publicado) MÁS qué secciones tienen cambios sin publicar (`seccion in
// borrador`), para la píldora "Sin publicar" y los botones Publicar/Descartar. Una sola query.
export async function readSiteContentParaEditor(): Promise<{
  contenido: SiteContentData;
  sinPublicar: Record<string, boolean>;
}> {
  const row = await prisma.siteContent.findUnique({ where: { id: 'default' } });
  const borrador = esObj(row?.borrador) ? row!.borrador : {};
  const contenido = resolverSiteContent(mezclarBorrador(row?.content ?? {}, borrador));
  const sinPublicar: Record<string, boolean> = {};
  for (const key of Object.keys(REGISTRY)) sinPublicar[key] = key in borrador;
  // `tema` (la paleta) NO está en el REGISTRY —es clave no-sección, como `paginas`— pero también se
  // borronea: su píldora "Sin publicar" y sus botones Publicar/Descartar salen de este mismo flag.
  sinPublicar.tema = 'tema' in borrador;
  // EL ENCABEZADO (§ PANEL-EDITOR-ENCABEZADO-1, ampliado por § MARCA-LOGO-IMAGEN-1): metas/secciones
  // no-sección y sección `logo` editadas como UN solo bloque del panel (`EncabezadoSeccion.tsx`, con
  // su propia ruta de publicar/descartar, `/api/site-content/encabezado`, patrón `tema/route.ts`). La
  // píldora "Sin publicar" se prende si CUALQUIERA de las partes está en el borrador — el operador
  // las edita juntas, así que el flag es UNO solo, gemelo del de `tema`.
  //
  // `logo` SE AGREGA ACÁ A PROPÓSITO (§ MARCA-LOGO-IMAGEN-1, deviación medida fuera de `touches:` —
  // necesaria para que el editor funcione: sin esto, subir un logo y guardar el borrador dejaría la
  // píldora apagada y los botones Publicar/Descartar ausentes, aunque `sinPublicar.logo` —ya
  // encendido por el loop genérico de arriba, porque `logo` SÍ es REGISTRY— diga la verdad por su
  // cuenta). `navDrawerMovil` sigue AUSENTE de esta condición — un hueco PRE-EXISTENTE a este
  // slice (la lista decía "TRES metas" desde antes de que `navDrawerMovil` existiera, y nunca se
  // sumó acá al agregarlo) que no se corrige en esta tanda: no es parte de `touches:` y arreglarlo
  // excede lo que este slice necesita para funcionar. Ver `open_followups` del reporte de este
  // slice.
  sinPublicar.encabezado =
    'cromo' in borrador || 'navWordmark' in borrador || 'navTratamiento' in borrador || 'logo' in borrador;
  // SECCIONES AGREGADAS del home (§ SECCIONES-INSTANCIAS-1): `seccionesHome` es META —fuera del
  // REGISTRY, como `tema`— así que el loop genérico de arriba no la toca; se publica/descarta por
  // el flujo GENÉRICO de siempre (`app/api/site-content/route.ts`, la whitelist 'orden'/'tema'/
  // REGISTRY-key gana `'seccionesHome'`), así que su píldora "Sin publicar" sigue el MISMO patrón
  // que `tema`: un flag propio, no uno compuesto como `encabezado`.
  sinPublicar.seccionesHome = 'seccionesHome' in borrador;
  return { contenido, sinPublicar };
}
