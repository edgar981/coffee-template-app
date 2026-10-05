import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PARTES_CONFIGURACION, PARTE_DEFAULT, parteValida,
  payloadBaseDesdeSettings, repartirErroresBloque, DESCRIPCION_ROL, ROLES_ASIGNABLES,
  confirmacionCambioRol, venceEn,
} from './configuracion-partes';
import type { SiteSettings } from '@/lib/config/site-settings';

// ─── Subsecciones ─────────────────────────────────────────────────────────────

test('PARTE_DEFAULT es la primera de PARTES_CONFIGURACION — el nav y el default no pueden divergir', () => {
  assert.equal(PARTE_DEFAULT, PARTES_CONFIGURACION[0].id);
});

test('PARTES_CONFIGURACION trae las cinco subsecciones del spec, en orden', () => {
  assert.deepEqual(PARTES_CONFIGURACION.map(p => p.id), ['negocio', 'contacto', 'correos', 'pagos', 'equipo']);
});

test('parteValida: un valor válido se devuelve tal cual', () => {
  assert.equal(parteValida('equipo'), 'equipo');
  assert.equal(parteValida('pagos'), 'pagos');
});

test('parteValida: ausente, vacío o desconocido cae al default — nunca pantalla en blanco', () => {
  assert.equal(parteValida(null), PARTE_DEFAULT);
  assert.equal(parteValida(undefined), PARTE_DEFAULT);
  assert.equal(parteValida(''), PARTE_DEFAULT);
  assert.equal(parteValida('usuarios'), PARTE_DEFAULT); // la ruta vieja `/configuracion/usuarios`
  assert.equal(parteValida('NEGOCIO'), PARTE_DEFAULT);  // sensible a mayúsculas: no inventa un match
});

// ─── El payload base ──────────────────────────────────────────────────────────

function settingsDePrueba(overrides: Partial<SiteSettings> = {}): SiteSettings {
  return {
    nombre:            'Finca San Adolfo',
    tagline:           'Café de familia',
    descripcionFooter: 'Más que una buena taza.',
    whatsapp:          '+57 310 555 0142',
    instagram:         'fincasanadolfo',
    emailRemitente:    'Finca San Adolfo <hola@fincasanadolfo.co>',
    emailReplyTo:      null,
    adminEmail:        null,
    metodosPago:       [{ tipo: 'efectivo', datos: {} }],
    redes:             [{ tipo: 'instagram', valor: 'fincasanadolfo' }],
    metodoPasarelaDesalineado: null,
    ...overrides,
  };
}

test('payloadBaseDesdeSettings: preserva TODOS los campos del bloque ajeno sin tocarlos', () => {
  const payload = payloadBaseDesdeSettings(settingsDePrueba(), ['TARJETA_CREDITO']);
  assert.deepEqual(payload, {
    nombre:            'Finca San Adolfo',
    tagline:           'Café de familia',
    descripcionFooter: 'Más que una buena taza.',
    whatsapp:          '+57 310 555 0142',
    instagram:         'fincasanadolfo',
    emailRemitente:    'Finca San Adolfo <hola@fincasanadolfo.co>',
    emailReplyTo:      '',
    adminEmail:        '',
    metodosPago:       [{ tipo: 'efectivo', datos: {} }],
    metodosPasarela:   ['TARJETA_CREDITO'],
    redes:             [{ tipo: 'instagram', valor: 'fincasanadolfo' }],
  });
});

test('payloadBaseDesdeSettings: emailReplyTo/adminEmail null se normalizan a cadena vacía, nunca "null"', () => {
  const payload = payloadBaseDesdeSettings(settingsDePrueba({ emailReplyTo: null, adminEmail: null }), []);
  assert.equal(payload.emailReplyTo, '');
  assert.equal(payload.adminEmail, '');
});

test('payloadBaseDesdeSettings: emailReplyTo/adminEmail con valor viajan tal cual', () => {
  const payload = payloadBaseDesdeSettings(
    settingsDePrueba({ emailReplyTo: 'resp@x.com', adminEmail: 'reportes@x.com' }), [],
  );
  assert.equal(payload.emailReplyTo, 'resp@x.com');
  assert.equal(payload.adminEmail, 'reportes@x.com');
});

test('payloadBaseDesdeSettings: metodosPasarela es SIEMPRE el que se pasó — nunca inventado de settings', () => {
  const payload = payloadBaseDesdeSettings(settingsDePrueba(), ['NEQUI', 'PSE']);
  assert.deepEqual(payload.metodosPasarela, ['NEQUI', 'PSE']);
});

// ─── repartirErroresBloque — un error AJENO nunca se pierde en silencio ──────

const mapaIdentidad = (campo: string): 'nombre' | 'tagline' | null =>
  campo === 'nombre' || campo === 'tagline' ? campo : null;

test('repartirErroresBloque: un error de un campo PROPIO va a `propios`', () => {
  const r = repartirErroresBloque([{ path: ['nombre'], message: 'El nombre es obligatorio' }], mapaIdentidad);
  assert.deepEqual(r.propios, { nombre: 'El nombre es obligatorio' });
  assert.equal(r.errorAjeno, null);
});

test('repartirErroresBloque: un error de un campo AJENO (whatsapp, que Identidad no edita) NO desaparece — va a errorAjeno', () => {
  const r = repartirErroresBloque([{ path: ['whatsapp'], message: 'Teléfono inválido' }], mapaIdentidad);
  assert.deepEqual(r.propios, {});
  assert.ok(r.errorAjeno, 'un error ajeno sin dónde caer se perdió en silencio');
  assert.match(r.errorAjeno!, /Teléfono inválido/);
});

test('repartirErroresBloque: sólo el PRIMER campo de cada bando se reporta (como ya hacía `if (!errs[destino])`)', () => {
  const r = repartirErroresBloque(
    [
      { path: ['nombre'], message: 'primero propio' },
      { path: ['nombre'], message: 'segundo propio' },
      { path: ['whatsapp'], message: 'primero ajeno' },
      { path: ['adminEmail'], message: 'segundo ajeno' },
    ],
    mapaIdentidad,
  );
  assert.equal(r.propios.nombre, 'primero propio');
  assert.match(r.errorAjeno!, /primero ajeno/);
});

test('repartirErroresBloque: sin issues, no hay nada que reportar', () => {
  const r = repartirErroresBloque([], mapaIdentidad);
  assert.deepEqual(r.propios, {});
  assert.equal(r.errorAjeno, null);
});

// ─── Equipo: una sola fuente de descripciones ────────────────────────────────

test('DESCRIPCION_ROL declara los tres roles del enum (incluido STAFF, append-only)', () => {
  assert.equal(typeof DESCRIPCION_ROL.OWNER, 'string');
  assert.equal(typeof DESCRIPCION_ROL.MANAGER, 'string');
  assert.equal(typeof DESCRIPCION_ROL.STAFF, 'string');
  assert.ok(DESCRIPCION_ROL.OWNER.length > 0);
});

test('ROLES_ASIGNABLES: OWNER y MANAGER, STAFF queda fuera — bajar a alguien a un rol sin acceso', () => {
  // `deepEqual` contra el array EXACTO ya prueba que STAFF está fuera — y el tipo de
  // `ROLES_ASIGNABLES` (`RolAsignable[]`) hace que un STAFF ahí sea un error de COMPILACIÓN,
  // no sólo de runtime: `ROLES_ASIGNABLES.includes('STAFF')` ni siquiera tipa.
  assert.deepEqual(ROLES_ASIGNABLES, ['OWNER', 'MANAGER']);
});

test('confirmacionCambioRol: promover a dueño nombra a la persona y la consecuencia', () => {
  const c = confirmacionCambioRol('Natalia Mejía', 'OWNER');
  assert.match(c.titulo, /Natalia Mejía/);
  assert.match(c.titulo, /dueñ/);
  assert.match(c.consecuencia, /medios de pago/);
});

test('confirmacionCambioRol: bajar a gerente también nombra a la persona y dice qué pierde', () => {
  const c = confirmacionCambioRol('Carlos Ibáñez', 'MANAGER');
  assert.match(c.titulo, /Carlos Ibáñez/);
  assert.match(c.titulo, /gerente/);
  assert.match(c.consecuencia, /Deja de ver/);
});

// ─── venceEn ──────────────────────────────────────────────────────────────────

test('venceEn: ya pasado el vencimiento → "Vencida"', () => {
  const ahora = new Date('2026-01-10T12:00:00Z');
  assert.equal(venceEn(new Date('2026-01-10T11:59:00Z'), ahora), 'Vencida');
  assert.equal(venceEn(new Date('2026-01-09T12:00:00Z'), ahora), 'Vencida');
});

test('venceEn: menos de media hora (redondea bajo 1h) → "Vence pronto"', () => {
  const ahora = new Date('2026-01-10T12:00:00Z');
  assert.equal(venceEn(new Date('2026-01-10T12:10:00Z'), ahora), 'Vence pronto');
});

test('venceEn: entre 1 y 24 horas → "Vence en N h"', () => {
  const ahora = new Date('2026-01-10T12:00:00Z');
  assert.equal(venceEn(new Date('2026-01-10T17:00:00Z'), ahora), 'Vence en 5 h');
});

test('venceEn: 24 horas o más → "Vence en N día(s)", singular/plural correcto', () => {
  const ahora = new Date('2026-01-10T12:00:00Z');
  assert.equal(venceEn(new Date('2026-01-11T12:00:00Z'), ahora), 'Vence en 1 día');
  assert.equal(venceEn(new Date('2026-01-15T12:00:00Z'), ahora), 'Vence en 5 días');
});
