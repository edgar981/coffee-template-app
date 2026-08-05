import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  titularRentabilidad, titularProductoEstrella, titularCartera, titularConcentracion,
} from './titulares';
import { CARTERA_DIAS_MEDIO, type ResumenCartera } from './cartera';
import type { FilaMargen } from './margen';
import type { Concentracion } from './concentracion';
import { PERIODO_ORDEN } from './periodo';

// Estas frases SON la decisión de producto del pase de jerarquía: es lo único que
// el dueño lee en la prueba de los 30 segundos. Un plural mal puesto o un cero
// que se lee como catástrofe no es un detalle de copy — es la respuesta a
// "¿gané plata?" contestada mal.

// ─── Rentabilidad ─────────────────────────────────────────────────────────────

test('el titular responde la pregunta con el sujeto del período', () => {
  const r = (periodo: Parameters<typeof titularRentabilidad>[0]['periodo']) =>
    titularRentabilidad({ periodo, margenTotal: 500_000, hayVentas: true });

  assert.match(r('mes'),             /^Este mes te quedaron .* después de costos$/);
  assert.match(r('mes_anterior'),    /^El mes pasado te quedaron /);
  assert.match(r('ultimos_3_meses'), /^En los últimos 3 meses te quedaron /);
  assert.match(r('anio'),            /^Este año te quedaron /);
});

test('TODO período tiene sujeto — un chip nuevo no puede dejar la frase coja', () => {
  // Sin esto, agregar una key a PERIODOS produciría "undefined te quedaron $X".
  for (const periodo of PERIODO_ORDEN) {
    const frase = titularRentabilidad({ periodo, margenTotal: 1, hayVentas: true });
    assert.ok(!frase.includes('undefined'), `${periodo} no tiene sujeto`);
    assert.ok(frase.length > 20, `${periodo} da una frase sospechosamente corta`);
  }
});

test('la PÉRDIDA se nombra pérdida, sin signo que decodificar', () => {
  const frase = titularRentabilidad({ periodo: 'mes', margenTotal: -50_000, hayVentas: true });
  assert.match(frase, /^Este mes perdiste /);
  assert.ok(!frase.includes('-'), 'el titular no debe mostrar el signo negativo');
  assert.ok(!frase.includes('−'), 'el titular no debe mostrar el signo negativo');
});

test('cero CON ventas y cero SIN ventas son frases distintas', () => {
  // EL caso que motiva el flag: vender justo al costo es información alarmante;
  // un mes sin ventas es un mes tranquilo. Colapsarlos haría que el segundo se
  // leyera como el primero.
  const vendioAlCosto = titularRentabilidad({ periodo: 'mes', margenTotal: 0, hayVentas: true });
  const sinVentas     = titularRentabilidad({ periodo: 'mes', margenTotal: 0, hayVentas: false });
  assert.notEqual(vendioAlCosto, sinVentas);
  assert.match(vendioAlCosto, /no te quedó nada después de costos/);
  assert.match(sinVentas,     /no hay ventas cobradas todavía/);
});

test('un período CERRADO sin ventas se narra en pasado, sin "todavía"', () => {
  // "El mes pasado no hay ventas todavía" le promete al dueño un cambio en un mes
  // que ya terminó.
  const cerrado = titularRentabilidad({ periodo: 'mes_anterior', margenTotal: 0, hayVentas: false });
  assert.ok(!cerrado.includes('todavía'), cerrado);
  assert.match(cerrado, /^El mes pasado no hubo ventas cobradas$/);

  // El que sigue abierto sí lo lleva: ahí "todavía" es cierto.
  const enCurso = titularRentabilidad({ periodo: 'mes', margenTotal: 0, hayVentas: false });
  assert.match(enCurso, /todavía$/);
});

test('sin ventas el titular NO menciona un monto, aunque llegue un margen', () => {
  const frase = titularRentabilidad({ periodo: 'mes', margenTotal: 999_999, hayVentas: false });
  assert.ok(!frase.includes('999'));
});

// ─── Producto estrella ────────────────────────────────────────────────────────

const fila = (producto: string, margenTotal: number): FilaMargen => ({
  productoId: producto, producto, unidades: 1, ingresos: 0,
  costoTotal: 0, margenTotal, margenUnitario: margenTotal, margenPct: null,
});

test('nombra la PRIMERA fila — no re-ordena por su cuenta', () => {
  // `agregarMargenPorSku` ya ordena por margen desc. Un segundo criterio acá
  // podría discrepar de la tabla que se ve justo debajo.
  const frase = titularProductoEstrella([fila('Origen 500g', 90_000), fila('Tolima', 20_000)]);
  assert.match(frase!, /^Tu producto más rentable: Origen 500g/);
  assert.ok(frase!.includes('90'));
});

test('sin filas costeables NO se emite la línea', () => {
  assert.equal(titularProductoEstrella([]), null);
});

// ─── Cartera ──────────────────────────────────────────────────────────────────

const cartera = (total: number, vencidoMonto: number, vencidoConteo: number): ResumenCartera => ({
  total,
  conteo: 1,
  buckets: [
    { bucket: 'reciente', label: '', conteo: 1, monto: total - vencidoMonto, query: '' },
    { bucket: 'medio',    label: '', conteo: 0, monto: 0, query: '' },
    { bucket: 'vencido',  label: '', conteo: vencidoConteo, monto: vencidoMonto, query: '' },
  ],
});

test('el bucket VIEJO sube al titular cuando existe', () => {
  // El punto entero del pase: antes había que leer y comparar tres tarjetas para
  // descubrir que una parte de la plata llevaba semanas quieta.
  const frase = titularCartera(cartera(500_000, 120_000, 2));
  assert.match(frase, /en la calle/);
  assert.match(frase, new RegExp(`hace más de ${CARTERA_DIAS_MEDIO} días`));
  assert.ok(frase.includes('·'), 'las dos mitades van separadas por el punto medio');
});

test('sin cartera vencida el titular NO inventa la segunda mitad', () => {
  const frase = titularCartera(cartera(500_000, 0, 0));
  assert.ok(!frase.includes('·'));
  assert.ok(!frase.includes('hace más de'));
});

test('un bucket vencido en CERO no cuenta como vencido', () => {
  // Los tres buckets se devuelven siempre, incluso vacíos: la frase tiene que
  // mirar el conteo, no la mera existencia del bucket.
  assert.ok(!titularCartera(cartera(80_000, 0, 0)).includes('hace más de'));
});

test('el umbral de la frase sale de la CONSTANTE, no de un 15 tecleado', () => {
  const frase = titularCartera(cartera(500_000, 1, 1));
  assert.ok(frase.includes(String(CARTERA_DIAS_MEDIO)));
});

// ─── Concentración ────────────────────────────────────────────────────────────

const conc = (pct: number | null, top: number): Concentracion => ({
  top:      Array.from({ length: top }, (_, i) => ({ id: `c${i}`, nombre: `C${i}`, total: 1, ordenes: 1 })),
  totalTop: 1, total: 1, pct, clientes: top,
});

test('la frase de concentración lidera el bloque con su %', () => {
  assert.equal(titularConcentracion(conc(72.4, 5)), 'El 72% de tus ingresos viene de 5 clientes');
});

test('un solo cliente va en singular', () => {
  assert.match(titularConcentracion(conc(100, 1))!, /viene de 1 cliente$/);
});

test('sin base de muestra el bloque abre SIN titular, no con un 100% falso', () => {
  assert.equal(titularConcentracion(conc(null, 5)), null);
});
