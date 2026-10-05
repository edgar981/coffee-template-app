import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sinComentarios } from './recorrido-editor.test';

// EL CONTRATO DEL COPY DEL PANEL (§ EDITOR-PANEL-PIEL-1): ningún texto que vea el dueño de una
// tienda en el editor lleva un código interno — ni una sección de doctrina (`§ ALGO`) ni un id con
// forma de ledger (`PALABRAS-EN-MAYÚSCULA-CON-GUIONES-N`). El pedido del owner, textual: "eso de
// NAV-INTERNAS .... no lo va a entender". El guard reusa `sinComentarios` de `recorrido-editor.
// test.ts` (§ su propio docstring: "los comentarios de este repo citan `§ ALGO-1` en PROSA para
// explicar una decisión — si el test buscara contra el archivo CRUDO, un comentario haría fallar
// algo que nunca llega a pantalla"). El mismo criterio acá, al revés: lo que SOBREVIVE a
// `sinComentarios` es código real — strings que el componente puede renderizar —, y ES ahí donde
// `§`/un ledger-id no pueden aparecer.
const ARCHIVOS_PANEL = [
  '../../components/admin/EncabezadoSeccion.tsx',
  '../../components/admin/MenuSeccion.tsx',
  '../../components/admin/FooterSeccion.tsx',
  '../../components/admin/PaletaSeccion.tsx',
  '../../components/admin/TiendaSeccionEditor.tsx',
  '../../components/admin/tienda-secciones.ts',
];

// Un id con forma de ledger: dos o más palabras en MAYÚSCULA unidas por guiones, cerrando en
// `-N` (un número). Visto fallar contra el hint de hoy antes de este slice
// (`EncabezadoSeccion.tsx`: "...el encabezado siempre queda claro (§ NAV-INTERNAS-CLARO-Y-OFFSET-1)."
// — matchea TANTO el `§` como el id).
const PATRON_LEDGER_ID = /\b[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ0-9]*(-[A-ZÁÉÍÓÚÑ0-9]+)+-\d+\b/;

function leerFuente(rutaRelativaDesdeAca: string): string {
  const ruta = path.join(fileURLToPath(new URL('.', import.meta.url)), rutaRelativaDesdeAca);
  return readFileSync(ruta, 'utf8');
}

for (const archivo of ARCHIVOS_PANEL) {
  test(`${archivo}: ningún string visible (sin comentarios) lleva "§"`, () => {
    const codigo = sinComentarios(leerFuente(archivo));
    assert.ok(
      !codigo.includes('§'),
      `${archivo} tiene un "§" en código real (fuera de un comentario) — un texto del panel no puede citar la doctrina`,
    );
  });

  test(`${archivo}: ningún string visible (sin comentarios) lleva un id con forma de ledger`, () => {
    const codigo = sinComentarios(leerFuente(archivo));
    const match = codigo.match(PATRON_LEDGER_ID);
    assert.equal(
      match,
      null,
      `${archivo} tiene algo con forma de ledger-id en código real: "${match?.[0]}" — el dueño de una tienda no lo entiende (el pedido del owner: "eso de NAV-INTERNAS... no lo va a entender")`,
    );
  });
}
