'use client';

// EL DESPACHADOR de /preguntas-frecuentes (§ PREGUNTAS-FRECUENTES-1). HEADLESS —lee
// `useSiteContent()` él mismo, como `PreguntasFrecuentes`/`TiendaCreditos`— para poder registrarse
// tal cual en el `Record<SeccionVista, ComponentType>` de `VistaTiendaEnVivo.tsx` (la vista previa
// en vivo del editor). Decide la composición (`variante`) y aplica el gate de contenido real: con
// `items: []` o sin ninguna pregunta COMPLETA (§ `agruparPreguntas`, que ya descarta las filas a
// medias), no hay nada que mostrar — null, igual que cualquier sección hide-on-empty.
//
// `whatsapp` LLEGA POR PROP, nunca por `useSiteSettings()` directo — MISMO patrón que
// `SuscripcionPlanes`/`GrindChooser`: este componente se monta también en el árbol ADMIN de la vista
// previa en vivo, que no tiene `SiteSettingsProvider` (el hook LANZARÍA). Es OPCIONAL para que el
// tipo siga siendo asignable a `ComponentType` sin props requeridas.
import { useSiteContent } from '@/components/storefront/SiteContentProvider';
import { REGISTRY, seccionEsVisible } from '@/lib/config/site-content-defaults';
import { agruparPreguntas } from '@/lib/storefront/preguntas-frecuentes';
import { ATRIBUTO_EDITOR_SECCION } from '@/lib/admin/editor-iframe';
import AyudaCreditos from './AyudaCreditos';
import AyudaLibreta from './AyudaLibreta';
import AyudaLista from './AyudaLista';

export default function AyudaPagina({ whatsapp }: { whatsapp?: string }) {
  const { preguntasFrecuentes } = useSiteContent();
  if (!seccionEsVisible(REGISTRY.preguntasFrecuentes, preguntasFrecuentes)) return null;
  const { titulo, subtitulo, items, variante } = preguntasFrecuentes;
  if (agruparPreguntas(items).length === 0) return null;

  const Composicion = variante === 'creditos' ? AyudaCreditos : variante === 'libreta' ? AyudaLibreta : AyudaLista;

  return (
    <div {...{ [ATRIBUTO_EDITOR_SECCION]: 'preguntasFrecuentes' }}>
      <Composicion titulo={titulo} subtitulo={subtitulo} items={items} whatsapp={whatsapp} />
    </div>
  );
}
