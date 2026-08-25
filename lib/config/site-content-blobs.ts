import { REGISTRY, type SeccionDef } from './site-content-defaults';

// EL BORRADO DE BLOBS del contenido, generalizado. Puro (sin prisma, sin storage): decide QUÉ
// URLs borrar; el llamador (el route) hace el `storage.delete` best-effort. Compartido por
// hero, y a futuro brandStory / Testimonios / Suscripción.

const esObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const empujarUrl = (out: string[], v: unknown) => { if (typeof v === 'string' && v.trim() !== '') out.push(v); };

// Junta TODAS las URLs de imagen de un doc de contenido (content o borrador), leyendo qué campos
// son imágenes de `registro[sec].imagenes`. REPEATER-AWARE: en una sección repeater la imagen
// vive en CADA item (se itera `sec[itemsKey]` y se junta el campo-imagen de cada uno). SOFT:
// ignora secciones/items/valores ausentes o mal formados. Parametrizado en `registro` para
// probarlo con secciones sintéticas — así el camino del repeater queda listo para Testimonios
// sin tocar esta función.
export function imagenesDe(doc: unknown, registro: Record<string, SeccionDef> = REGISTRY): string[] {
  const out: string[] = [];
  if (!esObj(doc)) return out;
  for (const key of Object.keys(registro)) {
    const def = registro[key];
    if (!def.imagenes?.length) continue;
    const sec = doc[key];
    if (!esObj(sec)) continue;
    if (def.repeater) {
      const items = sec[def.repeater.itemsKey];
      if (!Array.isArray(items)) continue;
      for (const item of items) {
        if (esObj(item)) for (const f of def.imagenes) empujarUrl(out, item[f]);
      }
    } else {
      for (const f of def.imagenes) empujarUrl(out, sec[f]);
    }
  }
  return out;
}

// Las URLs viejas que YA NO están en ninguna de las nuevas. SET-diff, NO por índice: una imagen
// que sigue presente —aunque en OTRO slot (un swap de posiciones)— NO se borra (§ galería: una
// toma reubicada sigue en uso). Dedup para no intentar borrar dos veces la misma.
export function blobsAReemplazar(viejas: string[], nuevas: string[]): string[] {
  const enUso = new Set(nuevas);
  return [...new Set(viejas)].filter((u) => !enUso.has(u));
}

// Blobs a borrar tras una operación (guardar / publicar / descartar): los que estaban EN USO
// antes y ya no lo están después. EN USO = content ∪ borrador (la UNIÓN en CRUDO): una imagen
// referenciada por lo PUBLICADO **o** por el BORRADOR está viva. Diffear contra la vista MEZCLADA
// (la efectiva, que muestra el borrador sobre lo publicado) borraría una imagen reemplazada en el
// borrador que sigue publicada — el bug que la unión evita.
export function blobsHuerfanos(
  antes: { content: unknown; borrador: unknown },
  despues: { content: unknown; borrador: unknown },
  registro: Record<string, SeccionDef> = REGISTRY,
): string[] {
  const usoAntes = [...imagenesDe(antes.content, registro), ...imagenesDe(antes.borrador, registro)];
  const usoDespues = [...imagenesDe(despues.content, registro), ...imagenesDe(despues.borrador, registro)];
  return blobsAReemplazar(usoAntes, usoDespues);
}
