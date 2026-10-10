"use client";

import { useEffect, useMemo, useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { useSearchParams } from 'next/navigation';
import ProductCard from '@/components/storefront/ProductCard';
import { TOSTADO_LABELS } from '@/constants/roast-levels';
import { getCatalog } from '@/lib/api/products';
import { categoriasDelCatalogo, catalogoTieneTostado } from '@/lib/productos/categorias';
import type { Product, RoastLevel } from '@/types/product';
import { useSiteContent } from '@/components/storefront/SiteContentProvider';
import FiltrarOrdenar from '@/components/storefront/tienda/FiltrarOrdenar';
import TiendaLaminas from '@/components/storefront/tienda/TiendaLaminas';
import { mostrarSelectorAntojo } from '@/lib/tienda/antojo';
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

interface ActiveFilter {
  key: string;
  label: string;
  clear: () => void;
}

// EL CATÁLOGO de /tienda (§ TIENDA-PAGINA-REGISTRO-1): buscador + filtros + grilla. Antes vivía
// inline en `ShopLegacy`/`ShopCorte` (app/(storefront)/tienda/page.tsx); se extrae por la misma razón
// que `TiendaEncabezado` — ver su docstring. HEADLESS: `page.tsx` sigue dueño de los wrappers de
// layout de cada rama (el `py-8` de legacy, el `mt-10` de corte).
//
// UNA sola composición, «Actual»: las dos ramas de SIEMPRE se conservan byte a byte, incluida su
// lógica de filtrado propia (`filtrarCatalogo`/`ordenarCatalogo` para corte; filtrado inline para
// legacy — el slice NO las unifica). `CatalogoLegacy`/`CatalogoCorte` son DOS funciones separadas,
// no una sola con ramas: son los mismos `ShopLegacy`/`ShopCorte` de hoy, sólo que recortados a la
// mitad "catálogo" — cada una declara sus propios hooks (reglas de hooks: no se puede llamar la
// mitad de un `useState` condicionalmente dentro de una sola función).
//
// SÓLO el placeholder del buscador queda FUERA del contenido editable (§ el docstring de
// `TiendaCatalogoContent`, site-content-defaults.ts — literal "Buscar café...", sin cambio); los dos
// textos del estado vacío (`vacioTitulo`/`vacioTexto`) sí son `tiendaCatalogo.*`.
//
// `useSearchParams()` puede devolver `null` sin un `SearchParamsContext` ambiente (la vista previa en
// vivo del editor, `renderToStaticMarkup` en el carril — § `admin-tienda-preset.test.ts`, que no
// monta el App Router de Next): el acceso es con `?.`, nunca `searchParams.get(...)` a secas — en la
// tienda real (dentro del `<Suspense>` de `Shop()`) el contexto SIEMPRE existe, así que el
// comportamiento ahí no cambia.
export default function TiendaCatalogo({ whatsapp }: { whatsapp?: string } = {}) {
  const { navTratamiento, tiendaCatalogo } = useSiteContent();
  // LA COMPOSICIÓN «LÁMINAS» (§ TIENDA-CHAMISAS-ALBUM-1) — INDEPENDIENTE de `navTratamiento.
  // posicion`, como «Carta» en `TiendaEncabezado`. Con MÁS de 6 productos cae SOLA a la grilla de
  // «Actual» (§ el spec: "quedan los filtros de «Actual»") — no es un tercer valor de `variante`,
  // es una decisión de este componente sobre los MISMOS dos valores. Mientras el catálogo carga
  // (`null`) cae a «Actual» también: ésas ya tienen su propio estado "Cargando" resuelto.
  const [catalog, setCatalog] = useState<Product[] | null>(null);
  useEffect(() => {
    if (tiendaCatalogo.variante !== 'laminas') return;
    getCatalog().then(setCatalog).catch(() => setCatalog([]));
  }, [tiendaCatalogo.variante]);

  if (tiendaCatalogo.variante === 'laminas' && catalog !== null && mostrarSelectorAntojo(catalog)) {
    return <TiendaLaminas catalog={catalog} coloresPorProducto={tiendaCatalogo.coloresPorProducto} whatsapp={whatsapp} />;
  }

  return navTratamiento.posicion ? <CatalogoCorte /> : <CatalogoLegacy />;
}

function CatalogoLegacy() {
  const { tiendaCatalogo } = useSiteContent();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState<string>(searchParams?.get('cat') || 'all');
  const [tostadoFilter, setTostadoFilter] = useState<RoastLevel | 'all'>(
    (searchParams?.get('tostado') as RoastLevel) || 'all',
  );
  const [sortBy, setSortBy] = useState('featured');
  const [showFilters, setShowFilters] = useState(false);

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

  const categorias = useMemo(() => categoriasDelCatalogo(catalog ?? []), [catalog]);
  const hayTostados = useMemo(() => catalogoTieneTostado(catalog ?? []), [catalog]);

  const activeFilters: ActiveFilter[] = [
    catFilter !== 'all'
      ? { key: 'cat', label: catFilter, clear: () => setCatFilter('all') }
      : null,
    tostadoFilter !== 'all'
      ? { key: 'tostado', label: `Tostado ${TOSTADO_LABELS[tostadoFilter]}`, clear: () => setTostadoFilter('all') }
      : null,
  ].filter((filter): filter is ActiveFilter => filter !== null);

  return (
    <>
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
              {['all', ...categorias].map(k => (
                <button key={k} onClick={() => setCatFilter(k)}
                  className={`px-3 py-1.5 sf-pildora text-xs font-medium transition-colors ${catFilter === k ? 'bg-[var(--sf-acento)] text-[var(--sf-acento-txt)]' : 'bg-[var(--sf-superficie)] text-[var(--sf-sobre-superficie,var(--sf-texto))] hover:bg-[var(--sf-linea)]'}`}>
                  {k === 'all' ? 'Todos' : k}
                </button>
              ))}
            </div>
          </div>
          {hayTostados && (
          <div>
            <p className="text-xs font-semibold text-[var(--sf-texto)] uppercase tracking-wide mb-3">Nivel de Tostado</p>
            <div className="flex flex-wrap gap-2">
              {[['all', 'Todos'], ...Object.entries(TOSTADO_LABELS)].map(([k, v]) => (
                <button key={k} onClick={() => setTostadoFilter(k as RoastLevel | 'all')}
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
          <p className="font-medium text-[var(--sf-tinta)] mb-1">{tiendaCatalogo.vacioTitulo}</p>
          <p className="text-sm text-[var(--sf-texto-suave)]">{tiendaCatalogo.vacioTexto}</p>
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
    </>
  );
}

function CatalogoCorte() {
  const { tiendaCatalogo } = useSiteContent();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState<string>(searchParams?.get('cat') || 'all');
  const [tostadoFilter, setTostadoFilter] = useState<RoastLevel | 'all'>(
    (searchParams?.get('tostado') as RoastLevel) || 'all',
  );
  const [disponibilidad, setDisponibilidad] = useState<ReadonlySet<DisponibilidadFiltro>>(
    () => new Set<DisponibilidadFiltro>(),
  );
  // `null` = el operador todavía no tocó el slider → cae al rango COMPLETO del catálogo.
  const [precioRango, setPrecioRango] = useState<[number, number] | null>(null);
  const [sortBy, setSortBy] = useState<OrdenCatalogo>('featured');
  const [panelAbierto, setPanelAbierto] = useState(false);

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

  const activeFilters: ActiveFilter[] = [
    catFilter !== 'all' ? { key: 'cat', label: catFilter, clear: () => setCatFilter('all') } : null,
    tostadoFilter !== 'all'
      ? { key: 'tostado', label: `Tostado ${TOSTADO_LABELS[tostadoFilter]}`, clear: () => setTostadoFilter('all') }
      : null,
  ].filter((f): f is ActiveFilter => f !== null);

  return (
    <>
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
          <p className="mb-1 font-medium text-[var(--sf-tinta)]">{tiendaCatalogo.vacioTitulo}</p>
          <p className="text-sm text-[var(--sf-texto-suave)]">{tiendaCatalogo.vacioTexto}</p>
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
    </>
  );
}
