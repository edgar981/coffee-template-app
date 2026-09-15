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
// POR QUÉ VIVE ACÁ (`PASARELA-LLAVES-TEST-QUE-CORRE-1`): esta función es pura —recibe sus
// insumos por parámetro, no lee `process.env`— y vive junto a `wompi-firma.ts`, su pariente
// exacto: la ruta del dinero, sin `process.env` adentro. Antes vivía en `instrumentation.ts`
// (raíz del repo) con su test al lado, y el glob de `npm test`
// (`"lib/**/*.test.ts" "constants/**/*.test.ts" "packages/core/**/*.test.ts"`) no llega a la
// raíz — el test estaba escrito, pasaba a mano, y `npm test` nunca lo ejecutaba. Una regla
// escrita que nadie ejecuta no es una guarda. `instrumentation.ts` se quedó como el gancho de
// arranque: lee el entorno, llama a esta función, y aborta con el mensaje.

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
