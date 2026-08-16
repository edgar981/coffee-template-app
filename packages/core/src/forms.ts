// ─── ¿Cambió el formulario respecto a como abrió? ────────────────────────────
//
// La primitiva de "sucio" compartida por los drawers. Existe por dos consumos
// que son el mismo dato mirado desde dos lados (§ CLAUDE.md — dirty/descarte):
//
//   · el BOTÓN Guardar se apaga cuando no hay nada que guardar (y lo DICE), igual
//     que un obligatorio faltante — un guardado que no cambia nada no es un
//     guardado, es un asiento fantasma o un viaje al server para nada;
//   · el CIERRE del drawer pregunta antes de descartar sólo si hay algo que
//     descartar. Sin cambios, cierra directo — una confirmación sin nada que
//     perder es fricción, no una guarda.
//
// Es UNA función y no un `JSON.stringify(a) === JSON.stringify(b)` regado por
// cada modal: el stringify depende del ORDEN de las claves —estable hoy, frágil
// el día que alguien reordene el shape— y traga NaN y undefined distinto que
// `Object.is`. Comparar clave por clave con `Object.is` es explícito y testeable,
// que es justo lo que este repo pide de una regla que decide habilitar un botón.

/**
 * ¿Difiere `actual` de `inicial` en al menos una clave? Comparación superficial
 * con `Object.is` sobre la UNIÓN de claves de ambos — pensada para formularios
 * planos (strings, números, booleanos), que es lo que son los forms de los
 * drawers. NO baja a arrays ni objetos anidados: una galería o una lista de
 * moliendas se comparan aparte, en la regla del formulario que las tiene.
 */
export function hayCambios<T extends object>(actual: T, inicial: T): boolean {
  const a = actual as Record<string, unknown>;
  const b = inicial as Record<string, unknown>;
  // La unión de claves y no sólo las de `actual`: si a `inicial` le sobra una
  // clave (shapes que no calzan), la diferencia tiene que contarse, no perderse.
  const claves = new Set<string>([...Object.keys(a), ...Object.keys(b)]);
  for (const k of claves) {
    if (!Object.is(a[k], b[k])) return true;
  }
  return false;
}

// ─── ¿Qué hacer cuando se INTENTA salir de un drawer? ────────────────────────
//
// Un embudo único para toda salida de un drawer con formulario: cerrarlo, o
// navegar a otra ruta desde adentro (el enlace al cliente). La decisión es la
// misma en los dos casos, y por eso vive acá, pura y testeable, en vez de
// repetida en cada consumidor:
//
//   · `bloquear`  — hay una mutación en vuelo: no se sale por ningún camino, ni
//     para preguntar. Cerrar/navegar a mitad no cancela nada en el server y deja
//     al operador sin saber si se aplicó (§ Doble-submit).
//   · `confirmar` — hay cambios sin guardar: se pregunta antes de descartarlos.
//   · `proceder`  — sin cambios y sin mutación: se sale directo.
//
// El orden importa: `enVuelo` gana sobre `hayCambios`. Con la mutación viajando,
// da igual si además hay cambios — no se sale.

export type DecisionSalida = 'proceder' | 'confirmar' | 'bloquear';

export function decidirSalida(enVuelo: boolean, hayCambios: boolean): DecisionSalida {
  if (enVuelo)    return 'bloquear';
  if (hayCambios) return 'confirmar';
  return 'proceder';
}
