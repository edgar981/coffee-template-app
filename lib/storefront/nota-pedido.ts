// LA NOTA DE PEDIDO (§ CHAMISAS-SUSCRIPCIONES-CASILLAS-1, refero-chamisas.md §4-5). PURA (capa 1):
// sin red, sin DOM. Arma las líneas EXACTAS del mensaje de WhatsApp que un comprador va a enviar —
// el mismo texto que el botón "Enviar por WhatsApp" promete, impreso en la hoja antes del clic.
//
// PIEZA REUTILIZABLE por cualquier tienda que coordine pedidos por WhatsApp (§ refero-chamisas.md
// §5: "Nota de pedido: sirve a cualquier tienda que coordine por WhatsApp. Cada línea cambia la
// hoja, no la lógica"). Este módulo no sabe nada de café, de Las Chamisas, ni de Taquilla/Casillas:
// recibe strings ya resueltos por el llamador (el nombre del negocio, la frase de frecuencia, las
// líneas de producto, el total, la ciudad, la pregunta de cierre) y los ensambla en el ORDEN fijo
// del formato "REKKI, pedido por chat" (§ refero-chamisas.md §2, referencia 3: "una línea por
// producto"). La hoja (el papel punteado, el tejido, la tipografía) es responsabilidad del
// componente que la muestra — nunca de este archivo.

export interface LineaPedido {
  cantidad: number;
  nombre: string;
  /** "340 g" / "500 g" — ya formateado por el llamador (este módulo no conoce unidades). */
  tamano: string;
  /** "en grano" / "molido" — vacío (`undefined` o `''`) si el ítem no declara molienda: la línea
   *  no agrega esa cláusula (nunca " · " seguido de nada). */
  molienda?: string;
}

export interface NotaPedidoInput {
  /** El nombre del negocio ("Café Las Chamisas") — llega por parámetro, nunca hardcodeado: es dato
   *  de identidad del tenant (§ CLAUDE.md, "el código compartido no NACE siendo Nayoli/demo"). */
  negocio: string;
  /** La frase de frecuencia YA en minúscula y en la forma que encaja en "Quiero recibir café
   *  {frecuenciaFrase}:" — p. ej. "cada mes", "cada 15 días". */
  frecuenciaFrase: string;
  items: readonly LineaPedido[];
  /** La línea que reemplaza al bloque de ítems cuando `items` está vacío — p. ej.
   *  "(elige al menos un café)". SÓLO se usa en ese caso. */
  placeholderSinItems: string;
  /** El total por envío, YA formateado ("$ 96.000" o el texto que el llamador decida para un caso
   *  sin selección, p. ej. "—"). Este módulo no calcula dinero. */
  totalTexto: string;
  ciudad: string;
  /** La pregunta de cierre ("¿Me confirman fecha del primer envío y cómo pago?") — editable por
   *  tienda, nunca fija en este módulo. */
  preguntaCierre: string;
}

/** Las líneas EXACTAS del mensaje, en el orden del formato — § el docstring de cabecera. Un array,
 *  no un string ya unido: el componente que pinta la hoja necesita cada línea por separado (una
 *  fila de `<div>` por línea, como ya hace la maqueta aprobada), y `mensajeNotaPedido` (abajo) es
 *  quien las junta para el `wa.me/?text=`. */
export function lineasNotaPedido(input: NotaPedidoInput): string[] {
  const lineas: string[] = [`Hola, ${input.negocio}. Quiero recibir café ${input.frecuenciaFrase}:`];
  if (input.items.length === 0) {
    lineas.push(input.placeholderSinItems);
  } else {
    for (const item of input.items) {
      const molienda = item.molienda ? ` · ${item.molienda}` : '';
      lineas.push(`• ${item.cantidad} × ${item.nombre} · ${item.tamano}${molienda}`);
    }
  }
  lineas.push(`Por envío: ${input.totalTexto}`);
  lineas.push(`Mi ciudad: ${input.ciudad}`);
  lineas.push(input.preguntaCierre);
  return lineas;
}

/** El mensaje completo, listo para `encodeURIComponent` en un `wa.me/?text=` — las líneas de
 *  `lineasNotaPedido` unidas por salto de línea, como manda WhatsApp. */
export function mensajeNotaPedido(input: NotaPedidoInput): string {
  return lineasNotaPedido(input).join('\n');
}
