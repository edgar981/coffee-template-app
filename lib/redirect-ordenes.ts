// ─── EL REDIRECT DE LA PANTALLA RETIRADA ─────────────────────────────────────
//
// `/admin/ordenes` se retiró y `/admin/pedidos` habla otro vocabulario de URL.
// Esta función traduce el uno al otro.
//
// ── POR QUÉ EXISTE, Y POR QUÉ NO PUEDE FALLAR ────────────────────────────────
//
// No es cortesía para un enlace viejo que alguien tenga en un marcador: hay
// enlaces CONGELADOS EN LA BASE. `Notification.href` es una columna `String` que
// se escribe al crear cada notificación y no se vuelve a tocar — medido en
// `development` el día del retiro: 8 notificaciones, 4 apuntando a
// `/admin/ordenes?order=`. No hay backfill que las arregle, así que el día que la
// ruta muere, la mitad de la campana deja de llevar a ningún lado.
//
// Por eso el redirect entra ANTES o EN EL MISMO deploy que el borrado, nunca
// después: el momento en que la ruta muere es exactamente el momento en que esas
// filas lo necesitan.
//
// ── NUNCA 404 ────────────────────────────────────────────────────────────────
//
// Un parámetro que no se sabe traducir se DESCARTA y el operador aterriza en la
// lista sin filtro. Es peor mostrar un error que una lista de más: el que llega
// acá venía de un enlace que funcionaba, y la lista siempre puede volver a
// filtrarse a mano. Un 404 lo deja sin nada.
//
// ── ES UNA FUNCIÓN PURA, Y `proxy.ts` SÓLO LA LLAMA ──────────────────────────
//
// La traducción es la decisión; el middleware es plomería. Separadas, cada mapeo
// se afirma en la capa 1 —incluido el caso del parámetro desconocido— sin montar
// un request. Mismo criterio que `datosDelPatch` o `estadoEntrega`.

/** La ruta retirada. Exportada para que `proxy.ts` no la re-teclee. */
export const RUTA_RETIRADA = '/admin/ordenes';

/** A dónde va todo lo que llegue a la retirada. */
export const RUTA_DESTINO = '/admin/pedidos';

/**
 * Traduce el query de `/admin/ordenes` al de `/admin/pedidos`.
 *
 * Devuelve el `search` ya armado (sin `?`), o `''` cuando no queda nada que
 * conservar — que es el caso "cae a la lista sin filtro".
 */
export function traducirQueryDeOrdenes(entrada: URLSearchParams): string {
  const salida = new URLSearchParams();

  // `?order=CN-123` → `?pedido=CN-123`. Es el ÚNICO que llevan las notificaciones
  // congeladas, así que es el que de verdad importa. Por NÚMERO en los dos
  // vocabularios; lo que cambia es el nombre de la clave.
  const orden = entrada.get('order');
  if (orden) salida.set('pedido', orden);

  // `?cobrar=1` → el carril `por_cobrar`, que es la MISMA definición
  // (`isPorCobrar`) expresada como carril en vez de como recorte por parámetro.
  //
  // `?cobrar=0` NO se traduce, y es una ausencia deliberada: significaba
  // "pendiente MENOS por-cobrar", el recorte del widget "Órdenes Pendientes" que
  // en #47 cambió de pregunta a "Necesitan atención". Ya no existe conjunto que
  // lo reproduzca, y mandarlo a `f=atencion` sería afirmar que son lo mismo
  // cuando no lo son. Cae a la lista.
  if (entrada.get('cobrar') === '1') salida.set('f', 'por_cobrar');

  // Éstos la pantalla nueva ya los entiende TAL CUAL desde #47 —son sus alcances
  // de cobro y de fecha— así que viajan sin tocarse. Es lo que permite que los
  // tres buckets de cartera de Analítica sigan siendo exactos aunque cambien de
  // destino: su query nunca se reescribió.
  for (const clave of ['estado', 'desde', 'hasta'] as const) {
    const valor = entrada.get(clave);
    if (valor) salida.set(clave, valor);
  }

  return salida.toString();
}

/**
 * La URL de destino completa, o `null` si esta petición no es para la ruta
 * retirada.
 *
 * `null` y no una URL igual a la de entrada: quien llama debe poder distinguir
 * "no me toca" de "te devuelvo lo mismo", que es lo que evita un bucle de
 * redirects si algún día el destino cambiara.
 */
export function destinoDesdeOrdenes(pathname: string, search: URLSearchParams): string | null {
  // Exacta o con subruta (`/admin/ordenes/lo-que-sea`): la pantalla vieja no tenía
  // subrutas, así que cualquier cosa colgando de ahí es un enlace inventado o un
  // typo — y también aterriza en la lista en vez de en un 404.
  const esLaRetirada = pathname === RUTA_RETIRADA || pathname.startsWith(`${RUTA_RETIRADA}/`);
  if (!esLaRetirada) return null;

  const query = traducirQueryDeOrdenes(search);
  return query ? `${RUTA_DESTINO}?${query}` : RUTA_DESTINO;
}
