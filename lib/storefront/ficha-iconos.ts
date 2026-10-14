// EL ÍCONO POR FILA de la Ficha «Etiqueta de bolsa» (§ CHAMISAS-NOSOTROS-ARCO-Y-FICHA-1,
// refero-chamisas.md §3 punto 4: "Retícula de dos columnas con iconos de línea"). PURO (capa 1).
//
// `NosotrosFichaEtiqueta.tsx` pintaba el MISMO ícono (`Minus`) en cada fila — decorativo, sin
// relación con el dato — porque el modelo no declara un ícono por etiqueta (§ su propio docstring:
// "no hay un dato de ícono por etiqueta en el modelo... una marca de línea NEUTRA cumple 'iconos de
// línea' sin inventar una capacidad de selección"). Esa decisión de MODELO no cambia acá: seguimos
// sin un campo "icono" por fila en `CreditoItem` — lo que cambia es que, dado el texto LIBRE de la
// `etiqueta`, se puede DERIVAR un ícono con sentido (Finca→pin, Altitud→montaña, …) sin pedirle al
// dueño un dato nuevo. Es el mismo movimiento que `categoriasDelCatalogo`/`colorDeLamina`: derivar de
// lo que ya existe, no declarar una capacidad de selección nueva.
//
// LA CLAVE ES EL IDENTIFICADOR DEL ÍCONO, NO EL COMPONENTE — este módulo es 'use client'-agnóstico
// (sin importar `lucide-react` ni JSX), así que se puede testear en capa 1 sin SSR. El componente
// mapea la clave devuelta acá a su propio ícono de lucide-react.
export type FichaIconoId =
  | 'origen'
  | 'altitud'
  | 'variedades'
  | 'proceso'
  | 'cosecha'
  | 'familias'
  | 'tostion'
  | 'presentacion'
  | 'neutro';

/** Normaliza para comparar: sin acentos, sin mayúsculas, sin espacios de sobra en los extremos
 *  (mismo patrón que `lib/admin/ayuda-editor.ts#normalizar`, no una segunda implementación). */
function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

// Cada entrada es un conjunto de PALABRAS CLAVE (substring, sobre el texto ya normalizado) que
// identifican la fila. El orden importa para el PRIMER match cuando dos palabras podrían coexistir
// (no ocurre hoy con este set, pero queda declarado por si una etiqueta futura las mezclara).
const REGLAS: readonly { id: FichaIconoId; palabras: readonly string[] }[] = [
  { id: 'origen', palabras: ['finca', 'origen', 'procedencia', 'lugar'] },
  { id: 'altitud', palabras: ['altitud', 'altura', 'msnm', 'm s.n.m', 'm.s.n.m'] },
  { id: 'variedades', palabras: ['variedad'] },
  { id: 'proceso', palabras: ['proceso', 'beneficio'] },
  { id: 'cosecha', palabras: ['cosecha', 'recoleccion'] },
  { id: 'familias', palabras: ['familia', 'productor', 'caficultor'] },
  { id: 'tostion', palabras: ['tostion', 'tueste'] },
  { id: 'presentacion', palabras: ['presentacion', 'bolsa', 'empaque', 'peso', 'gramaje'] },
];

/** El ícono que le corresponde a una etiqueta de la ficha ("Finca", "Altitud", "Cosecha
 *  principal"…) — por PALABRA CLAVE, no por igualdad exacta: "Cosecha principal" debe matchear
 *  igual que "Cosecha". Una etiqueta que ninguna regla reconoce cae a `'neutro'` — NUNCA revienta,
 *  nunca inventa una categoría nueva; es la misma red que ya usaba el ícono único de antes. */
export function fichaIcono(etiqueta: string): FichaIconoId {
  const norm = normalizar(etiqueta);
  if (!norm) return 'neutro';
  for (const regla of REGLAS) {
    if (regla.palabras.some((palabra) => norm.includes(palabra))) return regla.id;
  }
  return 'neutro';
}
