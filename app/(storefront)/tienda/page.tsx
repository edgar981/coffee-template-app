"use client";
import { Suspense, useState, useMemo, useEffect } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { motion } from 'framer-motion';
import ProductCard from '@/components/storefront/ProductCard';
import { TOSTADO_LABELS } from '@/constants/roast-levels';
import { getCatalog } from '@/lib/api/products';
import { categoriasDelCatalogo, catalogoTieneTostado } from '@/lib/productos/categorias';
import { useSearchParams } from 'next/navigation';
import {Product, RoastLevel} from '@/types/product';
import { useSiteContent } from '@/components/storefront/SiteContentProvider';
import { contenedorAnchoClase, navOffsetClase } from '@/lib/config/themes';
import FiltrarOrdenar from '@/components/storefront/tienda/FiltrarOrdenar';
import {
  ordenarCatalogo,
  filtrarCatalogo,
  contarDisponibilidad,
  rangoPrecioCatalogo,
  type OrdenCatalogo,
  type DisponibilidadFiltro,
} from '@/lib/storefront/filtrar-ordenar';


const SORTBY = [
  { value: 'featured', label: 'Destacados' },
  { value: 'price_asc', label: 'Precio: menor a mayor' },
  { value: 'price_desc', label: 'Precio: mayor a menor' },
  { value: 'name', label: 'Nombre A–Z' },
];

// ─── LA RAMA LEGACY (§ TIENDA-ENCABEZADO-Y-FILTRAR-ORDENAR-1) ──────────────────────────────────
// El código de HOY, SIN TOCAR — byte a byte el `ShopInner` que existía antes de este slice, sólo
// renombrado. `navTratamiento.posicion:false` (Nayoli y todo tenant que no aplicó CORTE) renderiza
// ESTA función, nunca `ShopCorte` (abajo): "Nayoli byte-idéntica" es acá una garantía de
// NO-EDICIÓN, no de reescritura cuidadosa — el encabezado con banda `--sf-superficie` y el filtro
// aparte con su `<select>` de orden se quedan exactamente como estaban.
function ShopLegacy() {
  const searchParams = useSearchParams();
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
  const [search, setSearch] = useState('');
  // La categoría es texto libre (la taxonomía se DERIVA del catálogo, § categorias): el estado es
  // `string`. Un `?cat=X` que no exista simplemente filtra a vacío y su chip muestra "X" —no
  // `undefined`, porque el label ES la categoría misma, no un mapa que pueda no tener la clave.
  const [catFilter, setCatFilter] = useState<string>(
    searchParams.get("cat") || "all"
  );
  const [tostadoFilter, setTostadoFilter] = useState<
  RoastLevel | "all"
>(
  (searchParams.get("tostado") as RoastLevel) ||
    "all"
);
  const [sortBy, setSortBy] = useState('featured');
  const [showFilters, setShowFilters] = useState(false);

  // Fuente única: catálogo público desde la DB (ya viene solo con activos).
  const [catalog, setCatalog] = useState<Product[] | null>(null);
  useEffect(() => {
    getCatalog().then(setCatalog).catch(() => setCatalog([]));
  }, []);

  const filtered = useMemo(() => {
    let list = catalog ?? [];
    if (search) list = list.filter(p => p.nombre.toLowerCase().includes(search.toLowerCase()) || p.origen?.toLowerCase().includes(search.toLowerCase()));
    if (catFilter !== 'all') list = list.filter(p => p.categoria === catFilter);
    if (tostadoFilter !== 'all') list = list.filter(p => p.tostado === tostadoFilter);
    if (sortBy === 'price_asc') list = [...list].sort((a, b) => a.precio - b.precio);
    else if (sortBy === 'price_desc') list = [...list].sort((a, b) => b.precio - a.precio);
    else if (sortBy === 'name') list = [...list].sort((a, b) => a.nombre.localeCompare(b.nombre));
    return list;
  }, [catalog, search, catFilter, tostadoFilter, sortBy]);

  // DERIVADO del catálogo real: las pestañas de categoría (las que el cliente puebla) y si existe la
  // dimensión Tostión. No hay set declarado — un cliente no-café ve SUS categorías, sin filtro de
  // Tostión; Nayoli ve sus 2 categorías y su Tostión (todos sus productos tienen tostado).
  const categorias = useMemo(() => categoriasDelCatalogo(catalog ?? []), [catalog]);
  const hayTostados = useMemo(() => catalogoTieneTostado(catalog ?? []), [catalog]);

  interface ActiveFilter {
    key: string;
    label: string;
    clear: () => void;
    }

  const activeFilters: ActiveFilter[] = [
  catFilter !== "all"
    ? {
        key: "cat",

        // El label ES la categoría misma (sin mapa) → nunca `undefined`, ni con un `?cat=X` raro.
        label: catFilter,

        clear: () =>
          setCatFilter("all"),
      }
    : null,

  tostadoFilter !== "all"
    ? {
        key: "tostado",

        label: `Tostado ${
          TOSTADO_LABELS[tostadoFilter]
        }`,

        clear: () =>
          setTostadoFilter("all"),
      }
    : null,
].filter(
  (filter): filter is ActiveFilter =>
    filter !== null
);

  return (
      <div className={offsetClase}>
        {/* Page Header */}
        {/* PALETA-MIGRAR-TEXTO-SOBRE-SUPERFICIE-1: texto directo sobre `--sf-superficie` migrado
            al par `var(--sf-sobre-superficie,<token de hoy>)` (§ TEMAS-P6-FAMILIAS-1). El h1 de
            abajo (fallback `--sf-tinta`) migró en PALETA-MIGRAR-ACENTO-TINTA-1 --
            § PALETA-ACENTO-TINTA-SOBRE-SUPERFICIE-1, DECISIONS.md. */}
        <div className="bg-[var(--sf-superficie)] sf-divisor-b border-[var(--sf-linea)] py-12">
          <div className={`${contenedorClase} mx-auto`}>
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
              <h1 className="text-4xl font-playfair text-[var(--sf-sobre-superficie,var(--sf-tinta))] mb-2">Nuestra Tienda</h1>
              <p className="text-[var(--sf-sobre-superficie,var(--sf-texto))] text-sm">{catalog === null ? "Cargando" : `${catalog.length} productos`} · Origen colombiano</p>
            </motion.div>
          </div>
        </div>

        <div className={`${contenedorClase} mx-auto py-8`}>
          {/* Search & Sort Bar */}
          <div className="flex flex-wrap gap-3 mb-6">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--sf-tostado-3)]" />
              <input
                type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Buscar café..."
                className="w-full pl-9 pr-4 py-2.5 bg-[var(--sf-tarjeta)] sf-borde border-[var(--sf-linea)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--sf-acento)]/20 text-[var(--sf-tinta)]"
              />
            </div>
            <button onClick={() => setShowFilters(!showFilters)} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium sf-borde transition-colors ${showFilters ? 'bg-[var(--sf-acento)] text-[var(--sf-acento-txt)] border-[var(--sf-acento)]' : 'bg-[var(--sf-tarjeta)] border-[var(--sf-linea)] text-[var(--sf-texto)] hover:border-[var(--sf-acento)]'}`}>
              <SlidersHorizontal className="w-4 h-4" /> Filtros
              {activeFilters.length > 0 && <span className="bg-white/30 text-inherit text-xs rounded-full w-4 h-4 flex items-center justify-center">{activeFilters.length}</span>}
            </button>
            <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="px-4 py-2.5 bg-[var(--sf-tarjeta)] sf-borde border-[var(--sf-linea)] rounded-xl text-sm text-[var(--sf-texto)] focus:outline-none focus:ring-2 focus:ring-[var(--sf-acento)]/20 cursor-pointer">
              {SORTBY.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>

          {/* Filter Panel */}
          {showFilters && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="bg-[var(--sf-tarjeta)] sf-borde border-[var(--sf-linea)] rounded-2xl p-5 mb-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <p className="text-xs font-semibold text-[var(--sf-texto)] uppercase tracking-wide mb-3">Categoría</p>
                <div className="flex flex-wrap gap-2">
                  {/* DERIVADAS del catálogo: "Todos" + las categorías reales. El label es la categoría misma. */}
                  {['all', ...categorias].map(k => (
                    <button key={k} onClick={() => setCatFilter(k)}
                      className={`px-3 py-1.5 sf-pildora text-xs font-medium transition-colors ${catFilter === k ? 'bg-[var(--sf-acento)] text-[var(--sf-acento-txt)]' : 'bg-[var(--sf-superficie)] text-[var(--sf-sobre-superficie,var(--sf-texto))] hover:bg-[var(--sf-linea)]'}`}>
                      {k === 'all' ? 'Todos' : k}
                    </button>
                  ))}
                </div>
              </div>
              {/* "Nivel de Tostado" es vocabulario CAFETERO: sólo se muestra si el catálogo lo puebla
                  (hide-on-empty). Un catálogo no-café no lo ve; Nayoli sí (todos con tostado). */}
              {hayTostados && (
              <div>
                <p className="text-xs font-semibold text-[var(--sf-texto)] uppercase tracking-wide mb-3">Nivel de Tostado</p>
                <div className="flex flex-wrap gap-2">
                  {[['all', 'Todos'], ...Object.entries(TOSTADO_LABELS)].map(([k, v]) => (
                    <button key={k} onClick={() => setTostadoFilter(k as RoastLevel | "all")}
                      className={`px-3 py-1.5 sf-pildora text-xs font-medium transition-colors ${tostadoFilter === k ? 'bg-[var(--sf-acento)] text-[var(--sf-acento-txt)]' : 'bg-[var(--sf-superficie)] text-[var(--sf-sobre-superficie,var(--sf-texto))] hover:bg-[var(--sf-linea)]'}`}>
                      {v}
                    </button>
                  ))}
                </div>
              </div>
              )}
            </motion.div>
          )}

          {/* Active Filter Tags */}
          {activeFilters.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-5">
              {activeFilters.map(f => (
                <button key={f.key} onClick={f.clear} className="flex items-center gap-1.5 bg-[var(--sf-acento)]/10 text-[var(--sf-acento-texto)] text-xs font-medium px-3 py-1.5 sf-pildora hover:bg-[var(--sf-acento)]/20 transition-colors">
                  {f.label} <X className="w-3 h-3" />
                </button>
              ))}
            </div>
          )}

          {/* Grid */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-[var(--sf-texto)]">{filtered.length} producto{filtered.length !== 1 ? 's' : ''}</p>
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-20">
              <Search aria-hidden="true" className="w-10 h-10 text-[var(--sf-tostado-2)] mx-auto mb-3" />
              <p className="font-medium text-[var(--sf-tinta)] mb-1">Sin resultados</p>
              <p className="text-sm text-[var(--sf-texto-suave)]">Prueba con otros filtros o términos de búsqueda.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
              {filtered.map((p, i) => (
                <motion.div key={p.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                  <ProductCard product={p} sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw" />
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
  );
}

// ─── LA RAMA CORTE (§ TIENDA-ENCABEZADO-Y-FILTRAR-ORDENAR-1) ───────────────────────────────────
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
function ShopCorte() {
  const searchParams = useSearchParams();
  const { navTratamiento } = useSiteContent();
  const contenedorClase = contenedorAnchoClase(navTratamiento.posicion);
  const offsetClase = navOffsetClase(navTratamiento.posicion);

  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState<string>(searchParams.get('cat') || 'all');
  const [tostadoFilter, setTostadoFilter] = useState<RoastLevel | 'all'>(
    (searchParams.get('tostado') as RoastLevel) || 'all',
  );
  const [disponibilidad, setDisponibilidad] = useState<ReadonlySet<DisponibilidadFiltro>>(
    () => new Set<DisponibilidadFiltro>(),
  );
  // `null` = el operador todavía no tocó el slider → cae al rango COMPLETO del catálogo
  // (`precioActivo`, abajo). No es un "sin filtro" aparte: es el MISMO estado que el rango completo,
  // así que no hace falta una tercera rama en `filtrarCatalogo`.
  const [precioRango, setPrecioRango] = useState<[number, number] | null>(null);
  const [sortBy, setSortBy] = useState<OrdenCatalogo>('featured');
  const [panelAbierto, setPanelAbierto] = useState(false);

  // Fuente única: catálogo público desde la DB (ya viene solo con activos) — MISMA fuente que
  // `ShopLegacy`, sin endpoint nuevo.
  const [catalog, setCatalog] = useState<Product[] | null>(null);
  useEffect(() => {
    getCatalog().then(setCatalog).catch(() => setCatalog([]));
  }, []);

  const categorias = useMemo(() => categoriasDelCatalogo(catalog ?? []), [catalog]);
  const hayTostados = useMemo(() => catalogoTieneTostado(catalog ?? []), [catalog]);
  const rango = useMemo(() => rangoPrecioCatalogo(catalog ?? []), [catalog]);
  const conteoDisponibilidad = useMemo(() => contarDisponibilidad(catalog ?? []), [catalog]);

  const precioActivo: [number, number] = precioRango ?? [rango.min, rango.max];

  const filtered = useMemo(() => {
    const filtrados = filtrarCatalogo(catalog ?? [], {
      busqueda: search,
      categoria: catFilter,
      tostado: tostadoFilter,
      disponibilidad,
      precioMin: precioActivo[0],
      precioMax: precioActivo[1],
    });
    return ordenarCatalogo(filtrados, sortBy);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog, search, catFilter, tostadoFilter, disponibilidad, precioActivo[0], precioActivo[1], sortBy]);

  interface ActiveFilter {
    key: string;
    label: string;
    clear: () => void;
  }

  // Mismos DOS tags que ShopLegacy (categoría/tostado) — disponibilidad y precio se limpian
  // reabriendo el panel, como en la referencia (que tampoco los muestra como tags removibles).
  const activeFilters: ActiveFilter[] = [
    catFilter !== 'all' ? { key: 'cat', label: catFilter, clear: () => setCatFilter('all') } : null,
    tostadoFilter !== 'all'
      ? { key: 'tostado', label: `Tostado ${TOSTADO_LABELS[tostadoFilter]}`, clear: () => setTostadoFilter('all') }
      : null,
  ].filter((f): f is ActiveFilter => f !== null);

  return (
    <div className={offsetClase}>
      <div className={`${contenedorClase} mx-auto py-16`}>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-playfair text-4xl text-[var(--sf-tinta)] mb-2">Nuestra Tienda</h1>
          <p className="text-sm text-[var(--sf-texto)]">
            {catalog === null ? 'Cargando' : `${catalog.length} productos`} · Origen colombiano
          </p>
        </motion.div>

        <div className="mt-10">
          <div className="relative mb-2 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--sf-tostado-3)]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar café..."
              className="w-full rounded-xl sf-borde border-[var(--sf-linea)] bg-[var(--sf-fondo)] py-2.5 pl-9 pr-4 text-sm text-[var(--sf-tinta)] outline-none transition-all focus:border-[var(--sf-acento)] focus:ring-4 focus:ring-[var(--sf-acento)]/10"
            />
          </div>

          <FiltrarOrdenar
            abierto={panelAbierto}
            onAbiertoChange={setPanelAbierto}
            categorias={categorias}
            catFilter={catFilter}
            onCatFilter={setCatFilter}
            hayTostados={hayTostados}
            tostadoFilter={tostadoFilter}
            onTostadoFilter={setTostadoFilter}
            disponibilidad={disponibilidad}
            onDisponibilidad={setDisponibilidad}
            conteoDisponibilidad={conteoDisponibilidad}
            rango={rango}
            precioActivo={precioActivo}
            onPrecio={setPrecioRango}
            sortBy={sortBy}
            onSortBy={setSortBy}
          />

          {activeFilters.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {activeFilters.map((f) => (
                <button
                  key={f.key}
                  onClick={f.clear}
                  className="flex items-center gap-1.5 sf-pildora bg-[var(--sf-acento)]/10 px-3 py-1.5 text-xs font-medium text-[var(--sf-acento-texto)] transition-colors hover:bg-[var(--sf-acento)]/20"
                >
                  {f.label} <X className="h-3 w-3" />
                </button>
              ))}
            </div>
          )}

          <div className="mb-4 mt-6 flex items-center justify-between">
            <p className="text-sm text-[var(--sf-texto)]">
              {filtered.length} producto{filtered.length !== 1 ? 's' : ''}
            </p>
          </div>

          {filtered.length === 0 ? (
            <div className="py-20 text-center">
              <Search aria-hidden="true" className="mx-auto mb-3 h-10 w-10 text-[var(--sf-texto-suave)]" />
              <p className="mb-1 font-medium text-[var(--sf-tinta)]">Sin resultados</p>
              <p className="text-sm text-[var(--sf-texto-suave)]">Prueba con otros filtros o términos de búsqueda.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6 lg:grid-cols-4">
              {filtered.map((p, i) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <ProductCard product={p} sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw" />
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ShopInner() {
  const { navTratamiento } = useSiteContent();
  return navTratamiento.posicion ? <ShopCorte /> : <ShopLegacy />;
}

// useSearchParams() (cat/tostado filters from the URL) requires a Suspense
// boundary to prerender — Next.js CSR bailout.
export default function Shop() {
  // El fallback de Suspense se renderiza ANTES de que `ShopInner` monte, así que necesita su
  // propio `navOffsetClase` — no puede heredarlo de `ShopInner` (§ NAV-INTERNAS-CLARO-Y-OFFSET-1).
  const { navTratamiento } = useSiteContent();
  return (
    <Suspense fallback={<div className={`${navOffsetClase(navTratamiento.posicion)} min-h-screen`} />}>
      <ShopInner />
    </Suspense>
  );
}
