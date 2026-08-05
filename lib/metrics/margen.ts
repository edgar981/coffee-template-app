// Margen por SKU — las reglas puras detrás del bloque RENTABILIDAD de Analítica.
//
// EL COSTO NO ESTÁ SNAPSHOTEADO. `OrderItem` guarda `precio_unitario` y
// `subtotal`, pero no el costo del producto al momento de la venta (ver el
// schema). El margen histórico se calcula por tanto contra `Product.costo`
// ACTUAL: si el costo cambió desde que se vendió, el margen de esa venta se
// recalcula con el costo de hoy. Es una APROXIMACIÓN aceptada a esta escala, y
// por eso la página lo declara ("margen estimado con costo actual") en vez de
// presentarlo como un hecho contable. La salida real —una columna
// `costo_unitario` en `OrderItem`, migración aditiva— está propuesta como mejora
// futura, no ejecutada.
//
// SOBRE MERCANCÍA, SIN ENVÍO. Los ingresos que entran acá son suma de
// `OrderItem.subtotal`, no de `Payment.monto`: el pago incluye el costo de envío
// y el costo de la mercancía no lo incluye, así que restar uno del otro inflaría
// el margen por cada despacho. El envío es un costo trasladado, no utilidad.
//
// PURO: sin Prisma, sin fechas, sin `server-only`. El endpoint lo llama sobre
// filas ya agregadas en SQL y la página renderiza el resultado — las dos mitades
// comparten estas funciones para que el total del header y las filas de la tabla
// no puedan discrepar.

/** Línea vendida, ya agregada por producto en SQL. */
export interface LineaVendida {
  /** FK al producto. NULLABLE en el schema: hay líneas históricas sin ella. */
  productoId:     string | null;
  /** Snapshot del nombre en la línea — lo que se vendió, exista o no hoy. */
  productoNombre: string;
  unidades:       number;
  ingresos:       number;
}

/** Costo actual de un producto del catálogo. */
export interface CostoProducto {
  id:     string;
  nombre: string;
  costo:  number;
}

/** Una fila de la tabla de rentabilidad: un SKU con costo resoluble. */
export interface FilaMargen {
  /** Id del producto — el deep link de la fila. Siempre presente en una fila. */
  productoId:     string;
  producto:       string;
  unidades:       number;
  ingresos:       number;
  costoTotal:     number;
  margenTotal:    number;
  /** Margen por unidad. `null` sin unidades (no se divide por cero). */
  margenUnitario: number | null;
  /** Margen como % de los ingresos. `null` si los ingresos son 0. */
  margenPct:      number | null;
}

/**
 * Lo que NO se pudo costear: líneas cuya FK es nula y cuyo nombre no resuelve a
 * un producto único del catálogo.
 *
 * NO se cuelan como filas con costo 0. Un costo 0 se renderiza como margen 100%
 * y es la mentira más cara que puede decir esta página: convierte un dato que
 * falta en la mejor noticia del mes. Se declaran aparte, con su monto, para que
 * el operador sepa cuánta plata queda fuera del cálculo.
 */
export interface ResidualMargen {
  productos: number;
  unidades:  number;
  ingresos:  number;
}

export interface ResumenMargen {
  /** Filas costeables, ORDENADAS por margen total desc (plata dejada). */
  filas:       FilaMargen[];
  /** Ingresos de las filas costeables — NO incluye el residual. */
  ingresos:    number;
  costo:       number;
  margenTotal: number;
  margenPct:   number | null;
  residual:    ResidualMargen;
}

/**
 * Índice nombre → costo, con la AMBIGÜEDAD marcada.
 *
 * `Product.nombre` no es único (solo `slug` y `sku` lo son). Dos productos
 * homónimos con costos distintos hacen que el match por nombre sea una moneda al
 * aire, así que ese nombre se marca ambiguo y sus líneas caen al residual — el
 * mismo criterio del `null` de `sugerirZona`: preferir callar a adivinar mal.
 */
function indicePorNombre(costos: CostoProducto[]): Map<string, CostoProducto | null> {
  const porNombre = new Map<string, CostoProducto | null>();
  for (const p of costos) {
    // `has` y no `get`: un nombre ya marcado ambiguo (valor `null`) debe seguir
    // ambiguo aunque aparezca una tercera vez.
    porNombre.set(p.nombre, porNombre.has(p.nombre) ? null : p);
  }
  return porNombre;
}

/**
 * Agrega las líneas vendidas en filas costeadas + un residual declarado.
 *
 * La resolución del costo va por dos caminos, en orden: la FK (`productoId`) y,
 * si falta, el nombre exacto contra el catálogo. Lo que no resuelve por ninguno
 * de los dos NO se descarta en silencio — se suma al residual.
 *
 * El ORDEN es por margen total descendente, no por unidades ni por ingresos: la
 * pregunta del bloque es "¿estoy ganando?", y el producto que más plata deja no
 * es necesariamente el que más se vende. Ese reordenamiento es el rediseño.
 */
export function agregarMargenPorSku(
  lineas: LineaVendida[],
  costos: CostoProducto[],
): ResumenMargen {
  const porId     = new Map(costos.map(p => [p.id, p]));
  const porNombre = indicePorNombre(costos);

  const acumulado = new Map<string, { producto: CostoProducto; unidades: number; ingresos: number }>();
  const residual  = { nombres: new Set<string>(), unidades: 0, ingresos: 0 };

  for (const l of lineas) {
    const producto = (l.productoId ? porId.get(l.productoId) : undefined)
      ?? porNombre.get(l.productoNombre)
      ?? null;

    if (!producto) {
      residual.nombres.add(l.productoNombre);
      residual.unidades += l.unidades;
      residual.ingresos += l.ingresos;
      continue;
    }

    // La clave es el ID del producto RESUELTO, no el nombre de la línea: dos
    // líneas del mismo producto —una con FK, otra resuelta por nombre— son el
    // mismo SKU y tienen que sumar en la misma fila.
    const previo = acumulado.get(producto.id);
    if (previo) {
      previo.unidades += l.unidades;
      previo.ingresos += l.ingresos;
    } else {
      acumulado.set(producto.id, { producto, unidades: l.unidades, ingresos: l.ingresos });
    }
  }

  const filas: FilaMargen[] = [...acumulado.values()].map(({ producto, unidades, ingresos }) => {
    const costoTotal  = producto.costo * unidades;
    const margenTotal = ingresos - costoTotal;
    return {
      productoId:     producto.id,
      producto:       producto.nombre,
      unidades,
      ingresos,
      costoTotal,
      margenTotal,
      margenUnitario: unidades > 0 ? margenTotal / unidades : null,
      margenPct:      ingresos > 0 ? (margenTotal / ingresos) * 100 : null,
    };
  });

  // Desempate por nombre: dos SKUs con el mismo margen deben salir siempre en el
  // mismo orden, o la tabla "cambia" entre recargas sin que nada haya pasado.
  filas.sort((a, b) => b.margenTotal - a.margenTotal || a.producto.localeCompare(b.producto));

  const ingresos    = filas.reduce((s, f) => s + f.ingresos, 0);
  const costo       = filas.reduce((s, f) => s + f.costoTotal, 0);
  const margenTotal = ingresos - costo;

  return {
    filas,
    ingresos,
    costo,
    margenTotal,
    margenPct: ingresos > 0 ? (margenTotal / ingresos) * 100 : null,
    residual: {
      productos: residual.nombres.size,
      unidades:  residual.unidades,
      ingresos:  residual.ingresos,
    },
  };
}
