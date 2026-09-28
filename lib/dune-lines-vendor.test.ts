import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// ─── PANEL-LOGIN-DUNELINES-OWNER-1 — LA COPIA SE VERIFICA POR HASH, NO SE TRANSCRIBE ───────────
//
// `components/admin/DuneLines.tsx` es el componente del OWNER (~/Documents/All Projects/
// duna-motion/DuneLines.tsx), copiado TAL CUAL para el fondo de las pantallas pre-auth: misma
// fórmula, constantes, colores, opacidades y trazo. La instrucción del owner es "ni una coma" — no
// se reescribe la matemática, no se cambian las constantes, no se pasa de SVG a canvas ni a CSS.
//
// Una regla en prosa que dice "no lo toques" no impide que alguien lo toque igual — con buena
// intención (una regla de lint, un "mejora" de paso) o sin darse cuenta. Este test es el mecanismo:
// afirma el HASH exacto del archivo tal como se copió, así que cualquier edición futura —de una
// coma o de la fórmula entera— lo rompe, y el gate obliga a que alguien la decida a la vista en vez
// de que se cuele en silencio.
//
// El hash lo dio el owner junto con el base64 del archivo (spec de este slice); no se recalculó
// "para que dé" — se decodificó el base64 tal cual y SE MIDIÓ el sha256 del resultado, que coincidió.
const HASH_ESPERADO =
  '94a2b2677b95e96e5b4a618ebfc80bcb8cae4d28a725af611214c51d1394e931';

function sha256DeArchivo(rutaRelativaDesdeAca: string): string {
  const ruta = path.join(fileURLToPath(new URL('.', import.meta.url)), rutaRelativaDesdeAca);
  const bytes = readFileSync(ruta);
  return createHash('sha256').update(bytes).digest('hex');
}

test('components/admin/DuneLines.tsx es BYTE A BYTE el componente del owner (verificado por hash, no por lectura)', () => {
  const hashReal = sha256DeArchivo('../components/admin/DuneLines.tsx');
  assert.equal(
    hashReal,
    HASH_ESPERADO,
    'components/admin/DuneLines.tsx cambió respecto de la copia del owner — el componente NO se ' +
      'toca (ni una coma); si el cambio es intencional, lo decide el owner, no este gate.',
  );
});
