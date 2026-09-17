'use client';

/**
 * EL MARCO AISLADO DEL DESAFÍO 3DS (§ API-DIRECTA-3DS-CON-CHALLENGE-1). Cuando el emisor de la
 * tarjeta pide un paso adicional, su pantalla —que NO es nuestra y NO la controlamos— se dibuja
 * ACÁ, en un área VISUALMENTE APARTE, declarada como ajena (§1 del spec del slice: "no se
 * maquilla dentro del cromo de la tienda"). ES DECISIÓN DE PRODUCTO DEL OWNER, marcada como
 * tal: con el desafío VUELVE la marca ajena (la pantalla del emisor, con la marca de la red que
 * el esquema EXIGE mostrar) al muestrario del checkout — el owner ya lo nombró así antes de que
 * este slice se construyera.
 *
 * `html` LLEGA YA DECODIFICADO por el servidor (`extraerContenidoDesafio3ds`,
 * `lib/pagos/tres-ds.ts`, corrida UNA vez en `PATCH /api/checkout`) — este componente NUNCA
 * decodifica nada; sólo lo EMBEBE.
 *
 * EL AISLAMIENTO ES EL PUNTO — nunca se afloja para que "funcione mejor":
 *   - `srcDoc`, no `src`: el contenido viaja como STRING, nunca como URL que el navegador
 *     tuviera que resolver contra un origen (y que pudiera filtrar nuestro `document.referrer`
 *     al emisor en la primera petición).
 *   - `sandbox="allow-scripts allow-forms"` — Y NADA MÁS. Es el mínimo que el flujo EMV 3DS2
 *     necesita: el HTML del emisor trae un formulario que se auto-envía por un `<script>`
 *     inline hacia SU servidor (el ACS) — sin `allow-scripts` ese envío nunca dispara, y sin
 *     `allow-forms` el envío del formulario no ocurre.
 *   - SIN `allow-same-origin`: el contenido del emisor queda con un origen OPAQUE (nulo) en
 *     cada navegación dentro del iframe — no puede leer nuestras cookies, nuestro
 *     `localStorage` ni nada de nuestro DOM.
 *   - SIN `allow-top-navigation` NI `allow-popups`: el contenido del emisor no puede navegar ni
 *     reemplazar esta página, ni abrir ventanas nuevas. Si el desafío se resuelve, lo sabemos
 *     por el MISMO sondeo que ya corre en `EsperaConfirmacionTarjeta` (§ el reporte del slice,
 *     §C/§D) — nunca por lo que el iframe intente hacerle a la página.
 *   - NINGÚN DATO NUESTRO viaja adentro: `html` es contenido AJENO que se muestra, no un
 *     formulario nuestro que reciba nada del comprador acá — la tarjeta y el navegador ya se
 *     mandaron antes de llegar a este componente (§ `FormularioTarjeta.tsx`, `recolectarDatos
 *     Navegador3ds`).
 */
export interface DesafioTarjetaProps {
  html: string;
}

// TEXTO PROVISIONAL — PENDIENTE DE COPY DEL OWNER (igual que el resto del programa, § el
// reporte del slice). Declara explícitamente que esta área es ajena: es la mitad honesta de
// "área visualmente apartada" que el copy tiene que decir, no sólo el borde.
const TEXTO = {
  titulo: 'Verificación de tu banco',
  aviso: 'Esta pantalla la muestra tu banco, no nosotros. Complétala para confirmar tu compra.',
};

export default function DesafioTarjeta({ html }: DesafioTarjetaProps) {
  return (
    <div className="rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-3 text-left">
      <p className="text-xs font-semibold text-gray-600 mb-0.5">{TEXTO.titulo}</p>
      <p className="text-[11px] text-gray-500 mb-2">{TEXTO.aviso}</p>
      <iframe
        title={TEXTO.titulo}
        srcDoc={html}
        sandbox="allow-scripts allow-forms"
        className="w-full h-[420px] rounded-lg border border-gray-200 bg-white"
      />
    </div>
  );
}
