// ─── La lógica PURA de /admin/configuracion-por-bloques (§ PANEL-CONFIG-BLOQUES-1) ──────────────
//
// Configuración dejó de ser un formulario que abre todo a la vez: subsecciones a la izquierda
// (Negocio · Contacto y redes · Correos · Pagos y cobros · Equipo), cada bloque con su propio
// Editar/Cancelar/Guardar. Lo que decide QUÉ subsección corresponde a cada `?parte`, el PAYLOAD
// base que cada bloque reenvía sin tocar, y el TEXTO del cambio de rol vive acá — puro, sin React
// ni Prisma, para poder afirmarlo en `npm test` (capa 1) sin montar nada.
//
// Mismo criterio que `lib/metrics/titulares.ts`: la redacción y el ruteo SON la decisión de
// producto; un `if` cambiado dentro del JSX rompería "¿a qué subsección cae un enlace viejo?" o
// "¿qué dice el confirm al hacer dueño a alguien?" sin que nada lo notara.

import type { Role } from '@/types/admin';
// `import type` desde un módulo SIN `server-only` (el lector cacheado re-exporta el tipo del
// RAW): sólo viaja el TIPO, así que este archivo sigue siendo puro — mismo patrón que
// `DatosNegocioSeccion.tsx` ya usaba.
import type { SiteSettings } from '@/lib/config/site-settings';
import type { MetodoPagoGuardado } from '@/lib/checkout/metodos-pago';
import type { RedSocialGuardada } from '@/lib/config/site';

// ─── Subsecciones ─────────────────────────────────────────────────────────────────────────────

export type ParteConfiguracion = 'negocio' | 'contacto' | 'correos' | 'pagos' | 'equipo';

export interface ParteConfig {
  id:     ParteConfiguracion;
  label:  string;
  /** La bajada bajo el label, en el nav — lo que CONTIENE, no una promesa. */
  bajada: string;
}

// El orden ES el orden del nav — PARTE_DEFAULT es la primera, no una constante aparte que
// pudiera desalinearse. `NegocioMenu` ("Datos del negocio") y el resto de los enlaces a
// `/admin/configuracion` (UserMenu, MobileNav) no llevan `?parte=` — caen acá por default, que
// es exactamente dónde vivía la identidad del negocio antes de este slice.
export const PARTES_CONFIGURACION: ParteConfig[] = [
  { id: 'negocio',  label: 'Negocio',          bajada: 'Nombre, frase y pie' },
  { id: 'contacto', label: 'Contacto y redes', bajada: 'WhatsApp y redes sociales' },
  { id: 'correos',  label: 'Correos',          bajada: 'Desde dónde salen' },
  { id: 'pagos',    label: 'Pagos y cobros',   bajada: 'Cómo te pagan' },
  { id: 'equipo',   label: 'Equipo',           bajada: 'Quién entra al panel' },
];

export const PARTE_DEFAULT: ParteConfiguracion = PARTES_CONFIGURACION[0].id;

/**
 * El `?parte=` de la URL → una subsección válida, o el default. Un valor ausente, vacío o que no
 * matchea ninguna de las cinco cae al default — nunca una pantalla en blanco por un enlace viejo
 * o un typo en la URL.
 */
export function parteValida(valor: string | null | undefined): ParteConfiguracion {
  return PARTES_CONFIGURACION.some(p => p.id === valor) ? (valor as ParteConfiguracion) : PARTE_DEFAULT;
}

// ─── El payload BASE que cada bloque reenvía sin tocar ───────────────────────────────────────
//
// El write de SiteSetting es COMPLETO (§ CLAUDE.md "SiteSetting… no la trampa del PATCH
// parcial"): cada bloque manda el formulario ENTERO, con sólo SUS campos cambiados. Antes había
// un solo formulario que ya traía todo; partido en bloques, cada uno necesita la MISMA base —los
// valores de los otros cuatro bloques, sin tocar— para no pisarlos. Una función, no cuatro copias
// del mismo `{ nombre: settings.nombre, tagline: settings.tagline, … }`.

export interface PayloadSiteSettings {
  nombre:            string;
  tagline:           string;
  descripcionFooter: string;
  whatsapp:          string;
  instagram:         string;
  emailRemitente:    string;
  emailReplyTo:      string;
  adminEmail:        string;
  metodosPago:       MetodoPagoGuardado[];
  metodosPasarela:   string[];
  redes:             RedSocialGuardada[];
}

/**
 * `metodosPasarela` llega APARTE: no vive en `SiteSettings` (§ `site-settings-read.ts` — sólo
 * expone `metodoPasarelaDesalineado`, un derivado, nunca la lista guardada). Cada bloque la lee
 * con `useCuentaPasarela()` y la pasa acá tal cual, la toque o no — así NINGÚN bloque puede
 * vaciarla por accidente al guardar un campo que no es el suyo.
 */
export function payloadBaseDesdeSettings(settings: SiteSettings, metodosPasarela: string[]): PayloadSiteSettings {
  return {
    nombre:            settings.nombre,
    tagline:           settings.tagline,
    descripcionFooter: settings.descripcionFooter,
    whatsapp:          settings.whatsapp,
    instagram:         settings.instagram,
    emailRemitente:    settings.emailRemitente,
    emailReplyTo:      settings.emailReplyTo ?? '',
    adminEmail:        settings.adminEmail ?? '',
    metodosPago:       settings.metodosPago,
    metodosPasarela,
    redes:             settings.redes,
  };
}

// ─── Reparto de errores del schema — un bloque sólo puede HABLAR de sus propios campos ──────
//
// `siteSettingsEditableSchema` valida el payload COMPLETO (§ `payloadBaseDesdeSettings`), así que
// un dato inválido de OTRO bloque —por ejemplo un WhatsApp vacío en una fila recién migrada
// (§ CLAUDE.md "El código compartido no NACE siendo Nayoli": el INSERT neutro de la migración deja
// `whatsapp: ''`, y el `siteSettingsEditableSchema.whatsapp` exige un teléfono) — puede reventar
// la validación de un bloque que JAMÁS toca ese campo (Identidad, Correos). Antes de este reparto,
// cada bloque sólo sabía nombrar SUS campos (`if (campo in form) …`), así que un error "ajeno"
// caía al suelo: `errs` quedaba VACÍO, `setErrores(errs)` no pintaba nada, y Guardar se quedaba
// mudo — el operador clickeaba y no pasaba NADA, sin ninguna pista de por qué. `mapCampo` decide
// si un campo del wire pertenece a ESTE bloque (y a qué nombre de su form) o es AJENO; lo ajeno
// nunca se pierde: cae a `errorAjeno`, para que el bloque lo muestre en su error general en vez de
// callarlo.
export interface RepartoErrores<K extends string> {
  /** Errores de campos que ESTE bloque edita — van al estado `errores` de cada input. */
  propios:    Partial<Record<K, string>>;
  /** El primer error de un campo que este bloque NO edita — nunca `null` si hubo alguno así. */
  errorAjeno: string | null;
}

export function repartirErroresBloque<K extends string>(
  issues:   readonly { path: PropertyKey[]; message: string }[],
  mapCampo: (campoWire: string) => K | null,
): RepartoErrores<K> {
  const propios: Partial<Record<K, string>> = {};
  let errorAjeno: string | null = null;
  for (const issue of issues) {
    const campoWire  = String(issue.path[0]);
    const campoLocal = mapCampo(campoWire);
    if (campoLocal) {
      if (!propios[campoLocal]) propios[campoLocal] = issue.message;
    } else if (!errorAjeno) {
      errorAjeno = `Hay un dato pendiente en otra parte de Configuración que bloquea el guardado: ${issue.message}`;
    }
  }
  return { propios, errorAjeno };
}

// ─── Equipo — una sola fuente de descripciones de rol ────────────────────────────────────────
//
// Había TRES: `InviteUserModal.roleDescriptions`, `configuracion/page.tsx LEYENDA` y
// `perfil/page.tsx PERMISOS` — cada una con su propio texto para el mismo rol (§ diagnóstico,
// `docs/panel/REDISENO.md` #Configuración). Ésta es la que queda: la usan el bloque Equipo
// (leyenda de roles) y `InviteUserModal` (descripción bajo cada opción). `perfil/page.tsx` sigue
// con la suya — ese archivo no está en `touches:` de este slice (ver el reporte de cierre).

export const DESCRIPCION_ROL: Record<Role, string> = {
  OWNER:   'Todo, incluido el dinero, los medios de pago y quién entra al panel.',
  MANAGER: 'El día a día: pedidos, productos, clientes e inventario. No toca pagos ni equipo.',
  // STAFF ya no se OFRECE (ni para invitar — `ROLES_INVITABLES` — ni para reasignar —
  // `ROLES_ASIGNABLES`, abajo), pero el valor del enum se queda (append-only: hay filas y
  // sesiones que lo tienen) y su badge lo sigue mostrando — así que conserva su frase acá, por
  // si algún día vuelve a tener superficie propia (§ `ROLES_INVITABLES`, `packages/core/src/
  // usuarios.ts`).
  STAFF:   'Gestión de pedidos del día a día. Hoy no tiene superficie propia en el panel.',
};

/**
 * Los roles que el panel deja REASIGNAR a un miembro YA existente del equipo — distinto de
 * `ROLES_INVITABLES` (`packages/core/src/usuarios.ts`, sólo `['MANAGER']`: no se invita
 * directo como dueño). Acá SÍ entra `OWNER`: promover a alguien ya del equipo es el camino para
 * tener un segundo dueño. `STAFF` queda FUERA a propósito — es la corrección del diagnóstico:
 * ofrecerlo bajaba a alguien a un rol sin superficie en el panel (`ROLES_INVITABLES`, el mismo
 * motivo).
 */
export type RolAsignable = Extract<Role, 'OWNER' | 'MANAGER'>;

export const ROLES_ASIGNABLES: RolAsignable[] = ['OWNER', 'MANAGER'];

export interface ConfirmacionCambioRol {
  titulo:       string;
  consecuencia: string;
  confirmLabel: string;
}

/**
 * El texto del confirm al reasignar el rol de alguien YA en el equipo — nunca un `window.confirm`
 * mudo. Sin intentar adivinar género por nombre (no hay ese dato): "dueño o dueña" es la MISMA
 * frase que ya usa la tarjeta de leyenda del rol, no una apuesta.
 */
export function confirmacionCambioRol(nombre: string, nuevoRol: RolAsignable): ConfirmacionCambioRol {
  if (nuevoRol === 'OWNER') {
    return {
      titulo:       `¿Hacer dueño o dueña a ${nombre}?`,
      consecuencia: `${DESCRIPCION_ROL.OWNER} Tú sigues con el rol que ya tienes.`,
      confirmLabel: 'Sí, hacerlo dueño',
    };
  }
  return {
    titulo:       `¿Hacer gerente a ${nombre}?`,
    consecuencia: 'Deja de ver y cambiar el dinero, los medios de pago y quién entra al panel. '
      + 'Conserva el día a día: pedidos, productos, clientes e inventario.',
    confirmLabel: 'Sí, hacerlo gerente',
  };
}

// ─── Invitaciones pendientes — "¿cuánto le queda?" ───────────────────────────────────────────
//
// Movida de `configuracion/page.tsx` (vivía inline, sin test) — es la misma clase de decisión que
// el resto de este archivo: aproximada (la página no la recalcula sola) y parametrizada en
// `ahora` para que el carril/capa-1 pueda afirmar el borde del vencimiento sin depender del reloj
// real, el mismo patrón que `listarInvitacionesPendientes` (`lib/invitations.ts`).
export function venceEn(expiresAt: string | Date, ahora: Date = new Date()): string {
  const ms = new Date(expiresAt).getTime() - ahora.getTime();
  if (ms <= 0) return 'Vencida';
  const horas = Math.round(ms / 3_600_000);
  if (horas >= 24) {
    const dias = Math.round(horas / 24);
    return `Vence en ${dias} día${dias !== 1 ? 's' : ''}`;
  }
  if (horas >= 1) return `Vence en ${horas} h`;
  return 'Vence pronto';
}
