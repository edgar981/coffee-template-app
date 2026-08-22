import { AUTOMATION_MAP, renderWhatsappTemplate } from '@/constants/automations';
import { waOperativo } from '../whatsapp-operativo';
import type { DispatchRequest, DispatchResult } from './types';

// ─── Canal WHATSAPP — STUB DELIBERADO ────────────────────────────────────────
//
// Todo el pipeline corre de verdad: se evalúa el disparador, se verifica la
// idempotencia, se resuelve el destinatario, se renderiza la plantilla con sus
// variables posicionales y se registra el run. Lo ÚNICO que falta es la llamada
// HTTP a Meta. Por eso el run queda PENDIENTE_CANAL y no ENVIADO: la página no
// dice "enviado" cuando nadie recibió nada.
//
// El mensaje renderizado queda en `AutomationRun.payload`. Ese es el punto: el día
// que Meta esté conectado, los runs acumulados son la evidencia revisable de qué se
// habría mandado, a quién y con qué variables.
//
// LO QUE FALTA PARA CONECTARLO (nada de esto vive en el código todavía):
//   1. Cuenta de WhatsApp Business + número verificado en Meta Business Manager.
//   2. Las plantillas del registry (constants/automations.ts → `plantilla`)
//      registradas y APROBADAS por Meta. Están escritas en su gramática justo para
//      poder subirse tal cual. Meta devuelve un template id por cada una.
//   3. Env vars nuevas: WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN y
//      (opcional) WHATSAPP_BUSINESS_ACCOUNT_ID.
//   4. Reemplazar el cuerpo de `dispatchWhatsapp` por el POST a
//      graph.facebook.com/v21.0/{phone_number_id}/messages con
//      `{ type: 'template', template: { name, language, components:[{ type:'body',
//      parameters:[{type:'text',text:…}] }] } }` — el orden de `variables` de aquí
//      ES el orden posicional de esos parameters. Éxito → ENVIADO; error → lanzar,
//      que el motor lo registra FALLIDO.
//   5. Webhook de estados de entrega (opcional) si se quiere distinguir enviado de
//      entregado/leído.
//
// NO se usa Twilio: `lib/whatsapp.ts` fue un sandbox que funcionó una vez y quedó
// retirado en la migración de contracción (20260729120000_drop_automation_legacy).
// No reintroducirlo — el destino es Meta Cloud API.

export async function dispatchWhatsapp(
  req: Extract<DispatchRequest, { canal: 'whatsapp' }>,
): Promise<DispatchResult> {
  const def      = AUTOMATION_MAP[req.templateKey];
  const plantilla = def?.plantilla;

  // Sin plantilla no hay nada aprobable que mandar — es un bug de registry, no un
  // fallo de canal, así que se registra FALLIDO y se ve en la auditoría.
  if (!plantilla) {
    console.error(`[automations:whatsapp] ${req.templateKey} no tiene plantilla en el registry`);
    return {
      estado:  'FALLIDO',
      payload: { canal: 'whatsapp', motivo: 'plantilla ausente en el registry', templateKey: req.templateKey },
    };
  }

  // El mensaje se renderiza SIEMPRE: es la evidencia de un run PENDIENTE_CANAL —
  // lo que se habría enviado, listo para comparar el día que Meta se conecte.
  const mensaje = renderWhatsappTemplate(plantilla, req.variables);
  const payload = {
    canal:      'whatsapp' as const,
    to:         req.to,
    plantilla:  plantilla.nombre,
    categoria:  plantilla.categoria,
    idioma:     plantilla.idioma,
    variables:  req.variables,
    mensaje,
  };

  // EL GATE DEL ENVÍO REAL, misma condición que decide el render (§ waOperativo).
  // Cuando esté operativo, el POST a la Cloud API de Meta va AQUÍ —éxito → ENVIADO,
  // error → throw para que el motor registre FALLIDO—. El adaptador no existe
  // todavía, así que hasta entonces también se registra PENDIENTE_CANAL: no hay a
  // quién llamar. Wired ya para que el go-live sea rellenar esta rama, no re-cablear.
  if (waOperativo()) {
    console.warn(
      `[automations:whatsapp] waOperativo pero sin adaptador de Meta — se REGISTRA, no se envía · "${plantilla.nombre}" → ${req.to}`,
    );
    return { estado: 'PENDIENTE_CANAL', payload };
  }

  console.log(
    `[automations:whatsapp] PENDIENTE_CANAL · plantilla "${plantilla.nombre}" → ${req.to}\n${mensaje}`,
  );
  return { estado: 'PENDIENTE_CANAL', payload };
}
