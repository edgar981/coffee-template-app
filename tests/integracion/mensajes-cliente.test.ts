import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from './fixtures';
import { siteSettingsEditableSchema } from '@/lib/config/site-settings-schema';
import { readSiteSettings } from '@/lib/config/site-settings-read';
import { mensajeWhatsappPedido, mensajeWhatsappCliente } from '@/lib/admin/mensajes-whatsapp';

// EL VIAJE de punta a punta de "Mensajes al cliente" (§ PEDIDOS-WHATSAPP-MENSAJES-EDITABLES-1):
// Configuración manda el form → el ROUTE lo pasa por `siteSettingsEditableSchema` (la misma
// fuente que `MensajesClienteSeccion` usa en el cliente) → se escribe en `SiteSetting` → el
// mensaje real de un pedido (los TRES llamadores de `lib/admin/mensajes-whatsapp.ts`) lo lee de
// vuelta por `readSiteSettings`. Un test con mocks pasaría contra un schema que strippea el
// campo en silencio (§ el bug #65-B de Presentaciones, la misma familia) — por eso esto va en
// el carril, pasando por el schema REAL, como hace `presentaciones-viaje.test.ts`.

const DEFAULT_ID = 'default';

/** Simula EXACTAMENTE lo que hace la ruta: lee el estado actual, construye el payload
 *  COMPLETO (el write de este endpoint no es parcial) con `mensajesWhatsapp` sobrescrito, lo
 *  pasa por el schema real, y escribe. */
async function patchComoLaRuta(mensajesWhatsapp: Record<string, string>) {
  const actual = await prisma.siteSetting.findUniqueOrThrow({ where: { id: DEFAULT_ID } });
  const parsed = siteSettingsEditableSchema.parse({
    nombre:            actual.nombre,
    tagline:           actual.tagline,
    descripcionFooter: actual.descripcionFooter,
    whatsapp:          actual.whatsapp,
    instagram:         actual.instagram,
    emailRemitente:    actual.emailRemitente,
    emailReplyTo:      actual.emailReplyTo,
    adminEmail:        actual.adminEmail,
    metodosPago:       actual.metodosPago,
    metodosPasarela:   actual.metodosPasarela,
    mensajesWhatsapp,
  });
  await prisma.siteSetting.update({
    where: { id: DEFAULT_ID },
    data: {
      nombre:            parsed.nombre,
      tagline:           parsed.tagline,
      descripcionFooter: parsed.descripcionFooter,
      whatsapp:          parsed.whatsapp,
      instagram:         parsed.instagram,
      emailRemitente:    parsed.emailRemitente,
      emailReplyTo:      parsed.emailReplyTo || null,
      adminEmail:        parsed.adminEmail || null,
      metodosPago:       parsed.metodosPago,
      metodosPasarela:   parsed.metodosPasarela,
      mensajesWhatsapp:  parsed.mensajesWhatsapp,
    },
  });
}

async function limpiarMensajes() {
  await prisma.siteSetting.update({ where: { id: DEFAULT_ID }, data: { mensajesWhatsapp: {} } });
}

// La fila que la MIGRACIÓN inserta trae valores NEUTROS (`nombre: 'Configura tu tienda'`, el
// resto VACÍO; § `20260824120000_add_site_setting`) — un despliegue fresco sin que el dueño haya
// configurado nada todavía. `patchComoLaRuta` ECHOEA esos campos tal cual (no los toca), así que
// sin una base VÁLIDA el schema real los rechaza por razones AJENAS a `mensajesWhatsapp` (tagline
// vacío, instagram vacío…) — no es un bug de este slice, es que la fila recién migrada nunca pasó
// por Configuración. Se siembra una base válida UNA vez, como haría el dueño al configurar la
// tienda por primera vez.
async function sembrarBaseValida() {
  await prisma.siteSetting.update({
    where: { id: DEFAULT_ID },
    data: {
      nombre: 'Tienda Test', tagline: 'Café de prueba', descripcionFooter: 'Pie de prueba',
      whatsapp: '+573001234567', instagram: 'tiendatest', emailRemitente: 'Tienda Test <hola@tiendatest.com>',
      emailReplyTo: null, adminEmail: null,
      metodosPago: [{ tipo: 'efectivo', datos: {} }], metodosPasarela: [],
      mensajesWhatsapp: {},
    },
  });
}

before(sembrarBaseValida);
after(async () => { await limpiarMensajes(); await prisma.$disconnect(); });

test('guardar por la ruta real → releer por el schema real → el mensaje de "en camino" usa el texto guardado', async () => {
  await patchComoLaRuta({ en_camino: 'Oye {nombre}! Tu pedido {pedido} va en camino: {rastreo}' });

  const settings = await readSiteSettings();
  const mensaje = mensajeWhatsappPedido(
    { shippingEstado: 'en_ruta' },
    { nombreCompleto: 'Camilo Rojas', tienda: settings.nombre, numeroOrden: 'CN-100', rastreo: 'https://x/rastrear' },
    settings.mensajesWhatsapp,
  );
  assert.equal(mensaje, 'Oye Camilo! Tu pedido CN-100 va en camino: https://x/rastrear');
});

test('guardar el saludo de la ficha del cliente → el mensaje sin pedido usa el texto guardado', async () => {
  await patchComoLaRuta({ saludo_cliente: 'Hola {nombre}! Somos {tienda}, qué gusto.' });

  const settings = await readSiteSettings();
  const mensaje = mensajeWhatsappCliente('Ana María', settings.nombre, settings.mensajesWhatsapp);
  assert.equal(mensaje, `Hola Ana! Somos ${settings.nombre}, qué gusto.`);
});

test('restaurar (omitir la clave en el PATCH siguiente) vuelve a la plantilla de fábrica', async () => {
  await patchComoLaRuta({ en_camino: 'Texto personalizado que debe desaparecer' });
  // "Restaurar el texto por defecto": el siguiente guardado NO incluye `en_camino`.
  await patchComoLaRuta({});

  const settings = await readSiteSettings();
  assert.equal(settings.mensajesWhatsapp.en_camino, undefined);

  const mensaje = mensajeWhatsappPedido(
    { shippingEstado: 'en_ruta' },
    { tienda: settings.nombre, numeroOrden: 'CN-1', rastreo: 'https://x' },
    settings.mensajesWhatsapp,
  );
  assert.ok(!mensaje.includes('personalizado'), 'el texto custom no debe sobrevivir a la restauración');
  assert.match(mensaje, /va en camino/, 'debe volver a la plantilla de fábrica');
});

test('un momento sin personalizar junto a otro personalizado: cada uno resuelve el suyo', async () => {
  await patchComoLaRuta({ entregado: 'Gracias {nombre} por tu compra en {tienda}!' });

  const settings = await readSiteSettings();
  assert.equal(settings.mensajesWhatsapp.pago_pendiente, undefined);

  const entregado = mensajeWhatsappPedido(
    { shippingEstado: 'entregado' },
    { nombreCompleto: 'Luz', tienda: settings.nombre, numeroOrden: 'CN-2' },
    settings.mensajesWhatsapp,
  );
  assert.equal(entregado, `Gracias Luz por tu compra en ${settings.nombre}!`);

  const pendiente = mensajeWhatsappPedido(
    { estado: 'pendiente' },
    { nombreCompleto: 'Luz', tienda: settings.nombre, numeroOrden: 'CN-2' },
    settings.mensajesWhatsapp,
  );
  assert.match(pendiente, /Quedó pendiente el pago/);
});
