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

// § EDITOR-PANEL-CONTROLES-1 — CERO `.duna-switch` DENTRO DEL EDITOR (el spec: "el panel debería
// sentirse más interactivo... no solo activo desactivo, prendo apago" — pedido del owner, revisando
// el editor). El interruptor se reemplazó por `EleccionVisual` (el rasgo de ASPECTO: dos o tres
// opciones con miniatura), `MostrarOcultar` (mostrar/ocultar algo que existe siempre) o un
// segmentado con palabras (un COMPORTAMIENTO, p. ej. el carrusel). El guard es una lista PROPIA, más
// amplia que `ARCHIVOS_PANEL` de arriba: incluye las piezas de detalles del sitio, el toggle de
// página y la pieza genérica de instancia, que `ARCHIVOS_PANEL` no cubre porque su contrato es
// distinto (ESE busca copy sin `§`/ledger-id; ÉSTE busca la AUSENCIA de una clase CSS).
// `MoliendasOpcionesEditor.tsx` NO entra: vive en el modal de PRODUCTO, fuera del editor de la
// tienda — "fuera del editor, p. ej. Automatizaciones, no se toca" (el spec).
const ARCHIVOS_SIN_SWITCH = [
  ...ARCHIVOS_PANEL,
  '../../components/admin/DetallesSitioSeccion.tsx',
  '../../components/admin/TogglePagina.tsx',
  '../../components/admin/editor/InstanciaEditorForm.tsx',
];

for (const archivo of ARCHIVOS_SIN_SWITCH) {
  test(`${archivo}: ningún panel del editor pinta duna-switch`, () => {
    // `sinComentarios` (no `leerFuente` a secas): varios de estos archivos EXPLICAN la migración en
    // un comentario que cita "duna-switch" por nombre — un chequeo contra el archivo crudo fallaría
    // por la prosa, no por una clase que el componente de verdad pinte (el mismo riesgo que el
    // guard de "§"/ledger-id de arriba ya resuelve con la misma función).
    const codigo = sinComentarios(leerFuente(archivo));
    assert.ok(
      !codigo.includes('duna-switch'),
      `${archivo} todavía pinta un .duna-switch — el editor usa EleccionVisual/MostrarOcultar/un segmentado, nunca un interruptor`,
    );
  });
}
