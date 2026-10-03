"use client";
import { useEffect, useRef } from 'react';
import { useSiteSettings } from '@/components/storefront/SiteSettingsProvider';
import { useSiteContent } from '@/components/storefront/SiteContentProvider';
import { navOffsetClase } from '@/lib/config/themes';
import SuscripcionPlanes from '@/components/storefront/suscripciones/SuscripcionPlanes';
import SuscripcionPasos from '@/components/storefront/suscripciones/SuscripcionPasos';
import PreguntasFrecuentes from '@/components/storefront/PreguntasFrecuentes';
import { ATRIBUTO_EDITOR_SECCION, MARCADOR_SUSCRIPCIONES } from '@/lib/admin/editor-iframe';

// El CUERPO de /suscripciones (cliente). El GATE de capacidad —redirect 307 cuando
// `paginas.suscripciones.visible` es false— vive en el `page.tsx` server (§ Backlog #49, opción 2),
// igual que /nosotros: la página EXISTE y sólo está apagada, así que redirige a la home, no da 404.
//
// El encabezado y los PLANES son DATO editable (§ Backlog #49, opción 1): viven en la sección
// `suscripcionPlanes` de SiteContent, renderizada por `SuscripcionPlanes` —el MISMO componente que la
// vista previa del editor monta—. El `whatsapp` (para el CTA "Me interesa", que abre WhatsApp, no crea
// pedidos) sale de SiteSetting (una sola fuente) y se pasa por PROP: el componente se monta también en
// el preview del panel, que no tiene el SiteSettingsProvider del storefront. Las PreguntasFrecuentes
// son DATO editable, sección repeater (§ SUSCRIPCIONES-FAQ-DATO-1) que NACE VACÍA — sus cuatro
// respuestas de código (RETIRADAS) prometían cobro recurrente, ciclos y envío gratis que no existen
// en el sistema. Se auto-oculta (hide-on-empty) hasta que el owner cargue preguntas reales.
//
// `suscripcionPlanes`/`suscripcionPasos` GANARON el campo editable INLINE (§ EDITOR-TIENDA-CAMPO-
// EDITABLE-PAGINAS-1, dentro de `SuscripcionPlanes.tsx`/`SuscripcionPasos.tsx`). La FAQ de ABAJO
// (`PreguntasFrecuentes.tsx`) **NO lo ganó en esta tanda**: ese componente no está en `touches:` de
// este slice —es compartido con `/preguntas-frecuentes` y con `/tienda`, § el grep de sus 3
// importadores— así que instrumentarlo exigía ampliar el alcance aprobado. El marcador de SECCIÓN
// (`data-editor-seccion="suscripcionFaq"`, abajo) sigue intacto: el repeater se sigue editando desde
// la lista del panel, sólo que todavía no directo sobre la página. Queda nombrado como follow-up
// (§ DECISIONS.md, EDITOR-TIENDA-CAMPO-EDITABLE-PAGINAS-1).
//
// EL RELLENO SUPERIOR (§ NAV-INTERNAS-CLARO-Y-OFFSET-1, cierra SUSCRIPCIONES-OFFSET-CONTENIDO-FUERA-
// DE-TOUCHES-1): usa `navOffsetClase(navTratamiento.posicion)`, la MISMA pieza que ya usan las otras
// seis páginas internas (tienda, la ficha, preguntas-frecuentes, rastrear-pedido, checkout y su
// retorno) — no un `pt-16` propio. `false` (todo tenant salvo CORTE) = `'pt-16'`, byte a byte lo que
// este archivo ya reservaba; `page.tsx` YA NO envuelve con `navOffsetDeltaClase` (ese wrapper existía
// SÓLO porque este archivo estaba fuera de `touches:` cuando se escribió — ver el asiento de
// DECISIONS.md de esa tanda).
//
// LAS TRES SECCIONES MARCAN SU PROPIO NODO EN MODO EDITOR (§ EDITOR-TIENDA-SELECCION-1) — cierra la
// limitación que `lib/admin/editor-iframe.ts` documentaba desde `EDITOR-TIENDA-IFRAME-VISTA-1`: las
// tres compartían UN marcador de PÁGINA (`data-editor-seccion="suscripciones"`, el `<div>` que
// `page.tsx` agrega ENCIMA de este componente, fuera de `touches:` de este slice — sigue
// escribiéndolo igual, sin tocar ese archivo).
//
// EL PROBLEMA QUE RESOLVER: este componente no puede recibir `enModoEditor` por prop —`page.tsx` no
// se puede editar para pasarlo— ni leerlo de un context (`SiteContentProvider`/
// `SiteSettingsProvider` no lo exponen, y agregarle uno es tocar un archivo fuera de `touches:`), ni
// con `useSearchParams()` (exige un `<Suspense>` que el padre de este árbol tampoco tiene). Lo que SÍ
// puede hacer: mirar su propio DOM. El `<div data-editor-seccion="suscripciones">` que `page.tsx`
// escribe EXISTE únicamente cuando `modoEditorActivo()` (sesión OWNER/MANAGER real, § `modo-editor-
// gate.ts`) ya lo decidió server-side — es la MISMA garantía que protege al resto de la tienda, sólo
// que se LEE por `closest()` en vez de recibirse por prop. Tráfico público (sin ese marcador): el
// `closest()` da `null` y este efecto no hace NADA — cero atributos, cero nodos nuevos, byte-idéntico.
//
// POR QUÉ ES `setAttribute` IMPERATIVO Y NO UN `<div data-editor-seccion=…>` EN EL JSX: un wrapper
// nuevo se renderizaría SIEMPRE —con o sin modo editor—, que es justo el byte de más que el spec
// prohíbe para el tráfico público. Marcar el nodo que YA existe, sólo cuando el ancla confirma modo
// editor, no agrega ni un nodo.
//
// LA UBICACIÓN ES POSICIONAL, a propósito: ninguno de los tres componentes (`SuscripcionPlanes`,
// `SuscripcionPasos`, `PreguntasFrecuentes`) acepta una prop para auto-marcarse —ninguno está en
// `touches:` de este slice—, así que la única forma de etiquetar su raíz sin un nodo nuevo es
// ubicarla por POSICIÓN dentro de ESTE árbol, que sí se controla acá. `SuscripcionPlanes` es un solo
// Fragment con DOS `<section>` (hero + tarjetas) — las dos cuentan como "suscripcionPlanes"—;
// `SuscripcionPasos` puede devolver `null` (hide-on-empty, `ocultable:true`) así que su `<section>`
// puede estar AUSENTE entre los `:scope > section` — por eso se cuentan los `<section>` directos en
// vez de asumir un índice fijo de `children`, que se habría corrido con Pasos oculto. El `<main>` de
// la FAQ es ÚNICO y SIEMPRE está (aunque su contenido se auto-oculte si la lista de preguntas está
// vacía), así que se ubica por tag, no por posición. Si algún día uno de los tres cambia su número de
// raíces, esto FALLA CALLADO —el clic en esa zona no resuelve a una sección—, el mismo límite que ya
// tenía esta página antes de este slice; no rompe nada.
export default function SuscripcionesContenido() {
  const settings = useSiteSettings();
  const { navTratamiento } = useSiteContent();
  const offsetClase = navOffsetClase(navTratamiento.posicion);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const nodo = rootRef.current;
    if (!nodo) return;
    const dentroDelEditor = nodo.closest(`[${ATRIBUTO_EDITOR_SECCION}="${MARCADOR_SUSCRIPCIONES}"]`);
    if (!dentroDelEditor) return; // tráfico público: sin el marcador de página, nada que etiquetar
    const secciones = nodo.querySelectorAll(':scope > section');
    secciones[0]?.setAttribute(ATRIBUTO_EDITOR_SECCION, 'suscripcionPlanes');
    secciones[1]?.setAttribute(ATRIBUTO_EDITOR_SECCION, 'suscripcionPlanes');
    secciones[2]?.setAttribute(ATRIBUTO_EDITOR_SECCION, 'suscripcionPasos');
    nodo.querySelector(':scope > main')?.setAttribute(ATRIBUTO_EDITOR_SECCION, 'suscripcionFaq');
    // Sin deps: corre tras CADA render — el contenido en vivo (§ EDITOR-TIENDA-POSTMESSAGE-1) puede
    // hacer que `SuscripcionPasos`/la FAQ aparezcan o desaparezcan sin remontar este componente, y
    // los marcadores tienen que seguir a los nodos reales, no quedarse pegados a los de la carga
    // inicial. Barato: sólo corre el `querySelectorAll` cuando el ancla de arriba existe.
  });

  return (
    <div ref={rootRef} className={offsetClase}>
      <SuscripcionPlanes whatsapp={settings.whatsapp} />
      <SuscripcionPasos />
      <main className="bg-[var(--sf-fondo)]">
        <PreguntasFrecuentes />
      </main>
    </div>
  );
}
