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
  const pesoTotal = m.columnas.reduce((s, c) => s + c.peso, 0);
  const anchos = m.columnas.map(c => (c.peso / pesoTotal) * ANCHO_UTIL);
  const x = anchos.reduce<number[]>((acc, w, i) => [...acc, (acc[i] ?? MARGEN.x) + (i === 0 ? 0 : anchos[i - 1])], [MARGEN.x]);

  /** El texto, recortado al ancho de su columna: una celda no invade a la vecina. */
  const recorta = (txt: string, ancho: number) => {
    const max = ancho - 6;
    if (doc.getTextWidth(txt) <= max) return txt;
    let s = txt;
    while (s.length > 1 && doc.getTextWidth(s + '…') > max) s = s.slice(0, -1);
    return s + '…';
  };

  const celda = (txt: string, i: number, y: number) => {
    const w = anchos[i];
    const t = recorta(txt, w);
    // Los montos a la derecha, como en el libro: la columna queda a plomo.
    if (m.columnas[i].derecha) doc.text(t, x[i] + w - 3, y, { align: 'right' });
    else doc.text(t, x[i] + 3, y);
  };

  const encabezadoTabla = (y: number) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(110);
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

  /** El título de una sección: la jerarquía que distingue un informe de un volcado. */
  const seccion = (txt: string, yy: number) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(130);
    doc.text(txt.toUpperCase(), MARGEN.x, yy);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(20);
    return yy + 14;
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
  for (const f of m.filas) {
    if (y > PAGINA.alto - MARGEN.abajo) {
      doc.addPage();
      y = encabezadoTabla(MARGEN.arriba);
    }
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
  y += 8;
  doc.text('Total', x[2] + 3, y);
  doc.text(m.total, x[3] + anchos[3] - 3, y, { align: 'right' });
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
