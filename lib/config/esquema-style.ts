import { derivarEsquema, contraste, RAICES_DEFECTO, type EsquemaId, type RaicesPaleta } from './palette-derive';
import { BANDAS_OSCURAS, type BandaId, type EsquemasContent } from './site-content-defaults';

// Puente entre UN esquema asignado a una BANDA (§ SiteContentData.esquemas, eje 5b mitad B) y las
// CSS custom properties que el WRAPPER de esa banda inyecta vía `style` en su <section> raíz. Las
// custom properties heredan a los descendientes por cascada, así que setearlas ahí las scopea a la
// banda sin un <div> nuevo (§ doctrina, el mecanismo de byte-identidad).
//
// Gemelo de `coloresCorreo`/`cssPaleta`: mismas 3 raíces (`content.tema`), mismo fallback a
// `RAICES_DEFECTO` cuando el cliente no configuró paleta (raíces null = fábrica). PURO (capa 1):
// sin red, sin `server-only`.

const raicesResueltas = (fondo: string | null, tinta: string | null, acento: string | null): RaicesPaleta => ({
  fondo: fondo ?? RAICES_DEFECTO.fondo,
  tinta: tinta ?? RAICES_DEFECTO.tinta,
  acento: acento ?? RAICES_DEFECTO.acento,
});

/**
 * SIN esquema asignado (`id` ausente/null) → `{}` — CERO vars locales. La <section> no setea nada
 * y cada clase del componente cae a su LITERAL/token GLOBAL de hoy: `--sf-tarjeta`/`--sf-sobre`
 * tienen default `#ffffff` en `:root` (§ globals.css, eje 5b MOTOR); `--sf-banda`/`--sf-linea-sobre`/
 * `--sf-sobre-banda`/`--sf-sobre-banda-suave` NO tienen default global —cada usuario trae su propio
 * fallback en la clase, `var(--sf-banda,<su token de hoy>)`— porque bandas distintas tienen fondos
 * (y por tanto textos-sobre-banda) canónicos distintos, y un default único no serviría a todas.
 * Resultado: byte-idéntico sin fila.
 *
 * CON esquema, se emiten las SEIS vars que un esquema efectivamente MUEVE para una banda:
 *   - el fondo de la banda (`--sf-banda`);
 *   - la superficie de tarjeta (`--sf-tarjeta`) y su texto (`--sf-sobre` — TARJETA-scoped: floreado
 *     contra `p.tarjeta`, para texto DENTRO de un `bg-[var(--sf-tarjeta)]`, nunca directo sobre la
 *     banda — usarlo para texto-sobre-banda con un fondo CLARO da 1.07:1 con 'crema' explícito,
 *     medido; ver `--sf-sobre-banda` para ese caso);
 *   - la línea sobre esa superficie (`--sf-linea-sobre`, del rol `linea`);
 *   - **`--sf-sobre-banda`/`--sf-sobre-banda-suave` (§ eje 5b, home-2) — el HUECO que esta pasada
 *     cierra: texto/ícono que se apoya DIRECTO en el fondo de la banda (título, eyebrow, ícono),
 *     no en una tarjeta.** Reusan `p.texto`/`p['texto-suave']`, NO una derivación nueva: esos dos
 *     roles YA están floreados contra `p.fondo` (la superficie MISMA de la banda, no la tarjeta —
 *     ver `derivarEsquema`) y YA los cubre el test que exige ≥4.5:1 para los 4 esquemas
 *     (`palette-derive.test.ts`). Medido con Nayoli: crema 9.97:1, superficie 8.71:1, oscuro
 *     8.49:1, acento 7.10:1 — con margen, nunca al piso raso. `--sf-sobre` (arriba) no sirve para
 *     esto: está floreado contra la TARJETA (que es ~90% la misma banda, así que da buen margen en
 *     3 de 4 esquemas por coincidencia, pero falla en 'crema' — 1.07:1, medido — porque el `sobre`
 *     de 'crema' es el blanco fijo de la tarjeta de hoy, no un auto-flip contra el fondo claro).
 *
 * El resto de las 24 vars de la paleta sigue viniendo del `:root` global (`derivarEsquema` no las
 * toca para `superficie`/`oscuro`/`acento`, salvo `acento-texto` — que ningún consumidor de home lee
 * DIRECTO sobre una banda hoy; sus usos DENTRO de una tarjeta se dejan intactos, § doctrina).
 */
export function esquemaStyle(
  id: EsquemaId | null | undefined,
  fondo: string | null,
  tinta: string | null,
  acento: string | null,
): Record<string, string> {
  if (!id) return {};
  const p = derivarEsquema(raicesResueltas(fondo, tinta, acento), id);
  return {
    '--sf-banda': p.fondo,
    '--sf-tarjeta': p.tarjeta,
    '--sf-sobre': p.sobre,
    '--sf-linea-sobre': p.linea,
    '--sf-sobre-banda': p.texto,
    '--sf-sobre-banda-suave': p['texto-suave'],
  };
}

/**
 * ¿La banda `bandaId` queda OSCURA con la configuración actual? La decide el CONTRASTE real del
 * fondo derivado, no el NOMBRE del esquema — 'acento' puede ser claro u oscuro según el acento del
 * cliente (misma regla de `direccionDePiso` que usa el motor). Es la función que consume el nav
 * (§ StoreNav): el nav flota SIEMPRE sobre `orden[0]` (§ eje 5, el orden de las bandas como dato),
 * que YA NO es necesariamente el hero.
 *
 * CON esquema asignado (`esquemas[bandaId]`) = el cálculo de contraste de hoy, sobre el fondo que
 * `derivarEsquema` produce para ese esquema.
 *
 * SIN esquema asignado = la CANÓNICA DE LA BANDA (`BANDAS_OSCURAS`, § `site-content-defaults.ts`):
 * oscura si `bandaId` está en ese set (hero/brandStory/subscriptionCTA — fondo literal de hoy
 * `tinta`/`tinta-2`), clara si no (trustBadges/featured/presentaciones/testimonials — fondo literal
 * `fondo`). El DEFAULT es CLARO: oscuro es la EXCEPCIÓN declarada, no la regla.
 *
 * MINA CERRADA (§ eje 5, EJE-5-ORDEN-NAV-CANONICA): esta función se llamaba `heroEsOscuro` y su
 * fallback SIN esquema asumía SIEMPRE la canónica del HERO (`tinta`, oscura) para CUALQUIER banda
 * que resultara primera — correcto sólo mientras `orden[0]` era necesariamente 'hero'. El eje 5 (el
 * orden como dato) rompió esa garantía: una banda CLARA sin esquema puesta primera habría dejado el
 * nav con texto claro sobre fondo claro. Generalizada a tomar la canónica DE LA BANDA que resulte
 * primera, no la del hero.
 */
export function bandaEsOscura(
  bandaId: BandaId,
  esquemas: EsquemasContent,
  fondo: string | null,
  tinta: string | null,
  acento: string | null,
): boolean {
  const raices = raicesResueltas(fondo, tinta, acento);
  const id = esquemas[bandaId];
  if (!id) return BANDAS_OSCURAS.has(bandaId);
  const bandaFondo = derivarEsquema(raices, id).fondo;
  return contraste('#ffffff', bandaFondo) >= contraste(raices.tinta, bandaFondo);
}
