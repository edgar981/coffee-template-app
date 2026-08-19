import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BUSINESS_TZ, dayKeyStart } from '@duna/core/timezone';
import { modeloInforme } from './informe';
import { generarInformePdf, geometriaColumnas, recortaAlAncho } from './informe-pdf';
import type { Payment, MetodoPago } from '@/types/payment';

// Capa 1 sobre el RENDERER, y existe por un defecto REAL: al insertar las secciones
// nuevas (resumen, desglose) la edición se llevó por delante el bucle de filas, y el
// PDF salió con el encabezado del detalle y NINGUNA fila.
//
// EL TEST DEL MODELO NO PODÍA ATRAPARLO, y eso es lo que hay que retener: el modelo
// producía las filas correctamente —su test las afirmaba y pasaba—, pero el renderer
// las ignoraba. Un test de capa 1 sobre el modelo no ve una capa que no lo lee. El
// discriminador tiene que vivir donde vive el bug.
//
// La aserción es el CONTEO DE PÁGINAS: con el bucle ausente el documento se queda en
// una sola página por muchas filas que traiga. No hace falta parsear el PDF para
// afirmar lo que importa.

const AHORA = dayKeyStart('2026-08-19', BUSINESS_TZ);

const pago = (i: number): Payment => ({
  id: `p${i}`, monto: 50_000 + i, metodo: 'NEQUI' as MetodoPago,
  fecha: '2026-08-14T15:00:00.000Z', referencia: `REF-${i}`,
  order: { numero_orden: `CN-${100000 + i}`, cliente_nombre: 'Laura Cárdenas' },
} as unknown as Payment);

const modelo = (n: number) => {
  const pagos = Array.from({ length: n }, (_, i) => pago(i));
  return modeloInforme({
    negocio: 'Café Nayoli', ahora: AHORA, pagos, enBucket: pagos,
    desde: '2026-08-01', hasta: '2026-08-19',
    metodoLabel: null, metodosDelFiltro: null, mejorDia: null,
  });
};

/** Las páginas del PDF, leídas del propio documento. */
async function paginas(n: number): Promise<number> {
  const blob = await generarInformePdf(modelo(n));
  const txt = Buffer.from(await blob.arrayBuffer()).toString('latin1');
  return (txt.match(/\/Type\s*\/Page[^s]/g) ?? []).length;
}

test('EL DETALLE SE IMPRIME: 300 filas ocupan más de una página', async () => {
  // Con el bucle de filas ausente esto da 1 y el test cae — que es exactamente el
  // defecto que se coló y que el modelo no podía delatar.
  const conFilas = await paginas(300);
  assert.ok(conFilas > 1, `300 filas deberían pasar de una página, dieron ${conFilas}`);
});

test('las páginas CRECEN con las filas — el detalle no se trunca solo', async () => {
  const [pocas, muchas] = [await paginas(60), await paginas(600)];
  assert.ok(muchas > pocas, `600 filas (${muchas} pág) deben ocupar más que 60 (${pocas} pág)`);
});

test('un informe VACÍO sigue siendo un documento de una página', async () => {
  // Sin filas el documento no desaparece: lleva su cabecera, su resumen y su pie.
  assert.equal(await paginas(0), 1);
});

// ── LA GEOMETRÍA DE COLUMNAS ────────────────────────────────────────────────
// Acá vivió el defecto de las columnas superpuestas: el cálculo devolvía UNA
// posición más que columnas —`Fecha` y `Orden` en la misma x— y cada celda se
// recortaba contra un ancho que no era su espacio real. El invariante que lo
// habría atrapado es simple: cada columna TERMINA donde empieza la siguiente.

const PESOS = [1.0, 1.1, 1.7, 1.1, 1.0, 1.3];

test('cada columna termina donde empieza la siguiente — ninguna invade', () => {
  const g = geometriaColumnas(PESOS, 515.28, 40);
  assert.equal(g.length, PESOS.length, 'una posición por columna, ni una más');
  for (let i = 0; i < g.length - 1; i++) {
    const fin = g[i].x + g[i].ancho;
    assert.ok(Math.abs(fin - g[i + 1].x) < 0.01,
      `la columna ${i} termina en ${fin.toFixed(1)} y la ${i + 1} empieza en ${g[i + 1].x.toFixed(1)}`);
  }
});

test('la geometría cubre el ancho útil exacto, sin sobrar ni faltar', () => {
  const g = geometriaColumnas(PESOS, 515.28, 40);
  assert.equal(g[0].x, 40);
  const fin = g.at(-1)!.x + g.at(-1)!.ancho;
  assert.ok(Math.abs(fin - (40 + 515.28)) < 0.01, `termina en ${fin}, debería en ${40 + 515.28}`);
});

test('recortaAlAncho NUNCA devuelve algo más ancho que su columna', () => {
  // Medidor falso: cada carácter mide 10. Así el test no depende de la tipografía.
  const medir = (s: string) => s.length * 10;
  assert.equal(recortaAlAncho('corto', 100, medir), 'corto');           // cabe: intacto
  const largo = recortaAlAncho('abcdefghijklmnop', 100, medir);
  assert.ok(medir(largo) <= 100, `"${largo}" mide ${medir(largo)}, no cabe en 100`);
  assert.ok(largo.endsWith('…'), 'lo recortado se declara con elipsis');
});

test('MEDIDO CON jsPDF: un nombre larguísimo no invade la columna siguiente', async () => {
  // El caso real del defecto: "QA Ordenes Pedidos Nuevo" pisando el monto. Se mide con
  // la API del documento, no a ojo — y se verifican TODAS las columnas, no sólo Cliente.
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const g = geometriaColumnas(PESOS, 515.28, 40);
  const PAD = 4;
  const monstruos = [
    '14 de agosto de 2026 a las 3:42 p. m.',
    'CN-999999999999999999999',
    'QA Ordenes Pedidos Nuevo Cliente De Prueba Con Nombre Larguísimo',
    '$ 999.999.999.999',
    'Transferencia bancaria internacional',
    'REF-ABCDEFGHIJKLMNOPQRSTUVWXYZ-0123456789',
  ];
  monstruos.forEach((txt, i) => {
    const t = recortaAlAncho(txt, g[i].ancho - PAD * 2, s => doc.getTextWidth(s));
    // La aserción es contra el ESPACIO REAL —dónde empieza la columna siguiente—, no
    // contra el ancho nominal de la columna. Ésa fue mi equivocación al medir: con la
    // geometría rota los dos números diferían, y comparar contra el nominal daba verde
    // sobre un texto que en el papel invadía.
    const finDibujado = g[i].x + PAD + doc.getTextWidth(t);
    const empiezaLaSiguiente = g[i + 1]?.x ?? (40 + 515.28);
    assert.ok(finDibujado <= empiezaLaSiguiente + 0.01,
      `col ${i}: "${t}" termina en ${finDibujado.toFixed(1)} y la siguiente empieza en ${empiezaLaSiguiente.toFixed(1)}`);
  });
});
