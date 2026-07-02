export type SearchEntity =
  | "orden"
  | "producto"
  | "cliente";

export type SearchResult = {
  id: string;
  type: SearchEntity;
  title: string;
  subtitle?: string;
  href: string;
  badge?: string;
};