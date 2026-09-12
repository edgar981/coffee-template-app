import { derivarEsquema, contraste, RAICES_DEFECTO, type EsquemaId, type RaicesPaleta } from './palette-derive';
import { bandaOscuraCanonica, bandaUniforme, type BandaId, type EsquemasContent } from './site-content-defaults';

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
 * `--sf-sobre-banda`/`--sf-sobre-banda-suave`/`--sf-sobre-tarjeta`/`--sf-sobre-tarjeta-suave` NO
 * tienen default global —cada usuario trae su propio fallback en la clase,
 * `var(--sf-banda,<su token de hoy>)`— porque bandas distintas tienen fondos (y por tanto
 * textos-sobre-banda/tarjeta) canónicos distintos, y un default único no serviría a todas.
 * Resultado: byte-idéntico sin fila.
 *
 * CON esquema, se emiten las OCHO vars que un esquema efectivamente MUEVE para una banda:
 *   - el fondo de la banda (`--sf-banda`);
 *   - la superficie de tarjeta (`--sf-tarjeta`) y su texto (`--sf-sobre` — el token VIEJO, texto
 *     sobre TINTA en el resto del storefront, no tocar su significado);
 *   - **`--sf-sobre-tarjeta`/`--sf-sobre-tarjeta-suave` (§ TEMAS-P6-FAMILIAS-1) — el PAR de la
 *     familia `tarjeta`: floreado GARANTIZADO (`sobreTarjetaDe`/`pisoContraste`) contra `p.tarjeta`,
 *     para texto DENTRO de un `bg-[var(--sf-tarjeta)]`. `--sf-sobre` (arriba) NO sirve para esto —
 *     es OTRO rol (texto-sobre-tinta) y además queda degenerado en 'crema' (blanco sobre tarjeta
 *     blanca, 1:1, medido) —, así que el par nuevo tiene NOMBRE PROPIO, no reusa `--sf-sobre`;
 *   - la línea sobre esa superficie (`--sf-linea-sobre`, del rol `linea`);
 *   - **`--sf-sobre-banda`/`--sf-sobre-banda-suave` (§ eje 5b, home-2) — el HUECO que esa pasada
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
 * El resto de las 28 vars de la paleta sigue viniendo del `:root` global (`derivarEsquema` no las
 * toca para `superficie`/`oscuro`/`acento`, salvo `acento-texto` — que ningún consumidor de home lee
 * DIRECTO sobre una banda hoy; sus usos DENTRO de una tarjeta se dejan intactos, § doctrina). La
 * familia `superficie` (`--sf-sobre-superficie`/`-suave`) NO entra a esta lista: `--sf-superficie`
 * es RAÍZ y ningún esquema la re-deriva, así que su par vive sólo en `derivarPaleta`/`cssPaleta`,
 * nunca acá (§ palette-derive.ts).
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
    // --sf-sobre-tarjeta/-suave (§ TEMAS-P6-FAMILIAS-1): el PAR de la familia `tarjeta`, floreado
    // GARANTIZADO contra `p.tarjeta` (`sobreTarjetaDe`/`pisoContraste`, § palette-derive.ts). NO es
    // `--sf-sobre` (arriba): ese token es OTRO rol —texto sobre TINTA, usado en el resto del
    // storefront (footer, botones, nav) donde SU default de :root (#ffffff) es correcto— y además
    // queda degenerado para 'crema' (tarjeta blanca + #ffffff = 1:1, medido). `--sf-sobre-tarjeta`
    // SIN default en globals.css a propósito (mismo patrón que `--sf-sobre-banda`, abajo): los
    // consumidores traen su fallback al texto de hoy (`var(--sf-sobre-tarjeta,var(--sf-tinta))`),
    // así que una banda SIN esquema (el `{}` de arriba) no rompe nada.
    '--sf-sobre-tarjeta': p['sobre-tarjeta'],
    '--sf-sobre-tarjeta-suave': p['sobre-tarjeta-suave'],
    '--sf-linea-sobre': p.linea,
    '--sf-sobre-banda': p.texto,
    '--sf-sobre-banda-suave': p['texto-suave'],
  };
}

/**
 * ¿La banda `bandaId` queda OSCURA con la configuración actual? La decide el CONTRASTE real del
 * fondo derivado, no el NOMBRE del esquema — 'acento' puede ser claro u oscuro según el acento del
 * cliente (misma regla de `direccionDePiso` que usa el motor). Es el COMPUTADOR de darkness; su
 * consumidor es `tratamientoNav` (§ EJE-5-NAV-UNIFORME, abajo), no StoreNav directo — el nav flota
 * SIEMPRE sobre `orden[0]` (§ eje 5, el orden de las bandas como dato), que YA NO es necesariamente
 * el hero, y `tratamientoNav` decide primero si esa banda ADMITE flotar antes de preguntarle a ésta
 * si es oscura.
 *
 * CON esquema asignado (`esquemas[bandaId]`) = el cálculo de contraste de hoy, sobre el fondo que
 * `derivarEsquema` produce para ese esquema. `variante` se IGNORA en esta rama a propósito: el
 * wrapper del esquema setea `--sf-banda` igual para las dos variantes de una sección, así que el
 * contraste del fondo derivado ya decide bien sin mirar la composición.
 *
 * SIN esquema asignado = la CANÓNICA DE LA BANDA (`bandaOscuraCanonica`, § `site-content-defaults.ts`),
 * que SÍ mira `variante` — hoy sólo el hero bifurca: 'curtina' oscura (fondo literal `tinta`), 'ficha'
 * clara (fondo literal `fondo`). El resto de las bandas (brandStory/subscriptionCTA oscuras;
 * trustBadges/featured/presentaciones/testimonials claras) no varían con su variante. El DEFAULT es
 * CLARO: oscuro es la EXCEPCIÓN declarada, no la regla.
 *
 * MINA CERRADA (§ eje 5, EJE-5-ORDEN-NAV-CANONICA): esta función se llamaba `heroEsOscuro` y su
 * fallback SIN esquema asumía SIEMPRE la canónica del HERO (`tinta`, oscura) para CUALQUIER banda
 * que resultara primera — correcto sólo mientras `orden[0]` era necesariamente 'hero'. El eje 5 (el
 * orden como dato) rompió esa garantía: una banda CLARA sin esquema puesta primera habría dejado el
 * nav con texto claro sobre fondo claro. Generalizada a tomar la canónica DE LA BANDA que resulte
 * primera, no la del hero.
 *
 * MINA CERRADA #2 (§ EJE-5-VARIANTES-HERO): la canónica de una banda dejó de ser fija cuando el hero
 * ganó variantes de composición —'ficha' es CLARA, al revés de 'curtina'—, así que esta función pasó
 * a recibir la VARIANTE de la banda primera y delegarla a `bandaOscuraCanonica`. Sin este parámetro,
 * un hero·ficha primero-y-sin-esquema habría dejado el nav con texto claro sobre banda clara (el
 * mismo modo de falla de la mina #1, una capa más abajo).
 */
export function bandaEsOscura(
  bandaId: BandaId,
  variante: string | undefined,
  esquemas: EsquemasContent,
  fondo: string | null,
  tinta: string | null,
  acento: string | null,
): boolean {
  const raices = raicesResueltas(fondo, tinta, acento);
  const id = esquemas[bandaId];
  if (!id) return bandaOscuraCanonica(bandaId, variante);
  const bandaFondo = derivarEsquema(raices, id).fondo;
  return contraste('#ffffff', bandaFondo) >= contraste(raices.tinta, bandaFondo);
}

/**
 * Cómo debe tratar el nav a la banda sobre la que flota (§ StoreNav, EJE-5-NAV-UNIFORME). UNA regla
 * sobre la primera banda, no dos que el consumidor combine a mano.
 *
 * `flotante`: ¿puede el nav flotar TRANSPARENTE sobre esta banda? Sólo si la banda es UNIFORME
 * (`bandaUniforme`, § site-content-defaults.ts) — una banda partida (la ficha del hero: crema a la
 * izquierda, foto oscura a la derecha) no tiene un color de texto único que se lea sobre las dos
 * mitades, así que el nav cae a SÓLIDO.
 *
 * `textoClaro`: si flota, ¿el texto va claro? = la banda es oscura (`bandaEsOscura` — el
 * COMPUTADOR de darkness, por contraste real CON esquema, por la canónica declarada SIN esquema).
 * Con `flotante: false` no hay texto claro que decidir: el sólido va con texto oscuro siempre
 * (misma lectura que el nav con scroll de hoy).
 *
 * MINA CERRADA (§ EJE-5-NAV-UNIFORME): el nav asumía que TODA banda es uniforme —cierto mientras la
 * única variante de la primera banda era la curtina (foto oscura a sangre) o un esquema asignado (un
 * solo color derivado)—. La ficha del hero es bi-tonal, y el gate visual del owner encontró el nav
 * transparente con texto oscuro ilegible sobre su mitad de foto. Antes de preguntar si la banda es
 * oscura, hay que preguntar si tiene UN tono que preguntar eso.
 */
export function tratamientoNav(
  bandaId: BandaId,
  variante: string | undefined,
  esquemas: EsquemasContent,
  fondo: string | null,
  tinta: string | null,
  acento: string | null,
): { flotante: boolean; textoClaro: boolean } {
  if (!bandaUniforme(bandaId, variante)) return { flotante: false, textoClaro: false };
  return { flotante: true, textoClaro: bandaEsOscura(bandaId, variante, esquemas, fondo, tinta, acento) };
}
