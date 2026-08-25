import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from './fixtures';
import { reporteSinDestinatario } from '@/lib/automations/destinatario-reporte';
import { dispatchEmail } from '@/lib/automations/channels/email';

// EL GUARD del PATCH de /api/automations/[key]: un reporte al EQUIPO por correo no puede
// quedar ENCENDIDO sin destinatario efectivo, porque el motor lo dejaría OMITIENDO en
// SILENCIO en cada corrida (config vacía Y sin correo del negocio). `reporteSinDestinatario`
// es la MISMA decisión que el PATCH aplica en la puerta.
//
// Se afirma en el CARRIL y no con mocks porque el guard lee `SiteSetting.adminEmail` (vía
// `parseRecipients`) de la base: un test con mocks pasaría contra un guard roto. El HTTP
// del PATCH no lo monta el carril; su lógica —esta función— sí. Neutralizar el guard
// (que devuelva siempre `false`) hace fallar el primer test: la "vista fallar sin el
// bloqueo" que exige la doctrina.

async function setAdminEmail(v: string | null) {
  await prisma.siteSetting.update({ where: { id: 'default' }, data: { adminEmail: v } });
}

before(() => setAdminEmail(null));
after(async () => { await setAdminEmail(null); await prisma.$disconnect(); });

test('sin destinatarios en config Y sin correo del negocio → BLOQUEA', async () => {
  await setAdminEmail(null);
  assert.equal(await reporteSinDestinatario('reporte_semanal', { destinatarios: '' }), true);
  assert.equal(await reporteSinDestinatario('resumen_diario', {}), true);
});

test('con destinatarios en la config → NO bloquea, aunque no haya correo del negocio', async () => {
  await setAdminEmail(null);
  assert.equal(await reporteSinDestinatario('reporte_semanal', { destinatarios: 'equipo@x.com' }), false);
});

test('sin config pero con correo del negocio (SiteSetting.adminEmail) → NO bloquea', async () => {
  await setAdminEmail('negocio@x.com');
  assert.equal(await reporteSinDestinatario('reporte_semanal', { destinatarios: '' }), false);
});

test('el guard NO aplica fuera de email+equipo', async () => {
  await setAdminEmail(null);
  assert.equal(await reporteSinDestinatario('stock_bajo', {}), false);   // interno + equipo
  assert.equal(await reporteSinDestinatario('nueva_orden', {}), false);  // whatsapp + cliente
  assert.equal(await reporteSinDestinatario('inexistente', {}), false);  // key desconocida
});

// LA CONSECUENCIA que el guard previene, hecha visible: sin destinatario, el envío cae en
// OMITIDO silencioso —el barrido corre "bien", no manda nada, y nada lo delata salvo un
// warn—. Ese es exactamente el estado inconsistente que el 400 del PATCH impide alcanzar.
test('un reporte al equipo sin destinatario OMITE en silencio (lo que el guard evita)', async () => {
  const res = await dispatchEmail({
    canal: 'email', audiencia: 'equipo', to: [],
    email: { subject: 'Reporte', html: '<p>x</p>', text: 'x' },
  });
  assert.equal(res.estado, 'OMITIDO');
});
