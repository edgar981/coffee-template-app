import type { ComprobanteEstado } from '@/lib/comprobante';

// REUSA el tipo del predicado (`lib/comprobante.ts`) en vez de redeclarar la
// unión: dos tipos que nunca se comparan pueden divergir sin que el compilador
// avise — la misma razón por la que `types/analytics.ts` reusa los suyos.
export type { ComprobanteEstado };

/** Fila de `Comprobante` tal como la sirve la API. */
export interface Comprobante {
  id:                     string;
  orden_id:               string;
  /** Puntero al blob. La imagen NUNCA viaja en el payload. */
  url:                    string;
  content_type:           string;
  size_bytes:             number;
  estado:                 ComprobanteEstado;
  subido_por?:            string | null;
  subido_por_nombre?:     string | null;
  verificado_por?:        string | null;
  verificado_por_nombre?: string | null;
  verificado_at?:         string | null;
  notas_verificacion?:    string | null;
  createdAt:              string;
}
