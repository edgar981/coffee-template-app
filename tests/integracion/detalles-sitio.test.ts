import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from './fixtures';
import { readSiteSettings } from '@/lib/config/site-settings-read';

// `readSiteSettings` es el lector RAW de `SiteSetting` — SOFT en todo lo que no sea las
// columnas garantizadas por la migración (§ CLAUDE.md, Config del negocio). `mensajesWhatsapp`
// (§ PEDIDOS-WHATSAPP-MENSAJES-EDITABLES-1) es JSON libre que nadie más que nuestra propia
// ruta escribe HOY, pero el loader no puede asumirlo: una fila tocada a mano, o escrita por
// una versión futura con otras claves, no debe tumbar el loader. Se afirma contra Postgres
// real porque el parseo SOFT (`parseMensajesWhatsapp`) sólo se prueba leyendo la fila de
// verdad — un mock del cliente de Prisma no ejercitaría la columna cruda.

const DEFAULT_ID = 'default';

async function setMensajesCrudo(valor: unknown) {
  // El campo es `Json` NOT NULL con default `'{}'`; un valor JS arbitrario (objeto, array,
  // string) es un valor JSON válido para esa columna — no hace falta SQL crudo.
  await prisma.siteSetting.update({ where: { id: DEFAULT_ID }, data: { mensajesWhatsapp: valor as object } });
}

before(() => setMensajesCrudo({}));
after(async () => { await setMensajesCrudo({}); await prisma.$disconnect(); });

test('fila con mensajesWhatsapp vacío ({}) → SiteSettings.mensajesWhatsapp es {}', async () => {
  await setMensajesCrudo({});
  const s = await readSiteSettings();
  assert.deepEqual(s.mensajesWhatsapp, {});
});

test('JSON con una clave VÁLIDA y claves/valores basura → sólo la válida sobrevive', async () => {
  await setMensajesCrudo({ en_camino: 'Custom', clave_inventada: 'x', pago_pendiente: 42, entregado: '' });
  const s = await readSiteSettings();
  assert.deepEqual(s.mensajesWhatsapp, { en_camino: 'Custom' });
});

test('JSON que NO es un objeto plano (array) → no revienta, cae a {}', async () => {
  await setMensajesCrudo(['no', 'es', 'un', 'objeto']);
  const s = await readSiteSettings();
  assert.deepEqual(s.mensajesWhatsapp, {});
});

test('las CINCO claves válidas, todas presentes → las cinco sobreviven', async () => {
  await setMensajesCrudo({
    pago_pendiente:  'A',
    pago_confirmado: 'B',
    en_camino:       'C',
    entregado:       'D',
    saludo_cliente:  'E',
  });
  const s = await readSiteSettings();
  assert.deepEqual(s.mensajesWhatsapp, {
    pago_pendiente:  'A',
    pago_confirmado: 'B',
    en_camino:       'C',
    entregado:       'D',
    saludo_cliente:  'E',
  });
});
