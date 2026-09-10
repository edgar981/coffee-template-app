import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MetodoPago as MetodoPagoPrisma } from '@duna/core';
import { METODOS_PAGO, METODO_PAGO_LABEL, METODO_CATEGORIA } from '@/types/payment';
import { METODOS_SERIE } from '@/components/admin/PagosCurva';

// `types/payment.ts` MIRROREA a mano el enum de Prisma `MetodoPago` — no lo importa, porque
// alimenta la UI admin del dinero (RegisterPaymentModal, la página de Pagos, PagosCurva, el
// informe PDF) sin arrastrar Prisma al bundle cliente. Dos declaraciones del MISMO conjunto: o
// una DERIVA de la otra, o hay un test que las ata (§ el precedente CATEGORIAS↔CATEGORIA_LABELS).
// Éste es el test — DERIVADO del enum real de Prisma, no una tercera lista a mano — y falla
// NOMBRANDO el valor que falte, para que un `ALTER TYPE … ADD VALUE` futuro no se olvide del
// espejo (§ PAGOS-METODOS-MODELO-1 §6, el modo de falla real: el desglose «Por método» del PDF
// itera `Object.keys(METODO_PAGO_LABEL)`, así que un método sin label queda AFUERA del desglose
// aunque SÍ sume al total — un documento financiero cuyas partes no cuadran, sin que nada avise).

const VALORES_PRISMA = Object.values(MetodoPagoPrisma) as string[];
const VALORES_ESPEJO = METODOS_PAGO as string[];

test('METODOS_PAGO cubre EXACTAMENTE los valores del enum de Prisma MetodoPago', () => {
  const faltantesEnEspejo = VALORES_PRISMA.filter(v => !VALORES_ESPEJO.includes(v));
  assert.deepEqual(
    faltantesEnEspejo, [],
    `types/payment.ts no declara: ${faltantesEnEspejo.join(', ')} — sumalo a MetodoPago/METODOS_PAGO/METODO_PAGO_LABEL/METODO_CATEGORIA`,
  );

  const sobrantesEnEspejo = VALORES_ESPEJO.filter(v => !VALORES_PRISMA.includes(v));
  assert.deepEqual(
    sobrantesEnEspejo, [],
    `types/payment.ts declara valores que el enum de Prisma NO tiene: ${sobrantesEnEspejo.join(', ')}`,
  );
});

test('todo valor del enum tiene label en METODO_PAGO_LABEL — el desglose del PDF no pierde ninguno', () => {
  for (const v of VALORES_PRISMA) {
    assert.ok(
      Object.prototype.hasOwnProperty.call(METODO_PAGO_LABEL, v),
      `METODO_PAGO_LABEL no declara "${v}" — quedaría FUERA del desglose «Por método» del informe`,
    );
  }
});

test('todo valor del enum tiene categoría en METODO_CATEGORIA — el resumen «Por método» no pierde ninguno', () => {
  for (const v of VALORES_PRISMA) {
    assert.ok(
      Object.prototype.hasOwnProperty.call(METODO_CATEGORIA, v),
      `METODO_CATEGORIA no declara "${v}"`,
    );
  }
});

// § PAGOS-METODOS-REMATES-1 — la CUARTA declaración a mano del mismo conjunto: el
// modo-método de PagosCurva. Un método sin entrada acá no dibuja barra (aunque SÍ
// sume al total y al desglose del libro/PDF), y uno de más dibujaría una barra para
// un método que no existe. DERIVADO del enum, no una quinta lista a mano.
const VALORES_SERIE = METODOS_SERIE.map(m => m.metodo) as string[];

test('METODOS_SERIE (PagosCurva) cubre EXACTAMENTE los valores del enum — ni de menos ni de más', () => {
  const faltantesEnSerie = VALORES_PRISMA.filter(v => !VALORES_SERIE.includes(v));
  assert.deepEqual(
    faltantesEnSerie, [],
    `METODOS_SERIE (components/admin/PagosCurva.tsx) no declara: ${faltantesEnSerie.join(', ')} — ese método no dibuja barra en el modo método`,
  );

  const sobrantesEnSerie = VALORES_SERIE.filter(v => !VALORES_PRISMA.includes(v));
  assert.deepEqual(
    sobrantesEnSerie, [],
    `METODOS_SERIE declara valores que el enum de Prisma NO tiene: ${sobrantesEnSerie.join(', ')}`,
  );
});
