'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Clock } from 'lucide-react';
import { consultarRetornoPago } from '@/services/checkout.service';
import {
  esperaSondeoSiguienteMs, TECHO_SONDEO_MS, TECHO_SONDEO_DESAFIO_MS, type Resultado3ds,
} from '@/lib/pagos/tres-ds';
import DesafioTarjeta from './DesafioTarjeta';

/**
 * La ESPERA, tras crear la transacción de tarjeta con 3DS pedido (§ API-DIRECTA-3DS-SIN-
 * CHALLENGE-1, §D del reporte del slice). La transacción NO resuelve al instante — hay que
 * SONDEAR hasta que el webhook cierre el `PaymentIntent` a un estado final, y esa espera con
 * backoff creciente es la MISMA política que ya usa `app/(storefront)/checkout/retorno/
 * RetornoCliente.tsx` para el mismo caso (esperar a que un `PaymentIntent EN_VUELO` resuelva),
 * reusando `/api/checkout/retorno` (vía `consultarRetornoPago`, YA EXPORTADO de
 * `services/checkout.service.ts` — sólo se IMPORTA, no se modifica ese archivo: está fuera de
 * `touches:` de este slice, ver el reporte).
 *
 * SIN SEGUNDO FACTOR TECLEADO: a diferencia de `RetornoCliente` (que pide el correo porque la
 * `reference` sola viaja en una URL que un tercero podría leer), acá el `email` YA ES CONOCIDO
 * —es el mismo que el comprador tecleó en el paso de Información del checkout, en la MISMA
 * sesión— así que no hay nada que re-preguntar.
 *
 * EL DESAFÍO (§ API-DIRECTA-3DS-CON-CHALLENGE-1) NO CAMBIA EL MECANISMO DE SONDEO — sólo qué se
 * DIBUJA mientras se espera, y CUÁNDO se declara "sigue sin resolver" (`TECHO_SONDEO_DESAFIO_MS`,
 * más alto que `TECHO_SONDEO_MS`, porque acá hay una PERSONA completando un paso en la pantalla
 * de su banco — ver `lib/pagos/tres-ds.ts`). Con `desafioHtml`, la vista `en_vuelo` embebe el
 * marco aislado (`DesafioTarjeta`) en vez de sólo texto; SIN `desafioHtml` (el desafío se
 * detectó pero no se pudo decodificar ningún contenido), sigue el texto honesto que ya existía
 * antes de este slice — un contenido inválido/ausente NUNCA rompe la pantalla.
 *
 * § CHECKOUT-ERROR-EN-LA-MISMA-PANTALLA-1: ESTE COMPONENTE YA NO TIENE VISTA `fallido` PROPIA.
 * Antes, un cobro rechazado dejaba al comprador en una pantalla terminal sin vuelta —el
 * formulario de tarjeta/otro método no se volvía a mostrar, así que reintentar exigía salir del
 * checkout—. Ahora, apenas el sondeo detecta un estado que no es `APROBADO` (ni `EN_VUELO`), este
 * componente llama a `onFallido` y DEJA DE RENDERIZAR NADA MÁS: quien decide qué mostrar en su
 * lugar —el formulario, con los datos ya escritos intactos (salvo el CVV) y un mensaje arriba del
 * botón— es el llamador (`FormularioTarjeta`/`FormularioOtroMetodoPasarela`), no este componente.
 *
 * § CHECKOUT-TRANSICION-DEFECTOS-1 (2026-09-18, tres defectos que el owner vio en la PRIMERA
 * transacción real, § el reporte del slice): ESTE COMPONENTE YA NO TIENE VISTA `aprobado` PROPIA
 * TAMPOCO, por la misma razón que perdió `fallido`. Antes, el pago aprobado se anunciaba con un
 * ícono + un título + una frase — sin número de orden, sin resumen, sin acciones — mientras que
 * el camino MANUAL (que ni siquiera cobró) sí mostraba la confirmación completa. Apenas el sondeo
 * detecta `APROBADO`, este componente llama a `onAprobado` y DEJA DE RENDERIZAR NADA MÁS: el
 * llamador (`FormularioTarjeta`/`FormularioOtroMetodoPasarela` → `SelectorMetodoPasarela` →
 * `checkout/page.tsx`) reemplaza TODA la transición por la MISMA pantalla "¡Pedido recibido!" que
 * ya usan los métodos manuales — reusada, no rediseñada.
 *
 * Y LA VISTA `en_vuelo` SIN DESAFÍO YA NO ES UN PANEL PROPIO: antes, apenas la transacción se
 * creaba, este componente reemplazaba AL FORMULARIO ENTERO por un ícono + un texto — la MISMA
 * "verificación" que el botón del formulario ya venía mostrando (`tokenizando`), sólo que en un
 * segundo layout. Dos layouts para el mismo momento es justo el defecto que el owner reportó
 * ("aparece dos veces"). Ahora, sin desafío que embeber, este componente sólo aporta una línea de
 * texto corta (el llamador ya bloqueó sus campos y su botón ya muestra el progreso) — nunca un
 * panel que reemplace al formulario. `techo` SIGUE siendo una vista propia: no es un fallo — es
 * "sigue sin resolver", honesto sobre no inventar un veredicto — así que no dispara `onFallido`
 * ni `onAprobado`. Sí dispara `onTecho`, PERO sólo para que el llamador oculte los campos de la
 * tarjeta bloqueados — este componente sigue dibujando su propia pantalla completa (número de
 * orden + las mismas dos acciones que el resto de la transición), porque es un cambio de estado
 * real (el sondeo se agotó), no un parpadeo de carga.
 */
export interface EsperaConfirmacionTarjetaProps {
  reference: string;
  email: string;
  /** La clasificación de `clasificarAutenticacion3ds` (§ API-DIRECTA-3DS-SIN-CHALLENGE-1) —
   *  sólo cambia el COPY de la espera (honesto sobre qué está pasando), nunca el mecanismo de
   *  sondeo: los tres casos sondean IGUAL. */
  resultado3ds: Resultado3ds;
  /** El HTML del desafío, YA DECODIFICADO por el servidor (§ API-DIRECTA-3DS-CON-CHALLENGE-1) —
   *  `null` cuando no hay nada que embeber (sin fricción, desconocido, o un desafío sin
   *  contenido decodificable). Este componente nunca decodifica nada. */
  desafioHtml: string | null;
  /** El cobro fue APROBADO (§ CHECKOUT-TRANSICION-DEFECTOS-1) — el sondeo encontró el estado
   *  final `APROBADO`. Este componente no dibuja nada para ese caso: llama a `onAprobado` y el
   *  llamador reemplaza TODA la pantalla de la transición por la confirmación completa del
   *  pedido. Se llama UNA vez, y no se vuelve a programar sondeo después. */
  onAprobado: () => void;
  /** El cobro fue RECHAZADO (§ CHECKOUT-ERROR-EN-LA-MISMA-PANTALLA-1) — el sondeo encontró un
   *  estado final que no es `APROBADO`. Este componente no dibuja nada para ese caso: llama a
   *  `onFallido` y el llamador decide qué mostrar (el formulario de vuelta, con sus datos
   *  intactos salvo el CVV, y un mensaje). Se llama UNA vez por transición a ese estado. */
  onFallido: () => void;
  /** EL SONDEO SE AGOTÓ SIN RESOLVER (§ CHECKOUT-TRANSICION-DEFECTOS-1, §4: "indeterminado") —
   *  a diferencia de `onAprobado`/`onFallido`, este componente SÍ sigue dibujando (su propia
   *  vista `techo`, con número de orden y las dos acciones de siempre). El callback existe sólo
   *  para que el llamador OCULTE los campos de la tarjeta bloqueados — mostrarlos arriba de la
   *  pantalla de "sigue procesándose" sería mostrar dos respuestas al mismo momento. Se llama
   *  UNA vez, cuando `vista` pasa a `techo`. */
  onTecho: () => void;
  /** § CHECKOUT-GATE-VISUAL-HALLAZGOS-1: el llamador YA MUESTRA, en su propio botón bloqueado,
   *  el mismo hecho que esta vista `en_vuelo` diría en su párrafo (`enVueloSinFriccion`,
   *  "Estamos confirmando tu pago.") — así que ese párrafo no se dibuja: repetirlo sería afirmar
   *  el mismo hecho dos veces en la misma vista, que es exactamente lo que el owner reportó
   *  (el botón decía "Verificando tarjeta…" y esta línea decía "Estamos confirmando tu pago.",
   *  a la vez). Default `false` — sin pasarlo, el comportamiento es el de siempre. SÓLO afecta
   *  el caso SIN desafío 3DS: con desafío, esta vista aporta el marco embebido del emisor (o su
   *  explicación), que el botón no puede decir por sí solo y no es un duplicado. */
  botonYaMuestraFaseConfirmando?: boolean;
}

type Vista = 'en_vuelo' | 'techo';

// TEXTO PROVISIONAL — PENDIENTE DE COPY DEL OWNER (§ el reporte del slice, igual que el resto
// del copy de este programa), salvo `enVueloSinFriccion`: ESE es el texto que el owner dio
// TEXTUAL (§ CHECKOUT-TRANSICION-DEFECTOS-1) para tarjeta y billetera — sin promesa de tiempo y
// sin nombrar al banco, porque acá NO hay banco de por medio y la transacción real medida
// (`PRIMERA-TRANSACCION-REAL-ASIENTO-1`, DECISIONS.md) resolvió en 5.6–10.3 segundos, no
// "minutos". El texto viejo era el del desafío (`enVueloDesafio`, abajo, que SÍ tiene banco y SÍ
// puede tardar) copiado a la rama que no lo necesitaba.
const TEXTO = {
  enVueloSinFriccion: 'Estamos confirmando tu pago.',
  // SIN `desafioHtml` (§ API-DIRECTA-3DS-CON-CHALLENGE-1 — desafío detectado pero sin contenido
  // decodificable, el mismo texto honesto que ya existía antes de este slice): sigue esperando
  // por el MISMO sondeo, sin inventar una pantalla que no tiene con qué dibujarse. CON
  // `desafioHtml`, la vista `en_vuelo` embebe `DesafioTarjeta` en su lugar (ver el render, abajo)
  // y este texto NO se muestra — el marco aislado ya declara por su cuenta que es ajeno.
  // NO SE TOCA (§ CHECKOUT-TRANSICION-DEFECTOS-1): acá SÍ hay un banco de por medio —una persona
  // completando un paso en la pantalla de su emisor— y SÍ puede tardar.
  enVueloDesafio: 'Tu banco pide un paso adicional para confirmar esta compra, que todavía no podemos completar desde aquí. Sigue esperando — si tu banco lo resuelve por su cuenta, confirmaremos el pago automáticamente.',
  techoTitulo: 'Tu pago sigue procesándose',
  techoCuerpo: 'Te avisaremos apenas se confirme. Puedes revisar el estado de tu pedido más tarde con tu número de orden y tu correo.',
};

export default function EsperaConfirmacionTarjeta({ reference, email, resultado3ds, desafioHtml, onAprobado, onFallido, onTecho, botonYaMuestraFaseConfirmando = false }: EsperaConfirmacionTarjetaProps) {
  const [vista, setVista] = useState<Vista>('en_vuelo');

  // El reloj del backoff vive en refs — no debe disparar un re-render por sí mismo, sólo el
  // RESULTADO de cada consulta cambia `vista` (mismo patrón que RetornoCliente.tsx).
  const intentoRef = useRef(0);
  const inicioRef = useRef<number | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // § API-DIRECTA-3DS-CON-CHALLENGE-1: el techo del DESAFÍO es más alto — hay una persona
  // completando un paso en la pantalla de su banco, no sólo el emisor resolviendo solo.
  const techoMs = resultado3ds === 'desafio' ? TECHO_SONDEO_DESAFIO_MS : TECHO_SONDEO_MS;

  const programarSiguiente = useCallback(() => {
    if (inicioRef.current === null) inicioRef.current = Date.now();
    if (Date.now() - inicioRef.current >= techoMs) {
      // No vuelve a programarse tras esto — es la ÚNICA vez que esta rama se alcanza.
      setVista((v) => (v === 'en_vuelo' ? 'techo' : v));
      onTecho();
      return;
    }

    const espera = esperaSondeoSiguienteMs(intentoRef.current);
    intentoRef.current += 1;

    timeoutRef.current = setTimeout(async () => {
      let resultado: Awaited<ReturnType<typeof consultarRetornoPago>> = null;
      try {
        resultado = await consultarRetornoPago(reference, email);
      } catch {
        // 429 u otro fallo transitorio: no rompe el ciclo, el próximo tick reintenta — sin
        // reiniciar el reloj del techo (mismo criterio que RetornoCliente.tsx).
      }
      if (!resultado || resultado.estado === 'EN_VUELO') {
        programarSiguiente();
        return;
      }
      // § CHECKOUT-TRANSICION-DEFECTOS-1 / CHECKOUT-ERROR-EN-LA-MISMA-PANTALLA-1: los dos
      // estados finales se DELEGAN al llamador — ninguno dibuja una vista propia acá (ver el
      // docstring del componente). Ninguna rama vuelve a llamar a `programarSiguiente`: cada
      // callback se invoca UNA sola vez por transición a su estado.
      if (resultado.estado === 'APROBADO') {
        onAprobado();
      } else {
        onFallido();
      }
    }, espera);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reference, email, techoMs, onAprobado, onFallido, onTecho]);

  useEffect(() => {
    programarSiguiente();
    // Arranca UNA vez, al montar — `programarSiguiente` se re-encadena a sí misma vía
    // `setTimeout`, no por dependencias de efecto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // `reference` se arma como `<numero_orden>:<cuid-de-la-propia-fila>`
  // (`referenciaIntentoPago`, `packages/core/src/orders.ts`) — el número de orden es la
  // primera mitad, y es lo único que hace falta mostrar/enlazar acá.
  const numeroOrden = reference.split(':')[0];

  // § CHECKOUT-TRANSICION-DEFECTOS-1: `techo` SIGUE siendo una vista propia que reemplaza al
  // formulario — no es un fallo (no dispara `onFallido`) ni un parpadeo de carga: el sondeo se
  // agotó de verdad, y eso es un cambio de estado real. Ganó las MISMAS DOS acciones que ya
  // ofrece la confirmación de los métodos manuales (`checkout/page.tsx`) — antes sólo decía "te
  // avisaremos" sin decirle al comprador qué hacer mientras tanto; el número de orden ya estaba.
  if (vista === 'techo') {
    return (
      <div className="text-center">
        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Clock className="w-8 h-8 text-amber-600" />
        </div>
        <h3 className="text-xl font-playfair text-[var(--sf-tinta)] mb-1">{TEXTO.techoTitulo}</h3>
        <p className="text-sm text-[var(--sf-texto-suave)] mb-3">
          {TEXTO.techoCuerpo}
          {resultado3ds === 'desafio' ? ` (${TEXTO.enVueloDesafio})` : ''}
        </p>
        {/* PALETA-MIGRAR-TEXTO-SOBRE-SUPERFICIE-1: texto directo sobre `--sf-superficie` migrado
            al par `var(--sf-sobre-superficie[-suave],<token de hoy>)` (§ TEMAS-P6-FAMILIAS-1). */}
        <div className="bg-[var(--sf-superficie)] rounded-2xl p-4 mb-4 text-left">
          <p className="text-xs text-[var(--sf-sobre-superficie-suave,var(--sf-texto-suave))] mb-1 text-center">Número de orden</p>
          <p className="text-xl font-bold text-[var(--sf-sobre-superficie,var(--sf-acento-texto))] text-center">{numeroOrden}</p>
        </div>
        <div className="flex flex-col gap-3">
          <Link
            href={`/rastrear-pedido?orden=${encodeURIComponent(numeroOrden)}`}
            className="block w-full bg-[var(--sf-tinta)] text-[var(--sf-sobre)] font-semibold py-3 rounded-xl text-sm hover:bg-[var(--sf-tinta-2)] transition-colors"
          >
            Rastrear mi pedido
          </Link>
          <Link
            href="/tienda"
            className="block w-full sf-borde border-[var(--sf-linea)] text-[var(--sf-texto)] font-medium py-3 rounded-xl text-sm hover:bg-[var(--sf-superficie)] transition-colors"
          >
            Seguir comprando
          </Link>
        </div>
      </div>
    );
  }

  // § API-DIRECTA-3DS-CON-CHALLENGE-1: con contenido decodificable, la vista `en_vuelo`
  // EMBEBE el marco aislado del emisor en vez de sólo texto — el sondeo de arriba sigue
  // corriendo igual por debajo; `DesafioTarjeta` no lo toca ni se entera de él. SIN contenido
  // (desafío detectado pero nada que decodificar), cae al texto honesto que ya existía.
  if (vista === 'en_vuelo' && resultado3ds === 'desafio' && desafioHtml) {
    return (
      <div className="text-center space-y-3">
        <DesafioTarjeta html={desafioHtml} />
        <p className="text-xs text-[var(--sf-texto-suave)]">
          No cierres esta página — confirmaremos tu pago apenas tu banco resuelva el paso de arriba.
        </p>
      </div>
    );
  }

  // § CHECKOUT-GATE-VISUAL-HALLAZGOS-1: SIN desafío, si el llamador YA dice este mismo hecho por
  // su cuenta (su botón bloqueado), esta línea no se dibuja — el botón bloqueado de arriba ya lo
  // dijo, y una segunda afirmación del mismo hecho en la misma vista es justo lo que el owner
  // reportó (§ el docstring de `botonYaMuestraFaseConfirmando`). CON desafío, esta línea SIGUE
  // mostrándose siempre (abajo): ahí no es un duplicado, es información que el botón no puede dar.
  if (resultado3ds !== 'desafio' && botonYaMuestraFaseConfirmando) return null;

  // § CHECKOUT-TRANSICION-DEFECTOS-1: SIN desafío que embeber, este componente ya NO dibuja un
  // panel propio (ícono + caja centrada) — ESO era el segundo layout del mismo momento que el
  // owner reportó. El llamador (`FormularioTarjeta`/`FormularioOtroMetodoPasarela`) ya bloqueó
  // sus campos y su botón ya muestra el progreso; acá sólo va una línea de texto corta, dentro
  // del MISMO contenedor que el formulario — nunca un remonte.
  return (
    <p className="text-xs text-[var(--sf-texto-suave)] text-center">
      {resultado3ds === 'desafio' ? TEXTO.enVueloDesafio : TEXTO.enVueloSinFriccion}
    </p>
  );
}
