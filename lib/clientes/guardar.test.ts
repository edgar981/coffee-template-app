import { test } from 'node:test';
import assert from 'node:assert/strict';
import { problemaGuardarCliente, hayCambiosCliente } from './guardar';
import type { CustomerForm } from '@/types/customer';

const base: CustomerForm = {
  nombre:    'Laura Cárdenas',
  email:     'l@ej.com',
  telefono:  '3001234567',
  ciudad:    'Cali',
  direccion: 'Cra 1 # 2-3',
  canal:     'whatsapp',
  notas:     '',
};

const form = (patch: Partial<CustomerForm>): CustomerForm => ({ ...base, ...patch });

// ── El nombre, con `trim` ────────────────────────────────────────────────────

test('sin nombre, el problema es el nombre', () => {
  assert.equal(problemaGuardarCliente(form({ nombre: '' }), null)?.campo, 'nombre');
});

test('un nombre de puros espacios no es un nombre', () => {
  assert.equal(problemaGuardarCliente(form({ nombre: '   ' }), base)?.campo, 'nombre');
});

// ── El alta: sin `inicial` no existe el "no hay cambios" ─────────────────────

test('en alta, un formulario con nombre no tiene problema', () => {
  assert.equal(problemaGuardarCliente(base, null), null);
});

// ── La edición: el "no hay cambios" es un problema ───────────────────────────

test('editar sin tocar nada: el problema es que no hay cambios', () => {
  const p = problemaGuardarCliente({ ...base }, base);
  assert.equal(p?.campo, 'sin_cambios');
});

test('editar cambiando un campo: no hay problema', () => {
  assert.equal(problemaGuardarCliente(form({ ciudad: 'Bogotá' }), base), null);
});

// Vaciar un campo opcional ES un cambio (Object.is): quitarle el correo a un
// cliente tiene que poder guardarse.
test('vaciar el correo es un cambio guardable', () => {
  assert.equal(problemaGuardarCliente(form({ email: '' }), base), null);
});

// ── El orden: el nombre gana sobre el "no hay cambios" ───────────────────────

test('sin nombre Y sin cambios, gana el nombre (está más arriba)', () => {
  // Un cliente que abrió sin nombre (dato viejo) y no se tocó: se reporta el
  // nombre, que es lo que el operador va a encontrar primero.
  const inicial = form({ nombre: '' });
  assert.equal(problemaGuardarCliente({ ...inicial }, inicial)?.campo, 'nombre');
});

// ── El cálculo de "sucio" que la guarda de descarte reusa ────────────────────

test('hayCambiosCliente: igual a sí mismo = sin cambios', () => {
  assert.equal(hayCambiosCliente({ ...base }, base), false);
});

test('hayCambiosCliente: un campo distinto = hay cambios', () => {
  assert.equal(hayCambiosCliente(form({ notas: 'VIP' }), base), true);
});
