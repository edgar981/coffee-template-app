import {
  LayoutDashboard, ShoppingCart, Package, Users, Warehouse,
  CreditCard, BarChart3, Zap, Store, Settings, User,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { IconAnim } from '@/components/admin/AnimatedIcon';

// THE single source of admin navigation: consumed by the Sidebar (rail + peek +
// mobile drawer) AND the command palette's static index, so a new section shows
// up in both by adding one entry. `anim` is the hover animation for the row.
export interface AdminNavItem {
  icon:       LucideIcon;
  label:      string;
  path:       string;
  anim:       IconAnim;
  ownerOnly?: boolean;
  /**
   * Sección del rail bajo la que agrupa el ítem. LISTA PLANA con tag, NO anidada:
   * los encabezados NO son elementos del array, así que no pueden volverse un
   * destino del ⌘K, y los consumidores planos (MobileNav, ⌘K, admin-titulo,
   * atención) lo IGNORAN sin tocarse — sólo el Sidebar lo lee para pintar el
   * encabezado. El agrupado es CONTIGUO: los ítems de una misma sección van
   * juntos en el orden del array. Sin `seccion` (Hoy) = sin encabezado.
   */
  seccion?:   string;
}

export const ADMIN_NAV: AdminNavItem[] = [
  // "Hoy", no "Dashboard": la etiqueta dice de qué trata la pantalla (el día), no el
  // nombre genérico del template. La RUTA se queda en `/admin/dashboard` —no hace falta
  // redirect, nada la referencia como etiqueta salvo esta línea—; la pestaña la deriva
  // `admin-titulo` de acá, así que también pasa a decir "Hoy".
  { icon: LayoutDashboard, label: 'Hoy',              path: '/admin/dashboard',        anim: 'lift' },
  // "Órdenes" SALIÓ: Pedidos absorbió sus flujos y la ruta se retiró. Lo que
  // quedaba apuntando a ella son las notificaciones ya escritas en la base, y de
  // ésas se encarga el redirect de `proxy.ts` — no un ítem de menú.
  //
  // LA SECCIÓN SE LLAMA "PEDIDOS" Y LA ENTIDAD SIGUE SIENDO "ORDEN", a propósito
  // (§ CLAUDE.md — el vocabulario del retiro). Unificar la entidad tocaría
  // `numero_orden`, el prefijo `CN-`, copy y probablemente datos: superficie
  // desproporcionada, y metida en el retiro lo habría convertido en un lío.
  { icon: ShoppingCart,    label: 'Pedidos',          path: '/admin/pedidos',          anim: 'cart', seccion: 'Operación' },
  { icon: Package,         label: 'Productos',        path: '/admin/productos',        anim: 'package', seccion: 'Operación' },
  // La convivencia viejo↔nuevo TERMINÓ: la pantalla vieja se retiró y la del
  // rediseño heredó la ruta. Era la última que quedaba (§ CLAUDE.md — el retiro
  // de Clientes), así que el menú vuelve a tener una entrada por sección.
  { icon: Users,           label: 'Clientes',         path: '/admin/clientes',         anim: 'users', seccion: 'Operación' },
  { icon: Warehouse,       label: 'Inventario',       path: '/admin/inventario',       anim: 'lift', seccion: 'Operación' },
  { icon: CreditCard,      label: 'Pagos',            path: '/admin/pagos',            anim: 'lift', seccion: 'Operación' },
  { icon: BarChart3,       label: 'Analítica',        path: '/admin/analitica',        anim: 'lift', seccion: 'Crecimiento' },
  { icon: Zap,             label: 'Automatizaciones', path: '/admin/automatizaciones', anim: 'lift', seccion: 'Crecimiento' },
];

/**
 * Un destino del panel que NO vive en el rail/la barra inferior, pero que sigue siendo una ruta de
 * verdad: tiene que titular su pestaña y aparecer en el ⌘K, igual que cualquier entrada de
 * `ADMIN_NAV` (§ PANEL-ESTRUCTURA-TIENDA-1, REDISENO.md § 3). Sin `seccion`/`ownerOnly`/`anim`: no
 * se pinta en el rail ni en la barra inferior, así que esos campos no tienen nada que gobernar acá.
 */
export interface DestinoFueraDelMenu {
  icon:  LucideIcon;
  label: string;
  path:  string;
}

/**
 * LOS DESTINOS FUERA DEL RAIL — la fuente ÚNICA de la que derivan `lib/admin-titulo.ts` (el título
 * de pestaña) y `CommandPalette.tsx` (el ⌘K), para que ninguno de los dos tenga su propia lista a
 * mano que pueda quedarse atrás de la otra (§ CLAUDE.md, el mismo criterio que ya rige `ADMIN_NAV`
 * para el resto del menú).
 *
 * - **Tienda** se entra desde el nombre del negocio en el rail (`NegocioMenu`), no desde una fila
 *   del menú — salió de `ADMIN_NAV` en esta tanda (§ PANEL-ESTRUCTURA-TIENDA-1).
 * - **Configuración** y **Mi perfil** ya vivían fuera del rail desde antes (se entran por el menú
 *   de usuario, `UserMenu`) — venían declaradas SÓLO en `lib/admin-titulo.ts` (`FUERA_DEL_NAV`) y
 *   AUSENTES del ⌘K, que sólo recorría `ADMIN_NAV`. Esta lista cierra ese hueco de una vez para
 *   las tres.
 */
export const DESTINOS_FUERA_DEL_MENU: DestinoFueraDelMenu[] = [
  { icon: Store,    label: 'Tienda',        path: '/admin/tienda' },
  { icon: Settings, label: 'Configuración', path: '/admin/configuracion' },
  { icon: User,     label: 'Mi perfil',     path: '/admin/perfil' },
];
