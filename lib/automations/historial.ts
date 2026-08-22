// EL HISTORIAL DE UNA AUTOMATIZACIÓN — las reglas PURAS, sin Prisma.
//
// Dos decisiones de producto viven acá, no inline en el endpoint, para poder
// afirmarlas sin base (capa 1) y para que sean UN solo sitio: el endpoint del
// historial y el de la lista (que deriva la señal de vida) leen las mismas.
//
// PRISMA-FREE a propósito: la señal de vida (`estadoDeVida`) la puede querer el
// cliente, y un import de prisma acá rompería el bundle. La CONSULTA vive aparte
// (historial-server.ts). Mismo corte que `order-stat-filters.ts`.

/**
 * EL CORTE. El historial muestra sólo lo que CAMBIÓ algo: un aviso que salió
 * (ENVIADO) o uno que se rompió (FALLIDO). Fuera quedan:
 *   · DUPLICADO — un silencio deliberado (cooldown/periodo). No es un hecho.
 *   · OMITIDO   — no había a quién avisar. Es "por qué no se disparó", diferido.
 *   · PENDIENTE_CANAL — sólo WhatsApp, que no se renderiza (§ waOperativo).
 * Un historial que lista cien "se calló" no responde "¿qué hizo el sistema por
 * mí?"; la ahoga.
 */
export const ESTADOS_HISTORIAL = ['ENVIADO', 'FALLIDO'] as const;

/**
 * EL CAP. Log append-only → nunca paginación por offset (una fila nueva corre
 * todas las páginas). Se muestran las últimas N por automatización, y si hay más
 * se DECLARA en pantalla. Sin cursor en v1 —N cubre semanas de actividad real
 * con el corte puesto—; el cursor entra el día que alguien necesite ir más atrás.
 */
export const CAP_HISTORIAL = 50;

export type EstadoVida = 'viva' | 'sin_casos' | 'fallo' | 'apagada';

/**
 * La señal de vida de una tarjeta: cuatro estados EXCLUYENTES, derivados de la
 * decisión del owner (activo) y del último run que CUENTA (el corte).
 *   apagada   — el operador la apagó.
 *   fallo     — encendida y su último aviso relevante se rompió (pide acción).
 *   viva      — encendida y su último aviso relevante salió.
 *   sin_casos — encendida pero nunca pasó lo que vigila (no está rota).
 * `ultima` es el último run ENVIADO/FALLIDO, no el último crudo: un DUPLICADO
 * reciente no debe leerse como "sin casos" ni tapar un fallo anterior.
 */
export function estadoDeVida(input: { activo: boolean; ultima: { estado: string } | null }): EstadoVida {
  if (!input.activo) return 'apagada';
  if (!input.ultima) return 'sin_casos';
  return input.ultima.estado === 'FALLIDO' ? 'fallo' : 'viva';
}

export interface RunParaHistorial {
  estado:     string;
  canal:      string;
  targetType: string;
  targetId:   string;
  payload:    unknown;
  createdAt:  Date;
}

export interface EntradaHistorial {
  cuando:         Date;
  /** El "sobre qué", legible. Sale del payload —la evidencia que el run YA guarda—. */
  sobreQue:       string;
  /** Enlace al pedido/producto si el payload lo trae; si no, null. */
  href:           string | null;
  resultado:      'ok' | 'fallo';
  resultadoLabel: string;
}

/**
 * Un run → una entrada legible. El "sobre qué" sale del `payload` (titulo/mensaje
 * que el handler ya armó, "La orden PED-1462 volvió sin entregar…"), NO de un join
 * que resuelva `targetId`: el payload es la evidencia, y ése es su propósito. Si
 * faltara, cae a `targetType targetId` —declarado, no un vacío que engañe—.
 */
export function entradaHistorial(run: RunParaHistorial): EntradaHistorial {
  const p = (run.payload && typeof run.payload === 'object' ? run.payload : {}) as Record<string, unknown>;
  const sobreQue =
    typeof p.mensaje === 'string' ? p.mensaje :
    typeof p.titulo  === 'string' ? p.titulo  :
    `${run.targetType} ${run.targetId}`;
  const fallo = run.estado === 'FALLIDO';
  return {
    cuando:         run.createdAt,
    sobreQue,
    href:           typeof p.href === 'string' ? p.href : null,
    resultado:      fallo ? 'fallo' : 'ok',
    // "Avisó" para la campana, "Envió" para el correo — el mismo hecho leído en el
    // vocabulario de su canal. FALLIDO es "Falló" en los dos.
    resultadoLabel: fallo ? 'Falló' : run.canal === 'email' ? 'Envió' : 'Avisó',
  };
}
