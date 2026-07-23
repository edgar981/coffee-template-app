"use client";
import { Suspense, useState, useMemo, useEffect } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { motion } from 'framer-motion';
import ProductCard from '@/components/storefront/ProductCard';
import { TOSTADO_LABELS } from '@/constants/roast-levels';
import { CATEGORIA_LABELS } from '@/constants/categories';
import { getCatalog } from '@/lib/api/products';
import { useSearchParams } from 'next/navigation';
import {Product, ProductCategory, RoastLevel} from '@/types/product';


const SORTBY = [
  { value: 'featured', label: 'Destacados' },
  { value: 'price_asc', label: 'Precio: menor a mayor' },
  { value: 'price_desc', label: 'Precio: mayor a menor' },
  { value: 'name', label: 'Nombre A–Z' },
];

function ShopInner() {
  const searchParams = useSearchParams();
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState<
  ProductCategory | "all"
>(
  (searchParams.get("cat") as ProductCategory) ||
    "all"
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

  interface ActiveFilter {
    key: string;
    label: string;
    clear: () => void;
    }   

  const activeFilters: ActiveFilter[] = [
  catFilter !== "all"
    ? {
        key: "cat",

        label:
          CATEGORIA_LABELS[catFilter],

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
      <div className="pt-16">
        {/* Page Header */}
        <div className="bg-[#f0e8de] border-b border-[#e8ddd0] py-12">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
              <h1 className="text-4xl font-playfair text-[#1a0f08] mb-2">Nuestra Tienda</h1>
              <p className="text-[#5a3a28] text-sm">{catalog === null ? "Cargando" : `${catalog.length} productos`} · Origen colombiano</p>
            </motion.div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Search & Sort Bar */}
          <div className="flex flex-wrap gap-3 mb-6">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#a07050]" />
              <input
                type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Buscar café..."
                className="w-full pl-9 pr-4 py-2.5 bg-white border border-[#e8ddd0] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#8B4513]/20 text-[#1a0f08]"
              />
            </div>
            <button onClick={() => setShowFilters(!showFilters)} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors ${showFilters ? 'bg-[#8B4513] text-white border-[#8B4513]' : 'bg-white border-[#e8ddd0] text-[#5a3a28] hover:border-[#8B4513]'}`}>
              <SlidersHorizontal className="w-4 h-4" /> Filtros
              {activeFilters.length > 0 && <span className="bg-white/30 text-inherit text-xs rounded-full w-4 h-4 flex items-center justify-center">{activeFilters.length}</span>}
            </button>
            <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="px-4 py-2.5 bg-white border border-[#e8ddd0] rounded-xl text-sm text-[#5a3a28] focus:outline-none focus:ring-2 focus:ring-[#8B4513]/20 cursor-pointer">
              {SORTBY.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>

          {/* Filter Panel */}
          {showFilters && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="bg-white border border-[#e8ddd0] rounded-2xl p-5 mb-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <p className="text-xs font-semibold text-[#5a3a28] uppercase tracking-wide mb-3">Categoría</p>
                <div className="flex flex-wrap gap-2">
                  {[['all', 'Todos'], ...Object.entries(CATEGORIA_LABELS)].map(([k, v]) => (
                    <button key={k} onClick={() => setCatFilter(k as ProductCategory | "all")}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${catFilter === k ? 'bg-[#8B4513] text-white' : 'bg-[#f0e8de] text-[#5a3a28] hover:bg-[#e8ddd0]'}`}>
                      {v}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-[#5a3a28] uppercase tracking-wide mb-3">Nivel de Tostado</p>
                <div className="flex flex-wrap gap-2">
                  {[['all', 'Todos'], ...Object.entries(TOSTADO_LABELS)].map(([k, v]) => (
                    <button key={k} onClick={() => setTostadoFilter(k as RoastLevel | "all")}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${tostadoFilter === k ? 'bg-[#8B4513] text-white' : 'bg-[#f0e8de] text-[#5a3a28] hover:bg-[#e8ddd0]'}`}>
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* Active Filter Tags */}
          {activeFilters.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-5">
              {activeFilters.map(f => (
                <button key={f.key} onClick={f.clear} className="flex items-center gap-1.5 bg-[#8B4513]/10 text-[#8B4513] text-xs font-medium px-3 py-1.5 rounded-full hover:bg-[#8B4513]/20 transition-colors">
                  {f.label} <X className="w-3 h-3" />
                </button>
              ))}
            </div>
          )}

          {/* Grid */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-[#5a3a28]">{filtered.length} producto{filtered.length !== 1 ? 's' : ''}</p>
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-20">
              <Search className="w-10 h-10 text-[#c0a080] mx-auto mb-3" />
              <p className="font-medium text-[#1a0f08] mb-1">Sin resultados</p>
              <p className="text-sm text-[#8B6650]">Prueba con otros filtros o términos de búsqueda.</p>
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

// useSearchParams() (cat/tostado filters from the URL) requires a Suspense
// boundary to prerender — Next.js CSR bailout.
export default function Shop() {
  return (
    <Suspense fallback={<div className="pt-16 min-h-screen" />}>
      <ShopInner />
    </Suspense>
  );
}