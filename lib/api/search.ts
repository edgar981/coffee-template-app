import type { AdminSearchResults } from '@/types/search';
import { SEARCH_MIN_CHARS } from '@/types/search';

const EMPTY: AdminSearchResults = { ordenes: [], clientes: [], productos: [] };

// Client wrapper for the admin global search (the ONLY caller of /api/search).
// Accepts an AbortSignal so the command palette can cancel a stale in-flight
// request when the query changes. Short/blank queries resolve to empty without a
// round-trip. An aborted request rethrows AbortError (the caller ignores it).
export async function searchAdmin(
  q: string,
  signal?: AbortSignal,
): Promise<AdminSearchResults> {
  const query = q.trim();
  if (query.length < SEARCH_MIN_CHARS) return EMPTY;

  const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal });
  if (!res.ok) throw new Error('Error al buscar');
  return res.json();
}
