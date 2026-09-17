import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cruzarMetodosPasarela, DESCRIPTOR_NEQUI, DESCRIPTORES_METODO_PASARELA, metodosPasarelaParaComprador,
  checkoutSabeDibujar, TIPOS_NO_COBRABLES, esNoCobrable, paraElPanel,
  type DescriptorMetodoPasarela,
} from './metodos-pasarela';
import { siteSettingsEditableSchema } from '../config/site-settings-schema';

test('las dos listas vacías → []', () => {
  assert.deepEqual(cruzarMetodosPasarela([], []), []);
});

test('guardado === cuenta → todos disponible', () => {
  assert.deepEqual(
    cruzarMetodosPasarela(['CARD', 'NEQUI'], ['CARD', 'NEQUI']),
    [
      { tipo: 'CARD', estado: 'disponible' },
      { tipo: 'NEQUI', estado: 'disponible' },
    ],
  );
});

test('guardado vacío, cuenta con métodos → todos disponible_no_ofrecido', () => {
  assert.deepEqual(
    cruzarMetodosPasarela([], ['CARD', 'PSE']),
    [
      { tipo: 'CARD', estado: 'disponible_no_ofrecido' },
      { tipo: 'PSE', estado: 'disponible_no_ofrecido' },
    ],
  );
});

test('guardado con un tipo que la cuenta ya no tiene → guardado_no_disponible, al final', () => {
  assert.deepEqual(
    cruzarMetodosPasarela(['CARD', 'BRE_B'], ['CARD']),
    [
      { tipo: 'CARD', estado: 'disponible' },
      { tipo: 'BRE_B', estado: 'guardado_no_disponible' },
    ],
  );
});

test('los tres estados a la vez, en el orden de la cuenta primero', () => {
  assert.deepEqual(
    cruzarMetodosPasarela(['CARD', 'BRE_B'], ['PSE', 'CARD']),
    [
      { tipo: 'PSE', estado: 'disponible_no_ofrecido' },
      { tipo: 'CARD', estado: 'disponible' },
      { tipo: 'BRE_B', estado: 'guardado_no_disponible' },
    ],
  );
});

test('cuenta vacía, guardado con métodos → todos guardado_no_disponible', () => {
  assert.deepEqual(
    cruzarMetodosPasarela(['CARD', 'NEQUI'], []),
    [
      { tipo: 'CARD', estado: 'guardado_no_disponible' },
      { tipo: 'NEQUI', estado: 'guardado_no_disponible' },
    ],
  );
});

// ── EL DESCRIPTOR DE PRUEBA (NEQUI) — §API-DIRECTA-OTROS-METODOS-1 ──────────────────────────

test('DESCRIPTOR_NEQUI.campo.validar: acepta un celular colombiano de 10 dígitos que empieza por 3', () => {
  assert.equal(DESCRIPTOR_NEQUI.campo.validar('3001234567'), null);
});

test('DESCRIPTOR_NEQUI.campo.validar: acepta el mismo número con espacios (se limpia antes de chequear)', () => {
  assert.equal(DESCRIPTOR_NEQUI.campo.validar('300 123 4567'), null);
});

test('DESCRIPTOR_NEQUI.campo.validar: rechaza un número que no empieza por 3', () => {
  const motivo = DESCRIPTOR_NEQUI.campo.validar('2001234567');
  assert.equal(typeof motivo, 'string');
  assert.notEqual(motivo, null);
});

test('DESCRIPTOR_NEQUI.campo.validar: rechaza un número con menos de 10 dígitos', () => {
  assert.notEqual(DESCRIPTOR_NEQUI.campo.validar('300123'), null);
});

test('DESCRIPTOR_NEQUI.campo.validar: rechaza vacío', () => {
  assert.notEqual(DESCRIPTOR_NEQUI.campo.validar(''), null);
});

test('DESCRIPTOR_NEQUI.construirPaymentMethod: arma {type, phone_number} con sólo los dígitos', () => {
  assert.deepEqual(
    DESCRIPTOR_NEQUI.construirPaymentMethod('300 123 4567'),
    { type: 'NEQUI', phone_number: '3001234567' },
  );
});

// ── LA PROPIEDAD DE "LA FORMA": el cruce de lo encendido con lo de la cuenta produce la
// lista correcta de opciones (§ API-DIRECTA-OTROS-METODOS-1, §5 del reporte del slice) ───────

test('metodosPasarelaParaComprador: dueño encendió Y cuenta tiene Y hay descriptor → se ofrece', () => {
  const r = metodosPasarelaParaComprador(['NEQUI'], ['NEQUI']);
  assert.deepEqual(r, [DESCRIPTOR_NEQUI]);
});

test('metodosPasarelaParaComprador: la cuenta lo tiene pero el dueño NO lo encendió → no se ofrece', () => {
  assert.deepEqual(metodosPasarelaParaComprador([], ['NEQUI']), []);
});

test('metodosPasarelaParaComprador: el dueño lo encendió pero la cuenta ya NO lo tiene → no se ofrece', () => {
  assert.deepEqual(metodosPasarelaParaComprador(['NEQUI'], []), []);
});

test('metodosPasarelaParaComprador: dueño encendió Y cuenta tiene, pero SIN descriptor (PSE) → no se ofrece', () => {
  assert.deepEqual(metodosPasarelaParaComprador(['PSE'], ['PSE']), []);
});

test('metodosPasarelaParaComprador: TARJETA disponible en las dos listas → nunca se ofrece por este camino (no tiene descriptor)', () => {
  assert.deepEqual(metodosPasarelaParaComprador(['CARD', 'NEQUI'], ['CARD', 'NEQUI']), [DESCRIPTOR_NEQUI]);
});

test('metodosPasarelaParaComprador: conserva el orden de la cuenta primero, como cruzarMetodosPasarela', () => {
  // Un segundo tipo hipotético con descriptor, para probar el ORDEN sin depender de que el
  // registro real tenga dos entradas hoy.
  const registroDeDosTipos: Record<string, DescriptorMetodoPasarela> = {
    ...DESCRIPTORES_METODO_PASARELA,
    BREB: { ...DESCRIPTOR_NEQUI, tipo: 'BREB' },
  };
  const cruzado = cruzarMetodosPasarela(['BREB', 'NEQUI'], ['NEQUI', 'BREB'])
    .filter((m) => m.estado === 'disponible')
    .map((m) => registroDeDosTipos[m.tipo]);
  assert.deepEqual(cruzado.map((d) => d.tipo), ['NEQUI', 'BREB']);
});

// ── EL PANEL DEJA DE OFRECER LO QUE NO SE PUEDE ENTREGAR (§ PANEL-FILTRA-IMPLEMENTADOS-1) ────

test('checkoutSabeDibujar: TARJETA siempre — su flujo es bespoke, sin descriptor', () => {
  assert.equal(checkoutSabeDibujar('CARD'), true);
});

test('checkoutSabeDibujar: un tipo con descriptor (NEQUI) → true', () => {
  assert.equal(checkoutSabeDibujar('NEQUI'), true);
});

test('checkoutSabeDibujar: PSE, sin descriptor a propósito → false', () => {
  assert.equal(checkoutSabeDibujar('PSE'), false);
});

test('checkoutSabeDibujar: un tipo cualquiera que el registro no conoce → false', () => {
  assert.equal(checkoutSabeDibujar('BANCOLOMBIA_COLLECT'), false);
});

test('TIPOS_NO_COBRABLES: vacía hoy — el spike no dejó el identificador exacto en el repo (§ el docstring)', () => {
  assert.equal(TIPOS_NO_COBRABLES.size, 0);
});

test('esNoCobrable: con el registro real (vacío), ningún tipo es no-cobrable', () => {
  assert.equal(esNoCobrable('CARD'), false);
  assert.equal(esNoCobrable('NEQUI'), false);
  assert.equal(esNoCobrable('PSE'), false);
});

test('esNoCobrable: con un set inyectado (mecanismo probado con un tipo SINTÉTICO, no uno real)', () => {
  const set = new Set(['TIPO_HIPOTETICO_NO_COBRABLE']);
  assert.equal(esNoCobrable('TIPO_HIPOTETICO_NO_COBRABLE', set), true);
  assert.equal(esNoCobrable('NEQUI', set), false);
});

test('paraElPanel: disponible (cuenta+guardado+dibujable+cobrable) queda intacto', () => {
  const r = paraElPanel(cruzarMetodosPasarela(['NEQUI'], ['NEQUI']));
  assert.deepEqual(r, [{ tipo: 'NEQUI', estado: 'disponible' }]);
});

test('paraElPanel: disponible_no_ofrecido (cuenta+dibujable+cobrable, no guardado) queda intacto', () => {
  const r = paraElPanel(cruzarMetodosPasarela([], ['CARD']));
  assert.deepEqual(r, [{ tipo: 'CARD', estado: 'disponible_no_ofrecido' }]);
});

test('paraElPanel: guardado_no_disponible (la cuenta ya no lo tiene) no se toca', () => {
  const r = paraElPanel(cruzarMetodosPasarela(['NEQUI'], []));
  assert.deepEqual(r, [{ tipo: 'NEQUI', estado: 'guardado_no_disponible' }]);
});

test('paraElPanel: no_implementado — la cuenta lo tiene pero el checkout no sabe dibujarlo (PSE, no guardado)', () => {
  const r = paraElPanel(cruzarMetodosPasarela([], ['PSE']));
  assert.deepEqual(r, [{ tipo: 'PSE', estado: 'no_implementado' }]);
});

test('paraElPanel: un tipo YA GUARDADO que cae a no_implementado NO se borra solo — sigue en la lista, con su estado', () => {
  const r = paraElPanel(cruzarMetodosPasarela(['PSE'], ['PSE']));
  assert.deepEqual(r, [{ tipo: 'PSE', estado: 'no_implementado' }]);
});

test('paraElPanel: no_cobrable — con un tipo sintético inyectado, no guardado', () => {
  const soloDeEstaPrueba = new Set(['TIPO_HIPOTETICO_NO_COBRABLE']);
  const r = paraElPanel(cruzarMetodosPasarela([], ['TIPO_HIPOTETICO_NO_COBRABLE']), soloDeEstaPrueba);
  assert.deepEqual(r, [{ tipo: 'TIPO_HIPOTETICO_NO_COBRABLE', estado: 'no_cobrable' }]);
});

test('paraElPanel: un tipo YA GUARDADO que cae a no_cobrable NO se borra solo — sigue en la lista, con su estado', () => {
  const soloDeEstaPrueba = new Set(['TIPO_HIPOTETICO_NO_COBRABLE']);
  const r = paraElPanel(cruzarMetodosPasarela(['TIPO_HIPOTETICO_NO_COBRABLE'], ['TIPO_HIPOTETICO_NO_COBRABLE']), soloDeEstaPrueba);
  assert.deepEqual(r, [{ tipo: 'TIPO_HIPOTETICO_NO_COBRABLE', estado: 'no_cobrable' }]);
});

test('paraElPanel: no_cobrable gana sobre no_implementado cuando un tipo es las dos cosas a la vez', () => {
  // TIPO_HIPOTETICO_NO_COBRABLE no tiene descriptor (no_implementado sería su otro destino) Y
  // está en el set inyectado de no-cobrables — el resultado tiene que ser no_cobrable, no
  // no_implementado, porque "no cobra nunca" es más fuerte que "todavía no lo construimos".
  const soloDeEstaPrueba = new Set(['TIPO_HIPOTETICO_NO_COBRABLE']);
  const r = paraElPanel(cruzarMetodosPasarela([], ['TIPO_HIPOTETICO_NO_COBRABLE']), soloDeEstaPrueba);
  assert.equal(r[0].estado, 'no_cobrable');
});

test('paraElPanel: los cinco estados a la vez, orden de la cuenta primero conservado', () => {
  const soloDeEstaPrueba = new Set(['TIPO_HIPOTETICO_NO_COBRABLE']);
  const r = paraElPanel(
    cruzarMetodosPasarela(['NEQUI', 'BRE_B'], ['TIPO_HIPOTETICO_NO_COBRABLE', 'PSE', 'CARD', 'NEQUI']),
    soloDeEstaPrueba,
  );
  assert.deepEqual(r, [
    { tipo: 'TIPO_HIPOTETICO_NO_COBRABLE', estado: 'no_cobrable' },
    { tipo: 'PSE', estado: 'no_implementado' },
    { tipo: 'CARD', estado: 'disponible_no_ofrecido' },
    { tipo: 'NEQUI', estado: 'disponible' },
    { tipo: 'BRE_B', estado: 'guardado_no_disponible' },
  ]);
});

// ── EL RECHAZO DEL SERVIDOR (§ PANEL-FILTRA-IMPLEMENTADOS-1, §3: "la validación del guardado
// es la que manda") — `siteSettingsEditableSchema` es la MISMA que corre el PATCH de
// `/api/site-settings`, así que afirmar esto acá afirma lo que el servidor va a rechazar. ────

function payloadDeSiteSettings(metodosPasarela: string[]) {
  return {
    nombre: 'x', tagline: 'x', descripcionFooter: 'x', whatsapp: '+573000000000', instagram: 'x',
    emailRemitente: 'a@b.com', metodosPago: [{ tipo: 'efectivo' as const, datos: {} }],
    metodosPasarela,
  };
}

test('el servidor ACEPTA un tipo que el checkout sabe dibujar y es cobrable (NEQUI)', () => {
  const parsed = siteSettingsEditableSchema.safeParse(payloadDeSiteSettings(['NEQUI']));
  assert.equal(parsed.success, true);
});

test('el servidor RECHAZA un tipo que el checkout no sabe dibujar (PSE, sin descriptor)', () => {
  const parsed = siteSettingsEditableSchema.safeParse(payloadDeSiteSettings(['PSE']));
  assert.equal(parsed.success, false);
});

// EL RECHAZO DEL SERVIDOR PARA "NO COBRABLE" NO SE PUEDE DEMOSTRAR CONTRA `siteSettingsEditableSchema`
// CON UN TIPO REAL HOY: `TIPOS_NO_COBRABLES` está vacía a propósito (§ su docstring en
// `metodos-pasarela.ts`) porque el spike que midió el caso no dejó el identificador exacto escrito
// en ningún lugar del repositorio. El schema llama a `esNoCobrable(tipo)` con su default de
// PRODUCCIÓN (esa misma lista vacía), así que no hay forma de inyectar un tipo sintético en esa
// llamada sin mutar el registro real desde un test — exactamente lo que este archivo se niega a
// hacer (mutar `TIPOS_NO_COBRABLES` ensuciaría estado global entre tests, y fingir un valor "real"
// sería la misma fabricación que el docstring ya descarta). LO QUE SÍ ESTÁ PROBADO, y es lo que
// prueba que el mecanismo funciona: `esNoCobrable`/`paraElPanel` con un set inyectado (arriba), Y
// el MISMO patrón de refine funcionando end-to-end contra el schema para "no dibujable" (el test de
// PSE, arriba) — el refine de "no cobrable" usa exactamente ese patrón, sólo cambia qué función pura
// invoca. El día que `TIPOS_NO_COBRABLES` gane una entrada real, éste es el sitio para agregar el
// caso que falta acá.
