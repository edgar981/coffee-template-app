import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cruzarMetodosPasarela, DESCRIPTOR_NEQUI, DESCRIPTORES_METODO_PASARELA, metodosPasarelaParaComprador,
  checkoutSabeDibujar, TIPOS_NO_COBRABLES, esNoCobrable, paraElPanel,
  camposVisibles, esAmbientePruebasPorLlave, urlDeRedireccion, conCampoLegacy,
  agruparMetodosPasarelaPorInstrumento, ORDEN_GRUPOS_METODO_PASARELA,
  ETIQUETA_PAGO_PASARELA, subtituloPagoPasarela,
  type DescriptorMetodoPasarela, type CampoMetodoPasarela,
  type CampoTextoLibre, type CampoEleccionCerrada, type CampoConsultaExterna,
} from './metodos-pasarela';
import { PREFIJO_LLAVE_PASARELA_PRODUCTIVA } from './llaves-pasarela';
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

// ── EL DESCRIPTOR DE PRUEBA (NEQUI) — §API-DIRECTA-OTROS-METODOS-1, PORTADO A `campos`/mapa
// por § API-DIRECTA-FORMA-TRES-DIMENSIONES-1 ────────────────────────────────────────────────

test('DESCRIPTOR_NEQUI: declara UN solo campo, de naturaleza texto_libre, y campo === campos[0] (compat LEGACY)', () => {
  assert.equal(DESCRIPTOR_NEQUI.campos.length, 1);
  assert.equal(DESCRIPTOR_NEQUI.campos[0].naturaleza, 'texto_libre');
  assert.equal(DESCRIPTOR_NEQUI.campo, DESCRIPTOR_NEQUI.campos[0]);
  assert.equal(DESCRIPTOR_NEQUI.redireccion, undefined);
});

test('DESCRIPTOR_NEQUI.campo.validar (LEGACY, lo que app/api/checkout/route.ts todavía invoca): acepta un celular colombiano de 10 dígitos que empieza por 3', () => {
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

test('DESCRIPTOR_NEQUI.construirPaymentMethod: arma {type, phone_number} desde el MAPA nombre→valor (naturaleza general, § API-DIRECTA-FORMA-TRES-DIMENSIONES-1)', () => {
  assert.deepEqual(
    DESCRIPTOR_NEQUI.construirPaymentMethod({ numero: '300 123 4567' }),
    { type: 'NEQUI', phone_number: '3001234567' },
  );
});

// ── LAS TRES DIMENSIONES (§ API-DIRECTA-FORMA-TRES-DIMENSIONES-1) — probadas con descriptores
// SINTÉTICOS, nunca con NEQUI: NEQUI usa sólo una de las tres (un campo, texto libre, sin
// redirección), así que probar la forma con él repetiría el caso que la dejó corta (§ el
// reporte del slice). ───────────────────────────────────────────────────────────────────────

// -- A) CUÁNTOS campos: sin un número adentro --

test('dimensión A — campos es un array: cero, uno o varios, sin ningún límite en la forma', () => {
  const sinCampos: CampoMetodoPasarela[] = [];
  const unCampo: CampoMetodoPasarela[] = [DESCRIPTOR_NEQUI.campos[0]];
  const seisCampos: CampoMetodoPasarela[] = Array.from({ length: 6 }, (_, i) => ({
    nombre: `campo_${i}`,
    rotulo: `Campo ${i}`,
    placeholder: '',
    naturaleza: 'texto_libre' as const,
    validar: () => null,
  }));
  assert.equal(sinCampos.length, 0);
  assert.equal(unCampo.length, 1);
  assert.equal(seisCampos.length, 6);
  // El catálogo midió hasta seis en un mismo tipo (§ el spike) — la forma no rechaza ese
  // tamaño ni ninguno mayor: es sólo la longitud de un array.
});

// -- B) DE QUÉ NATURALEZA — tres formas distintas, cada una con su propio dato adjunto --

const CAMPO_TEXTO_DE_PRUEBA: CampoTextoLibre = {
  nombre: 'documento',
  rotulo: 'Número de documento',
  placeholder: '1234567890',
  naturaleza: 'texto_libre',
  validar: (valor) => (/^\d{6,15}$/.test(valor) ? null : 'Ingresa un número de documento válido.'),
};

const CAMPO_ELECCION_DE_PRUEBA: CampoEleccionCerrada = {
  nombre: 'banco',
  rotulo: 'Banco',
  naturaleza: 'eleccion_cerrada',
  opciones: [
    { valor: 'BANCO_A', etiqueta: 'Banco A' },
    { valor: 'BANCO_B', etiqueta: 'Banco B' },
  ],
  validar: (valor) => (['BANCO_A', 'BANCO_B'].includes(valor) ? null : 'Elige un banco de la lista.'),
};

const CAMPO_CONSULTA_DE_PRUEBA: CampoConsultaExterna = {
  nombre: 'sucursal',
  rotulo: 'Sucursal',
  naturaleza: 'consulta_externa',
  fuenteConsulta: 'sucursales-del-banco-elegido',
  validar: () => null,
};

test('dimensión B — texto_libre: el comprador teclea, valida con su propia función', () => {
  assert.equal(CAMPO_TEXTO_DE_PRUEBA.naturaleza, 'texto_libre');
  assert.equal(CAMPO_TEXTO_DE_PRUEBA.validar('12345678'), null);
  assert.notEqual(CAMPO_TEXTO_DE_PRUEBA.validar('abc'), null);
});

test('dimensión B — eleccion_cerrada: la lista de opciones ES PARTE del campo, no una validación suelta', () => {
  assert.equal(CAMPO_ELECCION_DE_PRUEBA.naturaleza, 'eleccion_cerrada');
  assert.equal(CAMPO_ELECCION_DE_PRUEBA.opciones.length, 2);
  assert.equal(CAMPO_ELECCION_DE_PRUEBA.validar('BANCO_A'), null);
  assert.notEqual(CAMPO_ELECCION_DE_PRUEBA.validar('BANCO_INEXISTENTE'), null);
});

test('dimensión B — consulta_externa: declara DE DÓNDE sale la lista, no la resuelve', () => {
  assert.equal(CAMPO_CONSULTA_DE_PRUEBA.naturaleza, 'consulta_externa');
  assert.equal(CAMPO_CONSULTA_DE_PRUEBA.fuenteConsulta, 'sucursales-del-banco-elegido');
  // Ningún campo así vive en el registro real todavía — § el reporte del slice.
  assert.equal(
    Object.values(DESCRIPTORES_METODO_PASARELA).some((d) => d.campos.some((c) => c.naturaleza === 'consulta_externa')),
    false,
  );
});

// -- C) SI EL MÉTODO NAVEGA AFUERA, y el nombre del campo de la URL NO es compartido --

test('dimensión C — sin redireccion declarada: urlDeRedireccion siempre null, sin importar la respuesta', () => {
  assert.equal(urlDeRedireccion(DESCRIPTOR_NEQUI, { cualquier_cosa: 'https://x.co' }), null);
});

test('dimensión C — DOS descriptores con redireccion, cada uno con su PROPIO nombre de campo de URL', () => {
  const descriptorA: DescriptorMetodoPasarela = {
    tipo: 'REDIRECT_A', nombreVisible: 'A', grupo: 'billeteras', campos: [CAMPO_TEXTO_DE_PRUEBA],
    redireccion: { campoUrl: 'async_payment_url' },
    construirPaymentMethod: () => ({ type: 'REDIRECT_A' }),
    campo: CAMPO_TEXTO_DE_PRUEBA,
  };
  const descriptorB: DescriptorMetodoPasarela = {
    tipo: 'REDIRECT_B', nombreVisible: 'B', grupo: 'debito_bancario', campos: [CAMPO_TEXTO_DE_PRUEBA],
    redireccion: { campoUrl: 'redirect_url' },
    construirPaymentMethod: () => ({ type: 'REDIRECT_B' }),
    campo: CAMPO_TEXTO_DE_PRUEBA,
  };
  // Un nombre COMPARTIDO ('async_payment_url' buscado en la respuesta de B) fallaría acá —
  // exactamente el modo de falla que el spike midió ("sin ruido", § el docstring del tipo).
  assert.equal(
    urlDeRedireccion(descriptorA, { async_payment_url: 'https://a.co/pagar' }),
    'https://a.co/pagar',
  );
  assert.equal(urlDeRedireccion(descriptorA, { redirect_url: 'https://no-es-el-campo.co' }), null);
  assert.equal(
    urlDeRedireccion(descriptorB, { redirect_url: 'https://b.co/pagar' }),
    'https://b.co/pagar',
  );
});

test('dimensión C — urlDeRedireccion: null si el campo declarado vino con un valor que no es string', () => {
  const descriptor: DescriptorMetodoPasarela = {
    tipo: 'X', nombreVisible: 'X', grupo: 'billeteras', campos: [CAMPO_TEXTO_DE_PRUEBA],
    redireccion: { campoUrl: 'url' },
    construirPaymentMethod: () => ({}),
    campo: CAMPO_TEXTO_DE_PRUEBA,
  };
  assert.equal(urlDeRedireccion(descriptor, { url: 123 }), null);
  assert.equal(urlDeRedireccion(descriptor, { url: '' }), null);
  assert.equal(urlDeRedireccion(descriptor, {}), null);
});

// -- El campo SOLO-DE-PRUEBAS (§2 del spike) — no se renderiza fuera del ambiente de pruebas --

const CAMPO_SOLO_PRUEBAS: CampoTextoLibre = {
  nombre: 'resultado_simulado',
  rotulo: 'Resultado a simular (sólo pruebas)',
  placeholder: 'APPROVED',
  naturaleza: 'texto_libre',
  soloPruebas: true,
  validar: () => null,
};

test('camposVisibles: un campo soloPruebas se OMITE fuera del ambiente de pruebas', () => {
  const descriptor: DescriptorMetodoPasarela = {
    tipo: 'X', nombreVisible: 'X', grupo: 'billeteras', campos: [CAMPO_TEXTO_DE_PRUEBA, CAMPO_SOLO_PRUEBAS],
    construirPaymentMethod: () => ({}), campo: CAMPO_TEXTO_DE_PRUEBA,
  };
  const visibles = camposVisibles(descriptor, false);
  assert.equal(visibles.length, 1);
  assert.equal(visibles[0].nombre, 'documento');
});

test('camposVisibles: un campo soloPruebas SÍ se incluye dentro del ambiente de pruebas', () => {
  const descriptor: DescriptorMetodoPasarela = {
    tipo: 'X', nombreVisible: 'X', grupo: 'billeteras', campos: [CAMPO_TEXTO_DE_PRUEBA, CAMPO_SOLO_PRUEBAS],
    construirPaymentMethod: () => ({}), campo: CAMPO_TEXTO_DE_PRUEBA,
  };
  const visibles = camposVisibles(descriptor, true);
  assert.equal(visibles.length, 2);
  assert.deepEqual(visibles.map((c) => c.nombre), ['documento', 'resultado_simulado']);
});

test('camposVisibles: un campo NORMAL (sin soloPruebas) se muestra en los dos ambientes', () => {
  const descriptor: DescriptorMetodoPasarela = {
    tipo: 'X', nombreVisible: 'X', grupo: 'billeteras', campos: [CAMPO_TEXTO_DE_PRUEBA],
    construirPaymentMethod: () => ({}), campo: CAMPO_TEXTO_DE_PRUEBA,
  };
  assert.equal(camposVisibles(descriptor, false).length, 1);
  assert.equal(camposVisibles(descriptor, true).length, 1);
});

test('camposVisibles: DESCRIPTOR_NEQUI (ningún campo soloPruebas) se ve completo en cualquier ambiente', () => {
  assert.equal(camposVisibles(DESCRIPTOR_NEQUI, false).length, 1);
  assert.equal(camposVisibles(DESCRIPTOR_NEQUI, true).length, 1);
});

test('esAmbientePruebasPorLlave: una llave SIN el prefijo productivo → true (sandbox)', () => {
  assert.equal(esAmbientePruebasPorLlave('pub_test_abc123'), true);
  assert.equal(esAmbientePruebasPorLlave(''), true);
});

test('esAmbientePruebasPorLlave: una llave CON el prefijo productivo → false', () => {
  assert.equal(esAmbientePruebasPorLlave(`${PREFIJO_LLAVE_PASARELA_PRODUCTIVA}abc123`), false);
});

// ── EL DESCRIPTOR DE PRUEBA QUE USA LAS TRES DIMENSIONES A LA VEZ (§ el reporte del slice) —
// varios campos, de naturalezas distintas, y navega afuera con su propio nombre de campo. NO
// SE OFRECE A NADIE — no vive en `DESCRIPTORES_METODO_PASARELA`, sólo en este test. ───────────

const DESCRIPTOR_PRUEBA_TRES_DIMENSIONES: DescriptorMetodoPasarela = {
  tipo: 'BANCO_DIGITAL_DE_PRUEBA',
  nombreVisible: 'Banco Digital (de prueba, nunca ofrecido)',
  // "Banco Digital" es débito bancario — el grupo en sí es incidental a este test (prueba las
  // tres dimensiones de CAMPOS, no la agrupación por instrumento, que tiene sus propios tests
  // más abajo).
  grupo: 'debito_bancario',
  // A) CUATRO campos — B) de las TRES naturalezas, con un `soloPruebas` mezclado adentro para
  // probar las dos condiciones a la vez sobre el MISMO descriptor.
  campos: [CAMPO_ELECCION_DE_PRUEBA, CAMPO_TEXTO_DE_PRUEBA, CAMPO_CONSULTA_DE_PRUEBA, CAMPO_SOLO_PRUEBAS],
  // C) navega afuera, con SU PROPIO nombre de campo de URL — distinto del de los descriptores
  // A/B de arriba, a propósito.
  redireccion: { campoUrl: 'direccion_de_pago_banco_digital' },
  construirPaymentMethod: (valores) => ({
    type: 'BANCO_DIGITAL_DE_PRUEBA',
    financial_institution_code: valores.banco,
    user_legal_id: valores.documento,
    branch_code: valores.sucursal,
  }),
  campo: CAMPO_ELECCION_DE_PRUEBA,
};

test('el descriptor de prueba combina las tres dimensiones a la vez: N campos, LAS TRES naturalezas, redirección propia', () => {
  assert.equal(DESCRIPTOR_PRUEBA_TRES_DIMENSIONES.campos.length, 4);
  assert.deepEqual(
    DESCRIPTOR_PRUEBA_TRES_DIMENSIONES.campos.map((c) => c.naturaleza),
    ['eleccion_cerrada', 'texto_libre', 'consulta_externa', 'texto_libre'],
  );
  // Las tres naturalezas están representadas — ninguna falta.
  assert.deepEqual(
    new Set(DESCRIPTOR_PRUEBA_TRES_DIMENSIONES.campos.map((c) => c.naturaleza)),
    new Set(['eleccion_cerrada', 'texto_libre', 'consulta_externa']),
  );
  assert.equal(DESCRIPTOR_PRUEBA_TRES_DIMENSIONES.redireccion?.campoUrl, 'direccion_de_pago_banco_digital');
});

test('el descriptor de prueba: construirPaymentMethod arma el payload ENTERO desde el mapa de N valores', () => {
  const pm = DESCRIPTOR_PRUEBA_TRES_DIMENSIONES.construirPaymentMethod({
    banco: 'BANCO_A',
    documento: '12345678',
    sucursal: 'SUC-01',
    resultado_simulado: 'APPROVED',
  });
  assert.deepEqual(pm, {
    type: 'BANCO_DIGITAL_DE_PRUEBA',
    financial_institution_code: 'BANCO_A',
    user_legal_id: '12345678',
    branch_code: 'SUC-01',
  });
});

test('el descriptor de prueba: urlDeRedireccion lee EXACTAMENTE su propio campoUrl, no uno adivinado', () => {
  assert.equal(
    urlDeRedireccion(DESCRIPTOR_PRUEBA_TRES_DIMENSIONES, {
      direccion_de_pago_banco_digital: 'https://banco-digital.example/pagar/abc',
    }),
    'https://banco-digital.example/pagar/abc',
  );
  // El campo de OTRO tipo (async_payment_url) no cuenta para éste — cada descriptor tiene el
  // suyo, § dimensión C.
  assert.equal(urlDeRedireccion(DESCRIPTOR_PRUEBA_TRES_DIMENSIONES, { async_payment_url: 'https://x.co' }), null);
});

test('el descriptor de prueba: camposVisibles filtra su campo soloPruebas fuera del ambiente de pruebas, deja los otros tres', () => {
  const visibles = camposVisibles(DESCRIPTOR_PRUEBA_TRES_DIMENSIONES, false);
  assert.deepEqual(visibles.map((c) => c.nombre), ['banco', 'documento', 'sucursal']);
});

test('el descriptor de prueba: camposVisibles incluye los CUATRO dentro del ambiente de pruebas', () => {
  const visibles = camposVisibles(DESCRIPTOR_PRUEBA_TRES_DIMENSIONES, true);
  assert.deepEqual(visibles.map((c) => c.nombre), ['banco', 'documento', 'sucursal', 'resultado_simulado']);
});

// ── `conCampoLegacy` — el puente al wire LEGACY de `app/api/checkout/route.ts` ────────────────

test('conCampoLegacy (indirectamente, vía DESCRIPTOR_NEQUI): campo es SIEMPRE campos[0], nunca un valor declarado a mano', () => {
  assert.equal(DESCRIPTOR_NEQUI.campo, DESCRIPTOR_NEQUI.campos[0]);
});

test('conCampoLegacy: campo derivado es EXACTAMENTE campos[0], para un descriptor con varios campos', () => {
  const conVarios = conCampoLegacy({
    tipo: 'X',
    nombreVisible: 'X',
    grupo: 'billeteras',
    campos: [CAMPO_ELECCION_DE_PRUEBA, CAMPO_TEXTO_DE_PRUEBA],
    construirPaymentMethod: () => ({}),
  });
  assert.equal(conVarios.campo, CAMPO_ELECCION_DE_PRUEBA);
  assert.notEqual(conVarios.campo, CAMPO_TEXTO_DE_PRUEBA);
});

test('conCampoLegacy: lanza ruidoso si el descriptor no declara NINGÚN campo — el wire LEGACY no puede satisfacerse', () => {
  assert.throws(
    () => conCampoLegacy({ tipo: 'SIN_CAMPOS', nombreVisible: 'X', grupo: 'billeteras', campos: [], construirPaymentMethod: () => ({}) }),
    /SIN_CAMPOS.*no declara ningún campo/,
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

test('TIPOS_NO_COBRABLES: BANCOLOMBIA, y sólo BANCOLOMBIA — el identificador nombrado por API-DIRECTA-CATALOGO-NOMBRA-TIPO-1 (§ el docstring)', () => {
  assert.deepEqual([...TIPOS_NO_COBRABLES], ['BANCOLOMBIA']);
});

test('esNoCobrable: con el registro real, BANCOLOMBIA es no-cobrable', () => {
  assert.equal(esNoCobrable('BANCOLOMBIA'), true);
});

test('esNoCobrable: con el registro real, un tipo normal NO se ve afectado', () => {
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

test('paraElPanel: no_cobrable con el registro REAL — BANCOLOMBIA cae a no_cobrable, sin inyectar nada', () => {
  const r = paraElPanel(cruzarMetodosPasarela([], ['BANCOLOMBIA']));
  assert.deepEqual(r, [{ tipo: 'BANCOLOMBIA', estado: 'no_cobrable' }]);
});

test('paraElPanel: con el registro REAL, un tipo normal (NEQUI) en la misma cuenta NO se ve afectado por la entrada de BANCOLOMBIA', () => {
  const r = paraElPanel(cruzarMetodosPasarela(['NEQUI'], ['BANCOLOMBIA', 'NEQUI']));
  assert.deepEqual(r, [
    { tipo: 'BANCOLOMBIA', estado: 'no_cobrable' },
    { tipo: 'NEQUI', estado: 'disponible' },
  ]);
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

test('el servidor RECHAZA BANCOLOMBIA (§ PANEL-LISTA-NO-COBRABLES-1: TIPOS_NO_COBRABLES ya no está vacía)', () => {
  const parsed = siteSettingsEditableSchema.safeParse(payloadDeSiteSettings(['BANCOLOMBIA']));
  assert.equal(parsed.success, false);
});

// ── LAS PESTAÑAS POR INSTRUMENTO (§ CHECKOUT-PESTANAS-POR-INSTRUMENTO-1) ─────────────────────

test('agruparMetodosPasarelaPorInstrumento: con el registro real, NEQUI cae en billeteras — solo', () => {
  const r = agruparMetodosPasarelaPorInstrumento(['NEQUI']);
  assert.deepEqual(r, [{ grupo: 'billeteras', tipos: ['NEQUI'] }]);
});

test('agruparMetodosPasarelaPorInstrumento: sin tipos → sin grupos', () => {
  assert.deepEqual(agruparMetodosPasarelaPorInstrumento([]), []);
});

test('agruparMetodosPasarelaPorInstrumento: un tipo sin descriptor en el registro se omite, sin producir un grupo', () => {
  assert.deepEqual(agruparMetodosPasarelaPorInstrumento(['PSE']), []);
});

test('agruparMetodosPasarelaPorInstrumento: un descriptor CON tipo pero SIN `grupo` (como los sintéticos de creacion-transaccion.test.ts, fuera de touches de este slice) se omite igual que uno sin descriptor', () => {
  const registroConDescriptorSinGrupo: Record<string, DescriptorMetodoPasarela> = {
    ...DESCRIPTORES_METODO_PASARELA,
    SIN_GRUPO: conCampoLegacy({
      tipo: 'SIN_GRUPO', nombreVisible: 'X', campos: [{ ...CAMPO_ELECCION_DE_PRUEBA }],
      construirPaymentMethod: () => ({}),
    }),
  };
  assert.deepEqual(
    agruparMetodosPasarelaPorInstrumento(['NEQUI', 'SIN_GRUPO'], registroConDescriptorSinGrupo),
    [{ grupo: 'billeteras', tipos: ['NEQUI'] }],
  );
});

test('agruparMetodosPasarelaPorInstrumento: UN GRUPO SIN MÉTODOS NO APARECE — con sólo NEQUI, débito bancario, financiación y puntos, y tarjeta no salen en el resultado', () => {
  const grupos = agruparMetodosPasarelaPorInstrumento(['NEQUI']).map((g) => g.grupo);
  assert.equal(grupos.includes('debito_bancario'), false);
  assert.equal(grupos.includes('financiacion_puntos'), false);
  // 'tarjeta' nunca sale de esta función — no vive en el registro (§ el docstring de arriba).
  assert.equal((grupos as string[]).includes('tarjeta'), false);
});

test('agruparMetodosPasarelaPorInstrumento: CADA método cae en SU grupo — dos tipos sintéticos, grupos distintos, dos entradas separadas', () => {
  const registroDePrueba: Record<string, DescriptorMetodoPasarela> = {
    ...DESCRIPTORES_METODO_PASARELA,
    BANCO_DIGITAL_X: { ...DESCRIPTOR_NEQUI, tipo: 'BANCO_DIGITAL_X', grupo: 'debito_bancario' },
  };
  const r = agruparMetodosPasarelaPorInstrumento(['NEQUI', 'BANCO_DIGITAL_X'], registroDePrueba);
  assert.deepEqual(r, [
    { grupo: 'debito_bancario', tipos: ['BANCO_DIGITAL_X'] },
    { grupo: 'billeteras', tipos: ['NEQUI'] },
  ]);
});

test('agruparMetodosPasarelaPorInstrumento: DOS tipos del MISMO grupo caen en la MISMA entrada, en el orden en que llegaron', () => {
  const registroDePrueba: Record<string, DescriptorMetodoPasarela> = {
    ...DESCRIPTORES_METODO_PASARELA,
    OTRA_BILLETERA: { ...DESCRIPTOR_NEQUI, tipo: 'OTRA_BILLETERA' },
  };
  const r = agruparMetodosPasarelaPorInstrumento(['OTRA_BILLETERA', 'NEQUI'], registroDePrueba);
  assert.deepEqual(r, [{ grupo: 'billeteras', tipos: ['OTRA_BILLETERA', 'NEQUI'] }]);
});

test('agruparMetodosPasarelaPorInstrumento: AGREGAR UN DESCRIPTOR NUEVO LO UBICA SOLO, sin tocar el resultado de los demás grupos', () => {
  // Un descriptor sintético en un grupo que hoy no tiene ningún método (financiación y
  // puntos) — simula "el tipo siguiente" del docstring del registro: agregarlo no exige
  // tocar esta función ni el componente que la consume, sólo declarar su `grupo`.
  const registroConNuevoTipo: Record<string, DescriptorMetodoPasarela> = {
    ...DESCRIPTORES_METODO_PASARELA,
    ADDI: { ...DESCRIPTOR_NEQUI, tipo: 'ADDI', nombreVisible: 'Addi', grupo: 'financiacion_puntos' },
  };
  const r = agruparMetodosPasarelaPorInstrumento(['NEQUI', 'ADDI'], registroConNuevoTipo);
  assert.deepEqual(r, [
    { grupo: 'billeteras', tipos: ['NEQUI'] },
    { grupo: 'financiacion_puntos', tipos: ['ADDI'] },
  ]);
});

test('agruparMetodosPasarelaPorInstrumento: el ORDEN de los grupos es el CANÓNICO (débito · billeteras · financiación), nunca el orden de llegada de los tipos', () => {
  const registroDeTres: Record<string, DescriptorMetodoPasarela> = {
    NEQUI: { ...DESCRIPTOR_NEQUI, grupo: 'billeteras' },
    ADDI: { ...DESCRIPTOR_NEQUI, tipo: 'ADDI', grupo: 'financiacion_puntos' },
    PSE_X: { ...DESCRIPTOR_NEQUI, tipo: 'PSE_X', grupo: 'debito_bancario' },
  };
  // Llegan en el orden CONTRARIO al canónico — el resultado igual sale en orden canónico.
  const r = agruparMetodosPasarelaPorInstrumento(['ADDI', 'NEQUI', 'PSE_X'], registroDeTres);
  assert.deepEqual(r.map((g) => g.grupo), ['debito_bancario', 'billeteras', 'financiacion_puntos']);
  // Coincide con el orden canónico exportado, menos 'tarjeta' (nunca sale de esta función).
  assert.deepEqual(
    ORDEN_GRUPOS_METODO_PASARELA.filter((g) => g !== 'tarjeta'),
    ['debito_bancario', 'billeteras', 'financiacion_puntos'],
  );
});

// ── EL RADIO DE "PAGO EN LÍNEA" (§ CHECKOUT-COPY-Y-ORDEN-PASARELA-1) — etiqueta FIJA, subtítulo
// GENERADO ───────────────────────────────────────────────────────────────────────────────────

test('ETIQUETA_PAGO_PASARELA: es "Pago en línea", fija — no un valor derivado', () => {
  assert.equal(ETIQUETA_PAGO_PASARELA, 'Pago en línea');
});

test('subtituloPagoPasarela: sin métodos adicionales → sólo tarjeta, sin "y más"', () => {
  assert.equal(subtituloPagoPasarela([]), 'Tarjeta · se confirma al instante');
});

test('subtituloPagoPasarela: con UN método adicional del registro real (NEQUI) → lo nombra y cierra con "y más"', () => {
  assert.equal(subtituloPagoPasarela(['NEQUI']), 'Tarjeta, Nequi y más · se confirma al instante');
});

test('subtituloPagoPasarela: con VARIOS métodos (registro sintético de dos entradas) → los enumera todos antes de "y más"', () => {
  const registroDeDos: Record<string, DescriptorMetodoPasarela> = {
    ...DESCRIPTORES_METODO_PASARELA,
    DAVIPLATA_X: { ...DESCRIPTOR_NEQUI, tipo: 'DAVIPLATA_X', nombreVisible: 'Daviplata' },
  };
  assert.equal(
    subtituloPagoPasarela(['NEQUI', 'DAVIPLATA_X'], registroDeDos),
    'Tarjeta, Nequi, Daviplata y más · se confirma al instante',
  );
});

test('subtituloPagoPasarela: un tipo SIN descriptor en el registro se omite en silencio, nunca revienta', () => {
  assert.equal(subtituloPagoPasarela(['PSE']), 'Tarjeta · se confirma al instante');
  assert.equal(subtituloPagoPasarela(['NEQUI', 'PSE']), 'Tarjeta, Nequi y más · se confirma al instante');
});

test('subtituloPagoPasarela: la cola "· se confirma al instante" CIERRA SIEMPRE, pocos métodos o muchos', () => {
  const registroDeCuatro: Record<string, DescriptorMetodoPasarela> = {
    ...DESCRIPTORES_METODO_PASARELA,
    B: { ...DESCRIPTOR_NEQUI, tipo: 'B', nombreVisible: 'B' },
    C: { ...DESCRIPTOR_NEQUI, tipo: 'C', nombreVisible: 'C' },
    D: { ...DESCRIPTOR_NEQUI, tipo: 'D', nombreVisible: 'D' },
  };
  for (const metodosOtros of [[], ['NEQUI'], ['NEQUI', 'B'], ['NEQUI', 'B', 'C', 'D']]) {
    assert.ok(subtituloPagoPasarela(metodosOtros, registroDeCuatro).endsWith('· se confirma al instante'));
  }
});

test('subtituloPagoPasarela: nunca menciona el nombre del proveedor', () => {
  assert.ok(!subtituloPagoPasarela(['NEQUI']).toLowerCase().includes('wompi'));
});
