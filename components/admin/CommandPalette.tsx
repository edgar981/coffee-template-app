'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShoppingCart, Users, Package, ArrowRight, Clock } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem,
} from '@/components/ui/command';
import { ADMIN_NAV } from '@/constants/admin-nav';
import { searchAdmin } from '@/lib/api/search';
import { SEARCH_MIN_CHARS } from '@/types/search';
import type { AdminSearchResults, SearchEntity } from '@/types/search';
import { normalize, formatCOP } from '@duna/core/utils';

// A persisted recent selection. `type` drives its icon; `href` is the deep link
// and the dedupe key. Purely a client-side convenience (localStorage, no server).
interface RecentItem {
  title: string;
  type:  SearchEntity | 'nav';
  href:  string;
}

const RECENTS_KEY = 'admin:cmdk-recents';
const RECENTS_MAX = 8;
const EMPTY_RESULTS: AdminSearchResults = { ordenes: [], clientes: [], productos: [] };
const ENTITY_ICON: Record<SearchEntity, LucideIcon> = {
  orden:    ShoppingCart,
  cliente:  Users,
  producto: Package,
};

function loadRecents(): RecentItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = JSON.parse(localStorage.getItem(RECENTS_KEY) ?? '[]');
    return Array.isArray(raw) ? (raw as RecentItem[]).slice(0, RECENTS_MAX) : [];
  } catch { return []; }
}

export function CommandPalette({ open, onOpenChange }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [query, setQuery]     = useState('');
  const [results, setResults] = useState<AdminSearchResults>(EMPTY_RESULTS);
  const [loading, setLoading] = useState(false);
  const [recents, setRecents] = useState<RecentItem[]>([]);

  const q = query.trim();
  const searching = q.length >= SEARCH_MIN_CHARS;

  // Load recents whenever the palette opens (picks up selections from prior opens).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read persisted recents from localStorage on open (client-only)
    if (open) setRecents(loadRecents());
  }, [open]);

  // Debounced (250ms) server search; min 2 chars. Aborts the in-flight request
  // when the query changes so a slow response can't overwrite a newer one. State
  // is only touched inside the async callback (never synchronously in the effect
  // body); what to display is DERIVED below, so no reset-on-clear write is needed.
  useEffect(() => {
    if (!searching) return;
    let ignore = false;
    const controller = new AbortController();
    const t = setTimeout(() => {
      setLoading(true);
      searchAdmin(q, controller.signal)
        .then(r => { if (!ignore) setResults(r); })
        .catch(() => { /* aborted or transient error — leave prior results */ })
        .finally(() => { if (!ignore) setLoading(false); });
    }, 250);
    return () => { ignore = true; clearTimeout(t); controller.abort(); };
  }, [q, searching]);

  // Below the min length there are no server results and no spinner — derived, so
  // clearing the query needs no state write.
  const displayResults = searching ? results : EMPTY_RESULTS;
  const showLoading    = searching && loading;

  const pushRecent = useCallback((item: RecentItem) => {
    const next = [item, ...loadRecents().filter(r => r.href !== item.href)].slice(0, RECENTS_MAX);
    try { localStorage.setItem(RECENTS_KEY, JSON.stringify(next)); } catch { /* quota — non-fatal */ }
  }, []);

  // Navigate + remember + close. Selection always goes through here so recents
  // and the deep-link stay in one place.
  const go = useCallback((href: string, recent: RecentItem) => {
    pushRecent(recent);
    onOpenChange(false);
    setQuery('');
    router.push(href);
  }, [pushRecent, onOpenChange, router]);

  // Reset the query when the dialog closes so the next open starts clean.
  const handleOpenChange = useCallback((next: boolean) => {
    if (!next) setQuery('');
    onOpenChange(next);
  }, [onOpenChange]);

  const hasServerResults =
    displayResults.ordenes.length + displayResults.clientes.length + displayResults.productos.length > 0;

  // Icon for a recent row: reuse the section icon for nav, else the entity icon.
  const recentIcon = useMemo(() => (r: RecentItem): LucideIcon => {
    if (r.type === 'nav') return ADMIN_NAV.find(n => n.path === r.href)?.icon ?? ArrowRight;
    return ENTITY_ICON[r.type];
  }, []);

  return (
    <CommandDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Búsqueda del panel"
      description="Busca clientes, órdenes y productos, o navega por las secciones"
    >
      <CommandInput
        placeholder="Buscar clientes, órdenes, productos..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {/* True empty state — only once the server search has settled. */}
        {searching && !showLoading && !hasServerResults && (
          <CommandEmpty>Sin resultados para &quot;{q}&quot;</CommandEmpty>
        )}

        {/* Recents — only when the query is empty. */}
        {!q && recents.length > 0 && (
          <CommandGroup heading="Recientes">
            {recents.map(r => {
              const Icon = recentIcon(r);
              return (
                <CommandItem
                  key={r.href}
                  value={`recent-${r.href}`}
                  onSelect={() => go(r.href, r)}
                >
                  <Icon />
                  <span className="truncate">{r.title}</span>
                  <Clock className="ml-auto h-3.5 w-3.5 opacity-60" />
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        {/* Static nav index — instant, fuzzy via cmdk (diacritic-insensitive
            through the normalized keyword). */}
        <CommandGroup heading="Ir a">
          {ADMIN_NAV.map(item => {
            const Icon = item.icon;
            return (
              <CommandItem
                key={item.path}
                value={item.label}
                keywords={[normalize(item.label)]}
                onSelect={() => go(item.path, { title: item.label, type: 'nav', href: item.path })}
              >
                <Icon className="text-muted-foreground" />
                <span>{item.label}</span>
                <ArrowRight className="ml-auto h-3.5 w-3.5 opacity-50" />
              </CommandItem>
            );
          })}
        </CommandGroup>

        {/* Entity results — server-side, debounced. Each carries the live query as
            a keyword so cmdk never filters out a server-confirmed match. */}
        {showLoading && !hasServerResults && (
          <div className="py-6 text-center text-sm text-muted-foreground">Buscando…</div>
        )}

        {displayResults.ordenes.length > 0 && (
          <CommandGroup heading="Órdenes">
            {displayResults.ordenes.map(o => {
              const href = `/admin/ordenes?order=${encodeURIComponent(o.numero_orden)}`;
              const title = `${o.numero_orden}${o.cliente_nombre ? ` · ${o.cliente_nombre}` : ''}`;
              return (
                <CommandItem
                  key={o.id}
                  value={`orden-${o.id}`}
                  keywords={[q]}
                  onSelect={() => go(href, { title, type: 'orden', href })}
                >
                  <ShoppingCart />
                  <span className="truncate">
                    <span className="font-mono font-medium">{o.numero_orden}</span>
                    {o.cliente_nombre && <span className="text-muted-foreground"> · {o.cliente_nombre}</span>}
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground">{formatCOP(o.total)}</span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        {displayResults.clientes.length > 0 && (
          <CommandGroup heading="Clientes">
            {displayResults.clientes.map(c => {
              const href = `/admin/clientes/${c.id}`;
              const subtitle = c.telefono || c.email || '';
              return (
                <CommandItem
                  key={c.id}
                  value={`cliente-${c.id}`}
                  keywords={[q]}
                  onSelect={() => go(href, { title: c.nombre, type: 'cliente', href })}
                >
                  <Users />
                  <span className="truncate">
                    {c.nombre}
                    {subtitle && <span className="text-muted-foreground"> · {subtitle}</span>}
                  </span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        {displayResults.productos.length > 0 && (
          <CommandGroup heading="Productos">
            {displayResults.productos.map(p => {
              const href = `/admin/productos?producto=${encodeURIComponent(p.id)}`;
              return (
                <CommandItem
                  key={p.id}
                  value={`producto-${p.id}`}
                  keywords={[q]}
                  onSelect={() => go(href, { title: p.nombre, type: 'producto', href })}
                >
                  <Package />
                  <span className="truncate">{p.nombre}</span>
                  <span className="ml-auto text-xs capitalize text-muted-foreground">{p.categoria}</span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
