// EL COLOR POR CAFÉ (§ TIENDA-CHAMISAS-ALBUM-1, composición «Láminas» de `tiendaCatalogo`). PURO
// (capa 1): sin red, sin DOM. Reusa `derivarPaleta`/`mezclar`/`contraste` de `lib/config/
// palette-derive.ts` (ya puro, ya testeado) — nunca un hex fijo de un cliente particular: "los
// colores de café salen de una paleta... Esto pide un campo nuevo" se interpreta acá como un MAPA
// id→color editable (§ `SiteContentData.tiendaCatalogo.coloresPorProducto`), con una paleta de
// RESERVA derivada del TEMA del tenant — Nayoli incluida — para que "sin color elegido" nunca
// hornee el hex de Las Chamisas en el código compartido (§ CLAUDE.md, "El código compartido no NACE
// siendo Nayoli/demo").

import { RAICES_DEFECTO, derivarPaleta, mezclar, contraste, type RaicesPaleta } from '@/lib/config/palette-derive';

export const HEX6 = /^#[0-9a-fA-F]{6}$/;

// Los SEIS roles de la RECETA de `derivarPaleta` que mejor sirven de paleta categórica para láminas
// de café: alternan acento/tostado a pesos distintos, así que se distinguen entre sí sin inventar
// ningún color nuevo — DERIVADOS, nunca un hex suelto. El orden es el orden de asignación "por
// catálogo" (§ el spec: "Sin color elegido → se asigna por orden").
const ROLES_PALETA_LAMINAS = ['acento', 'tostado', 'acento-3', 'tostado-4', 'acento-4', 'tostado-6'] as const;

export interface SugerenciaLamina {
  nombre: string;
  hex: string;
}

/** La paleta de RESERVA, derivada de las raíces del tema (Nayoli si se omite). Cíclica: un catálogo
 *  con más cafés que roles reutiliza desde el principio. */
export function paletaLaminas(raices: RaicesPaleta = RAICES_DEFECTO): readonly string[] {
  const derivada = derivarPaleta(raices);
  return ROLES_PALETA_LAMINAS.map((rol) => derivada[rol]);
}

/** Las sugerencias que el picker del panel (`ColorPorCafe.tsx`) ofrece antes de «Personalizado» —
 *  nombre llano por ORDEN ("Color 1"…), nunca jerga de rol interno ni léxico de café (§ CLAUDE.md,
 *  #59/#63: la ficha y el copy del producto son café-shape; el picker del panel es GENÉRICO, sirve
 *  a cualquier vertical). "Color N" también comunica el criterio de reserva: es, literal, el color
 *  que ese producto tomaría si nadie elige nada. */
export function sugerenciasLaminas(raices: RaicesPaleta = RAICES_DEFECTO): SugerenciaLamina[] {
  return paletaLaminas(raices).map((hex, i) => ({ nombre: `Color ${i + 1}`, hex }));
}

/** El color de la lámina de UN producto: el elegido (si `coloresPorProducto[productId]` es un hex de
 *  6 dígitos válido) o, por ORDEN de catálogo, el siguiente de la paleta de reserva — cíclico. Un
 *  producto BORRADO simplemente deja de pedir este color (el mapa no se poda; basura inerte, no un
 *  bug); uno NUEVO toma color por su posición sin que nadie edite nada. */
export function colorDeLamina(
  productId: string,
  indiceEnCatalogo: number,
  coloresPorProducto: Record<string, string>,
  raices: RaicesPaleta = RAICES_DEFECTO,
): string {
  const elegido = coloresPorProducto[productId];
  if (typeof elegido === 'string' && HEX6.test(elegido)) return elegido;
  const paleta = paletaLaminas(raices);
  const i = ((indiceEnCatalogo % paleta.length) + paleta.length) % paleta.length;
  return paleta[i];
}

/** El LAVADO del color de la lámina (§ el spec: "el texto nunca va sobre el color pleno"): una
 *  mezcla hacia el FONDO del tema que SIGUE pasando AA (4.5:1 por defecto) contra la TINTA — el
 *  color de texto que se apoya encima. Camina el peso de mezcla en pasos finos hasta alcanzar el
 *  objetivo; si el color YA pasa sin mezclar (muy claro de por sí), el peso se queda en 0. Nunca
 *  falla silenciosamente: en el peor caso (100 pasos, peso 1) el resultado ES el fondo del tema,
 *  que por construcción del storefront ya contrasta con su propia tinta. */
export function lavadoLamina(colorHex: string, raices: RaicesPaleta = RAICES_DEFECTO, objetivo = 4.5): string {
  let peso = 0;
  let out = colorHex;
  for (let i = 0; i < 100 && contraste(raices.tinta, out) < objetivo; i++) {
    peso = Math.min(1, peso + 0.01);
    out = mezclar(colorHex, raices.fondo, peso);
  }
  return out;
}
