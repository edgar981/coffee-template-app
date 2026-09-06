import { derivarPaleta, RAICES_DEFECTO, type RaicesPaleta } from './palette-derive';
import type { EmailColors } from '@duna/core/notifications/brand';

// Los 6 colores de los correos al cliente, DERIVADOS de las 3 raíces de la paleta (`content.tema`),
// no un set de 6 hex aparte (§ Tanda C2 · antes vivían hand-picked en `siteConfig.tienda.emailColors`).
// Los clientes de correo no leen CSS vars, así que van INLINE —por eso el núcleo los recibe como
// VALORES (`Brand.colors`), no como tokens—.
//
// EL MAPEO a las claves de `derivarPaleta`. Cuatro son EXACTOS por rol; dos son de CRITERIO (§ el
// reporte), decididos por lo que la plantilla pinta con cada uno (`shared.ts`, `const C = brand.colors`):
//   crema    → fondo        · el fondo de página del correo
//   papel    → superficie   · la tarjeta del correo
//   cafe     → acento       · el acento de marca (pasa EXACTO — `derivarPaleta` copia las raíces)
//   borde    → linea        · los bordes
//   espresso → tinta        · CRITERIO: `espresso` pinta los TÍTULOS y el cuerpo (`C.espresso`), o sea
//                             el rol de TINTA/ink más oscuro. (El viejo #2a1a10 era un espresso más
//                             claro; la tinta #1a0f08 es el mismo rol, un punto más oscura.)
//   muted    → texto-suave  · CRITERIO: `muted` pinta el texto SECUNDARIO (tagline, pie, subtexto),
//                             que es exactamente el rol `texto-suave`.
//
// SIN `content.tema` (raíces null = fábrica) DERIVA de `RAICES_DEFECTO` (Nayoli). Los correos de Nayoli
// por tanto DEJAN de ser sus hexes hand-picked y pasan a los derivados: `cafe` queda idéntico (#8b4513),
// `crema` se corre 2u (#faf7f2→#faf7f4), `espresso`/`muted`/`papel`/`borde` se ajustan. Los correos NO
// están gateados a byte-idéntico (decisión del owner), así que este corrimiento es aceptado.
//
// PURO (capa 1): sin red, sin `server-only`. Lo llama `buildBrand` (route handlers, motor, carril).

export function coloresCorreo(
  fondo: string | null,
  tinta: string | null,
  acento: string | null,
): EmailColors {
  const raices: RaicesPaleta = {
    fondo:  fondo  ?? RAICES_DEFECTO.fondo,
    tinta:  tinta  ?? RAICES_DEFECTO.tinta,
    acento: acento ?? RAICES_DEFECTO.acento,
  };
  const p = derivarPaleta(raices);
  return {
    crema:    p.fondo,
    papel:    p.superficie,
    espresso: p.tinta,
    cafe:     p.acento,
    muted:    p['texto-suave'],
    borde:    p.linea,
  };
}
