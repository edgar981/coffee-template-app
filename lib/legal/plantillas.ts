// LAS CUATRO PÁGINAS LEGALES (§ TIENDA-LEGAL-1) — PLANTILLA FIJA, no dato por tenant (decisión del
// owner, `LEGALES-CENSO-TAMANO-1`, DECISIONS.md en la rama `slice/api-directa-panel-metodos-1`: "El
// texto estatutario es idéntico para cualquier comercio colombiano… una plantilla fija con los
// datos del negocio sustituidos no puede quedar vacía: el texto está, sólo faltan los campos de
// identidad"). Este módulo es la ÚNICA fuente del texto: las cuatro páginas de
// `app/(storefront)/legal/` lo consumen, nunca escriben su propio copy inline — la misma razón por
// la que `lib/checkout/estado-pedido.ts` centraliza las cinco pantallas de estado.
//
// BORRADOR SIN REVISIÓN DE ABOGADO — como lo eran los cuatro documentos de origen
// (`.scratch/lanzamiento/tienda-*.md`, escritos para La Granja Jofamugo y generalizados acá para
// cualquier vendedor). El texto cubre lo sustantivo de la Ley 1480 de 2011 (Estatuto del
// Consumidor) y la Ley 1581 de 2012 (datos personales), pero varios puntos quedaban marcados
// [VERIFICAR] en los originales — ver `vendedorAdvertenciaBorrador` y el panel, que repiten el
// aviso en los dos sitios donde alguien podría publicar esto sin saberlo.
//
// NINGÚN DATO DE VENDEDOR SE INVENTA (§ CLAUDE.md, "defaults-como-fallback" no aplica a una
// identidad legal ni a una promesa comercial). Las plantillas reciben `VendedorContent` ya
// resuelto (vacíos incluidos) y:
//   - los campos OBLIGATORIOS para publicar (§ `CAMPOS_VENDEDOR_REQUERIDOS`, abajo) se asumen
//     presentes — es responsabilidad de quien llama (las páginas, gateadas por
//     `vendedorEstaCompleto`) no invocar el texto completo sin ellos;
//   - los campos OPCIONALES-DENTRO-DE-COMPLETO (nombreComercial, tipoPersona, documentoTipo,
//     direccion, horarioAtencion, municipioDespacho, transportadoras, diasPreparacionHabiles,
//     ventanaCambiosDias) tienen un FALLBACK GENÉRICO explícito, nunca un hueco ni un claim
//     inventado — documentado campo por campo, abajo.

import type { VendedorContent } from '@/lib/config/site-content-defaults';

// ─── La identidad del vendedor: completitud, etiquetas, la línea compartida ───────────────────────

/** Los campos SIN los que ninguna página legal, bloque «Vendedor» ni línea del pie puede publicarse
 *  — el resto de `VendedorContent` tiene fallback genérico (abajo) y por eso no está acá. */
export const CAMPOS_VENDEDOR_REQUERIDOS: (keyof VendedorContent)[] = [
  'nombreCompleto', 'documentoNumero', 'ciudad', 'correo', 'telefono',
];

const esVacio = (s: string): boolean => s.trim() === '';

/** `true` sólo cuando los CINCO campos de `CAMPOS_VENDEDOR_REQUERIDOS` están presentes. Es el
 *  ÚNICO gate: la página pública, el bloque «Vendedor» del checkout, la línea del pie y la línea
 *  del cajón del carrito lo consultan — nunca duplican el criterio. */
export function vendedorEstaCompleto(v: VendedorContent): boolean {
  return CAMPOS_VENDEDOR_REQUERIDOS.every((campo) => !esVacio(v[campo] as string));
}

/** Los campos requeridos que FALTAN, en el orden de `CAMPOS_VENDEDOR_REQUERIDOS` — para que el
 *  panel diga «qué falta» en vez de sólo «incompleto». */
export function camposVendedorFaltantes(v: VendedorContent): (keyof VendedorContent)[] {
  return CAMPOS_VENDEDOR_REQUERIDOS.filter((campo) => esVacio(v[campo] as string));
}

/** La etiqueta del documento, derivada de `documentoTipo` — '' o cualquier valor fuera del set
 *  cerrado cae al genérico «documento», nunca lanza (mismo criterio SOFT que `modoLogoResuelto`). */
export function etiquetaDocumento(v: VendedorContent): string {
  if (v.documentoTipo === 'nit') return 'NIT';
  if (v.documentoTipo === 'cc') return 'C.C.';
  return 'documento';
}

/** La etiqueta del TIPO de persona — '' o basura cae a «persona o sociedad», nunca a una
 *  afirmación que nadie confirmó. */
export function etiquetaTipoPersona(v: VendedorContent): string {
  if (v.tipoPersona === 'natural') return 'persona natural';
  if (v.tipoPersona === 'juridica') return 'persona jurídica';
  return 'persona o sociedad';
}

/** El nombre a mostrar: el NOMBRE COMERCIAL si lo hay, si no el nombre completo/razón social.
 *  Nunca vacío cuando `vendedorEstaCompleto` (nombreCompleto es requerido). */
export function nombreParaMostrar(v: VendedorContent): string {
  return v.nombreComercial.trim() || v.nombreCompleto.trim();
}

/** El modo decide qué hace un campo REQUERIDO que falta: 'publico' lo OMITE (nunca le muestra un
 *  hueco al comprador — § el spec, "los clientes nunca ven un hueco"); 'editor' lo marca
 *  «[dato pendiente]», para que quien está completando el formulario vea DÓNDE falta algo sin
 *  tener que cruzar esta lista contra el panel. Nunca se usa para los campos con fallback genérico
 *  (abajo) — esos no "faltan", tienen una respuesta neutra siempre. */
export type ModoVendedor = 'publico' | 'editor';

function campoORequerido(valor: string, modo: ModoVendedor): string | null {
  if (!esVacio(valor)) return valor;
  return modo === 'editor' ? '[dato pendiente]' : null;
}

/** «Vende {nombre} · {DOC} {número} · {ciudad}» — la línea compartida por el pie, el cajón del
 *  carrito, el bloque «Vendedor» del checkout y la página de estado del pedido (§ el spec, los
 *  cuatro sitios donde "se ve el vendedor"). En modo 'publico' (el único que usan esas cuatro
 *  superficies) devuelve `null` si falta algo REQUERIDO — el llamador ya gatea con
 *  `vendedorEstaCompleto` antes de pedir la línea, así que en la práctica esto nunca pasa; es la
 *  red, no el gate. */
export function lineaVendedor(v: VendedorContent, modo: ModoVendedor = 'publico'): string | null {
  const nombre = campoORequerido(nombreParaMostrar(v), modo);
  const documento = campoORequerido(v.documentoNumero, modo);
  const ciudad = campoORequerido(v.ciudad, modo);
  if (nombre === null || documento === null || ciudad === null) return null;
  return `Vende ${nombre} · ${etiquetaDocumento(v)} ${documento} · ${ciudad}`;
}

// ─── Fallbacks genéricos de los campos OPCIONALES-dentro-de-completo ──────────────────────────────
// Cada uno documentado por separado porque cada uno es una decisión: qué dice la plantilla cuando
// el dueño no llenó un dato que no es obligatorio para publicar.

/** Vacío → "la dirección indicada al contactarnos" (nunca se inventa una dirección). */
function direccionOFallback(v: VendedorContent): string {
  return v.direccion.trim() || 'la dirección que te indicamos al contactarnos';
}

/** Vacío → se omite la línea de horario entera (una omisión, no una mentira sobre "disponibilidad
 *  24/7" que nadie confirmó). */
function horarioOFallback(v: VendedorContent): string | null {
  return v.horarioAtencion.trim() || null;
}

/** Vacío → despacha desde la MISMA ciudad del vendedor (`ciudad` es requerido) — es la mejor
 *  aproximación disponible sin inventar un municipio distinto. */
function municipioDespachoOFallback(v: VendedorContent): string {
  return v.municipioDespacho.trim() || v.ciudad;
}

/** Vacío → "la transportadora que mejor cubra tu zona" — no se nombra una empresa que el vendedor
 *  no confirmó que usa. */
function transportadorasOFallback(v: VendedorContent): string {
  return v.transportadoras.trim() || 'la transportadora que mejor cubra tu zona';
}

/** Vacío → "en pocos días hábiles", sin comprometer un número que nadie puso. */
function diasPreparacionOFallback(v: VendedorContent): string {
  const d = v.diasPreparacionHabiles.trim();
  return d ? `en ${d} días hábiles` : 'en pocos días hábiles';
}

// ─── Capacidades: qué cláusulas de rubro entran, según lo que la tienda tiene encendido ───────────

export interface CapacidadesTienda {
  /** `content.paginas.suscripciones.visible` (§ CLAUDE.md, "La SUSCRIPCIÓN es una capacidad
   *  APAGABLE") — gatea la cláusula de suscripciones de los Términos. */
  suscripciones: boolean;
  /** El método `efectivo` está entre `SiteSetting.metodosPago` (§ CLAUDE.md, "Los MÉTODOS de pago
   *  son una LISTA") — gatea la mención de pago contra entrega. */
  contraentrega: boolean;
}

export interface SeccionLegal {
  id: string;
  titulo: string;
  parrafos: string[];
}

// ─── 1. Términos y condiciones de venta ────────────────────────────────────────────────────────────

export function terminosYCondiciones(v: VendedorContent, cap: CapacidadesTienda): SeccionLegal[] {
  const nombre = nombreParaMostrar(v);
  const horario = horarioOFallback(v);

  const secciones: SeccionLegal[] = [
    {
      id: 'quien-te-vende',
      titulo: '1. Quién te vende',
      parrafos: [
        `Esta tienda la opera y vende, a través de ella: ${v.nombreCompleto} (${etiquetaTipoPersona(v)})` +
          (v.nombreComercial.trim() ? `, que vende bajo el nombre comercial «${v.nombreComercial}»` : '') + '.',
        `${etiquetaDocumento(v)}: ${v.documentoNumero}. Dirección de notificación: ${direccionOFallback(v)}.`,
        `Correo: ${v.correo}. Teléfono y WhatsApp: ${v.telefono}.` + (horario ? ` Horario de atención: ${horario}.` : ''),
        'En estos términos, "nosotros" es el vendedor y "usted" es quien compra. La plataforma tecnológica que hace posible esta tienda es provista por un tercero, que no es parte de la compraventa ni recibe los pagos.',
      ],
    },
    {
      id: 'aceptacion',
      titulo: '2. Aceptación',
      parrafos: [
        'Al hacer un pedido usted declara que es mayor de edad y que leyó y acepta estos términos y la Política de Tratamiento de Datos Personales. Antes de pagar, el sitio le muestra un resumen del pedido (productos, cantidades, precio, envío y total) para que lo revise y corrija.',
      ],
    },
    {
      id: 'productos',
      titulo: '3. Productos',
      parrafos: [
        'La información de cada producto es cierta y está en su ficha. Las fotos son ilustrativas: el empaque y su arte pueden variar levemente frente a la foto.',
        'La disponibilidad se muestra en línea. Si un producto se agota después de su pago, le avisamos y usted elige entre esperar, cambiarlo o recibir la devolución completa del dinero.',
      ],
    },
    {
      id: 'precios',
      titulo: '4. Precios',
      parrafos: [
        'Los precios están en pesos colombianos (COP) e incluyen los impuestos aplicables. El costo de envío se muestra por separado antes de pagar, según la ciudad de destino.',
        'El precio que vale es el que se ve al confirmar el pedido. Si por un error evidente se publica un precio irreal, le avisaremos antes de despachar y usted podrá aceptar el precio correcto o anular el pedido con devolución completa.',
      ],
    },
    {
      id: 'como-comprar',
      titulo: '5. Cómo comprar',
      parrafos: [
        'Agregue productos al carrito, vaya al pago, ingrese sus datos de contacto y la dirección de entrega, revise el resumen, acepte estos términos y autorice el tratamiento de sus datos, y pague. Recibirá una confirmación con el número de pedido y podrá seguirlo en la página de rastreo de esta tienda.',
      ],
    },
    {
      id: 'medios-de-pago',
      titulo: '6. Medios de pago',
      parrafos: [
        'En línea, a través de nuestra pasarela de pagos: usted pasa a una página de pago segura que procesa el pago bajo sus propios términos. Los datos de su tarjeta los digita directamente ahí; no los vemos ni los guardamos.',
        `Transferencia o billeteras, a las cuentas a nombre de ${nombre} que se indican al pagar. Suba el comprobante en el sitio; despachamos cuando verifiquemos el pago.` +
          (cap.contraentrega ? ' También aceptamos pago contra entrega en las zonas donde esa opción se ofrece al pagar.' : ''),
      ],
    },
    {
      id: 'factura',
      titulo: '7. Factura',
      parrafos: [
        'Expedimos el comprobante o factura que corresponda conforme a las normas aplicables, con los datos que usted nos indique.',
      ],
    },
    {
      id: 'envios',
      titulo: '8. Envíos',
      parrafos: [
        `Despachamos desde ${municipioDespachoOFallback(v)}, ${diasPreparacionOFallback(v)} después de confirmar el pago, por ${transportadorasOFallback(v)}. Los tiempos y zonas completos están en la Política de Envíos y Devoluciones.`,
        'Salvo que se indique otro plazo en el pedido, entregamos a más tardar 30 días calendario después del día siguiente a su pedido; si no cumplimos, usted puede anular la compra y le devolvemos todo lo pagado dentro de los 30 días calendario siguientes (art. 50, Ley 1480 de 2011).',
      ],
    },
    {
      id: 'derecho-de-retracto',
      titulo: '9. Derecho de retracto',
      parrafos: [
        `En las compras por internet usted puede retractarse dentro de los 5 días hábiles siguientes a la entrega del producto (art. 47, Ley 1480 de 2011). Escríbanos a ${v.correo} o al WhatsApp ${v.telefono} con su número de pedido dentro de ese plazo.`,
        'Devuelva el producto por los mismos medios y en las mismas condiciones en que lo recibió, sin abrir y en buen estado — los costos de transporte de la devolución son suyos. Le devolvemos todo lo pagado, sin descuentos ni retenciones, a más tardar 30 días calendario después de que nos informe el retracto.',
        'La ley excluye del retracto, entre otros, los bienes que por su naturaleza no pueden devolverse, los de uso personal y los hechos según especificaciones del consumidor; un producto abierto no aplica para retracto.',
      ],
    },
    {
      id: 'reversion-del-pago',
      titulo: '10. Reversión del pago',
      parrafos: [
        'Si pagó con tarjeta u otro medio de pago electrónico, puede pedir la reversión del pago (art. 51, Ley 1480 de 2011) si fue víctima de fraude, la operación no fue solicitada por usted, no recibió el producto, o el producto no corresponde a lo que pidió o está defectuoso — dentro de los 5 días hábiles siguientes a cuando supo del hecho.',
      ],
    },
    {
      id: 'garantia',
      titulo: '11. Garantía',
      parrafos: [
        `Todos nuestros productos tienen la garantía legal de calidad, idoneidad y seguridad (arts. 7 y siguientes, Ley 1480 de 2011). Si recibe un producto en mal estado, con defectos o distinto al pedido, escríbanos con fotos dentro de los días indicados en la Política de Envíos y Devoluciones; le cambiamos el producto o le devolvemos el dinero, a su elección cuando la ley lo permita.`,
      ],
    },
  ];

  if (cap.suscripciones) {
    secciones.push({
      id: 'suscripciones',
      titulo: '12. Suscripciones',
      parrafos: [
        'Las suscripciones (entregas periódicas) se acuerdan con usted antes de la primera entrega: ahí le confirmamos producto, frecuencia, precio, envío y forma de pago. Puede pausarlas o cancelarlas cuando quiera, avisando con anticipación razonable antes de la siguiente entrega.',
      ],
    });
  }

  secciones.push(
    {
      id: 'compras-al-por-mayor',
      titulo: `${cap.suscripciones ? '13' : '12'}. Compras al por mayor o para reventa`,
      parrafos: [
        'Si usted compra como insumo de su propia actividad económica (por ejemplo, para revender o transformar), esa compra no se rige por las normas de protección al consumidor sino por las del Código de Comercio (art. 5, num. 3, Ley 1480 de 2011). El precio, la cantidad, la entrega y el pago de ese tipo de compra se acuerdan por escrito, aparte.',
      ],
    },
    {
      id: 'pqr',
      titulo: `${cap.suscripciones ? '14' : '13'}. Peticiones, quejas y reclamos (PQR)`,
      parrafos: [
        `Escríbanos a ${v.correo} o al WhatsApp ${v.telefono}, con su nombre, número de pedido y qué necesita. Si no queda satisfecho, puede acudir a la Superintendencia de Industria y Comercio (SIC), autoridad de protección al consumidor: www.sic.gov.co.`,
      ],
    },
    {
      id: 'propiedad-intelectual',
      titulo: `${cap.suscripciones ? '15' : '14'}. Propiedad intelectual`,
      parrafos: [
        `Las marcas, nombres, textos y fotos de este sitio son de ${nombre} o se usan con autorización de su titular. No pueden usarse sin permiso.`,
      ],
    },
    {
      id: 'cambios-a-estos-terminos',
      titulo: `${cap.suscripciones ? '16' : '15'}. Cambios a estos términos`,
      parrafos: [
        'Podemos actualizar estos términos. Los cambios no afectan pedidos ya hechos: cada compra se rige por los términos vigentes cuando se confirmó.',
      ],
    },
    {
      id: 'ley-aplicable',
      titulo: `${cap.suscripciones ? '17' : '16'}. Ley aplicable`,
      parrafos: ['Estos términos se rigen por las leyes de Colombia.'],
    },
  );

  return secciones;
}

// ─── 2. Política de tratamiento de datos personales ───────────────────────────────────────────────

export function politicaDeDatosPersonales(v: VendedorContent): SeccionLegal[] {
  return [
    {
      id: 'responsable',
      titulo: '1. Responsable del tratamiento',
      parrafos: [
        `${v.nombreCompleto} (${etiquetaDocumento(v)} ${v.documentoNumero})` +
          (v.nombreComercial.trim() ? `, que vende bajo el nombre comercial «${v.nombreComercial}»,` : '') +
          ` con domicilio en ${direccionOFallback(v)}, es el Responsable del tratamiento de sus datos personales. Para temas de datos personales escríbanos a ${v.correo} o al WhatsApp ${v.telefono}.`,
      ],
    },
    {
      id: 'que-datos-tratamos',
      titulo: '2. Qué datos tratamos',
      parrafos: [
        'De quien compra: nombre, apellido, correo, teléfono, dirección de entrega, productos comprados, valores, método y estado del pago, comprobantes de pago que usted sube, y el estado de la entrega.',
        'De quien nos escribe (pedidos, cotizaciones): nombre, teléfono, y lo que nos cuente en el mensaje.',
        'No pedimos datos sensibles ni recogemos a sabiendas datos de menores de edad. Los datos de su tarjeta o cuenta bancaria los digita usted directamente en la página de pago de nuestra pasarela, bajo su propia política; no los vemos ni los guardamos.',
      ],
    },
    {
      id: 'para-que-los-usamos',
      titulo: '3. Para qué los usamos',
      parrafos: [
        'Para recibir, procesar, cobrar, despachar y entregar sus pedidos y permitirle rastrearlos; comunicarnos con usted sobre su pedido; expedir el comprobante o factura y cumplir obligaciones contables y tributarias; atender peticiones, quejas, reclamos, garantías, retractos y reversiones de pago; prevenir fraude y mantener la seguridad del sitio; y elaborar estadísticas internas de ventas.',
        'Sólo si usted lo autoriza aparte, para enviarle novedades y promociones. Puede retirar esa autorización cuando quiera.',
      ],
    },
    {
      id: 'con-quien-los-compartimos',
      titulo: '4. Con quién los compartimos',
      parrafos: [
        'Con nuestro proveedor tecnológico de plataforma, que opera esta tienda como Encargado del tratamiento, solo para las finalidades de esta política, y con sus proveedores de alojamiento, base de datos y envío de correos — algunos de ellos guardan los datos en servidores ubicados en Estados Unidos.',
        'Con nuestra pasarela de pagos, que recibe directamente en su página de pago los datos necesarios para procesar su pago; con transportadoras y mensajeros, para entregar su pedido; y con autoridades, cuando una norma o una orden lo exija. No vendemos ni alquilamos sus datos.',
      ],
    },
    {
      id: 'sus-derechos',
      titulo: '5. Sus derechos (art. 8, Ley 1581 de 2012)',
      parrafos: [
        'Usted puede conocer, actualizar y rectificar sus datos; pedir prueba de la autorización que nos dio; ser informado sobre el uso que les damos; revocar la autorización y/o pedir la supresión de sus datos, cuando no exista un deber legal o contractual de conservarlos; acceder gratis a sus datos; y presentar quejas ante la Superintendencia de Industria y Comercio (SIC), después de haber hecho su consulta o reclamo ante nosotros.',
      ],
    },
    {
      id: 'como-ejercerlos',
      titulo: '6. Cómo ejercerlos',
      parrafos: [
        `Escriba a ${v.correo} (o al WhatsApp ${v.telefono}) con su nombre, documento, qué solicita y, si es un reclamo, los hechos. Las consultas se responden en máximo 10 días hábiles y los reclamos en máximo 15 días hábiles, prorrogables con aviso (arts. 14 y 15, Ley 1581 de 2012).`,
      ],
    },
    {
      id: 'seguridad',
      titulo: '7. Seguridad',
      parrafos: [
        'Aplicamos medidas técnicas y administrativas razonables para proteger sus datos: conexión cifrada, acceso restringido por usuario y rol, y contraseñas protegidas.',
      ],
    },
    {
      id: 'por-cuanto-tiempo',
      titulo: '8. Por cuánto tiempo',
      parrafos: [
        'Conservamos sus datos mientras sea necesario para las finalidades anteriores y durante los plazos que exige la ley para soportes contables y tributarios. Los datos para mercadeo, hasta que usted retire su autorización.',
      ],
    },
    {
      id: 'cambios',
      titulo: '9. Cambios',
      parrafos: [
        'Si cambiamos esta política de forma sustancial, lo publicaremos en el sitio y, si cambian las finalidades, le pediremos una nueva autorización.',
      ],
    },
  ];
}

/** El aviso de privacidad CORTO (§ el borrador de origen, "versión de una línea") — para un
 *  resumen al pie de la página de datos personales, no una página propia (el spec declara CUATRO
 *  páginas, no cinco). */
export function avisoDePrivacidadCorto(v: VendedorContent): string {
  return `Aviso de privacidad: ${v.nombreCompleto}` +
    (v.nombreComercial.trim() ? ` («${v.nombreComercial}»)` : '') +
    `, con domicilio en ${direccionOFallback(v)}, es responsable de los datos personales que usted entrega en este sitio. Los usamos para procesar, cobrar y entregar sus pedidos y atender sus solicitudes, y sólo si usted lo autoriza, para enviarle novedades. Usted puede conocer, actualizar, rectificar y suprimir sus datos y revocar su autorización escribiendo a ${v.correo}.`;
}

// ─── 3. Envíos, cambios y devoluciones (con derecho de retracto) ──────────────────────────────────

export function enviosYDevoluciones(v: VendedorContent, cap: CapacidadesTienda): SeccionLegal[] {
  const secciones: SeccionLegal[] = [
    {
      id: 'envios',
      titulo: 'Envíos',
      parrafos: [
        `Despachamos desde ${municipioDespachoOFallback(v)}, ${diasPreparacionOFallback(v)} después de confirmar el pago. El transporte lo hace ${transportadorasOFallback(v)}.`,
        'El costo de envío se calcula según su ciudad y se muestra antes de pagar. En ningún caso la entrega tarda más de 30 días calendario, salvo que lo acordemos con usted.',
        'Consulte el estado de su pedido en la página de rastreo de esta tienda, con su número de pedido y su correo. Cuando despachemos le avisamos.',
      ],
    },
    {
      id: 'retracto',
      titulo: 'Retracto (se arrepintió de la compra)',
      parrafos: [
        `Tiene 5 días hábiles desde que recibe el pedido. Escríbanos a ${v.correo} o al WhatsApp ${v.telefono} con su número de pedido.`,
        'Devuelva el producto cerrado y sin abrir, como lo recibió — el envío de vuelta lo paga usted. Le devolvemos todo lo pagado en máximo 30 días calendario, por el mismo medio de pago o el que acordemos. No aplica para productos abiertos.',
      ],
    },
    {
      id: 'producto-en-mal-estado',
      titulo: 'Producto en mal estado o distinto al pedido (garantía)',
      parrafos: [
        'Escríbanos con fotos dentro de los días hábiles que le indiquemos al confirmar su pedido, desde la entrega. Si el problema es nuestro, cambiamos el producto o devolvemos el dinero y asumimos el envío.',
      ],
    },
  ];

  secciones.push(
    v.ventanaCambiosDias.trim()
      ? {
          id: 'cambios-por-gusto',
          titulo: 'Cambios por gusto',
          parrafos: [
            `Aceptamos cambios en productos cerrados dentro de los ${v.ventanaCambiosDias} días siguientes a la entrega. Escríbanos a ${v.correo} o al WhatsApp ${v.telefono} para coordinarlo; el envío del cambio corre por cuenta del comprador, salvo que acordemos algo distinto.`,
          ],
        }
      : {
          id: 'cambios-por-gusto',
          titulo: 'Cambios por gusto',
          parrafos: [
            `Hoy no ofrecemos cambios por gusto (cuando el producto llega bien pero usted prefiere otro). Si tiene un caso particular, escríbanos a ${v.correo} y lo revisamos.`,
          ],
        },
  );

  secciones.push({
    id: 'reversion-del-pago',
    titulo: 'Reversión del pago',
    parrafos: [
      'Si pagó con tarjeta u otro medio electrónico y hubo fraude, una compra que usted no hizo, o no recibió el pedido o recibió algo distinto o defectuoso, puede pedir la reversión del pago dentro de los 5 días hábiles siguientes. Ver el detalle en los Términos y Condiciones, sección "Reversión del pago".' +
        (cap.contraentrega ? ' Esto no aplica a pedidos pagados contra entrega, que no tienen reversión por esta vía.' : ''),
    ],
  });

  secciones.push({
    id: 'contacto',
    titulo: 'Contacto',
    parrafos: [
      `${v.correo} · WhatsApp ${v.telefono}` + (horarioOFallback(v) ? ` · ${horarioOFallback(v)}` : '') +
        '. Si no queda satisfecho, puede acudir a la Superintendencia de Industria y Comercio: www.sic.gov.co.',
    ],
  });

  return secciones;
}

// ─── 4. Cookies (sólo técnicas — la tienda no tiene analítica de terceros ni publicidad) ──────────

export function cookies(v: VendedorContent): SeccionLegal[] {
  return [
    {
      id: 'que-son',
      titulo: 'Qué son',
      parrafos: [
        'Las cookies y el almacenamiento del navegador son pequeños archivos o datos que un sitio guarda en su equipo. Esta tienda sólo usa los necesarios para funcionar: recordar su pedido mientras completa el pago, y mantener la sesión de quienes administran la tienda (no aplica a quienes compran). La página de pago de nuestra pasarela pone las suyas, bajo su propia política, para procesar el pago con seguridad.',
      ],
    },
    {
      id: 'lo-que-no-usamos',
      titulo: 'Lo que no usamos',
      parrafos: [
        'No usamos cookies de publicidad ni de analítica de terceros, y no vendemos información de su navegación. Si eso cambia, este aviso se actualiza antes de activarlas.',
      ],
    },
    {
      id: 'como-bloquearlas',
      titulo: 'Cómo bloquearlas',
      parrafos: [
        'Puede borrar o bloquear las cookies desde la configuración de su navegador; si bloquea las necesarias, es posible que no pueda completar el pago.',
      ],
    },
    {
      id: 'mas-informacion',
      titulo: 'Más información',
      parrafos: [
        `Sobre cómo tratamos sus datos, vea la Política de Tratamiento de Datos Personales. Preguntas: ${v.correo}. Responsable: ${v.nombreCompleto}` +
          (v.nombreComercial.trim() ? ` («${v.nombreComercial}»).` : '.'),
      ],
    },
  ];
}

/** El aviso que acompaña a las cuatro páginas — borrador, sin revisión de abogado, repetido acá y
 *  en el panel para que nadie lo publique sin saberlo (§ el spec, "los textos son borradores"). */
export const ADVERTENCIA_BORRADOR =
  'Este texto es un borrador general, pendiente de revisión por un abogado. No reemplaza asesoría legal.';
