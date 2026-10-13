import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { lineasNotaPedido, mensajeNotaPedido, type NotaPedidoInput } from './nota-pedido';

const BASE: NotaPedidoInput = {
  negocio: 'Café Las Chamisas',
  frecuenciaFrase: 'cada mes',
  items: [],
  placeholderSinItems: '(elige al menos un café)',
  totalTexto: '$ 96.000',
  ciudad: '',
  preguntaCierre: '¿Me confirman fecha del primer envío y cómo pago?',
};

describe('lineasNotaPedido', () => {
  test('saludo + placeholder + total + ciudad + pregunta, sin ítems', () => {
    const lineas = lineasNotaPedido(BASE);
    assert.deepEqual(lineas, [
      'Hola, Café Las Chamisas. Quiero recibir café cada mes:',
      '(elige al menos un café)',
      'Por envío: $ 96.000',
      'Mi ciudad: ',
      '¿Me confirman fecha del primer envío y cómo pago?',
    ]);
  });

  test('una línea por ítem, con molienda', () => {
    const lineas = lineasNotaPedido({
      ...BASE,
      items: [
        { cantidad: 1, nombre: 'Bourbon Rosado', tamano: '340 g', molienda: 'en grano' },
        { cantidad: 1, nombre: 'Papayo', tamano: '340 g', molienda: 'molido' },
      ],
      ciudad: 'Bogotá',
    });
    assert.deepEqual(lineas, [
      'Hola, Café Las Chamisas. Quiero recibir café cada mes:',
      '• 1 × Bourbon Rosado · 340 g · en grano',
      '• 1 × Papayo · 340 g · molido',
      'Por envío: $ 96.000',
      'Mi ciudad: Bogotá',
      '¿Me confirman fecha del primer envío y cómo pago?',
    ]);
  });

  test('sin molienda: la línea NO agrega una cláusula vacía', () => {
    const lineas = lineasNotaPedido({
      ...BASE,
      items: [{ cantidad: 2, nombre: 'Pacamara', tamano: '500 g' }],
    });
    assert.equal(lineas[1], '• 2 × Pacamara · 500 g');
  });

  test('cantidad > 1 se refleja en la línea', () => {
    const lineas = lineasNotaPedido({
      ...BASE,
      items: [{ cantidad: 3, nombre: 'Bourbon Rosado', tamano: '340 g', molienda: 'molido' }],
    });
    assert.equal(lineas[1], '• 3 × Bourbon Rosado · 340 g · molido');
  });

  test('varios ítems mantienen el ORDEN recibido', () => {
    const lineas = lineasNotaPedido({
      ...BASE,
      items: [
        { cantidad: 1, nombre: 'Papayo', tamano: '340 g' },
        { cantidad: 1, nombre: 'Bourbon Rosado', tamano: '340 g' },
        { cantidad: 1, nombre: 'Pacamara', tamano: '340 g' },
      ],
    });
    assert.deepEqual(
      lineas.slice(1, 4).map((l) => l.split(' × ')[1].split(' · ')[0]),
      ['Papayo', 'Bourbon Rosado', 'Pacamara'],
    );
  });
});

describe('mensajeNotaPedido', () => {
  test('junta las líneas con salto de línea, listo para encodeURIComponent', () => {
    const msg = mensajeNotaPedido({
      ...BASE,
      items: [{ cantidad: 1, nombre: 'Bourbon Rosado', tamano: '340 g', molienda: 'en grano' }],
      ciudad: 'Supatá',
    });
    assert.equal(
      msg,
      [
        'Hola, Café Las Chamisas. Quiero recibir café cada mes:',
        '• 1 × Bourbon Rosado · 340 g · en grano',
        'Por envío: $ 96.000',
        'Mi ciudad: Supatá',
        '¿Me confirman fecha del primer envío y cómo pago?',
      ].join('\n'),
    );
  });
});
