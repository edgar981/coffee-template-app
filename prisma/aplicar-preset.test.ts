// prisma/aplicar-preset.test.ts
//
// Capa 1, sin base: afirma la GUARDA de `prisma/aplicar-preset.ts` (§ ONBOARDING-APLICAR-PRESET-
// SCRIPT-1) — la condición 2 del owner ("que exija una confirmación explícita con el nombre del
// tenant") aislada en `confirmacionValida`, y el parseo de conexión de la condición 1
// ("nunca las credenciales") aislado en `conexionVisible`. Ninguna de las dos toca Prisma ni la
// red, así que se prueban sin levantar una base — el script en sí (main(), la escritura real) NO
// se afirma acá: eso exigiría una base real y stdin simulado, y queda fuera de este archivo (ver
// el asiento en DECISIONS.md para lo que NO cubre esta prueba).
import { test } from "node:test";
import assert from "node:assert/strict";
import { confirmacionValida, conexionVisible } from "./aplicar-preset";

test("confirmacionValida: coincidencia EXACTA con el nombre del tenant confirma", () => {
  assert.equal(confirmacionValida("Café Nayoli", "Café Nayoli"), true);
});

test("confirmacionValida: LA GUARDA — nada que no sea el nombre exacto confirma", () => {
  // Ésta es la guarda entera: sin esto, un script genérico corrido contra la base equivocada
  // reescribe el tema de un cliente vivo sin que nadie lo note. Cada caso de acá es uno de los
  // que el spec nombró explícitamente ("vacío, un nombre que no coincide, y/s").
  assert.equal(confirmacionValida("Café Nayoli", ""), false);
  assert.equal(confirmacionValida("Café Nayoli", "   "), false);
  assert.equal(confirmacionValida("Café Nayoli", "y"), false);
  assert.equal(confirmacionValida("Café Nayoli", "s"), false);
  assert.equal(confirmacionValida("Café Nayoli", "si"), false);
  assert.equal(confirmacionValida("Café Nayoli", "Cafe Nayoli"), false); // sin tilde: NO coincide
  assert.equal(confirmacionValida("Café Nayoli", "café nayoli"), false); // case-sensitive
  assert.equal(confirmacionValida("Café Nayoli", "Otro Negocio"), false);
  assert.equal(confirmacionValida("Café Nayoli", null), false);
  assert.equal(confirmacionValida("Café Nayoli", undefined), false);
});

test("confirmacionValida: recorta espacio en blanco de los BORDES, nunca del contenido", () => {
  assert.equal(confirmacionValida("Café Nayoli", "  Café Nayoli  "), true);
  assert.equal(confirmacionValida("Café Nayoli", "Café  Nayoli"), false); // doble espacio interno: NO coincide
});

test("conexionVisible: extrae host y base — NUNCA usuario ni contraseña", () => {
  const r = conexionVisible("postgresql://owner:un-secreto@ep-ancient-frog.neon.tech/neondb?sslmode=verify-full");
  assert.deepEqual(r, { host: "ep-ancient-frog.neon.tech", base: "neondb" });
  // El objeto sólo puede tener estas dos claves — por construcción no puede cargar el secreto.
  assert.deepEqual(Object.keys(r!).sort(), ["base", "host"]);
  assert.ok(!JSON.stringify(r).includes("un-secreto"));
});

test("conexionVisible: una URL ilegible da null — nunca imprime el valor crudo", () => {
  assert.equal(conexionVisible("no-es-una-url"), null);
});
