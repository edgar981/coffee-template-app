import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BUSINESS_TZ, dayKeyStart } from '@duna/core/timezone';
import { modeloInforme } from './informe';
import { generarInformePdf } from './informe-pdf';
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
