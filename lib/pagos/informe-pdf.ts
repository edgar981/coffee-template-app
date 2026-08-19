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

  // ── Portada de la primera página: la FRASE, tal como abre la pantalla ──────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(20);
  const tituloLineas = doc.splitTextToSize(m.titulo, ANCHO_UTIL) as string[];
  doc.text(tituloLineas, MARGEN.x, MARGEN.arriba);
  let y = MARGEN.arriba + tituloLineas.length * 19;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(110);
  doc.text(m.subtitulo, MARGEN.x, y);
  y += 15;
  doc.text(m.meta, MARGEN.x, y);
  y += 22;

  // La nota del truncado va ARRIBA, con la portada: al final de 25 páginas no la lee
  // nadie, y es justo el dato que cambia cómo se interpreta el documento entero.
  if (m.nota) {
    doc.setTextColor(150);
    doc.setFontSize(8.5);
    doc.text(m.nota, MARGEN.x, y);
    y += 18;
  }

  doc.setTextColor(20);
  y = encabezadoTabla(y);

  // ── Las filas, con salto de página ────────────────────────────────────────
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

  // El pie se estampa al final, cuando ya se sabe cuántas páginas hay.
  const paginas = doc.getNumberOfPages();
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(150);
  for (let p = 1; p <= paginas; p++) {
    doc.setPage(p);
    doc.text(`${p} / ${paginas}`, PAGINA.ancho - MARGEN.x, PAGINA.alto - 24, { align: 'right' });
    doc.text(m.meta, MARGEN.x, PAGINA.alto - 24);
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
