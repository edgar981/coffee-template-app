import { derivarEsquema, contraste, RAICES_DEFECTO, type EsquemaId, type RaicesPaleta } from './palette-derive';

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
 * tienen default `#ffffff` en `:root` (§ globals.css, eje 5b MOTOR); `--sf-banda`/`--sf-linea-sobre`
 * NO tienen default global —cada banda trae su propio fallback en la clase, `var(--sf-banda,<su
 * token de hoy>)`— porque bandas distintas tienen fondos canónicos distintos (tinta, tinta-2,
 * fondo, superficie) y un default único no serviría a todas. Resultado: byte-idéntico sin fila.
 *
 * CON esquema, se emiten las CUATRO vars que un esquema efectivamente MUEVE para una banda: el
 * fondo de la banda (`--sf-banda`), la superficie de tarjeta (`--sf-tarjeta`) y su texto
 * (`--sf-sobre`), y la línea sobre esa superficie (`--sf-linea-sobre`, del rol `linea` de
 * `derivarEsquema` — que la RECETA no recomputa por esquema, pero sirve igual de borde claro sobre
 * una banda oscura, como ya hace `tostado`). El resto de las 24 vars de la paleta sigue viniendo
 * del `:root` global (`derivarEsquema` no las toca para `superficie`/`oscuro`/`acento`, salvo estas
 * cuatro más `texto`/`texto-suave`/`acento-texto` — que esta banda no usa: ningún componente del
 * home lee esos tres roles DENTRO de una banda con literal blanco, § doctrina, sección 3).
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
  };
}

/**
 * ¿La banda del HERO queda OSCURA con este esquema? La decide el CONTRASTE real del fondo
 * derivado, no el NOMBRE del esquema — 'acento' puede ser claro u oscuro según el acento del
 * cliente (misma regla de `direccionDePiso` que usa el motor). Es la función que le falta al nav
 * (§ StoreNav): hoy asume el hero SIEMPRE oscuro (`isHome && !scrolled` → texto blanco); un hero con
 * esquema CLARO ('crema'/'superficie') dejaría el nav blanco sobre blanco sin este ajuste.
 *
 * SIN esquema (id ausente/null) = la CANÓNICA del hero, que es la raíz `tinta` (oscura) — el fondo
 * literal de hoy (`bg-[var(--sf-banda,var(--sf-tinta))]`), no `derivarEsquema('crema', …)`. Por eso
 * el fallback es `raices.tinta`, no `base.fondo`: son bandas con canónicas DISTINTAS (§ doctrina),
 * y esta función es específica del hero (la única banda cuyo nav lee su esquema).
 */
export function heroEsOscuro(
  id: EsquemaId | null | undefined,
  fondo: string | null,
  tinta: string | null,
  acento: string | null,
): boolean {
  const raices = raicesResueltas(fondo, tinta, acento);
  const bandaFondo = id ? derivarEsquema(raices, id).fondo : raices.tinta;
  return contraste('#ffffff', bandaFondo) >= contraste(raices.tinta, bandaFondo);
}
