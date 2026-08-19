import { formatCOP } from '@duna/core/utils';
import { formatFecha } from '@duna/core/format-fecha';
import { BUSINESS_TZ } from '@duna/core/timezone';
import { METODO_PAGO_LABEL } from '@/types/payment';
import type { Payment, MetodoPago } from '@/types/payment';

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

/** Una fila del desglose por método. */
export interface FilaMetodo {
  metodo: string;
  total: string;
  /** Participación sobre el total del PERÍODO, sin re-basear por el filtro. */
  participacion: string;
  /** El detalle de abajo desarrolla este método: va en negrita (§ la bajada lo nombra). */
  marcado: boolean;
}

/** Un par etiqueta/valor del bloque RESUMEN. */
export interface DatoResumen { label: string; valor: string }

export interface ColumnaInforme {
  titulo: string;
  /** Ancho relativo; el layout lo reparte sobre el ancho útil de la página. */
  peso: number;
  /** Los montos van a la derecha, como en el libro. */
  derecha?: boolean;
}

export interface ModeloInforme {
  /** El negocio del que habla el documento. Lo pone el consumidor (§ siteConfig). */
  negocio: string;
  /** "generado el 19 ago 2026, 3:42 p. m." — sin esto nadie sabe de cuándo es. */
  generado: string;
  /** "PAGOS · 1 ago – 19 ago 2026 · Nequi" — el encabezado del documento. */
  titulo: string;
  /** El bloque RESUMEN: la misma información de la frase, en forma de informe. */
  resumen: DatoResumen[];
  /**
   * El desglose POR MÉTODO, del período COMPLETO (sin el filtro de método).
   *
   * Se muestra SIEMPRE, incluso con el select filtrando, y ésa es la corrección que
   * distingue un documento de un volcado: en pantalla el operador puede quitar el
   * filtro y ver el contexto; **en un PDF no puede**. Con el detalle acotado a un
   * método, el total del resumen es sólo de ese método, y sin este bloque nadie sabe
   * que hay más plata fuera de ese número. Se resuelve ETIQUETANDO, no ocultando.
   */
  porMetodo: FilaMetodo[];
  /** La bajada del desglose: sólo cuando el filtro hace divergir desglose y detalle. */
  bajadaMetodo: string | null;
  columnas: ColumnaInforme[];
  filas: FilaInforme[];
  /**
   * La nota del truncado, o `null`. Va EN EL PDF y no en la pantalla: quien lo abra
   * tres días después no vio ningún aviso, y un documento que calla que le faltan
   * filas miente sobre el período que dice cubrir.
   *
   * Dice las DOS cosas: que el detalle está topado, y que el resumen y el desglose NO
   * lo están. Que el desglose sume más que el detalle es la clase de discrepancia que
   * hace dudar del documento entero, y quien la note no tiene a quién preguntarle.
   */
  nota: string | null;
  /** El total del recorte, ya formateado. */
  total: string;
  /** El pie de cada página: negocio y rango, para que una hoja suelta se explique. */
  pie: string;
  nombreArchivo: string;
}

/** "1.000" — el tope se nombra con el separador del panel, no como "1000". */
const conMiles = (n: number) => new Intl.NumberFormat('es-CO').format(n);

/** Un trozo de nombre de archivo seguro: sin acentos, espacios ni mayúsculas. */
function slug(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** El "—" del dato ausente, el mismo que muestra el libro. */
const oGuion = (s: string | null | undefined) => (s && s.trim() !== '' ? s : '—');

/** Sólo la HORA: la fecha la pone `formatFecha`, la utilidad única del panel — un
 *  segundo formato de fecha visible es exactamente lo que esa regla evita. */
const fmtHora = new Intl.DateTimeFormat('es-CO', {
  timeZone: BUSINESS_TZ, hour: 'numeric', minute: '2-digit',
});

export function modeloInforme(input: {
  /** El nombre del negocio (§ `siteConfig.brand.nombre`). El modelo no lo sabe solo. */
  negocio: string;
  /** El reloj, como parámetro, para que un test pueda fijarlo. */
  ahora: Date;
  /** Los pagos del recorte activo, YA filtrados y en el orden en que se muestran. */
  pagos: Payment[];
  /**
   * El recorte SIN el filtro de método (rango + bucket sí, método no) — la fuente del
   * desglose. Se DERIVA de `pagos` en la página (`filtered ⊆ enBucket`), no de una
   * consulta nueva: los dos salen del mismo array que ya está en memoria.
   */
  enBucket: Payment[];
  desde: string;
  hasta: string;
  /** El método, si el select filtra; `null` si son todos. */
  metodoLabel: string | null;
  /** Los métodos que el filtro incluye — varios si es un GRUPO ("Cualquier digital"). */
  metodosDelFiltro: MetodoPago[] | null;
  /** El pico del período, si la pantalla lo mostró. */
  mejorDia: { etiqueta: string; monto: number } | null;
}): ModeloInforme {
  const { negocio, ahora, pagos, enBucket, desde, hasta, metodoLabel, metodosDelFiltro, mejorDia } = input;

  const total = pagos.reduce((s, p) => s + p.monto, 0);

  // Se corta por el TOPE conservando el orden de la pantalla — nunca se re-ordena
  // para "elegir las mejores": las primeras del libro son las primeras del informe.
  const visibles = pagos.slice(0, MAX_FILAS_INFORME);
  const nota = pagos.length > MAX_FILAS_INFORME
    ? `Se alcanzó el máximo de ${conMiles(MAX_FILAS_INFORME)} filas en el detalle: el rango `
      + `contiene más. El resumen y el desglose por método sí cubren el período completo.`
    : null;

  const filas: FilaInforme[] = visibles.map(p => ({
    fecha:      formatFecha(p.fecha),
    orden:      oGuion(p.order?.numero_orden),
    cliente:    oGuion(p.order?.cliente_nombre),
    monto:      formatCOP(p.monto),
    metodo:     METODO_PAGO_LABEL[p.metodo] ?? p.metodo,
    referencia: oGuion(p.referencia),
  }));

  // ── El desglose, sobre el período COMPLETO ────────────────────────────────
  const totalPeriodo = enBucket.reduce((s, p) => s + p.monto, 0);
  const porMetodoMap = new Map<MetodoPago, number>();
  for (const p of enBucket) porMetodoMap.set(p.metodo, (porMetodoMap.get(p.metodo) ?? 0) + p.monto);
  const porMetodo: FilaMetodo[] = (Object.keys(METODO_PAGO_LABEL) as MetodoPago[])
    .map(m => ({ m, monto: porMetodoMap.get(m) ?? 0 }))
    // De mayor a menor: un desglose se lee de arriba hacia abajo por tamaño.
    .sort((a, b) => b.monto - a.monto)
    .map(({ m, monto }) => ({
      metodo: METODO_PAGO_LABEL[m],
      total: formatCOP(monto),
      // Sobre el total del PERÍODO, sin re-basear por el filtro: re-basear escondería
      // que se está mirando un recorte (misma regla que tenía la leyenda del strip).
      participacion: totalPeriodo > 0 ? `${Math.round((monto / totalPeriodo) * 100)} %` : '—',
      marcado: metodosDelFiltro !== null && metodosDelFiltro.includes(m),
    }));

  // La bajada sólo cuando el filtro hace divergir desglose y detalle. Sin filtro los
  // dos cubren el mismo conjunto y no hay nada que aclarar.
  const bajadaMetodo = metodoLabel
    ? `Del período completo, sin el filtro de método. El detalle de abajo desarrolla sólo ${metodoLabel}.`
    : null;

  const rango = `${formatFecha(desde)} – ${formatFecha(hasta)}`;
  const titulo = metodoLabel ? `PAGOS · ${rango} · ${metodoLabel}` : `PAGOS · ${rango}`;

  const resumen: DatoResumen[] = [
    { label: 'Total',             valor: formatCOP(total) },
    { label: 'Pagos',             valor: conMiles(pagos.length) },
    { label: 'Promedio por pago', valor: pagos.length > 0 ? formatCOP(Math.round(total / pagos.length)) : '—' },
  ];
  if (mejorDia) resumen.push({ label: 'Mejor día', valor: `${mejorDia.etiqueta} · ${formatCOP(mejorDia.monto)}` });

  const nombreArchivo = [
    'pagos',
    metodoLabel ? slug(metodoLabel) : null,
    `${desde}_${hasta}`,
  ].filter(Boolean).join('-') + '.pdf';

  return {
    negocio,
    generado: `generado el ${formatFecha(ahora)}, ${fmtHora.format(ahora)}`,
    titulo,
    resumen,
    porMetodo,
    bajadaMetodo,
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
    pie: `${negocio} · Pagos ${rango}`,
    nombreArchivo,
  };
}
