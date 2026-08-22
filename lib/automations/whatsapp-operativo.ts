// waOperativo — LA condición única de "el canal de WhatsApp está operativo".
//
// El canal (Meta Cloud API) no está conectado. Dos decisiones dependen de eso y
// TIENEN que salir del mismo predicado, o divergen:
//   · el SENDER no puede enviar → registra PENDIENTE_CANAL en vez de despachar;
//   · el RENDER no debe mostrar las 4 automatizaciones de ese canal → una tarjeta
//     viva que no envía entrena a ignorar la sección (precedente Wompi).
// Con dos lecturas separadas de las env vars, una se renderizaría como operativa
// mientras la otra no envía. Ese es el modo de falla de `razonDelServidor` y
// `cruzoMinimo`: dos definiciones del mismo hecho. Por eso vive acá, una vez.
//
// SERVER-ONLY (lee process.env). El render es cliente y no lee env, así que el
// endpoint de automatizaciones consume esto y decide qué devolver.
//
// Las env vars son las que el stub del canal ya nombra (channels/whatsapp.ts).
// HOY devuelve false en todo entorno real: no hay adaptador de Meta todavía. El
// día que exista, el envío real vive en la rama `waOperativo() === true` del
// sender — no en un segundo lugar que lea las mismas vars.
export function waOperativo(): boolean {
  return Boolean(
    process.env.WHATSAPP_PHONE_NUMBER_ID?.trim() &&
    process.env.WHATSAPP_ACCESS_TOKEN?.trim(),
  );
}
