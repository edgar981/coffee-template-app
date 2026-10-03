import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import MenuSeccion from '@/components/admin/MenuSeccion';
import FooterSeccion from '@/components/admin/FooterSeccion';
import EncabezadoSeccion from '@/components/admin/EncabezadoSeccion';
import DetallesSitioSeccion from '@/components/admin/DetallesSitioSeccion';
import ModoEditorActivo from '@/components/admin/ModoEditorActivo';

// ─── CONTENIDO DE LA TIENDA (el storefront) ──────────────────────────────────
//
// El contenido EDITORIAL del storefront. Distinto de Configuración, que edita la IDENTIDAD del
// negocio (§ negocio≠tienda). CUATRO ejes "cromo transversal" en esta pantalla, un QUINTO —COLORES—
// que se MUDÓ a la pestaña «Tema» del editor de pantalla completa (§ EDITOR-TIENDA-TEMA-1, abajo), y
// un SEXTO —las secciones agrupadas por página— que VIVE EN OTRA RUTA desde EDITOR-TIENDA-
// DISPOSITIVOS-1:
//   · MENÚ (`MenuSeccion`, § CROMO-MENU-PANEL-EDITOR-1) — cromo TRANSVERSAL (el nav aparece en toda
//     página). Editor BESPOKE sin vista previa en vivo (patrón ex-`PaletaSeccion` standalone, no
//     `TiendaSeccionEditor` — la RULING de `CROMO-MENU-COMO-DATO-1`);
//   · ENCABEZADO (`EncabezadoSeccion`, § PANEL-EDITOR-ENCABEZADO-1) — logo, sub-encabezado, color y
//     tratamiento del nav: TRES metas no-sección (`cromo`, `navWordmark`, `navTratamiento`) con su
//     propia ruta de publicar/descartar (patrón `tema`). Sin vista previa en vivo (misma razón que
//     `MenuSeccion`: el nav real del storefront LANZA fuera de su árbol de providers);
//   · DETALLES DEL SITIO (`DetallesSitioSeccion`, § PANEL-DETALLES-SITIO-1) — el botón "volver
//     arriba" y el riel social: DOS metas no-sección (`volverArriba`, `rielSocial`). Sin vista
//     previa en vivo (los componentes reales del storefront LANZAN fuera de su árbol de providers);
//   · PIE DE PÁGINA (`FooterSeccion`, § MUESTRARIO-FOOTER-TEMA-1) — el mismo cromo TRANSVERSAL que
//     Menú (el pie aparece en toda página, vía el layout). Sin vista previa en vivo, MISMO porqué
//     que `MenuSeccion`: `StoreFooter` importa `useSiteSettings()` del storefront.
// Las CUATRO que quedan acá adoptan el mismo flujo borrador/publicar: Tienda es "lo que se publica".
//
// COLORES SE MUDÓ (§ EDITOR-TIENDA-TEMA-1): `PaletaSeccion` ya NO se monta en esta portada — vive
// AHORA en la pestaña «Tema» de `/editor/tienda` (como "Configuración del tema" de Shopify), con la
// PÁGINA REAL al lado reflejando cada cambio al instante por el puente en vivo, en vez de su
// fragmento sintético propio. Es el MISMO componente (`PaletaSeccion.tsx`, prop `enEditor`) — nada
// de su lógica de datos cambió, sólo DÓNDE vive y qué sirve de preview. Mantenerla acá ADEMÁS
// habría sido la duplicación exacta que el spec pide evitar ("`/admin/tienda` deja de duplicar la
// paleta si queda en el editor").
//
// LAS SECCIONES AGRUPADAS POR PÁGINA (Home · Nosotros · Suscripciones, antes `<TiendaPaginas>`
// montada acá dentro de un `<Suspense>`) SE MUDARON a `/editor/tienda` (§ EDITOR-TIENDA-
// DISPOSITIVOS-1): una vista PROPIA, a pantalla completa, sin el chrome del panel — el pedido del
// owner tras ver el editor viejo ("se ve como en la vista movil… el editor abre en una nueva vista,
// no sale nada del panel de navegacion", referencia: el editor de temas de Shopify). Esta página
// queda como PORTADA: los cuatro ejes store-wide de arriba (que no tienen vista previa en vivo y no
// son "edición de página") se quedan acá, y el botón de abajo lleva al editor nuevo (que ahora
// también cubre Colores, vía su pestaña «Tema»).
//
// POR QUÉ ESTA PÁGINA SIGUE VIVA EN VEZ DE REDIRIGIR DIRECTO: moverla entera habría dejado a los
// cuatro ejes store-wide que quedan sin pantalla —`MenuSeccion`/`EncabezadoSeccion`/
// `DetallesSitioSeccion`/`FooterSeccion` no están en `touches:` de este slice, así que no se pueden
// reubicar—. "Portada con botón" es la opción que no toca esos cuatro archivos y conserva su acceso.
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

  return (
    <div>
      {/* MODO EDITOR (§ EDITOR-TIENDA-IFRAME-VISTA-1): limpia la cookie VIEJA del gate retirado
          (§ MODO-EDITOR-SOLO-EN-EL-IFRAME-1) — higiene, no un mecanismo activo hoy. Se queda montado
          acá (no en `/editor/tienda`, fuera de `touches:` cambiar dónde vive) porque retirarlo exigiría
          tocar este archivo de una forma que el slice que lo dejó así ya declaró fuera de su alcance. */}
      <ModoEditorActivo />
      <div style={{ minWidth: 0, marginBottom: 'var(--duna-space-4)' }}>
        <h1 className="duna-display-m">Contenido de la tienda</h1>
        <p className="duna-sub" style={{ marginTop: '3px', maxWidth: '42rem' }}>
          Lo que el cliente ve en el storefront. La identidad del negocio —nombre, WhatsApp,
          correos— se edita en Configuración.
        </p>
      </div>

      {/* MENÚ — store-wide: el nav es cromo transversal, no contenido de una página (§ MenuSeccion,
          el porqué de "sin vista previa"). Colores se fue a la pestaña «Tema» del editor
          (§ EDITOR-TIENDA-TEMA-1, arriba). */}
      <MenuSeccion />

      {/* Separador entre las piezas store-wide (menú · encabezado). */}
      <hr style={{ border: 0, borderTop: '1px solid var(--duna-border)', margin: 'var(--duna-space-8) 0' }} />

      {/* ENCABEZADO — store-wide, junto a Menú: logo, sub-encabezado, color y tratamiento
          del nav (§ EncabezadoSeccion, PANEL-EDITOR-ENCABEZADO-1). */}
      <EncabezadoSeccion />

      {/* Separador entre las piezas store-wide (menú · encabezado · detalles del sitio). */}
      <hr style={{ border: 0, borderTop: '1px solid var(--duna-border)', margin: 'var(--duna-space-8) 0' }} />

      {/* DETALLES DEL SITIO — store-wide, junto a Menú/Encabezado: el botón "volver arriba" y
          el riel social (§ DetallesSitioSeccion, PANEL-DETALLES-SITIO-1). */}
      <DetallesSitioSeccion />

      {/* Separador entre las piezas store-wide (menú · encabezado · detalles del sitio · pie). */}
      <hr style={{ border: 0, borderTop: '1px solid var(--duna-border)', margin: 'var(--duna-space-8) 0' }} />

      {/* PIE DE PÁGINA — store-wide, junto a Menú/Encabezado/Detalles del sitio: el pie es
          cromo transversal, no contenido de una página (§ FooterSeccion, MUESTRARIO-FOOTER-TEMA-1,
          mismo porqué que Menú). */}
      <FooterSeccion />

      {/* Separador entre lo store-wide y el acceso al editor de secciones por página. */}
      <hr style={{ border: 0, borderTop: '1px solid var(--duna-border)', margin: 'var(--duna-space-8) 0' }} />

      {/* EL ACCESO AL EDITOR DE PANTALLA COMPLETA (§ EDITOR-TIENDA-DISPOSITIVOS-1) — Home, Nosotros
          y Suscripciones se editan ahí: la tienda real, con nav, pie y breakpoints de verdad, al
          lado de sus campos. Colores/tipografía/forma también viven ahí, en la pestaña «Tema»
          (§ EDITOR-TIENDA-TEMA-1). */}
      <div
        className="duna-card"
        style={{
          padding: 'var(--duna-space-6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--duna-space-4)',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <h2 className="duna-display-s">Secciones de la tienda y tema</h2>
          <p className="duna-sub" style={{ marginTop: '3px', maxWidth: '38rem' }}>
            Home, Nosotros y Suscripciones se editan en el editor de pantalla completa: la tienda
            real, con su navegación, su pie y sus tamaños de pantalla de verdad, junto a sus campos.
            Ahí también vive la pestaña «Tema» — colores, tipografía y forma, con la tienda real
            reflejando cada cambio al instante.
          </p>
        </div>
        <Link href="/editor/tienda" className="duna-btn duna-btn--primary" style={{ flexShrink: 0 }}>
          Abrir editor <ArrowRight />
        </Link>
      </div>
    </div>
  );
}
