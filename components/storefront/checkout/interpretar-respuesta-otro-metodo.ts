import type { ResultadoCreacionTransaccionWompi } from '@/types/payment';
import type { Resultado3ds } from '@/lib/pagos/tres-ds';

/**
 * CHECKOUT-NEQUI-EXITO-FIX-1: la clasificación PURA de la respuesta que `PATCH /api/checkout`
 * devuelve para el camino QUE NO ES TARJETA — extraída para poder afirmarla con un test, el
 * mismo criterio que ya separa `lib/pagos/creacion-transaccion.ts` del route handler.
 *
 * EL DEFECTO QUE ESTO CIERRA: desde que § API-DIRECTA-ENVIO-GENERICO-1 generalizó
 * `lib/pagos/wompi-api.ts` para aceptar cualquier `payment_method` (no sólo tarjeta), el
 * servidor responde `{ tipo: 'creada', ... }` — la MISMA forma que ya usa `FormularioTarjeta`
 * (`ResultadoCreacionTransaccionWompi`, `types/payment.ts`) — también para este camino. Pero
 * `FormularioOtroMetodoPasarela.tsx` seguía escrito contra el diseño ANTERIOR, donde el
 * servidor SIEMPRE respondía `no_implementado`: nunca miraba `body?.tipo`, sólo `body?.error`
 * (`undefined` en el caso de éxito) y caía siempre al texto de error genérico. El comprador
 * pagaba bien y veía una falla. El error fue del spec que generalizó el servidor sin declarar
 * este componente en su alcance — no de quien lo escribió entonces.
 *
 * SIGUE EL MOLDE DE `confirmarConAutenticacion3ds` (`FormularioTarjeta.tsx`): mismo
 * discriminador (`tipo === 'creada'`), mismo default de `autenticacion3ds` a `'desconocido'`
 * cuando el proveedor no lo trae, mismo saneo de `desafioHtml` (cadena no vacía o `null`).
 * `ResultadoCreacionTransaccionOtroMetodo` (`types/payment.ts`) queda SIN USAR por este
 * cambio — su docstring ("el servidor SIEMPRE responde no_implementado") ya no describe el
 * servidor real; no se toca ese archivo (fuera de `touches` de este slice), ver el reporte.
 */
export type ResultadoRespuestaOtroMetodo =
  | { tipo: 'exito'; resultado3ds: Resultado3ds; desafioHtml: string | null }
  | { tipo: 'metodo_no_habilitado'; mensaje: string }
  | { tipo: 'error'; mensaje: string };

/**
 * `body` es lo que `res.json()` devolvió (o `null` si el cuerpo no se pudo leer). `mensajePor
 * Defecto` es el texto que se muestra cuando el servidor no trajo un `error` legible — nunca
 * se inventa un mensaje más específico que el que el servidor mandó.
 *
 * `metodo_no_habilitado` se devuelve como su PROPIO caso — nunca aplanado contra `'error'` —
 * porque desde § CHECKOUT-OTRO-METODO-SIN-SALIDA-1 (2026-09-18, decisión del owner) el
 * llamador SÍ decide distinto para él: `FormularioOtroMetodoPasarela` llama a su
 * `onMetodoNoHabilitado` (el MISMO mecanismo que `FormularioTarjeta` ya usaba) en vez de
 * mostrar este caso inline — el rechazo ESTRUCTURAL cae a la misma confirmación manual que
 * ya usa tarjeta, nunca a un error sin salida. Antes de ese slice el discriminador existía
 * pero nadie lo consultaba para esto (`SelectorMetodoPasarela` no le pasaba
 * `onMetodoNoHabilitado` a este formulario) — quedó registrado como hallazgo abierto en
 * `DECISIONS.md`, `CHECKOUT-OTRO-METODO-SIN-SALIDA-1`, y este slice lo cierra.
 */
export function interpretarRespuestaOtroMetodo(
  body: unknown,
  mensajePorDefecto: string,
): ResultadoRespuestaOtroMetodo {
  const resultado = body as Partial<ResultadoCreacionTransaccionWompi> | null;

  if (resultado?.tipo === 'creada') {
    return {
      tipo: 'exito',
      resultado3ds: resultado.autenticacion3ds ?? 'desconocido',
      desafioHtml: typeof resultado.desafioHtml === 'string' && resultado.desafioHtml.trim() !== ''
        ? resultado.desafioHtml
        : null,
    };
  }

  const mensaje = resultado && 'error' in resultado && typeof resultado.error === 'string'
    ? resultado.error
    : mensajePorDefecto;

  if (resultado?.tipo === 'metodo_no_habilitado') {
    return { tipo: 'metodo_no_habilitado', mensaje };
  }

  return { tipo: 'error', mensaje };
}
