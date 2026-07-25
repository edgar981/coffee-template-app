export type SearchEntity =
  | "orden"
  | "producto"
  | "cliente";

// A normalized, ready-to-render palette row (also the shape persisted in the
// "Recientes" list). `type` drives the icon; `href` is the deep link.
export type SearchResult = {
  id: string;
  type: SearchEntity;
  title: string;
  subtitle?: string;
  href: string;
  badge?: string;
};

// ─── GET /api/search response (grouped, capped ≤5 per group) ─────────────────
// Light per-hit shapes: just enough to render a row and build its deep link.

export interface OrderSearchHit {
  id:             string;
  numero_orden:   string;
  cliente_nombre: string | null;
  estado:         string;
  total:          number;
}

export interface CustomerSearchHit {
  id:       string;
  nombre:   string;
  email:    string | null;
  telefono: string | null;
}

export interface ProductSearchHit {
  id:        string;
  nombre:    string;
  categoria: string;
}

export interface AdminSearchResults {
  ordenes:   OrderSearchHit[];
  clientes:  CustomerSearchHit[];
  productos: ProductSearchHit[];
}

// Below this length the palette shows only the static nav index + recents and
// makes NO server round-trip. Shared by the client wrapper and the route.
export const SEARCH_MIN_CHARS = 2;

// Max hits per group (server caps; kept here so both sides agree).
export const SEARCH_GROUP_LIMIT = 5;
