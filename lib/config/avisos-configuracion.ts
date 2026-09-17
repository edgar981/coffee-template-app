import { metodosDisponibles } from '../checkout/metodos-pago';
import { tarjetasDePresentaciones } from '../storefront/presentaciones';
import { DESCRIPTORES_METODO_PASARELA } from '../pagos/metodos-pasarela';
import type { SiteContentData } from './site-content-defaults';
// `import type` desde un módulo SIN `server-only` (el lector RAW): sólo viaja el TIPO y este archivo
// sigue siendo puro (capa 1), como el `SiteContentData` de arriba.
import type { SiteSettings } from './site-settings-read';

// AVISOS DE CONFIGURACIÓN del Dashboard (§ Backlog #65, Fase 1). Un aviso es un defecto que deja el
// storefront ROTO/INCOMPLETO para el VISITANTE sin que el dueño se entere. Distinto de "Necesita tu
// atención": esa es la COLA DE TRABAJO del OPERADOR (pedidos, stock), que se VACÍA; un defecto de
// configuración se arregla UNA vez y no vuelve —meterlo en la cola la volvería un ACUMULADOR que nunca
// llega a cero y deja de mirarse—. Por eso va en un aviso APARTE, del DUEÑO. Puro (capa 1).

export interface AvisoConfig {
  /** id estable del defecto — la `key` de React y el anti-duplicado. */
  clave: string;
  /** qué está mal, en lenguaje del DUEÑO (no del sistema). */
  mensaje: string;
  /** a dónde va a arreglarlo. */
  href: string;
}

// El enlace de un aviso ATERRIZA EN EL DEFECTO, no en la pantalla: abre la sección correcta con su
// edición y resalta el BLOQUE de la tarjeta (§ el fix del gate). Es el MISMO aterrizaje del puente
// vista→formulario, disparado por query params que /admin/tienda lee al cargar (`?seccion=&tarjeta=`,
// precedente `?pedido=` de Pedidos — sin inventar API). `seccion` elige la página + abre esa sección;
// `tarjeta` (el SLOT) resalta y scrollea su bloque, reusando `tarjetaActiva`/`bloquesRef` del puente.
const hrefTarjeta = (slot: number) => `/admin/tienda?seccion=presentaciones&tarjeta=${slot}`;

// EL DEEP-LINK DEL AVISO #8 ATERRIZA EN LA PANTALLA, NO EN EL CAMPO — y es un LÍMITE de la convención,
// no un descuido. `?seccion=&tarjeta=` es del editor de CONTENIDO (`/admin/tienda`): `seccion` es una
// clave de SiteContent y `tarjeta` un SLOT de un bloque. El `whatsapp` es un SiteSetting —IDENTIDAD del
// negocio, otra pantalla (§ la frontera negocio≠tienda)— y `/admin/configuracion` NO lee query params
// (medido: cero `useSearchParams` en esa página y en `DatosNegocioSeccion`), así que no hay a qué
// aterrizar más fino. Se cae a la pantalla donde vive el campo, que es lo más cerca que la convención
// permite hoy; el día que Configuración gane sub-rutas o deep-link por sección, esto lo aprovecha.
const HREF_DATOS_NEGOCIO = '/admin/configuracion';

/**
 * Los defectos de CONFIGURACIÓN del storefront PUBLICADO —cruzando el contenido que ve el visitante
 * (`readSiteContent` → `SiteContentData`) con el catálogo—. FASE 1: SÓLO Presentaciones —
 *   #1 destino de una tarjeta que NO existe en el catálogo (no trae productos), y
 *   #2 tarjeta con TÍTULO y SIN imagen (hueco visible: el criterio OR de la cardinalidad variable la
 *      muestra apenas tiene título, y la imagen faltante queda como estado incompleto persistente).
 *
 * FASE 2 suma el DORMIDO #8 — WHATSAPP VACÍO —, que ya no cruza contenido sino la IDENTIDAD del negocio
 * (`SiteSettings`, cuarto argumento): el checkout le promete al comprador que se confirma el pago por
 * WhatsApp, y `SiteSetting.whatsapp` puede estar VACÍO (la migración neutral siembra `''` — un cliente
 * nuevo nace sin número; sólo el seed de Nayoli lo llena, que es por qué el defecto está DORMIDO acá).
 * Con esta tanda el checkout deja de prometer ese canal cuando no existe (§ el GATE del storefront), y
 * el dueño se entera por este aviso. Con él va su GEMELO —`checkout-sin-salida`—, el combo severo del
 * mismo dato: ningún método de pago mostrable Y sin WhatsApp, o sea un checkout al que se llega y del
 * que no se sale. Los dormidos #3/#4 (hero/brandStory requeridos vacíos) siguen sin construirse: son
 * contenido, y para Nayoli los defaults SON el tenant.
 *
 * `catalogoListo` gatea SÓLO #1: un fetch de catálogo fallido NO puede afirmar que una categoría "no
 * existe" —mentiría—. #2 no depende del catálogo y corre igual. Mismo criterio que el aviso del editor
 * (`categoriasListas`, TiendaSeccionEditor). El predicado de #1 es el MISMO que ese aviso
 * (`value ∉ categorias`), sacado del editor abierto al Dashboard —una sola definición de "destino roto"—.
 * #8 tampoco depende del catálogo.
 *
 * FASE 3 suma **#9 — MÉTODO DE PASARELA DESALINEADO CON LA CUENTA** (§ API-DIRECTA-DESALINEO-AVISO-1,
 * cableado por § API-DIRECTA-DESALINEO-DUENO-1). El residual que sobrevive tras `API-DIRECTA-METODOS-
 * REHECHOS-1` §3 (DECISIONS.md): el panel de métodos de pasarela YA previene el desalineo AL CONFIGURAR
 * (lee `accepted_payment_methods` en vivo, § el panel de métodos), pero la cuenta puede cambiar DESPUÉS
 * de que el dueño configuró —el proveedor le retira un método sin que nadie de este lado se entere—. Ahí
 * la creación de la transacción (`lib/pagos/creacion-transaccion.ts`, `CreacionMetodoNoHabilitado`) es
 * la que se entera primero, y `app/api/checkout/route.ts` (el PATCH, el `switch` de sus resultados)
 * persiste el TIPO exacto —no el `motivo` en prosa, que sólo se loguea— en
 * `PaymentIntent.metodo_rechazado`.
 *
 * `ajustes.metodoPasarelaDesalineado` (`SiteSettings`, `lib/config/site-settings-read.ts`) es ESE tipo,
 * ya cruzado contra `SiteSetting.metodosPasarela` (lo que el dueño ofrece HOY) — o `null` si no hay
 * ninguno vigente. El módulo sigue siendo puro, capa 1, SIN red: no lo consulta, lo RECIBE dentro de
 * `ajustes`, que ya era el cuarto argumento — por eso #9 se enciende SIN que el call site del Dashboard
 * (`app/(admin)/admin/dashboard/page.tsx`, fuera de `touches` de este slice) tenga que cambiar una línea:
 * ya le pasaba `settings` completo.
 *
 * **EL NOMBRE VISIBLE SALE DEL VOCABULARIO DEL PROVEEDOR** (`nombreVisibleMetodoPasarela`, abajo): el
 * mensaje nombra el método exacto ("Nequi", "tarjeta"...) en vez de decir "un método de tu pasarela",
 * que mandaría al dueño a adivinar teniendo nosotros el dato.
 *
 * **LÍMITE CONOCIDO, heredado de `metodoPasarelaDesalineado` (ver su docstring en
 * `site-settings-read.ts`):** el aviso se apaga cuando el dueño QUITA el método de lo que ofrece —el
 * cruce contra `metodosPasarela` lo hace solo, sin acuse—, pero NO detecta que la cuenta del proveedor
 * recupere el método sin que el dueño toque nada; eso exigiría una consulta en vivo, fuera de `touches`.
 */
export function avisosDeConfiguracion(
  contenido: SiteContentData,
  categorias: string[],
  catalogoListo: boolean,
  ajustes: SiteSettings,
): AvisoConfig[] {
  const avisos: AvisoConfig[] = [];
  const pres = contenido.presentaciones;

  // Sólo si la sección se MUESTRA al visitante: una Presentaciones OCULTA no tiene defecto visible.
  if (pres && pres.visible !== false) {
    for (const t of tarjetasDePresentaciones(pres)) {
      const cat = t.cat.trim();
      const titulo = t.label.trim();
      const tieneImagen = t.img.trim() !== '';
      // El nombre de la tarjeta para la copy: su título si lo tiene; si no (tarjeta visible sólo por su
      // imagen), su número de tarjeta.
      const nombre = titulo !== '' ? `«${titulo}»` : `#${t.slot}`;

      // #1 — DESTINO INEXISTENTE. Destino NO vacío que no está en las categorías del catálogo (el
      // MISMO predicado que el aviso del editor). Un destino vacío lleva a /tienda (todos), no es defecto.
      if (catalogoListo && cat !== '' && !categorias.includes(cat)) {
        avisos.push({
          clave: `presentaciones-destino-${t.slot}`,
          mensaje: `La tarjeta ${nombre} de la portada lleva a la categoría «${cat}», que ningún producto tiene todavía: no traerá productos.`,
          href: hrefTarjeta(t.slot),
        });
      }

      // #2 — TÍTULO SIN IMAGEN. La tarjeta con título pero sin foto es un estado incompleto que el
      // storefront pinta como HUECO (`--sf-linea`, no un `<img>` roto), y así se queda hasta que suban la foto.
      if (titulo !== '' && !tieneImagen) {
        avisos.push({
          clave: `presentaciones-imagen-${t.slot}`,
          mensaje: `La tarjeta «${titulo}» de la portada no tiene imagen: se ve un hueco en la tienda.`,
          href: hrefTarjeta(t.slot),
        });
      }
    }
  }

  // #8-GEMELO — CHECKOUT SIN SALIDA. Va PRIMERO porque es el combo MÁS SEVERO de esta familia, no una
  // variante del de abajo: sin ningún método de pago MOSTRABLE el paso de pago cae a su guarda defensiva,
  // y sin WhatsApp esa guarda ya no puede ofrecer coordinar el pago (§ el gate del checkout) — el
  // comprador llega al final y no tiene por dónde salir. Es una VENTA MUERTA, no un canal menos, así que
  // se dice APARTE aunque `negocio-whatsapp` dispare también: los dos hechos son ciertos y dicen cosas
  // distintas (un canal retirado ≠ un pedido que nadie puede completar), y esta lista ya es "un aviso por
  // defecto" (cada tarjeta rota trae el suyo). Los dos aterrizan en la misma pantalla porque los dos
  // datos —métodos y WhatsApp— se editan ahí.
  //
  // "MOSTRABLE" ES LA REGLA DEL CHECKOUT, NO UNA COPIA: `metodosDisponibles` (§ metodos-pago) es la única
  // definición de "ON *y* con datos", así que la banda del Dashboard y la tienda no pueden discrepar
  // sobre si hay método — el modo de falla del patrón de las dos voces del mismo umbral.
  //
  // `isBogota: true` A PROPÓSITO, y conviene leerlo despacio: `isBogota` NO es configuración, es la
  // dirección del COMPRADOR (una regla de envío), y este aviso juzga la CONFIGURACIÓN. Con `true` sólo
  // dispara cuando NINGÚN comprador, en ninguna ciudad, tendría método: el dead-end CIERTO, sin falso
  // positivo. El caso PARCIAL —efectivo como único método encendido, que deja sin salida a quien compra
  // FUERA de Bogotá— NO lo cubre este aviso: si un negocio "sólo Bogotá" es un defecto es una pregunta de
  // producto, no una medición, y se decide en su propio ítem.
  if (metodosDisponibles(ajustes.metodosPago, { isBogota: true }).length === 0 && ajustes.whatsapp.trim() === '') {
    avisos.push({
      clave: 'checkout-sin-salida',
      mensaje: 'Tu checkout no puede recibir pedidos: no hay ningún método de pago para mostrar ni un WhatsApp por donde coordinar, así que quien llega al paso de pago no puede terminar su compra.',
      href: HREF_DATOS_NEGOCIO,
    });
  }

  // #8 — WHATSAPP VACÍO. El mensaje dice la CONSECUENCIA que el COMPRADOR vive, no el mecanismo: el
  // dueño no tiene por qué saber que existe un campo `whatsapp`, sí que su checkout dejó de ofrecer el
  // canal por el que iba a confirmar los pagos (§ #65: la copy es del dueño, no del sistema). Un
  // `whatsapp` de sólo espacios cuenta como vacío — es lo mismo que el visitante recibe.
  if (ajustes.whatsapp.trim() === '') {
    avisos.push({
      clave: 'negocio-whatsapp',
      mensaje: 'No cargaste el WhatsApp del negocio: tu checkout ya no le ofrece a los compradores confirmar el pago por ese canal.',
      href: HREF_DATOS_NEGOCIO,
    });
  }

  // #9 — MÉTODO DE PASARELA DESALINEADO CON LA CUENTA (§ el docstring de la función, arriba). Dispara
  // cuando `readSiteSettings` encontró un tipo rechazado que el dueño SIGUE ofreciendo. El texto NOMBRA
  // el método exacto —nunca «un método de tu pasarela», que mandaría al dueño a adivinar teniendo
  // nosotros el dato (§ el argumento del slice original, API-DIRECTA-DESALINEO-AVISO-1)—.
  if (ajustes.metodoPasarelaDesalineado) {
    const nombre = nombreVisibleMetodoPasarela(ajustes.metodoPasarelaDesalineado);
    avisos.push({
      clave: 'pasarela-metodo-no-habilitado',
      // TEXTO PROVISIONAL — PENDIENTE DE TEXTO DEL OWNER (§ API-DIRECTA-DESALINEO-AVISO-1, heredado;
      // este slice sólo cambió DE QUÉ dato sale el nombre del método).
      mensaje: `Wompi rechazó un cobro con ${nombre} porque tu cuenta ya no tiene ese método habilitado. Revisa la sección Pasarela en Configuración.`,
      href: HREF_DATOS_NEGOCIO,
    });
  }

  return avisos;
}

/**
 * El nombre que el DUEÑO reconoce para un tipo de método de pasarela (§ API-DIRECTA-DESALINEO-DUENO-1)
 * — el vocabulario del PROVEEDOR (`'CARD'`, `'NEQUI'`...) traducido a lo que ya ve en el resto del panel.
 * TARJETA no tiene descriptor en `DESCRIPTORES_METODO_PASARELA` (§ metodos-pasarela.ts, "TARJETA NO VIVE
 * EN ESTE REGISTRO" — su captura es un flujo bespoke), así que se nombra a mano; un tipo que el registro
 * todavía no conozca cae al string crudo del proveedor — mejor una palabra en mayúsculas que un aviso
 * que no dice nada.
 */
function nombreVisibleMetodoPasarela(tipo: string): string {
  if (tipo === 'CARD') return 'tarjeta';
  return DESCRIPTORES_METODO_PASARELA[tipo]?.nombreVisible ?? tipo;
}
