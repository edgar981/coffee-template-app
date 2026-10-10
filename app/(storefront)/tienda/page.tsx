"use client";
import { Suspense } from 'react';
import { useSiteContent } from '@/components/storefront/SiteContentProvider';
import { useSiteSettings } from '@/components/storefront/SiteSettingsProvider';
import { contenedorAnchoClase, navOffsetClase } from '@/lib/config/themes';
import TiendaEncabezado from '@/components/storefront/tienda/TiendaEncabezado';
import TiendaCatalogo from '@/components/storefront/tienda/TiendaCatalogo';
import TiendaInterludio from '@/components/storefront/tienda/TiendaInterludio';
import TiendaCierre from '@/components/storefront/tienda/TiendaCierre';

// ─── LA RAMA LEGACY (§ TIENDA-ENCABEZADO-Y-FILTRAR-ORDENAR-1, § TIENDA-PAGINA-REGISTRO-1) ────────
// El código de HOY, SIN TOCAR — byte a byte el `ShopInner` que existía antes de
// TIENDA-ENCABEZADO-Y-FILTRAR-ORDENAR-1, sólo que el encabezado y el catálogo ahora son
// `TiendaEncabezado`/`TiendaCatalogo` (§ TIENDA-PAGINA-REGISTRO-1, components/storefront/tienda/):
// esta función sigue siendo dueña de TODOS los divs de layout —el panel `--sf-superficie` del
// encabezado, el contenedor del catálogo— y los dos componentes son HEADLESS (ver sus propios
// docstrings), así que la extracción no cambia un solo byte del DOM. `navTratamiento.posicion:false`
// (Nayoli y todo tenant que no aplicó CORTE) renderiza ESTA función, nunca `ShopCorte` (abajo).
function ShopLegacy({ whatsapp }: { whatsapp?: string }) {
  // EL CONTENEDOR (§ PARIDAD-ANCHO-CONTENIDO-1) — ver el docstring de `contenedorAnchoClase`
  // (`lib/config/themes.ts`) para el porqué de reusar `navTratamiento.posicion` acá. `false`
  // (todo tenant salvo CORTE) = el literal de HOY, byte a byte.
  const { navTratamiento } = useSiteContent();
  const contenedorClase = contenedorAnchoClase(navTratamiento.posicion);
  // EL RELLENO SUPERIOR (§ NAV-INTERNAS-CLARO-Y-OFFSET-1) — ver el docstring de `navOffsetClase`
  // (`lib/config/themes.ts`) para el porqué: reserva el alto REAL del header fijo de CORTE, para
  // que no tape el primer elemento visible. `false` (todo tenant salvo CORTE) = `pt-16`, byte a
  // byte lo que esta página ya usaba.
  const offsetClase = navOffsetClase(navTratamiento.posicion);

  return (
      <div className={offsetClase}>
        {/* Page Header */}
        {/* PALETA-MIGRAR-TEXTO-SOBRE-SUPERFICIE-1: texto directo sobre `--sf-superficie` migrado
            al par `var(--sf-sobre-superficie,<token de hoy>)` (§ TEMAS-P6-FAMILIAS-1). El h1 de
            abajo (fallback `--sf-tinta`) migró en PALETA-MIGRAR-ACENTO-TINTA-1 --
            § PALETA-ACENTO-TINTA-SOBRE-SUPERFICIE-1, DECISIONS.md. */}
        <div className="bg-[var(--sf-superficie)] sf-divisor-b border-[var(--sf-linea)] py-12">
          <div className={`${contenedorClase} mx-auto`}>
            <TiendaEncabezado />
          </div>
        </div>

        <div className={`${contenedorClase} mx-auto py-8`}>
          <TiendaCatalogo whatsapp={whatsapp} />
        </div>
      </div>
  );
}

// ─── LA RAMA CORTE (§ TIENDA-ENCABEZADO-Y-FILTRAR-ORDENAR-1, § TIENDA-PAGINA-REGISTRO-1) ─────────
// Sale del gate del owner sobre el muestrario desplegado (2026-09-30, con captura de referencia
// adjunta, `.scratch/refs/cafeone-filtrar-ordenar.png`): "los colores del encabezado chocan con el
// resto de la página" y "la sección de filtros tiene un estilo y la de destacados otro.
// Combinémoslos como en la imagen adjunta."
//
// EL CHOQUE DE COLOR, MEDIDO (no supuesto): el encabezado de HOY pinta con `--sf-superficie`/
// `--sf-sobre-superficie` — la familia RAÍZ (§ palette-derive.ts, `derivarPaleta`), que NO respeta
// `origenTexto` (el eje que CORTE declara para que el texto de lectura nazca de la TINTA, no del
// ACENTO). Corrido contra las raíces reales de CORTE (`{fondo:'#fdfbf7', tinta:'#102407',
// acento:'#a70004'}` + `{origenTexto:'tinta', origenAccion:'acento'}`): `sobre-superficie` da
// `#732a00` mientras `texto`/`texto-suave` (que SÍ respetan el eje, y son los que pinta el resto
// del storefront — `FeaturedProductsGrilla`, `PreguntasFrecuentes`, `NosotrosHistoria`…) dan
// `#3d3000`/`#1d2a00` — dos familias de color DISTINTAS para el mismo rol ("texto de lectura"), en
// la MISMA página. Por eso el fix es de COMPONENTE (dejar de leer `--sf-superficie`/
// `--sf-sobre-superficie`, tokens RAÍZ que ningún eje re-deriva) y no de `themes.ts`: `CORTE` ya
// declara `origenTexto`/`origenAccion` correctamente, y `palette-derive.ts` (donde vive la
// asimetría real) está fuera del `touches:` de este slice — una tanda de alcance mayor, no de esta.
//
// LA COMPOSICIÓN pasa a la misma que usa el resto del storefront para una banda de contenido plana
// (`PreguntasFrecuentes.tsx`, `NosotrosHistoria.tsx`): fondo de PÁGINA (`--sf-fondo`, el mismo que
// ya pinta `layout.tsx`, así que el encabezado deja de ser un panel "flotando" con su propio fondo)
// + título en `--sf-tinta` + meta en `--sf-texto` — los MISMOS dos tokens que cualquier h1/p de
// CORTE en cualquier otra página.
//
// § TIENDA-PAGINA-REGISTRO-1: esta función sigue siendo dueña del ÚNICO contenedor
// (`${contenedorClase} mx-auto py-16`) que encabezado y catálogo comparten — partirlo en dos divs
// (uno por componente) habría arriesgado el padding compartido (`py-16` cubre a los dos hoy) por un
// cálculo que sólo se puede confirmar MIDIENDO; `TiendaEncabezado`/`TiendaCatalogo` son HEADLESS, así
// que la extracción no mueve un solo byte del DOM.
function ShopCorte({ whatsapp }: { whatsapp?: string }) {
  const { navTratamiento } = useSiteContent();
  const contenedorClase = contenedorAnchoClase(navTratamiento.posicion);
  const offsetClase = navOffsetClase(navTratamiento.posicion);

  return (
    <div className={offsetClase}>
      <div className={`${contenedorClase} mx-auto py-16`}>
        <TiendaEncabezado />

        <div className="mt-10">
          <TiendaCatalogo whatsapp={whatsapp} />
        </div>
      </div>
    </div>
  );
}

// `whatsapp` SE AGREGA COMO PROP (§ TIENDA-CHAMISAS-ALBUM-1) — pasa de mano hasta `TiendaCatalogo`
// para «Avísame por WhatsApp» en una lámina agotada. Un prop que ninguna rama de «Actual» lee no
// cambia un solo byte renderizado (no hay HTML por un prop no consumido), así que esto no rompe el
// byte-idéntico que el docstring de arriba promete.
function ShopInner({ whatsapp }: { whatsapp?: string }) {
  const { navTratamiento } = useSiteContent();
  return navTratamiento.posicion ? <ShopCorte whatsapp={whatsapp} /> : <ShopLegacy whatsapp={whatsapp} />;
}

// ─── INTERLUDIO + CIERRE (§ TIENDA-CHAMISAS-ALBUM-1) — fuera de ShopLegacy/ShopCorte a propósito ──
// Las DOS secciones nuevas se montan DESPUÉS de `ShopInner`, nunca DENTRO de sus wrappers: así
// ShopLegacy/ShopCorte se quedan byte a byte como estaban (ningún div nuevo entre medio) y las dos
// secciones se auto-ocultan solas (`seccionEsVisible` + "sin imagen"/nacen apagadas) — Nayoli, sin
// fila de SiteContent, no gana un solo nodo al DOM. `whatsapp` llega por PROP desde `Shop()` (abajo,
// único punto de la página con `useSiteSettings()`) hacia `TiendaCierre` y hacia `TiendaCatalogo`
// (para «Avísame por WhatsApp» en una lámina agotada) — mismo patrón que `SuscripcionPlanes`.
function TiendaAlbumExtra({ whatsapp }: { whatsapp?: string }) {
  return (
    <>
      <TiendaInterludio />
      <TiendaCierre whatsapp={whatsapp} />
    </>
  );
}

// useSearchParams() (cat/tostado filters from the URL, dentro de `TiendaCatalogo`) requires a
// Suspense boundary to prerender — Next.js CSR bailout.
export default function Shop() {
  // El fallback de Suspense se renderiza ANTES de que `ShopInner` monte, así que necesita su
  // propio `navOffsetClase` — no puede heredarlo de `ShopInner` (§ NAV-INTERNAS-CLARO-Y-OFFSET-1).
  const { navTratamiento } = useSiteContent();
  const { whatsapp } = useSiteSettings();
  return (
    <Suspense fallback={<div className={`${navOffsetClase(navTratamiento.posicion)} min-h-screen`} />}>
      <ShopInner whatsapp={whatsapp} />
      <TiendaAlbumExtra whatsapp={whatsapp} />
    </Suspense>
  );
}
