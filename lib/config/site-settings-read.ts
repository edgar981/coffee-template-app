import prisma from '@duna/core';
import { parseMetodosPago, type MetodoPagoGuardado } from '../checkout/metodos-pago';

/**
 * Config EDITABLE del negocio, resuelta a un objeto plano (serializable, para pasar
 * del server layout al provider cliente). Sólo los campos PLANOS — los estructurados
 * (`emailColors`, `footerNav`, `legalNav`) siguen en `siteConfig` (código) en v1.
 */
export interface SiteSettings {
  nombre:            string;
  tagline:           string;
  descripcionFooter: string;
  whatsapp:          string;
  instagram:         string;
  emailRemitente:    string;
  emailReplyTo:      string | null;
  adminEmail:        string | null;
  // Los métodos de pago del checkout — LISTA (§ PAGOS-METODOS-MODELO-1), ya pasada por
  // `parseMetodosPago` (SOFT): nadie fuera de este loader lee el JSON crudo de la columna.
  // Reemplaza los 9 campos viejos (los 4 booleanos + el número móvil + los 4 de banco).
  metodosPago: MetodoPagoGuardado[];
  // La PALETA ya no está acá: se mudó a `SiteContent.content.tema` (§ Backlog #55). El storefront
  // la lee de `getSiteContent()`, no de este loader.
  //
  // § API-DIRECTA-DESALINEO-DUENO-1: el TIPO de método de pasarela que Wompi rechazó por no
  // tenerlo habilitado en la cuenta (`PaymentIntent.metodo_rechazado`), o `null` si no hay
  // ninguno VIGENTE. No es un campo de `SiteSetting` — vive en `PaymentIntent` (es estado de
  // UN INTENTO, no un ajuste del negocio) — pero viaja acá para que el aviso del Dashboard
  // (`lib/config/avisos-configuracion.ts`, #9) lo reciba SIN que su call site
  // (`app/(admin)/admin/dashboard/page.tsx`) tenga que cambiar: ya recibe `SiteSettings`
  // completo como cuarto argumento de `avisosDeConfiguracion`.
  //
  // "VIGENTE" = el tipo rechazado SIGUE en `SiteSetting.metodosPasarela` (lo que el dueño
  // ofrece HOY) — ver `metodoPasarelaDesalineado`, abajo, para el porqué de ese cruce y su
  // límite conocido.
  metodoPasarelaDesalineado: string | null;
}

/**
 * El lector RAW de la config del negocio. FALLA RUIDOSO si la fila no existe —SIN
 * fallback a los valores de código—. Un fallback mostraría datos rancios sin que nada
 * falle, que es el peor modo (§ discovery). La fila la garantiza la migración (INSERT),
 * así que su ausencia es un deploy roto y debe fallar fuerte.
 *
 * Vive acá, SIN `server-only` ni `react/cache`, a propósito: lo consumen contextos que
 * NO son renders —route handlers, el motor de automatizaciones y el CARRIL de
 * integración (tsx/node)—, donde `server-only` no resuelve y `cache()` no aplica. El
 * wrapper cacheado para RENDERS (layouts, páginas) es `getSiteSettings` en
 * `site-settings.ts`, que envuelve a éste. Una sola query, dos entradas por contexto.
 */
// § API-DIRECTA-DESALINEO-DUENO-1 — parseo mínimo del JSONB crudo, MISMO patrón que
// `guardadoDesde`/`metodosGuardadosDesde` (`app/api/pasarela/metodos/route.ts`,
// `app/api/checkout/route.ts`): ninguno de esos dos archivos exporta el suyo (son locales a
// un route handler), así que se repite acá en vez de importar de una ruta.
function metodosPasarelaGuardados(valor: unknown): string[] {
  return Array.isArray(valor) ? valor.filter((v): v is string => typeof v === 'string') : [];
}

/**
 * El tipo de método de pasarela que Wompi rechazó y que SIGUE ofreciendo el dueño — o `null`
 * si no hay ninguno así. Cruza `PaymentIntent.metodo_rechazado` contra `metodosOfrecidos`
 * (`SiteSetting.metodosPasarela`, YA leído por `readSiteSettings`, sin una segunda query a esa
 * tabla): el filtro `IN` es lo que hace que "el dueño quita el método de lo que ofrece" apague
 * el aviso solo, sin un botón de "ya lo vi" — y lo que acota la consulta a, como mucho,
 * `metodosOfrecidos.length` valores (nunca al tamaño de `PaymentIntent`, ver el índice
 * compuesto en `schema.prisma`).
 *
 * LÍMITE CONOCIDO, declarado: esto NO detecta "la cuenta del proveedor recuperó el método sin
 * que el dueño toque nada" — exigiría una consulta en vivo al proveedor
 * (`consultarMetodosAceptados`, `lib/pagos/wompi-api.ts`, fuera de `touches` de este slice) o
 * rastrear el tipo de CADA transacción exitosa (un segundo campo que el spec no pidió: "un
 * campo propio", singular). Queda como open_followup, no como promesa incumplida en silencio.
 */
async function metodoPasarelaDesalineadoVigente(metodosOfrecidos: string[]): Promise<string | null> {
  if (metodosOfrecidos.length === 0) return null;
  const intento = await prisma.paymentIntent.findFirst({
    where:   { metodo_rechazado: { in: metodosOfrecidos } },
    orderBy: { updatedAt: 'desc' },
    select:  { metodo_rechazado: true },
  });
  return intento?.metodo_rechazado ?? null;
}

export async function readSiteSettings(): Promise<SiteSettings> {
  const s = await prisma.siteSetting.findUniqueOrThrow({ where: { id: 'default' } });
  const metodosPasarelaOfrecidos = metodosPasarelaGuardados(s.metodosPasarela);
  const metodoPasarelaDesalineado = await metodoPasarelaDesalineadoVigente(metodosPasarelaOfrecidos);
  return {
    nombre:            s.nombre,
    tagline:           s.tagline,
    descripcionFooter: s.descripcionFooter,
    whatsapp:          s.whatsapp,
    instagram:         s.instagram,
    emailRemitente:    s.emailRemitente,
    emailReplyTo:      s.emailReplyTo,
    adminEmail:        s.adminEmail,
    metodosPago:       parseMetodosPago(s.metodosPago),
    metodoPasarelaDesalineado,
  };
}
