/**
 * La GUARDA que cierra la CLASE «un test que el gate no corre es documentación»
 * (§ GATE-DOS-CARRILES-1, CLAUDE.md) — en vez de agregar el subárbol que faltó cada
 * vez que un archivo nacía invisible, ésta pregunta ¿PUEDE haber uno?, y la responde
 * el gate solo. Ver DECISIONS.md, `GATE-GUARDA-TESTS-INVISIBLES-1`.
 *
 * SU LÍMITE, para quien la vea fallar y para quien la lea después: esta guarda
 * afirma que todo archivo de test del repositorio CAE DENTRO de un patrón que algún
 * carril del gate ejecuta. NO afirma que su CONTENIDO corra — un caso saltado, un
 * bloque que nunca se alcanza o una condición que lo apaga siguen siendo invisibles,
 * y esta guarda no los ve.
 *
 * Puro: nada de este archivo toca disco. Leer package.json, leer
 * scripts/test-integracion.sh y caminar el árbol de archivos es responsabilidad de
 * `tests-descubiertos.test.ts`, que es quien sabe DÓNDE vive cada cosa.
 */

/**
 * Extrae los patrones glob DE UN TEXTO DE COMANDO. Un patrón es cualquier cadena
 * entrecomillada que TERMINA EN `.test.ts` — el sufijo que las dos invocaciones de
 * `node --test` de este repo (el script "test" de package.json, y la línea final de
 * scripts/test-integracion.sh) usan para delimitar su alcance. Cualquier otra cadena
 * entrecomillada del mismo comando (una ruta de datadir, un mensaje de error) no
 * termina en `.test.ts` y por tanto no puede colarse.
 *
 * Nunca se transcriben los patrones a mano: se leen de la fuente, así que un patrón
 * agregado o retirado se sigue solo — es la misma razón por la que esta función
 * existe en vez de una lista escrita en el test.
 */
export function extraerGlobsDeComando(comando: string): string[] {
  const out: string[] = [];
  const re = /"([^"]*\.test\.ts)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(comando)) !== null) out.push(m[1]);
  return out;
}

/**
 * Convierte un glob POSIX (`**`, `*`, segmentos literales) al RegExp que decide si
 * una ruta relativa cae bajo él. Cubre lo que los patrones de este repo usan hoy —
 * `<dir>/**\/*.test.ts` — pero no está atado a esa forma exacta: generaliza a
 * cualquier combinación de `**`, `*`, `?` y literales.
 */
export function globAPatronRegExp(glob: string): RegExp {
  let out = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*') {
      if (glob[i + 2] === '/') {
        // `**/` consume cero o más segmentos completos, incluido ninguno —
        // `lib/**/*.test.ts` matchea tanto `lib/x.test.ts` como `lib/a/b/x.test.ts`.
        out += '(?:.*/)?';
        i += 2;
      } else {
        out += '.*';
        i += 1;
      }
    } else if (c === '*') {
      out += '[^/]*';
    } else if (c === '?') {
      out += '[^/]';
    } else if ('.+^${}()|[]\\'.includes(c)) {
      out += '\\' + c;
    } else {
      out += c;
    }
  }
  return new RegExp(`^${out}$`);
}

/**
 * De la lista de archivos (rutas relativas, separador `/`), cuáles NO caen bajo
 * NINGUNO de los patrones dados. Pura: no sabe de dónde salió ninguna de las dos
 * listas — eso es responsabilidad de quien la llama.
 */
export function archivosSinCubrir(archivos: readonly string[], patrones: readonly string[]): string[] {
  const regexps = patrones.map(globAPatronRegExp);
  return archivos.filter((f) => !regexps.some((re) => re.test(f)));
}
