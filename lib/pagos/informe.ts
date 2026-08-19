import { formatCOP } from '@duna/core/utils';
import { formatFecha } from '@duna/core/format-fecha';
import { METODO_PAGO_LABEL } from '@/types/payment';
import type { Payment } from '@/types/payment';
import type { Frase } from './frase';

// ── EL MODELO DEL INFORME DE PAGOS ──────────────────────────────────────────
//
// Tres capas separadas —MODELO ≠ LAYOUT ≠ BYTES— y ésta es la primera: dice QUÉ
// lleva el documento y NO renderiza nada. Por eso se puede afirmar en capa 1 sin
// generar un PDF: lo que hay que garantizar (el alcance, el tope, el nombre) es
// una decisión de producto, no una cuestión de tipografía.
//
// EL ALCANCE ES EL RECORTE ACTIVO, EXACTAMENTE. Las filas se reciben ya filtradas
// —son el MISMO array que pinta el libro—, y acá no se re-filtra ni se re-ordena.
// Esa igualdad es el punto: un informe que trajera datos que la pantalla no muestra
// sería una SEGUNDA FUENTE del mismo recorte, que es justo lo que esta pantalla se
// construyó para no tener (§ una fuente alimenta frase, gráfico y libro).
//
// Por lo mismo el encabezado ES la frase de la pantalla, no un título nuevo: el
// documento abre diciendo lo que el operador acababa de leer.

/**
 * Tope de filas por informe, DECLARADO en el documento cuando muerde.
 *
 * 1.000 filas ≈ 25 páginas, que es el límite de lo que alguien abre; más allá el
 * informe es un archivo que nadie lee. El tope es del DOCUMENTO, no de la consulta
 * —la pantalla ya carga el rango completo—, y por eso vive acá y no en el fetch.
 */
export const MAX_FILAS_INFORME = 1000;

/** Una fila del libro, ya formateada para imprimir. */
export interface FilaInforme {
  fecha: string;
  orden: string;
  cliente: string;
  monto: string;
  metodo: string;
  referencia: string;
}

export interface ColumnaInforme {
  titulo: string;
  /** Ancho relativo; el layout lo reparte sobre el ancho útil de la página. */
  peso: number;
  /** Los montos van a la derecha, como en el libro. */
  derecha?: boolean;
}

export interface ModeloInforme {
  /** El encabezado: la frase de la pantalla, en texto plano. */
  titulo: string;
  /** La segunda línea de la frase (promedio y mejor día). */
  subtitulo: string;
  /** El contexto del recorte: rango y, si filtra, método. */
  meta: string;
  columnas: ColumnaInforme[];
  filas: FilaInforme[];
  /**
   * La nota del truncado, o `null`. Va EN EL PDF y no en la pantalla: quien lo abra
   * tres días después no vio ningún aviso, y un documento que calla que le faltan
   * filas miente sobre el período que dice cubrir.
   */
  nota: string | null;
  /** El total del recorte, ya formateado. */
  total: string;
  nombreArchivo: string;
}

/** "1.000" — el tope se nombra con el separador del panel, no como "1000". */
const conMiles = (n: number) => new Intl.NumberFormat('es-CO').format(n);

/** Un trozo de nombre de archivo seguro: sin acentos, espacios ni mayúsculas. */
function slug(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** El "—" del dato ausente, el mismo que muestra el libro. */
const oGuion = (s: string | null | undefined) => (s && s.trim() !== '' ? s : '—');

export function modeloInforme(input: {
  /** La frase YA construida por `fraseDePagos`: el documento abre con lo mismo que la pantalla. */
  frase: Frase;
  /** Los pagos del recorte activo, YA filtrados y en el orden en que se muestran. */
  pagos: Payment[];
  desde: string;
  hasta: string;
  /** El método, si el select filtra; `null` si son todos. */
  metodoLabel: string | null;
  total: number;
}): ModeloInforme {
  const { frase, pagos, desde, hasta, metodoLabel, total } = input;

  // Se corta por el TOPE conservando el orden de la pantalla — nunca se re-ordena
  // para "elegir las mejores": las primeras del libro son las primeras del informe.
  const visibles = pagos.slice(0, MAX_FILAS_INFORME);
  const nota = pagos.length > MAX_FILAS_INFORME
    ? `Se alcanzó el máximo de ${conMiles(MAX_FILAS_INFORME)} filas: el rango contiene más.`
    : null;

  const filas: FilaInforme[] = visibles.map(p => ({
    fecha:      formatFecha(p.fecha),
    orden:      oGuion(p.order?.numero_orden),
    cliente:    oGuion(p.order?.cliente_nombre),
    monto:      formatCOP(p.monto),
    metodo:     METODO_PAGO_LABEL[p.metodo] ?? p.metodo,
    referencia: oGuion(p.referencia),
  }));

  const meta = metodoLabel
    ? `${formatFecha(desde)} – ${formatFecha(hasta)} · ${metodoLabel}`
    : `${formatFecha(desde)} – ${formatFecha(hasta)}`;

  const nombreArchivo = [
    'pagos',
    metodoLabel ? slug(metodoLabel) : null,
    `${desde}_${hasta}`,
  ].filter(Boolean).join('-') + '.pdf';

  return {
    titulo: frase.tramos.map(t => t.t).join(''),
    subtitulo: frase.subtitulo,
    meta,
    columnas: [
      { titulo: 'Fecha',      peso: 1.0 },
      { titulo: 'Orden',      peso: 1.1 },
      { titulo: 'Cliente',    peso: 1.7 },
      { titulo: 'Monto',      peso: 1.1, derecha: true },
      { titulo: 'Método',     peso: 1.0 },
      { titulo: 'Referencia', peso: 1.3 },
    ],
    filas,
    nota,
    total: formatCOP(total),
    nombreArchivo,
  };
}
