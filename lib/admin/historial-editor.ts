// EL HISTORIAL del editor de pantalla completa (§ EDITOR-TIENDA-DESHACER-1) — deshacer/rehacer
// GENÉRICO y framework-agnóstico, mismo criterio que `lib/autoguardado.ts`: la lógica delicada
// (la pila, cortar el rehacer al registrar un paso nuevo) vive y se prueba ACÁ, sin React ni
// `postMessage` ni conocimiento de `SiteContent` — el llamador (`TiendaPaginas.tsx`,
// `TiendaSeccionEditor.tsx`) construye cada `PasoHistorial` con SUS PROPIOS closures (p. ej.
// "vuelve el form de esta sección al valor X" / "vuélvelo al valor Y"), así que este módulo nunca
// necesita saber QUÉ se deshace, sólo CUÁNDO.
//
// Es la misma pila de dos listas que cualquier editor de texto: cada paso registrado entra a la
// pila de DESHACER; `deshacer()` lo saca de ahí, lo aplica (`paso.deshacer()`) y lo pasa a la pila
// de REHACER; `rehacer()` hace lo inverso. Registrar un paso NUEVO corta cualquier rehacer
// pendiente —editar tras deshacer descarta lo deshecho, el comportamiento estándar de cualquier
// undo/redo— porque la rama vieja ya no describe el estado actual.

export interface PasoHistorial {
  /** Restaura el valor ANTERIOR a este paso — llamado por `deshacer()`. */
  deshacer: () => void;
  /** Vuelve a aplicar el valor de este paso — llamado por `rehacer()`, lo inverso de `deshacer`. */
  rehacer: () => void;
}

export interface HistorialEditor {
  /** Registra un paso YA CONFIRMADO (no una tecla suelta — el llamador decide el límite del paso,
   *  p. ej. "se asentó el autoguardado"). Corta la pila de rehacer. */
  registrar(paso: PasoHistorial): void;
  /** Deshace el último paso registrado. `false` si no había nada que deshacer (no-op, nunca lanza). */
  deshacer(): boolean;
  /** Rehace el último paso deshecho. `false` si no había nada que rehacer. */
  rehacer(): boolean;
  puedeDeshacer(): boolean;
  puedeRehacer(): boolean;
  /** Cuántos pasos hay en cada pila — para un indicador o un test, nunca para decidir lógica. */
  tamano(): { deshacer: number; rehacer: number };
  /** Vacía las dos pilas. Se llama al cambiar de página/modo (`TiendaPaginas.tsx`): un paso viejo
   *  puede referenciar el `setForm` de una sección que ya se desmontó, y reproducirlo ahí sería
   *  un no-op silencioso en el mejor caso — más seguro cortar la rama entera que arriesgar un
   *  paso que ya no tiene a quién aplicarse. */
  limpiar(): void;
}

export function crearHistorialEditor(): HistorialEditor {
  let pilaDeshacer: PasoHistorial[] = [];
  let pilaRehacer: PasoHistorial[] = [];

  return {
    registrar(paso) {
      pilaDeshacer.push(paso);
      pilaRehacer = [];
    },
    deshacer() {
      const paso = pilaDeshacer.pop();
      if (!paso) return false;
      paso.deshacer();
      pilaRehacer.push(paso);
      return true;
    },
    rehacer() {
      const paso = pilaRehacer.pop();
      if (!paso) return false;
      paso.rehacer();
      pilaDeshacer.push(paso);
      return true;
    },
    puedeDeshacer() { return pilaDeshacer.length > 0; },
    puedeRehacer() { return pilaRehacer.length > 0; },
    tamano() { return { deshacer: pilaDeshacer.length, rehacer: pilaRehacer.length }; },
    limpiar() { pilaDeshacer = []; pilaRehacer = []; },
  };
}

// ── IGUALDAD ESTRUCTURAL, para que el llamador no registre un paso SIN cambio real ───────────────
//
// `TiendaSeccionEditor`/`TiendaPaginas` comparan el valor ANTES y DESPUÉS de un lote de ediciones
// (§ el docstring de `aplicarCambioForm`) antes de llamar a `registrar`: si el lote se asentó sin
// cambiar nada (p. ej. tipear y borrar lo mismo), un paso vacío ensuciaría la pila con un
// deshacer/rehacer que no mueve nada. Comparación por VALOR —no por referencia—, recursiva sobre
// JSON plano (strings/booleans/números/arrays/objetos, lo único que viaja por `SiteContent` y por
// `BandaId[]`): claves en cualquier orden cuentan igual.
export function sonIguales(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return false;
  if (typeof a !== 'object') return false; // primitivos distintos ya se descartaron arriba
  const oa = a as Record<string, unknown> | unknown[];
  const ob = b as Record<string, unknown> | unknown[];
  if (Array.isArray(oa) !== Array.isArray(ob)) return false;
  if (Array.isArray(oa) && Array.isArray(ob)) {
    if (oa.length !== ob.length) return false;
    return oa.every((v, i) => sonIguales(v, ob[i]));
  }
  const clavesA = Object.keys(oa as Record<string, unknown>);
  const clavesB = Object.keys(ob as Record<string, unknown>);
  if (clavesA.length !== clavesB.length) return false;
  return clavesA.every((k) =>
    Object.prototype.hasOwnProperty.call(ob, k) &&
    sonIguales((oa as Record<string, unknown>)[k], (ob as Record<string, unknown>)[k]),
  );
}
