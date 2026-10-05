import { redirect } from 'next/navigation';
import ModoEditorActivo from '@/components/admin/ModoEditorActivo';
import TiendaPortada from '@/components/admin/TiendaPortada';
import { getSiteSettings } from '@/lib/config/site-settings';
import { readSiteContentParaEditor } from '@/lib/config/site-content-read';

// ─── LA PORTADA DE TIENDA (el storefront) — § PANEL-ESTRUCTURA-TIENDA-1 ──────────────────────────
//
// Antes esta ruta montaba CUATRO formularios store-wide (Menú, Encabezado, Detalles del sitio, Pie)
// más una tarjeta con el botón "Abrir editor". Con `PANEL-ESTRUCTURA-TIENDA-1` (REDISENO.md § 3:
// "una portada con la tienda en miniatura y «Abrir el editor»"), los cuatro formularios salen de
// acá:
//   · MENÚ/ENCABEZADO/PIE (`MenuSeccion`/`EncabezadoSeccion`/`FooterSeccion`) YA VIVÍAN TAMBIÉN en
//     el editor (`TiendaPaginas.tsx`, montados por `EditorTiendaPantallaCompleta` en `/editor/
//     tienda`) — este mount acá era SEGUNDO, redundante; se retira, no se muda (no había adónde
//     mudarlo: ya estaba).
//   · DETALLES DEL SITIO (`DetallesSitioSeccion`, § PANEL-DETALLES-SITIO-1) era la ÚNICA que sólo
//     vivía acá. Se MUDÓ al editor como una fila más, junto a Encabezado y Pie (§ el docstring de
//     `DetallesSitioSeccion.tsx` y de `TiendaPaginas.tsx`, grupo "Abajo").
// COLORES ya se había mudado antes (§ EDITOR-TIENDA-TEMA-1, la pestaña «Tema» del editor) y las
// SECCIONES por página, también antes (§ EDITOR-TIENDA-DISPOSITIVOS-1). Con Detalles del sitio
// mudado en esta tanda, la portada queda LIBRE de formularios sueltos — exactamente lo que el spec
// pide ("ya no hay formularios sueltos aquí", el texto que `TiendaPortada` muestra al pie).
//
// EL CONTENIDO DE LA PORTADA (§ `TiendaPortada.tsx`) se resuelve ACÁ, server-side, con
// `readSiteContentParaEditor()` — la MISMA función que ya usa `/api/site-content` para el editor, no
// un segundo cómputo: `paginas` (qué páginas están encendidas), `tema` (para derivar "Estilo") y
// `sinPublicar` (cuántas claves tienen borrador, para "Sin publicar"). `getSiteSettings()` da
// `nombre` — ya se llama una vez en `app/(admin)/admin/layout.tsx`; llamarla de nuevo acá es gratis
// (`cache()`, dedupe por request).
export default async function Tienda({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // EL DEEP-LINK DEL AVISO DE CONFIGURACIÓN SIGUE APUNTANDO ACÁ (`lib/config/avisos-configuracion.ts`
  // — `hrefTarjeta`, `/admin/tienda?seccion=presentaciones&tarjeta=${slot}` —, fuera de `touches:` de
  // este slice: no se edita ese archivo). Como la edición de sección se mudó a `/editor/tienda`, esta
  // página REENVÍA el query completo para allá en vez de dejar el link roto — el mismo mecanismo que
  // ya resuelve el Dashboard para las rutas retiradas (§ `lib/redirect-*`, CLAUDE.md), aplicado acá
  // con `redirect()` en el propio `page.tsx` en vez de en `proxy.ts` (no hay una tabla de rutas que
  // traducir, sólo reenviar el query tal cual).
  const params = await searchParams;
  if (params.seccion != null) {
    const qs = new URLSearchParams();
    for (const [key, valor] of Object.entries(params)) {
      if (valor == null) continue;
      if (Array.isArray(valor)) { for (const v of valor) qs.append(key, v); }
      else qs.set(key, valor);
    }
    redirect(`/editor/tienda?${qs.toString()}`);
  }

  // Las dos lecturas son independientes (identidad del negocio vs. contenido del storefront), así
  // que corren en paralelo — mismo criterio que `app/(admin)/admin/layout.tsx` ya aplica a
  // sesión ∥ config.
  const [settings, doc] = await Promise.all([getSiteSettings(), readSiteContentParaEditor()]);

  return (
    <div>
      {/* MODO EDITOR (§ EDITOR-TIENDA-IFRAME-VISTA-1): limpia la cookie VIEJA del gate retirado
          (§ MODO-EDITOR-SOLO-EN-EL-IFRAME-1) — higiene, no un mecanismo activo hoy. Se queda montado
          acá (no en `/editor/tienda`, fuera de `touches:` cambiar dónde vive) porque retirarlo exigiría
          tocar este archivo de una forma que el slice que lo dejó así ya declaró fuera de su alcance. */}
      <ModoEditorActivo />
      <TiendaPortada
        nombre={settings.nombre}
        paginas={doc.contenido.paginas}
        tema={doc.contenido.tema}
        sinPublicarCount={Object.values(doc.sinPublicar).filter(Boolean).length}
      />
    </div>
  );
}
