import type { ModeloInforme } from './informe';

// ── EL LAYOUT DEL INFORME ───────────────────────────────────────────────────
//
// Segunda capa: toma el MODELO (qué lleva el documento) y lo pone en páginas. Los
// BYTES los pone jsPDF; acá sólo vive la geometría y las decisiones de página.
//
// LA LIBRERÍA SE CARGA CON `import()` DINÁMICO, y no es un detalle de estilo: son
// ~242 KB gzip que NO deben viajar en el bundle de Pagos —la pantalla se abre muchas
// veces y el informe se pide pocas—. El `await import()` los deja en su propio chunk,
// que baja la primera vez que alguien toca el botón. Verificado sobre el ARTEFACTO
// compilado, no sobre esta línea (§ el gate de capa 3).
//
// jsPDF y no pdf-lib (owner, 2026-08-19), pese a pesar ~40 KB más: pdf-lib lleva cuatro
// años sin publicar. El formato PDF está congelado, pero el ENTORNO no —navegadores,
// bundlers, APIs de descarga sí se mueven—, y una librería quieta no recibe el parche
// cuando algo de eso cambia. Ahí el costo no son 40 KB: es un botón roto sin nadie a
// quien reportarle, y acá no hay equipo que pueda forkear una dependencia abandonada.

/**
 * Las posiciones y anchos de cada columna sobre el ancho útil.
 *
 * PURA Y EXPORTADA porque acá vivió un defecto que el ojo no perdona: la versión
 * anterior calculaba las posiciones con un `reduce` que devolvía UNA MÁS de las
 * columnas —`Fecha` y `Orden` caían en la misma x— y cada celda se recortaba contra un
 * ancho que no era el espacio que realmente tenía. Resultado: el nombre del cliente
 * invadiendo la columna de monto ("QA Ordenes Pedidos Nuevo$ 35.000"), que no es un
 * detalle estético sino un dato ilegible.
 *
 * El invariante que su test afirma: cada columna TERMINA donde empieza la siguiente.
 */
export function geometriaColumnas(pesos: number[], anchoUtil: number, margenX: number)
  : { x: number; ancho: number }[] {
  const total = pesos.reduce((s, p) => s + p, 0);
  const out: { x: number; ancho: number }[] = [];
  let cursor = margenX;
  for (const peso of pesos) {
    const ancho = (peso / total) * anchoUtil;
    out.push({ x: cursor, ancho });
    cursor += ancho;
  }
  return out;
}

/**
 * Recorta un texto al ancho disponible, con elipsis. `medir` es la función del
 * documento (`getTextWidth`), inyectada para poder afirmarlo sin un PDF.
 *
 * Se aplica a TODAS las columnas, no sólo a Cliente: un número de orden o una
 * referencia larga desbordan igual.
 */
export function recortaAlAncho(texto: string, ancho: number, medir: (s: string) => number): string {
  if (medir(texto) <= ancho) return texto;
  let s = texto;
  while (s.length > 0 && medir(s + '…') > ancho) s = s.slice(0, -1);
  return s + '…';
}

/** A4 en puntos, y los márgenes del documento. */
const PAGINA = { ancho: 595.28, alto: 841.89 };
const MARGEN = { x: 40, arriba: 52, abajo: 44 };
const ANCHO_UTIL = PAGINA.ancho - MARGEN.x * 2;

const FILA_H = 16;      // alto de una fila de la tabla
const CABECERA_H = 18;  // alto de la fila de encabezados

/**
 * Genera el PDF del informe y devuelve sus bytes.
 *
 * Async por el `import()`: el llamador ya está en un handler que muestra "Generando…",
 * así que la espera es visible y no hay que inventarle un estado.
 */
export async function generarInformePdf(m: ModeloInforme): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true });

  // El reparto de columnas sale de los PESOS del modelo: el layout decide píxeles, el
  // modelo decide proporciones. Así una columna nueva no obliga a re-hacer la geometría.
  const cols = geometriaColumnas(m.columnas.map(c => c.peso), ANCHO_UTIL, MARGEN.x);
  /** El aire a cada lado del texto dentro de su columna. */
  const PAD = 4;

  const celda = (txt: string, i: number, y: number) => {
    const { x, ancho } = cols[i];
    // Se recorta contra el espacio REAL de la columna, no contra un ancho nominal.
    const t = recortaAlAncho(txt, ancho - PAD * 2, s => doc.getTextWidth(s));
    // Los montos a la derecha, como en el libro: la columna queda a plomo.
    if (m.columnas[i].derecha) doc.text(t, x + ancho - PAD, y, { align: 'right' });
    else doc.text(t, x + PAD, y);
  };

  const encabezadoTabla = (y: number) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(125);
    m.columnas.forEach((c, i) => celda(c.titulo, i, y));
    doc.setDrawColor(200);
    doc.setLineWidth(0.7);
    doc.line(MARGEN.x, y + 5, MARGEN.x + ANCHO_UTIL, y + 5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(20);
    doc.setFontSize(9);
    return y + CABECERA_H;
  };

  // ── CABECERA DEL DOCUMENTO ────────────────────────────────────────────────
  // Negocio y fecha de generación: sin esto, una hoja impresa no dice de qué
  // negocio es ni de cuándo, y es lo primero que se pregunta quien la encuentra.
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(130);
  doc.text(m.negocio, MARGEN.x, MARGEN.arriba - 18);
  doc.text(m.generado, MARGEN.x + ANCHO_UTIL, MARGEN.arriba - 18, { align: 'right' });
  doc.setDrawColor(215);
  doc.setLineWidth(0.7);
  doc.line(MARGEN.x, MARGEN.arriba - 12, MARGEN.x + ANCHO_UTIL, MARGEN.arriba - 12);

  // ── TÍTULO ────────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(20);
  const tituloLineas = doc.splitTextToSize(m.titulo, ANCHO_UTIL) as string[];
  doc.text(tituloLineas, MARGEN.x, MARGEN.arriba + 6);
  let y = MARGEN.arriba + 6 + tituloLineas.length * 18 + 12;

  /**
   * El título de una sección. La JERARQUÍA es lo que separa un informe de un volcado, y
   * son tres pesos distintos, no uno: el título de sección (10.5 bold, tinta), el
   * encabezado de tabla (7.5 bold, gris) y las filas (9 normal). Antes el título de
   * sección y el encabezado de tabla eran los dos "8 bold gris" —idénticos—, y por eso
   * el documento se leía plano.
   */
  const seccion = (txt: string, yy: number) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(20);
    doc.text(txt.toUpperCase(), MARGEN.x, yy);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    return yy + 16;
  };

  // ── RESUMEN ───────────────────────────────────────────────────────────────
  y = seccion('Resumen', y);
  doc.setFontSize(10);
  for (const d of m.resumen) {
    doc.setTextColor(110);
    doc.text(d.label, MARGEN.x, y);
    doc.setTextColor(20);
    doc.setFont('helvetica', 'bold');
    doc.text(d.valor, MARGEN.x + 130, y);
    doc.setFont('helvetica', 'normal');
    y += 15;
  }
  y += 8;

  // La nota del truncado vive en el RESUMEN: es información sobre el ALCANCE del
  // documento, y ahí es donde el lector busca "de qué me está hablando esto".
  if (m.nota) {
    doc.setFontSize(8);
    doc.setTextColor(150);
    const notaLineas = doc.splitTextToSize(m.nota, ANCHO_UTIL) as string[];
    doc.text(notaLineas, MARGEN.x, y);
    y += notaLineas.length * 10 + 10;
    doc.setTextColor(20);
  }

  // ── POR MÉTODO ────────────────────────────────────────────────────────────
  y = seccion('Por método', y);
  if (m.bajadaMetodo) {
    doc.setFontSize(8);
    doc.setTextColor(150);
    const bl = doc.splitTextToSize(m.bajadaMetodo, ANCHO_UTIL) as string[];
    doc.text(bl, MARGEN.x, y);
    y += bl.length * 10 + 6;
    doc.setTextColor(20);
  }
  doc.setFontSize(9);
  for (const f of m.porMetodo) {
    // El método que el detalle desarrolla va en NEGRITA. El peso es el puntero; el
    // significado lo da la bajada, que lo nombra (sin color: el color es estado).
    doc.setFont('helvetica', f.marcado ? 'bold' : 'normal');
    doc.text(f.metodo, MARGEN.x, y);
    doc.text(f.total, MARGEN.x + 260, y, { align: 'right' });
    doc.text(f.participacion, MARGEN.x + 330, y, { align: 'right' });
    y += 14;
  }
  doc.setFont('helvetica', 'normal');
  y += 14;

  // ── DETALLE ───────────────────────────────────────────────────────────────
  y = seccion('Detalle', y);
  y = encabezadoTabla(y);

  // Las filas, con salto de página. Cada página nueva REPITE el encabezado de la
  // tabla: una hoja suelta con seis columnas sin títulos no se puede leer.
  let iFila = 0;
  for (const f of m.filas) {
    if (y > PAGINA.alto - MARGEN.abajo) {
      doc.addPage();
      y = encabezadoTabla(MARGEN.arriba);
    }
    // Banda cebra al ~3%: con doscientas filas y seis columnas el ojo pierde el
    // renglón, y el recorrido es a lo ANCHO. Se elige la banda y NO la regla entre
    // filas —las dos juntas son ruido—: una banda acompaña el barrido horizontal,
    // una línea sólo lo corta.
    if (iFila % 2 === 1) {
      doc.setFillColor(247, 247, 245);
      doc.rect(MARGEN.x, y - 10, ANCHO_UTIL, FILA_H, 'F');
    }
    iFila += 1;
    doc.setTextColor(20);
    celda(f.fecha, 0, y);
    celda(f.orden, 1, y);
    celda(f.cliente, 2, y);
    celda(f.monto, 3, y);
    celda(f.metodo, 4, y);
    celda(f.referencia, 5, y);
    y += FILA_H;
  }

  // El TOTAL cierra la tabla, no la abre: es la suma de lo que se acaba de leer.
  if (y > PAGINA.alto - MARGEN.abajo - 24) { doc.addPage(); y = MARGEN.arriba; }
  doc.setDrawColor(200);
  doc.line(MARGEN.x, y - 6, MARGEN.x + ANCHO_UTIL, y - 6);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  y += 9;
  doc.text('Total', cols[2].x + PAD, y);
  doc.text(m.total, cols[3].x + cols[3].ancho - PAD, y, { align: 'right' });
  doc.setFont('helvetica', 'normal');

  // El pie se estampa al final, cuando ya se sabe cuántas páginas hay.
  const paginas = doc.getNumberOfPages();
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(150);
  for (let p = 1; p <= paginas; p++) {
    doc.setPage(p);
    doc.text(`Página ${p} de ${paginas}`, PAGINA.ancho - MARGEN.x, PAGINA.alto - 24, { align: 'right' });
    doc.text(m.pie, MARGEN.x, PAGINA.alto - 24);
    // La única marca del producto en un documento que sale de la casa —el operador lo
    // manda a su contador—. Va como TEXTO: el logo existe (public/brand/*.svg) pero
    // jsPDF no dibuja SVG, así que meterlo exige rasterizarlo o transcribir sus paths,
    // que es una decisión propia y no un renglón de pie. No se inventa un logo.
    doc.text('Generado con Duna', PAGINA.ancho / 2, PAGINA.alto - 24, { align: 'center' });
  }

  return doc.output('blob');
}

/** Dispara la descarga en el navegador y suelta el object URL. */
export function descargar(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}
