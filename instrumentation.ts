// Chequeo de arranque del servidor: impide que un despliegue en estado DEMO arranque con
// la llave pública PRODUCTIVA de la pasarela de pagos (Wompi).
//
// POR QUÉ EXISTE (CLAUDE.md § Pagos en línea (Wompi), `PASARELA-LLAVES-COHERENTES-1`,
// owner 2026-09-15): la regla "un despliegue DEMO lleva llaves de SANDBOX, aunque su rama
// sea `main` y su deploy sea 'producción' en Vercel" existía sólo como INTENCIÓN escrita —
// dependía enteramente de que el operador no se equivocara al pegar variables de entorno.
// Sin nada que la haga cumplir, no es una guarda: es una frase. Lo que se evita, sin
// eufemismo: que una tienda de DEMO cobre dinero real a una persona real.
//
// LA FORMA: LISTA NEGRA, NO LISTA BLANCA (decisión del owner). No se exige que la llave de
// sandbox tenga un prefijo conocido —dato que no está medido—; sólo se rechaza el único
// prefijo confirmado como productivo. Una lista blanca rompería el día que Wompi agregue un
// entorno o cambie de convención; la lista negra sigue protegiendo contra lo único
// peligroso y falla del lado seguro.
//
// `WOMPI_PUBLIC_KEY` es la llave PÚBLICA — viaja al navegador, no es secreto — así que su
// prefijo puede vivir en el código. Las demás variables de la pasarela SÍ son secretas: este
// chequeo no las lee, no las compara, no las nombra.
//
// SI LA VARIABLE NO ESTÁ, NO PASA NADA: hoy ningún otro archivo del repo la referencia
// (grep, 2026-09-15) — este chequeo es su primer consumidor. Un despliegue sin pasarela
// configurada arranca normal, sin advertencia y sin ruido.
//
// CUÁNDO CORRE: `register()` se llama UNA VEZ cuando arranca una instancia nueva del
// servidor de Next.js (`next dev` / `next start`, y el runtime de Vercel), antes de atender
// el primer request — nunca en la primera transacción de pago, que ya sería tarde. Next.js
// EXPLÍCITAMENTE NO llama a `register()` durante `next build`
// (`node_modules/next/dist/server/lib/router-utils/instrumentation-globals.external.js`:
// `if (process.env.NEXT_PHASE === 'phase-production-build') return;`) y memoiza la promesa
// de registro, así que corre una sola vez por proceso — nunca por request. El build no
// tiene por qué tener llaves, y estructuralmente no las necesita para pasar.
import { esDespliegueDemo } from "./next.config";

// Confirmado por el owner de primera mano contra el dashboard de Wompi: es el prefijo de la
// llave PÚBLICA PRODUCTIVA. Es lo único que este chequeo afirma sobre prefijos — no se
// inventa ni se deduce un prefijo de sandbox.
export const PREFIJO_LLAVE_PASARELA_PRODUCTIVA = "pub_prod_";

export type VeredictoLlavePasarela = { ok: true } | { ok: false; mensaje: string };

// Pura y testeable a propósito: recibe sus insumos en vez de leer `process.env` adentro,
// para poder afirmar en un test los cuatro casos que importan (llave productiva en demo
// rechaza; cualquier otra llave pasa; sin llave pasa; producción real pasa aunque la llave
// sea productiva).
export function verificarLlavePasarelaCoherente(
  esDemo: boolean,
  llavePublicaPasarela: string | undefined,
): VeredictoLlavePasarela {
  if (!llavePublicaPasarela) {
    return { ok: true };
  }
  if (esDemo && llavePublicaPasarela.startsWith(PREFIJO_LLAVE_PASARELA_PRODUCTIVA)) {
    return {
      ok: false,
      mensaje: [
        "Este despliegue está marcado como DEMO (VERCEL_ENV no es 'production', o NOINDEX",
        "está en '1') y la variable WOMPI_PUBLIC_KEY es una llave pública PRODUCTIVA de la",
        `pasarela de pagos (empieza con '${PREFIJO_LLAVE_PASARELA_PRODUCTIVA}').`,
        "",
        "Por qué importa: con esta combinación, una tienda de demostración podría cobrar",
        "dinero real a una persona real.",
        "",
        "Qué hacer: pon las llaves de SANDBOX de la cuenta de Wompi en este despliegue. Si",
        "este despliegue SÍ es una tienda real que vende, quita la marca de demo",
        "(VERCEL_ENV='production' y NOINDEX sin poner en '1').",
      ].join("\n"),
    };
  }
  return { ok: true };
}

export function register() {
  const veredicto = verificarLlavePasarelaCoherente(
    esDespliegueDemo(),
    process.env.WOMPI_PUBLIC_KEY,
  );
  if (!veredicto.ok) {
    throw new Error(veredicto.mensaje);
  }
}
