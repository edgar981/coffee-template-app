// Gancho de arranque del servidor: impide que un despliegue en estado DEMO arranque con la
// llave pública PRODUCTIVA de la pasarela de pagos (Wompi). La REGLA (por qué existe, la
// forma de lista negra, qué NO se lee ni se compara) vive en `lib/pagos/llaves-pasarela.ts`
// junto con su test — este archivo es sólo el gancho: lee el entorno, llama a la función
// pura, y aborta con el mensaje que ella arma. Cuanto menos lógica quede acá, mejor: es el
// único pedazo que ningún test puede cubrir (ver abajo, § CUÁNDO CORRE).
//
// CUÁNDO CORRE: `register()` se llama UNA VEZ cuando arranca una instancia nueva del
// servidor de Next.js (`next dev` / `next start`, y el runtime de Vercel), antes de atender
// el primer request — nunca en la primera transacción de pago, que ya sería tarde. Next.js
// EXPLÍCITAMENTE NO llama a `register()` durante `next build`
// (`node_modules/next/dist/server/lib/router-utils/instrumentation-globals.external.js`:
// `if (process.env.NEXT_PHASE === 'phase-production-build') return;`) y memoiza la promesa
// de registro, así que corre una sola vez por proceso — nunca por request. El build no
// tiene por qué tener llaves, y estructuralmente no las necesita para pasar.
//
// SI LA VARIABLE NO ESTÁ, NO PASA NADA: hoy ningún otro archivo del repo la referencia
// (grep, 2026-09-15) — este chequeo es su primer consumidor. Un despliegue sin pasarela
// configurada arranca normal, sin advertencia y sin ruido.
import { esDespliegueDemo } from "./next.config";
import { verificarLlavePasarelaCoherente } from "./lib/pagos/llaves-pasarela";

export function register() {
  const veredicto = verificarLlavePasarelaCoherente(
    esDespliegueDemo(),
    process.env.WOMPI_PUBLIC_KEY,
  );
  if (!veredicto.ok) {
    throw new Error(veredicto.mensaje);
  }
}
