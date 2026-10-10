// LA FICHA DE ORIGEN · «CRÉDITOS» (§ TIENDA-ONIX-CARTELERA-1). PURO (capa 1): sin red, sin DOM.
// Repeater etiqueta/valor (§ TIENDA-COMPOSICIONES-CENSO-1: "la alternativa de guardarlas como
// contenido de página en SiteContent... es viable con la plataforma de repeaters ya existente") —
// NUNCA lee `Product.origen`/`.variedad`/`.proceso`/`.altitudMin/Max`: esos campos los deja vacíos el
// seed y ningún PATCH del admin los escribe (§ el censo, product-update.ts), así que una ficha
// derivada del catálogo real estaría vacía para Onix. Los datos de la finca son contenido de la
// TIENDA, con sus propios defaults VACÍOS (§ el spec: "ningún dato de finca vive en el código").

export interface CreditoItem {
  etiqueta: string;
  valor: string;
}

/** El piso para mostrarse (§ el spec: "Se oculta con menos de 3 filas"). Una o dos filas no arman
 *  una "ficha de origen" — se leen como un dato suelto, no como el carácter documental de la
 *  sección; por debajo del piso, la sección entera queda oculta aunque el interruptor esté
 *  encendido (mismo criterio que el hide-on-empty de un repeater común, con el umbral en 3 en vez
 *  de 1). */
export const MIN_FILAS_CREDITOS = 3;

/** ¿Se muestran los créditos? Cuenta sólo las filas CON etiqueta Y valor — una fila a medias (sólo
 *  el rótulo, o sólo el dato) no suma al piso: mostrarla sería una fila rota, y contarla sin
 *  mostrarla inflaría el piso con filas invisibles. */
export function creditosVisibles(items: readonly CreditoItem[]): boolean {
  return filasCompletas(items).length >= MIN_FILAS_CREDITOS;
}

/** Las filas que se RENDERIZAN: con etiqueta y valor, ambos no vacíos tras recortar espacios. */
export function filasCompletas(items: readonly CreditoItem[]): CreditoItem[] {
  return items.filter((it) => it.etiqueta?.trim() && it.valor?.trim());
}
