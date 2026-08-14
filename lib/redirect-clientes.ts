// ─── EL REDIRECT DE CLIENTES ─────────────────────────────────────────────────
//
// La pantalla vieja de Clientes se retiró y la nueva —que vivía en
// `/admin/clientes-v2` mientras convivían— se quedó con `/admin/clientes`. Esta
// función traduce las dos poblaciones de enlaces viejos al vocabulario nuevo.
//
// ── MÓDULO APARTE DEL DE ÓRDENES, A PROPÓSITO ───────────────────────────────
//
// No comparten nada salvo la MECÁNICA (función pura + `proxy.ts` + 307 + nunca
// 404). Los vocabularios son distintos y fusionarlos daría un módulo que tiene
// que conocer los dos para decidir cuál aplica — que es exactamente el tipo de
// helper que después nadie se atreve a tocar.
//
// ── QUIÉN LO NECESITA, Y ES DISTINTO DE LA VEZ ANTERIOR ─────────────────────
//
// El retiro de `/admin/ordenes` lo necesitaba por `Notification.href`, una
// columna con enlaces CONGELADOS en la base. Acá esa población es CERO y no puede
// crecer: se midió (8 notificaciones, ninguna de cliente) y `AUTOMATION_HREF` no
// tiene entrada de cliente, así que ninguna puede escribirse.
//
// La población que sí existe está en el NAVEGADOR. El ⌘K persiste sus recientes
// en `localStorage` bajo `admin:cmdk-recents`, y ahí el `href` es a la vez el
// dato guardado y la CLAVE DE DEDUPE (`components/admin/CommandPalette.tsx`). Un
// cliente elegido por ⌘K antes del retiro deja `/admin/clientes/<id>` guardado en
// la máquina de ese operador — sin backfill posible, porque no es nuestra base.
//
// Es la misma población que el retiro anterior cubrió sin nombrarla. Queda
// nombrada acá para que el próximo retiro no tenga que redescubrirla.
//
// ── NUNCA 404 ────────────────────────────────────────────────────────────────
//
// Lo que no se sabe traducir se descarta y el operador aterriza en la lista sin
// filtro. El que llega venía de un enlace que funcionaba; una lista de más se
// vuelve a filtrar, un 404 lo deja sin nada.

/** La ruta que la pantalla nueva heredó. Es destino, y también origen. */
export const RUTA_CLIENTES = '/admin/clientes';

/** La ruta de convivencia, que muere con el retiro. */
export const RUTA_V2 = '/admin/clientes-v2';

/**
 * Traduce el query de la pantalla vieja al de la nueva.
 *
 * Devuelve el `search` armado (sin `?`), o `''` cuando no queda nada — que es el
 * caso "cae a la lista sin filtro".
 */
export function traducirQueryDeClientes(entrada: URLSearchParams): string {
  const salida = new URLSearchParams();

  // `?recurrentes=1` → el carril `recurrentes`, que es el MISMO predicado
  // (`esRecurrente`) expresado como carril en vez de como recorte por parámetro.
  //
  // Se TRADUCE y no se soporta como alias permanente (owner): el widget del
  // dashboard que lo emitía es código y se migró, así que lo único que queda es
  // algún marcador viejo — y de ése se encarga esto. La pantalla nueva habla un
  // solo vocabulario.
  if (entrada.get('recurrentes') === '1') salida.set('f', 'recurrentes');

  // Éstos la pantalla nueva ya los entiende TAL CUAL: son su carril y su
  // selección. Viajan sin tocarse, que es lo que hace que un enlace a
  // `/admin/clientes-v2?f=atencion&cliente=…` siga siendo exacto.
  for (const clave of ['f', 'cliente'] as const) {
    const valor = entrada.get(clave);
    if (valor) salida.set(clave, valor);
  }

  return salida.toString();
}

/**
 * La URL de destino, o `null` si esta petición no hay que redirigirla.
 *
 * ── LAS TRES TRAMPAS DE ESTE MAPEO ──────────────────────────────────────────
 *
 * 1. **`/admin/clientes-v2` EMPIEZA por `/admin/clientes`.** Un `startsWith` a
 *    secas lo trata como subruta y lo manda a `?cliente=-v2`. Es el mismo bug de
 *    caracteres-contra-segmentos que el rail ya pagó (`/admin/clientes-v2`
 *    encendía también la entrada de `/admin/clientes`), así que acá la
 *    comparación es por SEGMENTO y `-v2` es su propio caso, evaluado primero.
 *
 * 2. **`/admin/clientes` pelado NO se redirige: ES el destino.** Devolver una URL
 *    para él sería un BUCLE INFINITO — el middleware corre en cada request,
 *    incluido el que él mismo provoca. Por eso la regla es *redirigir sólo si hay
 *    algo que traducir*, y `null` cuando no lo hay.
 *
 * 3. **Prefijos disjuntos con el redirect de órdenes.** Ninguna ruta puede
 *    matchear los dos, así que el orden en que `proxy.ts` los llama no importa.
 *    Afirmado en los dos tests.
 */
export function destinoDesdeClientes(pathname: string, search: URLSearchParams): string | null {
  const query = traducirQueryDeClientes(search);
  const conQuery = (base: string) => (query ? `${base}?${query}` : base);

  // ── La ruta de convivencia, y cualquier cosa colgando de ella.
  if (pathname === RUTA_V2 || pathname.startsWith(`${RUTA_V2}/`)) {
    return conQuery(RUTA_CLIENTES);
  }

  // ── El PERFIL: `/admin/clientes/<id>` → `?cliente=<id>`.
  //
  // La barra es lo que hace que esto sea jerarquía de rutas y no comparación de
  // caracteres. El id se toma como UN segmento: `/admin/clientes/abc/def` no es
  // un perfil que existiera, así que su "id" sería basura — cae a la lista.
  if (pathname.startsWith(`${RUTA_CLIENTES}/`)) {
    const resto = pathname.slice(RUTA_CLIENTES.length + 1);
    const id = resto.includes('/') ? '' : resto;
    if (!id) return conQuery(RUTA_CLIENTES);
    // La selección del path GANA sobre un `?cliente=` del query: el que escribió
    // esa URL estaba pidiendo ESE perfil, y el query es a lo sumo un resto.
    const q = new URLSearchParams(query);
    q.set('cliente', decodeURIComponent(id));
    return `${RUTA_CLIENTES}?${q.toString()}`;
  }

  // ── La lista: sólo si trae algo que traducir. Si no, `null` (ver trampa 2).
  if (pathname === RUTA_CLIENTES) {
    return search.get('recurrentes') ? conQuery(RUTA_CLIENTES) : null;
  }

  return null;
}
