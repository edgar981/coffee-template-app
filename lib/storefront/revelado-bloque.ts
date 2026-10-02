import { fadeUp, transicionEscalonada } from "@/lib/animation";

// lib/storefront/revelado-bloque.ts — § SECCIONES-ENTRAN-VIVAS-1, corregido por §
// SECCIONES-ENTRAN-UNA-VEZ-1, y REEMPLAZADO de magnitudes por § SECCIONES-ENTRAN-COMO-ORIGEN-1
// (2026-10-02).
//
// EL PEDIDO DEL OWNER (2026-10-01), LITERAL: «revisa homeburgers.com... el ingreso a cada sección se
// siente como vivo; en el demo de las Chamisas o en Onix las secciones tienen los textos estáticos a
// excepción de cuando entramos al origen y suscripción». Y después, aclarando el alcance: «agrega el
// ajuste... a Nayoli, es la página más estática de las 3» y «aplicar la misma entrada a todas no tan
// literal, la entrada que tiene suscripciones y el origen en chamisas y onix está perfecta».
//
// `RevelarBloque` (components/storefront/RevelarBloque.tsx) sigue siendo la primitiva NUEVA para el
// RESTO de los bloques de texto/media de la home (incluida Nayoli); lo que ESTA tanda cambia es
// EXCLUSIVAMENTE su MAGNITUD y su DISPARADOR — nunca qué secciones la usan.
//
// EL GATE DEL OWNER SOBRE `SECCIONES-ENTRAN-VIVAS-1`/`SECCIONES-ENTRAN-UNA-VEZ-1`, LITERAL: «el
// efecto que se agregó de la entrada de las secciones está como demorado, hay un momento al hacer
// scroll en el que pareciera que estuviera navegando en una página vacía porque demoran en salir las
// secciones, pero con 'El Origen' y Suscripción no pasa así que es defecto del nuevo efecto». El
// disparo tardío (§ `SECCIONES-ENTRAN-VIVAS-1`, el margen `-20%` en el fondo) y la curva/duración
// propias (50px/0.8s/`cubic-bezier(0.22,1,0.36,1)`) eran precisamente lo que distinguía a estas
// secciones de "El origen"/Suscripción — el owner midió, en su propio gate, que esa distancia SE
// LEE como página vacía. La corrección es dejar de tener una magnitud propia: `RevelarBloque` pasa a
// disparar y a temporizarse EXACTAMENTE como "El origen" (`fadeUp`+`transicionEscalonada`,
// lib/animation.ts) — las mismas constantes, REUSADAS, no una segunda copia con los mismos números.
//
// POR QUÉ "El origen" Y NO UNA CIFRA PROPIA: "El origen" (`Origen.tsx`, sus fotos/datos/cifras, vía
// `fadeUp`+`transicionEscalonada`) y Suscripción (`SubscriptionCTALinea.tsx`, vía
// `transicionTituloPostal`/`transicionFadePostal`, que a su vez REUSAN `REVELADO_GRUPO_DURACION_S`/
// `REVELADO_GRUPO_EASE`/`REVELADO_GRUPO_PASO_S`) son las DOS secciones que el owner señaló como el
// nivel correcto, y las dos resuelven a la MISMA familia de constantes
// (`REVELADO_GRUPO_*`, `lib/animation.ts`) — no hay una tercera cifra que inventar: hay una que ya
// existe y que las dos referencias ya comparten.
//
// EL DISPARO — SIN MARGEN, `once:true`. "El origen"/Suscripción disparan con
// `viewport={{ once: true }}` SIN `margin` (verificado: ninguno de los `motion.*` de `Origen.tsx` ni
// de `SubscriptionCTALinea.tsx` declara `margin`) — la intersección cuenta apenas un píxel del bloque
// asoma por el borde inferior del viewport, lo opuesto del disparo tardío que `RevelarBloque` tenía
// (`REVELA_BLOQUE_MARGEN`, RETIRADA con esta tanda, sin reemplazo: "sin margen" no es un valor, es la
// AUSENCIA del prop). El `once:true` (de `SECCIONES-ENTRAN-UNA-VEZ-1`) NO CAMBIA: sigue siendo
// correcto que un bloque, una vez revelado, no vuelva a ocultarse.
export const variantesRevelaBloque = fadeUp;

export type TransicionRevelaBloque = ReturnType<typeof transicionEscalonada>;

// `indice` es la posición del bloque DENTRO de su grupo de hermanos (0-based, en orden de lectura).
// `transicionRevelaBloque` DELEGA en `transicionEscalonada` (lib/animation.ts, los tokens
// `REVELADO_GRUPO_*`) en vez de declarar su propia duración/curva/paso — "Reusá esas constantes, no
// copies valores" (§ el spec de esta tanda): dos lugares con la MISMA cifra escrita dos veces es cómo
// una termina desincronizada de la otra (§ CLAUDE.md, "razonDelServidor"/"cruzoMinimo"). Se conserva
// el `Math.max(0, …)` de la versión anterior — un índice negativo no es un caso real (todo llamador
// pasa un entero ≥0), pero sigue sin poder producir un retraso negativo.
export function transicionRevelaBloque(indice: number = 0): TransicionRevelaBloque {
  return transicionEscalonada(Math.max(0, indice));
}
