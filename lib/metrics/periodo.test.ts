import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rangoDeDiasDelPeriodo, opcionesPreset, anioPisoPicker } from './periodo';

// Capa 1 — puro. Los presets REUSAN la definición de período de Analítica
// (`rangoDelPeriodo`) y la traducen a day keys de Bogotá INCLUSIVOS. Lo que se
// afirma: un período EN CURSO termina HOY (no al final del período —eso mostraba
// días futuros—), un período CERRADO va completo, y todo con la frontera de Bogotá.

const MED_MAYO = new Date('2026-05-15T18:00:00Z'); // 15 may 13:00 Bogotá

test('Este mes termina HOY, no al final del mes — no muestra días futuros', () => {
  // El defecto que esto fija: antes daba `hasta: 2026-05-31` (el mes calendario
  // entero) aunque hoy fuera el 15, arrastrando 16 días futuros.
  assert.deepEqual(rangoDeDiasDelPeriodo('mes', MED_MAYO), { desde: '2026-05-01', hasta: '2026-05-15' });
});

test('Últimos 3 meses: ventana móvil (incluye el mes en curso) y TAMBIÉN termina hoy', () => {
  // Mar + Abr + May, pero el tope es hoy (15), no el 31 — el mismo defecto que `mes`.
  assert.deepEqual(rangoDeDiasDelPeriodo('ultimos_3_meses', MED_MAYO), { desde: '2026-03-01', hasta: '2026-05-15' });
});

test('Este año: desde el 1 de enero y termina hoy', () => {
  assert.deepEqual(rangoDeDiasDelPeriodo('anio', MED_MAYO), { desde: '2026-01-01', hasta: '2026-05-15' });
});

test('Mes pasado va COMPLETO — es un período cerrado, el cap a hoy no lo toca', () => {
  assert.deepEqual(rangoDeDiasDelPeriodo('mes_anterior', MED_MAYO), { desde: '2026-04-01', hasta: '2026-04-30' });
});

test('un período CERRADO usa el último día del CALENDARIO (feb no bisiesto = 28)', () => {
  // La cordura de "último día del mes" del calendario, no un 30/31 fijo, se afirma
  // ahora sobre un período cerrado: en marzo, "Mes pasado" es febrero completo.
  const marzo = new Date('2026-03-10T18:00:00Z'); // 10 mar 13:00 Bogotá
  assert.deepEqual(rangoDeDiasDelPeriodo('mes_anterior', marzo), { desde: '2026-02-01', hasta: '2026-02-28' });
});

test('opcionesPreset mapea cada período a { label, desde, hasta } — el mapeo que Inventario y Pagos comparten', () => {
  assert.deepEqual(opcionesPreset(['mes', 'mes_anterior'], MED_MAYO), [
    { label: 'Este mes',   desde: '2026-05-01', hasta: '2026-05-15' },
    { label: 'Mes pasado', desde: '2026-04-01', hasta: '2026-04-30' },
  ]);
});

test('el año-piso del picker cubre TODO preset alcanzable — incluido ENERO, que cruza al año anterior', () => {
  // El caso que rompía el picker: en enero "Mes pasado" apunta a DICIEMBRE del año
  // ANTERIOR y "Últimos 3 meses" a noviembre. Un piso en el año en curso los deja
  // filtrando bien pero fuera de vista —no navegables en el picker—. Se simula enero,
  // no se usa la fecha de hoy: el defecto solo aparece cuando el mes en curso es enero.
  const ENE = new Date('2027-01-15T18:00:00Z'); // 15 ene 2027 13:00 Bogotá
  const pisoDia = `${anioPisoPicker(ENE)}-01-01`; // 2026-01-01 (año ANTERIOR)

  // El criterio: todo preset mensual arranca en o después del piso → navegable.
  for (const k of ['mes', 'mes_anterior', 'ultimos_3_meses'] as const) {
    const { desde } = rangoDeDiasDelPeriodo(k, ENE);
    assert.ok(desde >= pisoDia, `${k} (${desde}) debe ser navegable desde el piso ${pisoDia}`);
  }

  // El preset que lo justifica: en enero "Mes pasado" ES diciembre del año anterior.
  assert.equal(rangoDeDiasDelPeriodo('mes_anterior', ENE).desde, '2026-12-01');

  // Y el DEFECTO que el año-anterior fija: con el piso NAIVE (año en curso) ese
  // diciembre cae FUERA —el picker no lo mostraría aunque el rango lo filtrara—.
  assert.ok(rangoDeDiasDelPeriodo('mes_anterior', ENE).desde < '2027-01-01',
    'diciembre del año anterior queda bajo el piso naive: por eso el piso es el año-1');
});

test('la frontera es de BOGOTÁ, no UTC: 1 jun 04:00Z todavía es 31 MAY', () => {
  // 2026-06-01T04:00Z = 31 may 23:00 en Bogotá (UTC−5). Hoy es el 31 → "Este mes" es
  // 1–31 de mayo (hoy es el último día), no junio. Con frontera UTC naíf daría junio.
  const casiJunio = new Date('2026-06-01T04:00:00Z');
  assert.deepEqual(rangoDeDiasDelPeriodo('mes', casiJunio), { desde: '2026-05-01', hasta: '2026-05-31' });
});
