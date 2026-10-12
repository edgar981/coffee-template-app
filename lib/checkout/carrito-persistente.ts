// CHECKOUT-LISTO-PARA-VENDER-1 — el carrito sobrevive a una recarga, y a volver desde la app
// del banco o de Nequi: hoy (`lib/cartStore.tsx`) es `useState` puro, así que recargar
// `/checkout` —o volver de un pago PSE pendiente— lo vacía en silencio (§ el reporte del
// slice, § `paginas-pendientes.md` §2.1). Este módulo es la mitad PURA de la persistencia:
// decide QUÉ se guarda y si lo guardado sigue siendo válido, sin tocar `localStorage`
// directamente en los tests (se inyecta un storage, nunca el real).
//
// VERSIÓN + CADUCIDAD, a propósito: un carrito de HACE DÍAS no debería reaparecer silencioso
// un `CartItem` es un snapshot de `Product` al momento de agregarlo (precio, nombre, imagen…)
// — si el producto cambió de precio entre medio, restaurarlo mostraría un precio viejo sin que
// nadie lo note. `V_CARRITO_PERSISTIDO` permite invalidar TODO lo guardado el día que la forma
// del snapshot cambie (un campo nuevo de `Product`, por ejemplo) sin tener que migrar nada —
// una versión vieja simplemente no se restaura.
//
// TOLERANTE A QUE NO EXISTA EL STORAGE: `localStorage` puede lanzar (navegación privada,
// política de cookies, un storage lleno) o simplemente no estar definido (SSR, el primer
// render del lado del servidor). Ninguna de las dos funciones de abajo lanza jamás — guardar
// que falla es, como mucho, perder la persistencia; restaurar que falla es, como mucho, un
// carrito vacío, nunca un checkout roto.

export const CLAVE_CARRITO_PERSISTIDO = 'duna:carrito:v1';

/** Forma mínima y agnóstica de `CartItem` — este módulo no importa `types/product` a
 *  propósito (evitaría acoplar la PERSISTENCIA a la forma exacta del catálogo); el storage
 *  guarda y devuelve lo que `cartStore.tsx` le entregue, tal cual, mientras sea JSON-serializable. */
export type ItemCarritoPersistible = Record<string, unknown>;

export interface CarritoPersistido {
  v: number;
  /** `Date.now()` al momento de guardar — la base de la caducidad. */
  guardadoEn: number;
  items: ItemCarritoPersistible[];
  /** El departamento elegido en el cajón del carrito (§ CHECKOUT-LISTO-PARA-VENDER-1, el
   *  selector de envío del cajón) — sobrevive junto con los items para que el checkout no
   *  tenga que volver a pedirlo. `null` = todavía no elegido. */
  departamento: string | null;
}

/** 7 días — un carrito de la semana pasada es, casi siempre, una decisión de compra que ya
 *  caducó (precios, stock y presentaciones pueden haber cambiado), y restaurarlo sin aviso
 *  sería peor que empezar de cero. `TODO(cliente)`: el valor es un placeholder razonable, no
 *  una medición del negocio. */
export const TTL_CARRITO_PERSISTIDO_MS = 7 * 24 * 60 * 60 * 1000;

interface StorageLike {
  getItem(clave: string): string | null;
  setItem(clave: string, valor: string): void;
  removeItem(clave: string): void;
}

/** El storage REAL del navegador, resuelto perezosamente para que el módulo se pueda importar
 *  en un entorno sin `window` (SSR, los tests de este mismo archivo) sin lanzar al cargar. */
function storageDelNavegador(): StorageLike | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    // Navegación privada/bloqueada en algunos navegadores hace que acceder a
    // `window.localStorage` LANCE, no que devuelva `undefined`.
    return null;
  }
}

/** Guarda el carrito. Nunca lanza: un storage ausente o que lanza al escribir (lleno,
 *  bloqueado) sólo significa que esta sesión no persiste — el carrito en memoria sigue
 *  funcionando igual. */
export function guardarCarrito(
  items: ItemCarritoPersistible[],
  departamento: string | null,
  storage: StorageLike | null = storageDelNavegador(),
): void {
  if (!storage) return;
  const payload: CarritoPersistido = { v: 1, guardadoEn: Date.now(), items, departamento };
  try {
    storage.setItem(CLAVE_CARRITO_PERSISTIDO, JSON.stringify(payload));
  } catch {
    // Storage lleno o bloqueado a mitad de sesión — se ignora, no se propaga.
  }
}

/** Vacía la persistencia — se llama al confirmar el pedido (§ el spec: "se vacía al confirmar
 *  el pedido"), para que un comprador que vuelve a `/tienda` no reciba de regreso un carrito
 *  que ya compró. Nunca lanza. */
export function limpiarCarritoPersistido(
  storage: StorageLike | null = storageDelNavegador(),
): void {
  if (!storage) return;
  try {
    storage.removeItem(CLAVE_CARRITO_PERSISTIDO);
  } catch {
    // Sin storage que limpiar — no-op.
  }
}

export interface CarritoRestaurado {
  items: ItemCarritoPersistible[];
  departamento: string | null;
}

const CARRITO_VACIO: CarritoRestaurado = { items: [], departamento: null };

/**
 * Restaura el carrito si: el storage existe y responde, hay algo guardado, su forma es la
 * esperada (`v`/`items`/`guardadoEn` con los tipos correctos), SU VERSIÓN coincide con la
 * actual, y no superó `TTL_CARRITO_PERSISTIDO_MS` desde que se guardó. Cualquier otro caso
 * —storage ausente, JSON roto, versión vieja, caducado— devuelve el carrito VACÍO, nunca
 * lanza: un dato corrupto no puede tumbar el checkout, sólo puede dejarlo donde ya estaba
 * (sin carrito restaurado).
 */
export function restaurarCarrito(
  storage: StorageLike | null = storageDelNavegador(),
  ahora: number = Date.now(),
): CarritoRestaurado {
  if (!storage) return CARRITO_VACIO;
  let crudo: string | null;
  try {
    crudo = storage.getItem(CLAVE_CARRITO_PERSISTIDO);
  } catch {
    return CARRITO_VACIO;
  }
  if (!crudo) return CARRITO_VACIO;

  let parsed: unknown;
  try {
    parsed = JSON.parse(crudo);
  } catch {
    return CARRITO_VACIO;
  }
  if (!parsed || typeof parsed !== 'object') return CARRITO_VACIO;

  const payload = parsed as Partial<CarritoPersistido>;
  if (payload.v !== 1) return CARRITO_VACIO;
  if (typeof payload.guardadoEn !== 'number') return CARRITO_VACIO;
  if (!Array.isArray(payload.items)) return CARRITO_VACIO;
  if (ahora - payload.guardadoEn > TTL_CARRITO_PERSISTIDO_MS) return CARRITO_VACIO;

  const departamento = typeof payload.departamento === 'string' ? payload.departamento : null;
  return { items: payload.items as ItemCarritoPersistible[], departamento };
}
