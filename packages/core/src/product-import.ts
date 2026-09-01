import prisma from '@duna/core';
import type { ActorRef } from '@duna/core/inventory';
import { crearProductoConAsiento, slugDeNombre } from '@duna/core/product-update';

// ─── Import de catálogo ──────────────────────────────────────────────────────
// El caso real: montar la tienda de un prospecto con SU catálogo copiado a mano
// (Instagram, un menú, una lista de WhatsApp), no un export limpio. Sólo `nombre` y
// `categoria` son necesarios para que un producto exista (§ el modelo: `precio` cae a
// 0, `imagen` a '' → placeholder, el slug se deriva del nombre, moliendas null →
// agrega directo). El resto de columnas es opcional.

/** Una fila del import — lo que la grilla recolectó. */
export interface FilaImport {
  nombre:       string;
  categoria:    string;
  precio?:      number | string;
  sku?:         string;
  stock?:       number | string;
  descripcion?: string;
}

export type EstadoFilaImport = 'creada' | 'omitida' | 'error';

/**
 * El resultado POR FILA, en la forma que la grilla pinta SIN adivinar:
 * - `fila`   ubica la fila en la grilla (índice 0-based, MISMO orden que se envió);
 * - `estado` decide el color (creada = ok, omitida = ya existía, error = falló);
 * - `motivo` es la frase para el operador (omitida/error);
 * - `slug`/`productoId` cuando aplican.
 * Una fila del input = un resultado; `resultados` sigue el orden de `filas`.
 */
export interface ResultadoFilaImport {
  fila:        number;
  estado:      EstadoFilaImport;
  nombre:      string;
  slug?:       string;
  productoId?: string;
  motivo?:     string;
}

export interface ResumenImport {
  creadas:  number;
  omitidas: number;
  errores:  number;
}

export interface ResultadoImport {
  resultados: ResultadoFilaImport[];
  resumen:    ResumenImport;
}

/**
 * Procesa las filas, CADA UNA independiente (ÉXITO PARCIAL): una fila que falla no
 * aborta las demás — la fila 7 de 40 mala deja entrar a las otras 39, y ella vuelve
 * en `resultados` con su motivo para corregir. Abortar todo por un typo es hostil a
 * un catálogo tecleado.
 *
 * DEDUP POR SLUG derivado del nombre con `slugDeNombre` —LA MISMA que el alta manual,
 * no una segunda implementación—: si ya existe un producto con ese slug, la fila se
 * OMITE (ni duplica ni revienta), así reimportar el mismo catálogo es seguro. El bucle
 * es SECUENCIAL a propósito: dos filas del mismo nombre en el MISMO lote → la primera
 * crea, la segunda ya la encuentra y omite (el create commitea antes de la siguiente
 * vuelta). El `catch` del P2002 es la red por si algo se cuela.
 *
 * Crea con `crearProductoConAsiento`, así que cada producto nace con su asiento
 * inaugural (el kardex arranca en cero) y con `imagen: ''` → placeholder (§ el fix del
 * commit 1: un producto sin foto ya no se ve roto).
 *
 * Vive acá y no en el route handler por el criterio de siempre: el carril no monta
 * HTTP, y la única forma de afirmar el éxito parcial + el dedup contra una base real es
 * que sea una función (ver tests/integracion/import-catalogo.test.ts).
 */
export async function procesarFilasImport(
  filas: FilaImport[],
  actor?: ActorRef,
): Promise<ResultadoImport> {
  const resultados: ResultadoFilaImport[] = [];
  let creadas = 0, omitidas = 0, errores = 0;

  const fallo = (i: number, nombre: string, motivo: string, slug?: string) => {
    resultados.push({ fila: i, estado: 'error', nombre, slug, motivo });
    errores++;
  };

  for (let i = 0; i < filas.length; i++) {
    const nombre    = (filas[i]?.nombre ?? '').trim();
    const categoria = (filas[i]?.categoria ?? '').trim();

    // Validación mínima: sin nombre o sin categoría, la fila no puede existir (§ el modelo).
    if (!nombre)    { fallo(i, nombre, 'Falta el nombre'); continue; }
    if (!categoria) { fallo(i, nombre, 'Falta la categoría'); continue; }

    const slug = slugDeNombre(nombre);
    if (!slug) { fallo(i, nombre, 'El nombre no produce un enlace válido'); continue; }

    try {
      const existe = await prisma.product.findUnique({ where: { slug }, select: { id: true } });
      if (existe) {
        resultados.push({ fila: i, estado: 'omitida', nombre, slug, motivo: 'Ya existe un producto con ese nombre' });
        omitidas++;
        continue;
      }
      const producto = await crearProductoConAsiento({
        nombre,
        slug,
        categoria,
        precio:      Number(filas[i].precio) || 0,
        stock:       Number(filas[i].stock)  || 0,
        descripcion: (filas[i].descripcion ?? '').trim(),
        sku:         (filas[i].sku ?? '').trim() || null,
        imagen:      '',
        activo:      true,
      }, actor);
      resultados.push({ fila: i, estado: 'creada', nombre, slug, productoId: producto.id });
      creadas++;
    } catch (e) {
      fallo(i, nombre, e instanceof Error ? e.message : 'No se pudo crear', slug);
    }
  }

  return { resultados, resumen: { creadas, omitidas, errores } };
}
