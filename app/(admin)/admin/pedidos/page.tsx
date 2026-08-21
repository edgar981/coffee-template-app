'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Plus, MessageCircle } from 'lucide-react';
import { OrderCard } from '@duna/design-system/components/OrderCard';
import { ItemsTable } from '@duna/design-system/components/ItemsTable';
import { Timeline } from '@duna/design-system/components/Timeline';
import { SkeletonOrderCards } from '@duna/design-system/components/SkeletonOrderCard';
import { BADGE_TONE_CLASS } from '@duna/design-system/status';
import { getOrders, getOrder } from '@/lib/api/orders';
import { formatCOP } from '@duna/core/utils';
import { METODO_PAGO_LABEL, metodoPrevistoLabel } from '@/types/payment';
import type { Order, OrderDetalle } from '@/types/order';
import { ChipCanal } from '@/components/admin/ChipCanal';
import { DunaSheet } from '@/components/admin/DunaSheet';
import { DunaTooltip } from '@/components/admin/DunaTooltip';
import { useDetalleAlLado } from '@/hooks/useDetalleAlLado';
import { useSheetDesdeAbajo } from '@/hooks/useSheetDesdeAbajo';
import { useHidratado } from '@/hooks/useHidratado';
import {
  FILTROS_PEDIDOS, aplicarFiltro, conteos, filtroPorKey,
  aplicarAlcance, soloOrdenesReales, parseEstados, etiquetaEstados, hayAlcance,
  type FiltroKey,
} from '@/lib/pedidos/filtros';
import { pasosDelPedido, badgeCobro } from '@/lib/pedidos/estado';
import { motivosDeAtencion, textoDeMotivo } from '@/lib/pedidos/atencion';
import { recorridoDelPedido, tieneDerivados } from '@/lib/pedidos/recorrido';
import { hace } from '@/lib/pedidos/tiempo';
import { useControlComprobantes, type ControlComprobantes } from '@/hooks/useControlComprobantes';
import { useTransicionEntrega, type TransicionEntrega } from '@/hooks/useTransicionEntrega';
import { useAccionGuardada } from '@/hooks/useAccionGuardada';
import { useDescarteDeDrawer } from '@/hooks/useDescarteDeDrawer';
import { ErrorDialogo, useErrorDialogo } from '@/components/admin/ErrorDialogo';
import { ScheduleDeliveryModal } from '@/components/admin/ScheduleDeliveryModal';
import { RegisterPaymentModal } from '@/components/admin/RegisterPaymentModal';
import { NewOrderModal } from '@/components/admin/NewOrderModal';
import { DateRangePicker, rangoLabel } from '@/components/admin/DateRangePicker';
import { findSlotLabel } from '@duna/core/shipping-config';
import { customerWhatsappHref } from '@duna/core/whatsapp-link';
import { siteConfig } from '@/lib/config/site';
import { formatFecha } from '@duna/core/format-fecha';
import { ConfirmDeleteDialog } from '@/components/admin/ConfirmDeleteDialog';
import { ConfirmDescartarDialog } from '@/components/admin/ConfirmDescartarDialog';
import { ConfirmDespachoSinPago } from '@/components/admin/ConfirmDespachoSinPago';
import { ComprobanteVista, SelectorComprobante, useLightboxComprobante } from '@/components/admin/Comprobantes';
import { ImageLightbox } from '@/components/admin/ImageLightbox';
import { ensureOrderShipping } from '@/lib/api/shippings';
import { updateOrder } from '@/lib/api/orders';
import { accionAlVerificar, puedeDecidirse, nombreArchivo } from '@/lib/comprobante';
import { MAX_COMPROBANTE_MB } from '@/constants/comprobante';
import { RECHAZAR_COMPROBANTE_COPY, CANCELAR_ORDEN_COPY } from '@/constants/confirmaciones';
import { isScheduledShipping, hasScheduleData, missingToDispatch } from '@/constants/shippings';
import { autoSeleccion } from '@/lib/admin/auto-seleccion';
import type { Shipping } from '@/types/shipping';
import type { Comprobante } from '@/types/comprobante';

// Todo lo que el panel necesita para OPERAR sin ser dueño de ninguna mutación.
// Mismo patrón que `ControlComprobantes`: el panel renderiza y llama hacia arriba.
interface AccionesPedido {
  transicion:     TransicionEntrega;
  control:        ControlComprobantes;
  errorAccion:    ReturnType<typeof useErrorDialogo>;
  preparando:     boolean;
  abrirProgramar: (orden: Order) => void;
  abrirCobrar:    (orden: Order) => void;
  abrirCancelar:  (orden: Order) => void;
  abrirRechazar:  (orden: Order, c: Comprobante) => void;
  verificar:      (orden: Order, c: Comprobante) => void;
  /** Guarda las notas. Vive en la PÁGINA: el panel se desmonta al cambiar de
   *  pedido y una mutación montada ahí puede perder su continuación. `onGuardado`
   *  limpia el borrador para que el textarea vuelva a seguir al servidor. */
  guardarNotas:   (orden: Order, notas: string, onGuardado: () => void) => void;
  guardandoNotas: boolean;
  errorNotas:     ReturnType<typeof useErrorDialogo>;
  /** BORRADOR de las notas, ELEVADO a la página. El detalle se monta en el panel
   *  (≥1080) o en el sheet (<1080), que son posiciones distintas del árbol: cruzar
   *  el umbral desmonta una y monta la otra, y un `useState` dentro del detalle
   *  moriría en ese remontaje llevándose una nota a medias. Vive acá, en el padre
   *  que sobrevive al swap. `null` = intacto → el textarea sigue al servidor. */
  borrador:       string | null;
  setBorrador:    (v: string | null) => void;
  /** Embudo de descarte del borrador, EN LA PÁGINA. El detalle lo llama para su
   *  única salida propia —el enlace de cliente, que es una navegación de Next que no
   *  pasa por `onCerrar`—. Cerrar y cambiar de pedido los intercepta la página. */
  intentarSalir:  (proceder: () => void) => void;
}

// ═══ PEDIDOS · la pantalla del rediseño Duna OS ══════════════════════════════
//
// Se construye SOLO con primitivas de @duna/design-system. Cero valores nuevos:
// ni un color, ni un espaciado, ni un radio inventado acá. Los cuatro huecos que
// aparecieron construyéndola se llenaron EN EL SISTEMA, cada uno en su commit
// (layout partido, punto de nav, ranura de actor de la timeline, `steps`
// opcional). Un valor local "sólo esta vez" es el momento en que el sistema deja
// de ser fuente de verdad.
//
// Vive en RUTA PROPIA, en paralelo a /admin/ordenes, que no se toca (decisión del
// owner). La operativa actual tiene seis flujos modales en producción y
// reemplazarla obligaría a reconstruirlos con un DS que todavía no tiene primitiva
// de diálogo — o sea, a inventar. Además el gate visual se hace A/B contra ella.
//
// DEUDA CON DISPARADOR (declarada): cuando esta pantalla absorba los flujos
// operativos, van a usar los modales shadcn de /admin/ordenes hasta que el
// design-system tenga primitiva de diálogo (H6).
//
// LOS FLUJOS OPERATIVOS reusan los modales de /admin/ordenes tal cual —ya están
// probados en producción— y sus mutaciones viven en ESTE componente, no en el
// panel: el panel se desmonta al cambiar de pedido y una mutación montada ahí
// puede perder su continuación (§ el gate del 2026-08-06).

/** Iniciales para el avatar. Una letra si el nombre es de una palabra. */
function iniciales(nombre: string): string {
  return nombre.trim().split(/\s+/).slice(0, 2).map(p => p[0] ?? '').join('').toUpperCase() || '?';
}

export default function PedidosPage() {
  return <Suspense fallback={null}><Pedidos /></Suspense>;
}

function Pedidos() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [pedidos, setPedidos]   = useState<Order[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError]       = useState<string | null>(null);

  // ¿El detalle va al lado (panel) o sube como sheet? No es una decisión de estilo
  // —el CSS no puede mover un nodo de sitio— y por eso hace falta preguntarlo en
  // JS. El umbral lo trae el sistema, por ROL (no "¿es móvil?": eso es el chrome).
  const detalleAlLado = useDetalleAlLado();
  // El auto-select no debe correr contra el `detalleAlLado` del prerender (§ el hook):
  // en servidor reporta `true` y en cliente angosto hidrata a `false`, y el efecto
  // que lo viera `true` escribiría `?pedido` como escritorio.
  const hidratado = useHidratado();
  // Cuando el detalle YA es sheet (no al lado), de qué borde sale: abajo en el
  // chrome móvil (<960), del lado junto al rail (960–1080).
  const sheetDesdeAbajo = useSheetDesdeAbajo();

  // El filtro y la selección viven en la URL: el detalle es enlazable y sobrevive
  // a un refresh, igual que `?order=` en la lista vieja.
  const filtro = (filtroPorKey(params.get('f') ?? '')?.key ?? 'todos') as FiltroKey;
  const seleccion = params.get('pedido');
  // El SHEET del detalle se abre por ACCIÓN, no por ancho de ventana. `sheetAbierto`
  // separa "hay una orden seleccionada" (que persiste y se marca en la lista) de "el
  // sheet modal está abierto". Cruzar de panel a sheet CONSERVA la selección pero NO
  // abre el sheet —taparía la lista sin que el operador lo pida—; se abre al tocar la
  // fila. Un deep link SÍ abre (lleva la intención dentro), por eso el init.
  const [sheetAbierto, setSheetAbierto] = useState(!!seleccion);
  // Reset EN RENDER al cruzar de panel a sheet (no en efecto: cascada que el lint
  // marca). El centinela `null` es la clave: la PRIMERA sincronización post-hidratación
  // fija la base SIN contar como cruce. Sin él, cuando `detalleAlLado`→false y
  // `hidratado`→true se batchean en un render (React 18 lo hace), el reset vería
  // `alLadoAntes` con el valor SSR viejo (`true`) y cerraría un deep-link recién
  // abierto. Con el centinela, esa primera vez sólo asienta la base.
  const [alLadoAntes, setAlLadoAntes] = useState<boolean | null>(null);
  if (hidratado && alLadoAntes !== detalleAlLado) {
    if (alLadoAntes !== null && alLadoAntes && !detalleAlLado) setSheetAbierto(false);
    setAlLadoAntes(detalleAlLado);
  }
  // LOS TRES ALCANCES. Acotan la lista sin ser carriles: se combinan entre sí y
  // con cualquiera de los siete. De quién es (`cliente`), de cuándo (`desde` /
  // `hasta`) y si está cobrado (`estado`).
  //
  // `estado` es el eje de COBRO, y que vuelva no contradice haberlo retirado como
  // carril: lo que la doctrina rechazaba era el octavo PILL, no el filtro (§
  // lib/pedidos/filtros). Sólo llega por enlace profundo — los tres buckets de
  // cartera de Analítica —, nunca desde un control de esta pantalla.
  const alcanceUrl = useMemo(() => ({
    cliente: params.get('cliente'),
    desde:   params.get('desde'),
    hasta:   params.get('hasta'),
    estados: parseEstados(params.get('estado')),
  }), [params]);
  const cliente = alcanceUrl.cliente;

  const [detalle, setDetalle] = useState<OrderDetalle | null>(null);
  // El fallo lleva el ID al que pertenece, y eso es lo que permite NO tener que
  // limpiarlo a mano al cambiar de pedido: un error viejo simplemente deja de
  // corresponder. Es el mismo mecanismo con el que Analítica deriva su `loading`
  // (`data?.periodo.key !== periodo`) en vez de setearlo dentro del efecto — un
  // `setState` síncrono ahí dispara renders en cascada y el lint lo marca.
  const [fallo, setFallo] = useState<{ id: string; msg: string } | null>(null);

  // Contador del REFETCH del detalle. Se declara acá arriba porque el efecto que
  // lo usa como dependencia vive más abajo; su porqué está donde se dispara.
  const [refetch, setRefetch] = useState(0);
  const repreguntar = useCallback(() => setRefetch(n => n + 1), []);


  useEffect(() => {
    let vivo = true;
    getOrders()
      .then(d => { if (vivo) { setPedidos(d); setError(null); } })
      .catch(e => { if (vivo) setError(e instanceof Error ? e.message : 'Error al cargar pedidos'); })
      .finally(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
  }, []);

  // LAS `SN-` NO SON PEDIDOS: son fixtures del seed, y ésta era la última
  // superficie del panel que las mostraba. Se recortan ANTES que nada —incluso
  // antes de los alcances— porque no es un filtro del operador sino el scope de
  // la pantalla, y por eso tampoco se anuncia con un tag.
  const reales = useMemo(() => soloOrdenesReales(pedidos), [pedidos]);

  // EL ALCANCE se aplica primero y es la base de todo lo demás: la lista, los
  // conteos y el vacío hablan de lo acotado, no de la tienda entera.
  const alcance  = useMemo(() => aplicarAlcance(reales, alcanceUrl), [reales, alcanceUrl]);
  const visibles = useMemo(() => aplicarFiltro(alcance, filtro), [alcance, filtro]);
  // Los conteos se calculan sobre la lista COMPLETA (dentro del alcance), no sobre
  // la filtrada: el pill tiene que decir cuántos hay en su carril, no cuántos
  // quedan del carril actual. Y sobre el ALCANCE y no sobre `pedidos`, porque un
  // pill que dice 5 y al hacer clic muestra 1 es peor que ninguno.
  const cuentas = useMemo(() => conteos(alcance), [alcance]);

  // El nombre sale del SNAPSHOT del primer pedido del alcance — es lo que la lista
  // ya tiene en mano, sin pedirle nada al servidor. Si el cliente no tiene ningún
  // pedido, no hay nombre que mostrar y el aviso lo dice sin inventarlo.
  const nombreAlcance = alcance[0]?.cliente_nombre ?? null;

  // ── LO ELEGIDO SE BUSCA EN `reales`, NO EN LO VISIBLE ──────────────────────
  //
  // Se buscaba sobre `visibles`, o sea sobre la lista YA recortada por el carril
  // y los tres alcances. Un `?pedido=` que cayera fuera de ese recorte no
  // encontraba nada, y el panel mostraba "Elige un pedido" al lado de una lista
  // donde ese pedido no está — raro pero legible.
  //
  // EN MÓVIL DEJA DE SER LEGIBLE: el detalle es un sheet, así que lo mismo se ve
  // como un enlace de notificación que no hace NADA. Y las notificaciones son
  // justo lo que llega a un teléfono.
  //
  // Hoy ninguna fuente conocida combina `pedido=` con un alcance que lo excluya
  // (`hrefOrden` y el redirect de `/admin/ordenes` van sin `f=`; los deep links
  // de Analítica y el dashboard llevan alcance pero no selección), así que esto
  // es una mina y no una herida. Se desarma acá porque la arma cualquiera que
  // escriba un enlace con las dos cosas, y el arreglo es más barato que la nota
  // que habría que dejar.
  //
  // Sigue recortado a `reales`: una `SN-` no es un pedido y un enlace a una no
  // debe abrir nada (§ soloOrdenesReales). El alcance de la PANTALLA se respeta;
  // lo que se ignora es el filtro del OPERADOR, que es suyo y no del enlace.
  const elegido = useMemo(
    () => reales.find(p => p.numero_orden === seleccion) ?? null,
    [reales, seleccion],
  );

  // LA VERDAD DEL DETALLE LA TRAE EL SERVIDOR al abrirse. La lista no carga el
  // libro de transiciones ni los pagos (§ payload), así que el panel los pide —
  // y de paso deja de depender de una copia de la lista que pudo quedar atrás.
  // Depende sólo del id: un cambio en la lista no vuelve a dispararlo.
  const idElegido = elegido?.id ?? null;
  useEffect(() => {
    if (!idElegido) return;
    let vivo = true;
    getOrder(idElegido)
      .then(d => { if (vivo) setDetalle(d); })
      .catch(e => { if (vivo) setFallo({ id: idElegido, msg: e instanceof Error ? e.message : 'Error al cargar el pedido' }); });
    return () => { vivo = false; };
  }, [idElegido, refetch]);

  // Los tres DERIVADOS del par (id elegido, lo que hay cargado). Ninguno es
  // estado: así no hay dos fuentes que puedan discrepar, y el detalle de OTRO
  // pedido nunca se pinta bajo la cabecera del actual mientras viaja el fetch.
  const detalleVigente = detalle?.id === idElegido ? detalle : null;
  const errorDetalle   = fallo?.id === idElegido ? fallo.msg : null;
  const cargandoDetalle = !!idElegido && !detalleVigente && !errorDetalle;

  // ═══ MUTACIONES · viven en LA PÁGINA, no en el panel ═══════════════════════
  //
  // El panel de detalle se desmonta al cambiar de pedido, así que una mutación
  // montada ahí puede perder su continuación — es el incidente del 2026-08-06 con
  // los comprobantes. Acá arriba nada se pierde: el peor caso es que el panel
  // reabra ya con el efecto aplicado.

  // EL REFETCH. La lista EMPALMA (barato e inmediato: la card se actualiza sola) y
  // el detalle REPREGUNTA (la verdad). No es redundancia: el libro de transiciones
  // sólo viaja en `GET /api/orders/[id]`, y las respuestas de los modales traen la
  // orden o el envío actualizados pero NO los asientos nuevos. Sin esto, el
  // Recorrido mostraría todo menos la transición que el operador acaba de
  // provocar — el peor sitio posible para quedar desactualizado, porque es la
  // sección que existe para contar qué pasó.
  const empalmar = useCallback((actualizada: Order) => {
    setPedidos(prev => prev.map(o => o.id === actualizada.id ? actualizada : o));
    // El detalle también, si es el pedido abierto: `fuente = detalle ?? orden` prefiere
    // `detalle`, así que sin esto el estado nuevo no se veía hasta el refetch async. Se
    // preservan los dos campos que `Order` no trae (`payments`, `transiciones`): los
    // refresca el `getOrder` que dispara `repreguntar`.
    setDetalle(prev => prev && prev.id === actualizada.id
      ? { ...prev, ...actualizada, payments: prev.payments, transiciones: prev.transiciones }
      : prev);
    repreguntar();
  }, [repreguntar]);

  const errorAccion = useErrorDialogo();

  // Los comprobantes, del hook COMPARTIDO con /admin/ordenes. Cada cambio empalma
  // en la lista y dispara el refetch del panel.
  //
  // `control.refrescar` queda SIN USAR acá a propósito: en esta pantalla el panel
  // ya pide `getOrder`, que trae los comprobantes junto con el libro. Llamarlo
  // sería una segunda consulta por lo mismo.
  const control = useControlComprobantes(
    useCallback((ordenId: string, actualizar: (previos: Comprobante[]) => Comprobante[]) => {
      setPedidos(prev => prev.map(o => o.id === ordenId
        ? { ...o, comprobantes: actualizar(o.comprobantes ?? []) }
        : o));
      repreguntar();
    }, [repreguntar]),
  );

  // Las transiciones, del hook COMPARTIDO con el board y la pantalla vieja —
  // CUARTA montura. `onError` inline y no toast: el operador está mirando el panel.
  const transicion = useTransicionEntrega({
    onUpdated: (sh) => {
      setPedidos(prev => prev.map(o => o.shipping?.id === sh.id ? { ...o, shipping: sh } : o));
      setDetalle(prev => prev && prev.shipping?.id === sh.id ? { ...prev, shipping: sh } : prev);
      repreguntar();
    },
    onError: (e) => errorAccion.mostrar(e, 'No se pudo actualizar la entrega'),
  });

  const guardaPreparar = useAccionGuardada();
  const [programando, setProgramando]     = useState<{ shipping: Shipping; ordenId: string } | null>(null);
  const [cobrando, setCobrando]           = useState<Order | null>(null);
  const [enVerificacion, setEnVerificacion] = useState<Comprobante | null>(null);
  const [cancelando, setCancelando]       = useState<Order | null>(null);
  const [creando, setCreando]             = useState(false);
  const [rechazando, setRechazando]       = useState<{ orden: Order; c: Comprobante } | null>(null);

  // Crea el Shipping si falta (server-guarded e idempotente) y abre el modal. La
  // guarda no protege el dato —el server lo hace— sino al operador: sin ella el
  // botón se queda mudo mientras viaja.
  const abrirProgramar = useCallback((orden: Order) => guardaPreparar.ejecutar(async () => {
    errorAccion.limpiar();
    if (orden.shipping) { setProgramando({ shipping: orden.shipping, ordenId: orden.id }); return; }
    try {
      const creado = await ensureOrderShipping(orden.id);
      empalmar({ ...orden, shipping: creado });
      setProgramando({ shipping: creado, ordenId: orden.id });
    } catch (e) {
      errorAccion.mostrar(e, 'No se pudo preparar la entrega');
    }
  }), [guardaPreparar, errorAccion, empalmar]);

  // Verificar: con la orden pendiente abre Registrar Pago y deja el sello
  // pendiente —la verificación CREA la plata—; con la plata ya adentro, sella
  // directo. El orden NO es reversible (§3.1).
  const verificar = useCallback((orden: Order, c: Comprobante) => {
    control.limpiarError();
    if (accionAlVerificar(orden.estado) === 'cobrar') {
      setEnVerificacion(c);
      setCobrando(orden);
      return;
    }
    control.decidir(orden.id, c.id, 'verificar')
      .catch(e => control.mostrarError(e, 'No se pudo verificar el comprobante'));
  }, [control]);

  // GUARDAR NOTAS. Vive acá y no en el panel por la regla del 2026-08-06: el
  // panel se desmonta al cambiar de pedido y la continuación del `await` caería
  // sobre un componente muerto — ni empalme ni error.
  //
  // Guarda de doble-submit con la primitiva compartida: el ref síncrono corta el
  // segundo click del mismo tick y el estado le pone texto intermedio al botón.
  const guardaNotas = useAccionGuardada();
  const errorNotas  = useErrorDialogo();
  // El borrador de notas vive en la PÁGINA, no en el detalle: cruzar el umbral del
  // split remonta el detalle (panel ↔ sheet son ramas distintas del árbol) y un
  // estado local ahí perdería la nota a medias. Vive en el padre que sobrevive al
  // swap. Va ANCLADO a su pedido (`{ id, texto }`) y el borrador efectivo se DERIVA.
  //
  // El ancla se LIMPIA al cambiar de `idElegido` —no sólo se ignora por el derive—.
  // Sin esto sobrevive a ir a otro pedido y VOLVER (y a cerrar y reabrir): la nota
  // reaparece sin que el operador sepa si la escribió él, que es persistencia de
  // borradores, lo que la tanda 1 descartó. El alcance del fix es sobrevivir al
  // REMONTAJE POR CAMBIO DE CONTENEDOR (cruzar 1080 con el MISMO pedido, que NO
  // cambia `idElegido` → NO limpia → la nota sobrevive), no al cambio de pedido.
  //
  // El reset va EN RENDER (patrón de React para ajustar estado cuando cambia un
  // valor), NO en un efecto —eso dispara la cascada que el lint marca (§ el
  // `loading` derivado de Analítica)—. El derive por `id` mantiene correcto el
  // render de transición sin depender de que React lo descarte. `null` = servidor.
  const [borradorAnclado, setBorradorAnclado] = useState<{ id: string; texto: string } | null>(null);
  const [pedidoAncla, setPedidoAncla] = useState<string | null>(idElegido);
  if (pedidoAncla !== idElegido) {
    setPedidoAncla(idElegido);
    setBorradorAnclado(null);
  }
  const borrador = borradorAnclado?.id === idElegido ? borradorAnclado.texto : null;
  const setBorrador = useCallback((v: string | null) => {
    setBorradorAnclado(v === null || !idElegido ? null : { id: idElegido, texto: v });
  }, [idElegido]);
  const guardarNotas = useCallback((orden: Order, notas: string, onGuardado: () => void) =>
    guardaNotas.ejecutar(async () => {
      errorNotas.limpiar();
      try {
        // El endpoint es PARCIAL: manda sólo `notas_internas` y no toca nada más.
        empalmar(await updateOrder(orden.id, { notas_internas: notas }));
        onGuardado();
      } catch (e) {
        // Inline y no toast: el operador está mirando el panel (§ toast = éxito,
        // inline = error). Y el borrador NO se limpia — lo que escribió sigue ahí
        // para reintentar.
        errorNotas.mostrar(e, 'No se pudieron guardar las notas');
      }
    }), [guardaNotas, errorNotas, empalmar]);

  // El único chokepoint de la URL: cerrar, cambiar de pedido, filtros, rango y
  // limpiar cliente pasan todos por acá. Sube antes de `acciones` porque el embudo
  // de descarte lo necesita para su cierre real.
  const navegar = useCallback((cambios: Record<string, string | null>) => {
    const q = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(cambios)) {
      if (v === null) q.delete(k); else q.set(k, v);
    }
    const s = q.toString();
    router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
  }, [params, pathname, router]);

  // EL EMBUDO DE DESCARTE del borrador de notas, en la PÁGINA (antes vivía en
  // Detalle sirviendo sólo al enlace de cliente). Cubre las TRES puertas que
  // abandonan un borrador sin guardar —cerrar el detalle, cambiar de pedido y el
  // enlace de cliente—: el mismo embudo, no tres guardas. `onCerrar` es el cierre
  // REAL; `intentarCerrar`/`intentarSalir` lo envuelven con la guarda (bloquea si
  // una nota se está guardando, pregunta si hay borrador, procede si no).
  const salida = useDescarteDeDrawer({
    enVuelo: guardaNotas.enVuelo,
    onCerrar: () => { setSheetAbierto(false); navegar({ pedido: null }); },
  });
  // El "¿hay borrador?" se reporta desde un efecto, como cuando vivía en el cuerpo:
  // `marcarCambios` fija un ref (no re-renderiza), así que esto no es un setState en
  // efecto. `borrador` ya vive acá, así que no cruza props.
  const marcarCambios = salida.marcarCambios;
  useEffect(() => { marcarCambios(borrador !== null); }, [borrador, marcarCambios]);

  const acciones: AccionesPedido = {
    transicion, control, errorAccion,
    preparando: guardaPreparar.enVuelo,
    abrirProgramar, verificar,
    abrirCobrar:   (orden) => setCobrando(orden),
    abrirCancelar: (orden) => setCancelando(orden),
    abrirRechazar: (orden, c) => { control.limpiarError(); setRechazando({ orden, c }); },
    guardarNotas, guardandoNotas: guardaNotas.enVuelo, errorNotas,
    borrador, setBorrador,
    intentarSalir: salida.intentarSalir,
  };

  // ── EL DETALLE SE ESCRIBE UNA VEZ ──────────────────────────────────────────
  // Vive en el panel (ancho) o en el sheet (angosto), nunca en los dos: sólo una
  // de las dos ramas se monta. Se arma acá, con sus props, para que las dos
  // superficies no puedan discrepar — dos juegos de props del mismo componente
  // es cómo una de las dos se queda sin un dato y nadie lo ve hasta abrirlo en un
  // teléfono.
  const detalleNodo = elegido ? (
    <Detalle
      orden={elegido}
      detalle={detalleVigente}
      cargando={cargandoDetalle}
      error={errorDetalle}
      acciones={acciones}
    />
  ) : null;

  // AUTO-SELECCIÓN / RE-SELECCIÓN en escritorio: mantiene el panel coherente con
  // el conjunto VISIBLE, que cambia con el carril y con el rango de fechas. La
  // decisión —conservar el seleccionado si sigue presente, re-seleccionar el
  // primero si cayó fuera, o limpiar si el carril quedó vacío— vive en
  // `autoSeleccion` (pura, testeada). El deep link `?pedido=` gana en la primera
  // evaluación. En móvil no hay auto-select (el detalle es un sheet).
  //
  // El defecto que cierra: el efecto viejo bailaba con `|| seleccion ||`, así que
  // sólo corría al montar y nunca re-evaluaba al cambiar de carril — dejando el
  // panel con un pedido de otro carril (`elegido` se resuelve contra la lista
  // COMPLETA, no la filtrada).
  const primeraAutoSel = useRef(true);
  useEffect(() => {
    if (!hidratado || !detalleAlLado || cargando) return;
    // PUERTA #4 del embudo de descarte, y la ÚNICA que NO pregunta y NO descarta:
    // PRESERVA. Con un borrador SUCIO, el auto-select no reemplaza ni limpia la
    // selección — el pedido abierto se queda, aunque caiga fuera del carril visible
    // (`elegido` lo resuelve contra la lista COMPLETA, así que el panel lo conserva).
    // Preguntar acá sería por una consecuencia que el operador no eligió (cambió un
    // filtro, no salió del pedido); descartar en silencio es justo lo que este seam
    // lleva rondas cerrando. La guarda protege sólo MIENTRAS está sucio: al guardar
    // o descartar la nota, el auto-select retoma su conducta normal.
    if (borrador !== null) return;
    const decision = autoSeleccion({
      seleccion,
      idsVisibles: visibles.map(p => p.numero_orden),
      primeraVez: primeraAutoSel.current,
    });
    primeraAutoSel.current = false;
    if (decision.tipo === 'seleccionar') navegar({ pedido: decision.id });
    else if (decision.tipo === 'limpiar')  navegar({ pedido: null });
  }, [hidratado, detalleAlLado, cargando, seleccion, visibles, navegar, borrador]);

  return (
    // `.duna` es el reset de superficie del sistema (familia, tinta, tamaño base).
    <div className="duna duna-pantalla-fija">
      {/* CABECERA — la fila `auto` del grid de alto fijo: título, alcance y
          carriles NO scrollean (§ duna.css, el shell). <1080 es un div normal y
          todo cae en document-scroll, como siempre. */}
      <div className="duna-cabecera">
      <header style={{ display: 'flex', alignItems: 'center', gap: 'var(--duna-space-3)', marginBottom: 'var(--duna-space-6)' }}>
        {/* SIN conteo bajo el título: el pill "Todos" ya lo dice, y ahí además
            FILTRA. Una cifra que repite a un control accionable le quita sitio a
            la respuesta sin agregar una. `marginRight: auto` empuja el rango y
            "Nuevo pedido" al extremo derecho, juntos. */}
        <h1 className="duna-display-m" style={{ minWidth: 0, marginRight: 'auto' }}>Pedidos</h1>

        {/* EL SELECTOR DE RANGO, en modo SÓLO ÍCONO (§ CLAUDE.md — la cabecera de
            Pedidos). Sube a la fila del título junto a "Nuevo pedido" en vez de
            cobrarse una fila propia; el rango activo lo muestra el tag de alcance de
            abajo, no el botón. Es el `DateRangePicker` COMPARTIDO con Pagos e
            Inventario, que siguen con su botón de texto (default) — acá va la prop.
            Sin primitiva de calendario en el DS (hueco declarado), shadcn como los
            modales (H6). */}
        <DateRangePicker
          soloIcono
          desde={alcanceUrl.desde}
          hasta={alcanceUrl.hasta}
          onChange={(d, h) => navegar({ desde: d, hasta: h })}
        />

        {/* SECUNDARIO, no el primario sólido de la vista. Crear a mano es la
            ESCOTILLA, no la acción primaria: los pedidos entran por WhatsApp, la
            tienda y los canales. Con la creación en secundario, esta vista no
            tiene primario sólido, y Amber Minimal lo permite ("máx. una"). El
            tamaño del ícono lo pone el sistema (`.duna-btn svg`). */}
        <button
          type="button"
          className="duna-btn duna-btn--secondary"
          style={{ flexShrink: 0 }}
          onClick={() => setCreando(true)}
        >
          <Plus /> Nuevo pedido
        </button>
      </header>

      {/* ── EL ALCANCE SE VE Y SE QUITA ────────────────────────────────────────
          Una lista recortada que no dice que está recortada es una lista que
          miente: se lee como "la tienda tiene 2 pedidos". La fila entera es
          CONDICIONAL a `hayAlcance` —que ya incluye el rango (`desde`/`hasta`)—:
          sin alcance no se renderiza (la vista por defecto no gasta una fila en un
          control ocioso), y aparece sólo cuando hay algo recortado. Va ARRIBA de
          los carriles porque los alcanza también a ellos, y en NEUTRO (`duna-tag`),
          nunca `duna-note`: el sol significa atención, y un alcance informa. */}
      {hayAlcance(alcanceUrl) && (
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--duna-space-3)', marginBottom: 'var(--duna-space-4)' }}>
          {/* EL RANGO SÍ LLEVA TAG AHORA. Antes no —el selector de texto ya mostraba
              las fechas y un tag las repetía—; con el selector en SÓLO ÍCONO ese
              motivo se INVIERTE: el tag pasa a ser el ÚNICO sitio donde el rango se
              ve, y un filtro invisible es el defecto que Pagos cerró. Display-only,
              como los otros dos: se quita reabriendo el ícono o con "Ver todos" —un
              × propio sería una tercera forma de quitar el mismo alcance—. El texto
              sale de `rangoLabel`, el MISMO helper que el control, no una copia. */}
          {(alcanceUrl.desde || alcanceUrl.hasta) && (
            <span className="duna-tag">{rangoLabel(alcanceUrl.desde, alcanceUrl.hasta)}</span>
          )}
          {!cargando && cliente && (
            <span className="duna-tag">Pedidos de {nombreAlcance ?? 'un cliente'}</span>
          )}
          {!cargando && etiquetaEstados(alcanceUrl.estados) && (
            <span className="duna-tag">{etiquetaEstados(alcanceUrl.estados)}</span>
          )}

          {/* UNA sola forma de quitar alcances, la que ya existía para el cliente.
              Limpia los tres de una vez y NO toca el carril: el carril es dónde
              estás mirando, no cuánto estás mirando. */}
          <button
            type="button"
            className="duna-btn duna-btn--ghost duna-btn--sm"
            onClick={() => navegar({ cliente: null, desde: null, hasta: null, estado: null })}
          >
            Ver todos
          </button>
        </div>
      )}

      {/* ── Carriles ─────────────────────────────────────────────────────── */}
      <div className="row" style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--duna-space-2)', marginBottom: 'var(--duna-space-5)' }}>
        {FILTROS_PEDIDOS.map(f => (
          <button
            key={f.key}
            type="button"
            className={`duna-pill${filtro === f.key ? ' is-on' : ''}`}
            aria-pressed={filtro === f.key}
            onClick={() => navegar({ f: f.key === 'todos' ? null : f.key })}
          >
            {f.label}
            {/* EL NÚMERO SÓLO EN LAS COLAS (§ lib/carriles). `conteos` ni siquiera
                calcula los acumuladores, así que acá no queda un valor a mano que
                alguien pueda pintar sin querer: la ausencia es del dato, no del
                render.

                El cero SÍ se muestra —un carril de cola vacío es una respuesta:
                "no hay nada por cobrar"— y por eso la condición mira `undefined`
                y no la verdad del número. */}
            {cuentas[f.key] !== undefined && (
              <span className="duna-mono" style={{ marginLeft: 'var(--duna-space-inline)' }}>{cuentas[f.key]}</span>
            )}
          </button>
        ))}
      </div>

      {error && <div className="duna-note" role="alert">{error}</div>}
      </div>{/* /duna-cabecera */}

      {/* REGIÓN SCROLLEABLE — la fila `1fr`: acá scrollea cada columna del split
          ≥1080; <1080 es un div normal y todo cae en document-scroll. */}
      <div className="duna-region">
      {/* LA CARGA OCUPA EL SITIO DE LA LISTA, con su forma. Va dentro del MISMO
          `duna-split` que van a ocupar las tarjetas —no en un bloque suelto—
          para que caigan en la misma columna y con el mismo ancho en los dos
          breakpoints; el panel queda vacío, que es lo que va a estar de todos
          modos mientras no haya nada elegido.

          El texto "Cargando pedidos…" no desaparece: se lo lleva el lector de
          pantalla por `role="status"`. Lo que desaparece es su renglón, que era
          el que hacía brincar la página al ser reemplazado por tarjetas. */}
      {!error && cargando && (
        <div className="duna-split">
          <div className="duna-split__list">
            <SkeletonOrderCards label="Cargando pedidos…" />
          </div>
        </div>
      )}

      {!error && !cargando && visibles.length === 0 && (
        <div className="duna-card duna-card__pad">
          {/* Tres vacíos distintos, y decir CUÁL es lo que evita que el operador
              crea que perdió algo: la tienda no tiene pedidos · el ALCANCE no
              tiene · este carril no tiene.

              El del alcance dejó de nombrar al cliente: ahora los alcances son
              tres y el vacío puede venir del rango o del cobro. Decir "este
              cliente no tiene pedidos" cuando lo que está vacío es la semana
              pasada mandaría a buscar el problema donde no está — y la línea de
              arriba ya dice qué alcances hay puestos. */}
          <p className="duna-sub" style={{ margin: 0 }}>
            {reales.length === 0
              ? 'Todavía no hay pedidos.'
              : alcance.length === 0
                ? 'Ningún pedido en lo que estás mirando. Prueba con "Ver todos".'
                : 'Ningún pedido en este carril.'}
          </p>
        </div>
      )}

      {/* `|| elegido` es la otra mitad de buscar en `reales`: sin él, un enlace a
          un pedido cuyo carril está VACÍO encontraba el pedido y no tenía dónde
          pintarlo. El vacío de arriba se sigue mostrando en ese caso, y hace
          falta — es lo que explica por qué hay un detalle abierto sin una lista
          que lo contenga. */}
      {(visibles.length > 0 || elegido) && (
        <div className="duna-split">
          <div className="duna-split__list">
            {visibles.map(p => {
              const pasos = pasosDelPedido(p);
              return (
                <OrderCard
                  key={p.id}
                  title={p.cliente_nombre}
                  id={p.numero_orden}
                  amount={formatCOP(p.total)}
                  channel={<ChipCanal canal={p.canal} />}
                  status={badgeCobro(p, 'lista')}
                  // `undefined` cuando no hay camino que mostrar (cancelado): la
                  // primitiva lo admite y la ausencia es la respuesta.
                  steps={pasos ? { count: pasos.labels.length, current: pasos.current, done: pasos.done } : undefined}
                  // `?? undefined`: una orden ANTERIOR al libro no tiene última
                  // transición, y su slot queda vacío en vez de mostrar la fecha
                  // de creación, que responde otra pregunta.
                  timeAgo={hace(p.ultimaTransicion?.occurred_at) ?? undefined}
                  selected={p.numero_orden === seleccion}
                  // Puerta 3 del embudo: cambiar de pedido pasa por la guarda. El
                  // clic en el pedido YA abierto no re-navega ni pregunta (sería
                  // preguntar por una salida que no ocurre).
                  onClick={() => {
                    // Tocar en rango sheet ABRE el sheet, incluso la fila ya marcada
                    // (un cruce la conservó sin abrir). En panel no aplica.
                    if (!detalleAlLado) setSheetAbierto(true);
                    if (p.numero_orden === seleccion) return;
                    salida.intentarSalir(() => navegar({ pedido: p.numero_orden }));
                  }}
                />
              );
            })}
          </div>

          {/* EL PANEL, SÓLO CUANDO EL DETALLE VA AL LADO. Por debajo del umbral el
              detalle no está acá: sube como sheet. No es que se oculte — se monta
              en otro sitio, y por eso hace falta el `detalleAlLado` en JS y no
              alcanza con el CSS.

              El "Elige un pedido" se va con el panel, y está bien: en angosto
              esa instrucción no tiene a qué panel referirse, y quien ya tocó una
              tarjeta la está leyendo después de haberla seguido. */}
          {detalleAlLado && (
            <div className="duna-split__panel">
              {!elegido && (
                <div className="duna-card duna-card__pad">
                  <p className="duna-sub" style={{ margin: 0 }}>Elige un pedido para ver su detalle.</p>
                </div>
              )}
              {detalleNodo}
            </div>
          )}
        </div>
      )}
      </div>{/* /duna-region */}

      {/* ═══ EL MISMO DETALLE, EN ANGOSTO ═════════════════════════════════════
          Apilado, el panel se actualizaba FUERA DE LA PANTALLA: tocar una
          tarjeta no producía respuesta visible y había que scrollear a ciegas
          para descubrir que sí había pasado algo. Es una acción sin respuesta —
          la misma clase de defecto que el botón mudo que obligó a
          `useAccionGuardada`—, no una incomodidad de layout.

          Sheet y NO una página: la lista queda detrás, cerrar devuelve al mismo
          sitio sin navegación ni botón atrás, y `?pedido=` sigue siendo un
          enlace compartible. Una página rompía las tres a la vez.

          Y VA FUERA del bloque de arriba, no dentro: el sheet tiene que poder
          abrirse aunque la lista visible esté vacía — que es exactamente el caso
          del enlace profundo con un carril que no lo contiene.

          El nodo del detalle es UNO (`detalleNodo`): montarlo acá y en el panel
          con dos juegos de props sería el mismo detalle escrito dos veces, y la
          primera divergencia no la vería nadie hasta abrirlo en un teléfono. */}
      <DunaSheet
        abierto={!detalleAlLado && !!elegido && sheetAbierto}
        anclaje={sheetDesdeAbajo ? 'abajo' : 'lado'}
        onCerrar={salida.intentarCerrar}
        titulo={elegido ? `Pedido ${elegido.numero_orden}` : 'Detalle del pedido'}
        descripcion="Estado de entrega y de pago, con las acciones disponibles."
      >
        <div className="duna-sheet__body">{detalleNodo}</div>
      </DunaSheet>

      {/* ═══ MODALES · montados en la PÁGINA, no en el panel ══════════════════
          El panel se desmonta al cambiar de pedido; una mutación montada ahí
          puede perder su continuación. Acá arriba, el peor caso es que el panel
          reabra ya con el efecto aplicado.

          Son los MISMOS modales de /admin/ordenes, reusados tal cual: ya están
          probados en producción y reescribirlos con una primitiva nueva dejaría
          dos implementaciones de los mismos flujos conviviendo hasta que la
          pantalla vieja muera. La mezcla visual es temporal y DECLARADA (H6). */}
      <ScheduleDeliveryModal
        target={programando}
        onClose={() => setProgramando(null)}
        onSaved={(sh) => {
          setPedidos(prev => prev.map(o => o.id === programando?.ordenId ? { ...o, shipping: sh } : o));
          setDetalle(prev => prev && prev.id === programando?.ordenId ? { ...prev, shipping: sh } : prev);
          repreguntar();
        }}
        onAddressAdded={(ordenId, address) => {
          setPedidos(prev => prev.map(o => o.id === ordenId
            ? { ...o, direccion_entrega: address.direccion_entrega, ciudad_entrega: address.ciudad_entrega }
            : o));
          setDetalle(prev => prev && prev.id === ordenId
            ? { ...prev, direccion_entrega: address.direccion_entrega, ciudad_entrega: address.ciudad_entrega }
            : prev);
          repreguntar();
        }}
      />
      <RegisterPaymentModal
        target={cobrando ? {
          id: cobrando.id, numero: cobrando.numero_orden,
          cliente: cobrando.cliente_nombre ?? null, monto: cobrando.total,
        } : null}
        declaredMetodo={cobrando?.metodoPagoPrevisto ?? cobrando?.metodo_pago ?? null}
        verificando={enVerificacion}
        onClose={() => { setCobrando(null); setEnVerificacion(null); }}
        onSaved={({ order: actualizada, comprobante }) => {
          if (actualizada) {
            // DIRECTO: la orden viene actualizada. El soporte, si lo hubo, se sube
            // DESPUÉS del Payment y no viaja en la orden: se concatena.
            const previos = actualizada.comprobantes ?? [];
            empalmar({ ...actualizada, comprobantes: comprobante ? [...previos, comprobante] : previos });
          } else {
            // VERIFICAR: la verificación creó el Payment y movió la orden a `pagado`
            // en UNA sola llamada (ya no hay pago-y-luego-sello). La verdad —orden
            // pagada, envío auto-creado, comprobante VERIFICADO— la trae el servidor.
            repreguntar();
          }
        }}
      />
      <ConfirmDeleteDialog
        open={!!cancelando}
        onOpenChange={(abierto) => { if (!abierto) setCancelando(null); }}
        title={CANCELAR_ORDEN_COPY.title}
        entityLabel={cancelando ? `Orden ${cancelando.numero_orden}${cancelando.cliente_nombre ? ` · ${cancelando.cliente_nombre}` : ''}` : ''}
        consequence={CANCELAR_ORDEN_COPY.consequence}
        confirmLabel={CANCELAR_ORDEN_COPY.confirmLabel}
        busyLabel={CANCELAR_ORDEN_COPY.busyLabel}
        successMessage="Orden cancelada"
        onConfirm={async () => {
          if (!cancelando) return;
          empalmar(await updateOrder(cancelando.id, { estado: 'cancelado' }));
          setCancelando(null);
        }}
      />
      <ConfirmDeleteDialog
        open={!!rechazando}
        onOpenChange={(abierto) => { if (!abierto) setRechazando(null); }}
        title={RECHAZAR_COMPROBANTE_COPY.title}
        entityLabel={rechazando ? nombreArchivo(rechazando.c.url) : ''}
        consequence={RECHAZAR_COMPROBANTE_COPY.consequence}
        confirmLabel={RECHAZAR_COMPROBANTE_COPY.confirmLabel}
        confirmKind="default"
        onConfirm={async () => {
          if (!rechazando) return;
          // LANZA si el servidor rechaza: el diálogo se queda abierto y lo muestra
          // inline, que es su contrato.
          await control.decidir(rechazando.orden.id, rechazando.c.id, 'rechazar');
          setRechazando(null);
        }}
      />
      {/* Crear un pedido — el modal COMPARTIDO con /admin/ordenes, montado tal
          cual. Era el hueco conocido de esta pantalla y el bloqueador del retiro
          de la vieja.

          Al crear se LIMPIAN el carril y el alcance antes de seleccionar, y no es
          celo: si hay un carril activo ("Entregados") o un alcance por cliente, el
          pedido recién creado no estaría en `visibles` y el detalle no podría
          abrirlo — el operador vería la lista igual que antes y creería que no se
          creó nada. La lista EMPALMA con lo que devuelve el POST y el detalle
          REPREGUNTA al abrirse, que es el patrón de esta pantalla. */}
      <NewOrderModal
        open={creando}
        onClose={() => setCreando(false)}
        onCreated={(creado) => {
          setPedidos(prev => [creado, ...prev]);
          navegar({ f: null, cliente: null, pedido: creado.numero_orden });
        }}
      />

      <ConfirmDespachoSinPago {...transicion.confirmacion} />

      {/* Confirmación de descarte del borrador de notas. Una sola, a nivel de
          página, para las TRES puertas del embudo (cerrar, cambiar de pedido,
          enlace de cliente). Portalea al shell, así que su posición en el DOM no
          importa. */}
      <ConfirmDescartarDialog
        abierto={salida.confirmando}
        onDescartar={salida.descartar}
        onSeguir={salida.seguirEditando}
      />
    </div>
  );
}

// ─── EL DETALLE ──────────────────────────────────────────────────────────────
//
// Recibe la orden de la LISTA y el detalle del servidor por separado, y no es un
// capricho: la cabecera se pinta de inmediato con lo que la lista ya tiene, y lo
// que exige el viaje (líneas, método real, Recorrido) aparece cuando llega. Así
// abrir un pedido no deja el panel en blanco.
function Detalle({ orden, detalle, cargando, error, acciones }: {
  orden: Order;
  detalle: OrderDetalle | null;
  cargando: boolean;
  error: string | null;
  /** El panel RENDERIZA y llama hacia arriba: no es dueño de ninguna mutación. */
  acciones: AccionesPedido;
}) {
  const badge = badgeCobro(orden, 'detalle');
  const fuente = detalle ?? orden;

  // Sale de `fuente`, no de `orden`: mientras el detalle viaja se calcula con lo
  // que la lista ya trae (que incluye envío y comprobantes, así que los cuatro
  // motivos son evaluables desde el primer render) y se recalcula solo cuando
  // llega la verdad del servidor. Es LA MISMA función que filtra el pill — si esta
  // pantalla tuviera su propia idea de qué pide atención, el operador vería un
  // pedido en el carril "Necesitan atención" y adentro ningún motivo.
  const motivos = motivosDeAtencion(fuente);

  // BORRADOR de las notas. `null` = intacto, y por eso el textarea deriva del
  // servidor mientras nadie escriba (ver el comentario en la sección). NO es estado
  // local: vive en la página y baja por `acciones`, porque cruzar el umbral del
  // split remonta el detalle (panel ↔ sheet) y un `useState` acá perdería la nota.
  const { borrador, setBorrador } = acciones;

  const envio    = fuente.shipping ?? null;
  const enVuelo  = envio ? acciones.transicion.enVuelo(envio.id) : false;
  const falta    = missingToDispatch(envio);
  const soportes = fuente.comprobantes ?? [];
  const lightbox = useLightboxComprobante();

  // GUARDA DE SALIDA del enlace de cliente. El embudo VIVE EN LA PÁGINA (cubre las
  // tres puertas: cerrar, cambiar de pedido y este enlace); el detalle sólo lo
  // LLAMA para su salida propia —el enlace es un <Link> de Next que navega SIN pasar
  // por `onCerrar`, así que sin el embudo saltaría la guarda—. El "¿hay borrador?"
  // lo reporta la página, que es donde vive el borrador.
  const router = useRouter();
  const clienteHref = orden.cliente_id ? `/admin/clientes?cliente=${encodeURIComponent(orden.cliente_id)}` : null;

  // WhatsApp al cliente, la acción más frecuente del operador de este negocio y
  // la que se perdió al migrar de /admin/ordenes. Usa el MISMO snapshot que se
  // muestra (`orden.cliente_telefono`), no una segunda fuente — así el enlace
  // abre el número al que el cliente pidió que se le escribiera por ESTE pedido.
  // `null` si el teléfono no es un celular válido: sin acción que ofrecer, no se
  // pinta un botón muerto.
  const waHref = customerWhatsappHref(
    orden.cliente_telefono,
    `Hola ${orden.cliente_nombre}, te escribimos de ${siteConfig.brand.nombre} por tu pedido ${orden.numero_orden}`,
  );

  // El método REAL manda sobre el previsto: el pago que existe gana sobre la
  // intención declarada al crear la orden. Sin pago, se dice que es lo previsto —
  // presentarlo a secas haría creer que ya se cobró.
  const pagoReal = detalle?.payments?.[0];
  const metodo = pagoReal
    ? METODO_PAGO_LABEL[pagoReal.metodo]
    : metodoPrevistoLabel(orden);

  const pasos = detalle ? recorridoDelPedido(detalle) : [];

  const lineas = (fuente.items ?? []).map(i => ({
    label: i.producto_nombre,
    meta: [`× ${i.cantidad}`, i.moliendaSeleccionada].filter(Boolean).join(' · '),
    amount: formatCOP(i.subtotal),
  }));
  // El envío entra como LÍNEA cuando existe. Sin él, la suma de las líneas no da
  // el total y la tabla se contradice sola.
  if (fuente.costo_envio > 0) {
    lineas.push({ label: 'Envío', meta: '', amount: formatCOP(fuente.costo_envio) });
  }

  return (
    <div className="duna-card duna-card__pad">
      {/* ── Cabecera ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--duna-space-3)' }}>
        <span className="duna-avatar">{iniciales(orden.cliente_nombre)}</span>
        <div style={{ minWidth: 0 }}>
          {/* El nombre lleva a su ficha, como en la pantalla vieja. Sólo cuando hay
              cliente al que ir: `cliente_id` es nullable (órdenes previas a la
              relación), y un enlace muerto promete una navegación que no ocurre —
              misma regla que CustomerLink ("no dead link"). Sin id, texto plano. */}
          <div className="duna-title">
            {clienteHref ? (
              <Link href={clienteHref}
                    className="duna-link" title={`Ver ficha de ${orden.cliente_nombre}`}
                    onClick={(e) => {
                      // Clic con modificador (nueva pestaña) no desmonta el panel.
                      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                      e.preventDefault();
                      acciones.intentarSalir(() => router.push(clienteHref));
                    }}>
                {orden.cliente_nombre}
              </Link>
            ) : orden.cliente_nombre}
          </div>
          <div className="duna-mono">{orden.numero_orden}</div>
        </div>
        <span className={`duna-badge ${BADGE_TONE_CLASS[badge.tone]}`} style={{ marginLeft: 'auto' }}>
          {badge.tone !== 'neutral' && <span className="duna-badge__dot" />}
          {badge.label}
        </span>
      </div>

      {/* `flexWrap: wrap` es INTRÍNSECO, no un breakpoint: la fila rompe por
          proporción del split, no por viewport, así que un media query no la
          arregla. Sin envolver, los ítems encogen hasta su min-content y la
          dirección se parte en columnas de una palabra ("Ak 58 / 169a, /
          Bogota"). Con wrap, la dirección —el ítem más ancho y el último— cae a
          su propio renglón (ancho completo, wrap normal) sólo cuando no cabe:
          "a su propio renglón antes de comprimirse". En ancho, todo sigue en una
          línea (sin cambio). */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--duna-space-3)', marginTop: 'var(--duna-space-3)' }}>
        {/* SÓLO ÍCONO acá: el botón de WhatsApp de al lado ya lleva la palabra, y
            un canal "WhatsApp" con texto la repetiría. En la card de la lista
            (sin ese botón) el chip sigue con su etiqueta. */}
        <ChipCanal canal={orden.canal} soloIcono />
        {/* EL TELÉFONO, y sólo él, del pliegue de contacto de la pantalla vieja.
            Mismo criterio que la evidencia de la entrega: entra lo que HABILITA
            una acción que esta pantalla ofrece. El teléfono la habilita —el
            mensajero no encuentra, el cliente no abre, se llama— y sin él el
            operador tiene que salir del detalle justo en el peor momento. La
            dirección detallada y el método previsto no habilitan nada acá: la de
            cabecera ya orienta, y el previsto es intención (el método REAL
            aparece solo cuando hay pago, unas líneas más abajo).

            Es el SNAPSHOT de la orden, no el teléfono actual del cliente: dice a
            qué número dejó dicho el cliente que se le llamara por ESTE pedido.
            Editar su perfil no reescribe pedidos pasados.

            En `duna-mono` por lo mismo que el número de orden: es un dato que se
            lee dígito a dígito y se copia, no prosa. Ausente no se renderiza —
            un "Teléfono: —" ocupa el mismo espacio para no decir nada. */}
        {orden.cliente_telefono && (
          <span className="duna-mono">{orden.cliente_telefono}</span>
        )}
        {/* El acceso a WhatsApp de la pantalla vieja. Ghost-sm para no competir con
            las acciones de la vista; abre en pestaña nueva. Sólo con un número
            válido (`waHref`). */}
        {waHref && (
          <a href={waHref} target="_blank" rel="noopener noreferrer"
             className="duna-btn duna-btn--ghost duna-btn--sm">
            <MessageCircle /> WhatsApp
          </a>
        )}
        {/* DEUDA DECLARADA: DUNA-DS pide "Recoge en tienda" si el pedido es
            pickup. El dominio NO tiene pickup — `TipoEnvio` es LOCAL | NACIONAL y
            las dos son envío. Modelarlo es otra fase con su propia decisión de
            producto (¿cambia el flujo de entrega? ¿el cobro?), así que acá se
            muestra siempre la dirección. */}
        <span className="duna-caption">
          {orden.direccion_entrega
            ? [orden.direccion_entrega, orden.ciudad_entrega].filter(Boolean).join(', ')
            : 'Sin dirección registrada'}
        </span>
      </div>

      <hr className="duna-divider" style={{ margin: 'var(--duna-space-5) 0' }} />

      {error && <div className="duna-note" role="alert">{error}</div>}

      {/* ── POR QUÉ pide atención ────────────────────────────────────────────
          Va PRIMERO, antes de los productos: si el pedido pide algo, es lo que el
          operador vino a resolver. Y va SÓLO acá, no en la card de la lista — la
          lista ya dice QUÉ pedidos piden atención (el pill los filtra) y el
          detalle es donde se ACTÚA. Mantenerlo fuera de la card además no toca
          `order-card`, que es primitiva agnóstica del DS.

          Se muestran TODOS los motivos, no el principal: el caso que originó esto
          fue justamente una orden con dos causas, donde resolver una dejaba la
          otra invisible.

          `.duna-att-item` en su forma NEUTRA (un `<div>`): estos motivos no llevan
          a ningún lado — el operador ya está en el pedido —, y la primitiva dejó de
          prometer click en su clase base. */}
      {motivos.length > 0 && (
        <>
          <div className="duna-eyebrow" style={{ marginBottom: 'var(--duna-space-2)' }}>Necesita tu atención</div>
          <div style={{ marginBottom: 'var(--duna-space-5)' }}>
            {motivos.map((m, i) => (
              <div className="duna-att-item" key={i}>
                <span className="duna-att-item__dot" />
                <div className="duna-att-item__body">
                  <div className="duna-att-item__title">{textoDeMotivo(m)}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Líneas y total ───────────────────────────────────────────────── */}
      <div className="duna-eyebrow" style={{ marginBottom: 'var(--duna-space-2)' }}>Productos</div>
      <ItemsTable rows={lineas} total={{ label: 'Total', amount: formatCOP(fuente.total) }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--duna-space-4)' }}>
        <span className="duna-caption">Método de pago</span>
        <span className="duna-body-sm">
          {metodo ?? 'Por definir'}
          {!pagoReal && metodo && <span className="duna-caption"> · previsto</span>}
        </span>
      </div>

      <hr className="duna-divider" style={{ margin: 'var(--duna-space-5) 0' }} />

      {/* ── ENTREGA · las acciones que el ESTADO permite, ni una más ─────────
          El if/else es sobre `Shipping.estado`, igual que la pantalla vieja — no
          una lista plana de botones que se habilitan. La ÚNICA excepción es
          "Marcar En Ruta" con la programación a medias: se muestra DESHABILITADO
          diciendo qué falta, porque esconderlo mandaría al operador a buscarlo a
          otra pantalla. Es la misma doctrina de los motivos de atención — decir el
          porqué en vez de dejar que lo averigüe. */}
      <div className="duna-eyebrow" style={{ marginBottom: 'var(--duna-space-2)' }}>Entrega</div>

      {/* ── LO QUE YA SE DECIDIÓ, antes de las acciones ──────────────────────
          Ofrecer "Marcar en ruta" sin decir QUIÉN lleva ni CUÁNDO es pedirle al
          operador que despache a ciegas: el botón afirma que la entrega está
          lista y el panel no muestra con qué. La pantalla vieja tenía esta línea
          y la nueva nació sin ella.

          Sólo lo que EXISTE — un "Mensajero: —" ocupa el mismo espacio para no
          decir nada. Y la FRANJA va aparte de los otros tres a propósito: los
          tres primeros son decisiones del operador (a quién, a dónde, para
          cuándo) y la franja es lo que PIDIÓ el cliente en el checkout. Meterlas
          en la misma lista las haría leer como si alguien las hubiera elegido
          juntas. Es el único dato del checkout que esta pantalla no mostraba. */}
      {(() => {
        const decidido = envio ? [
          envio.mensajero?.trim() && `Mensajero: ${envio.mensajero.trim()}`,
          envio.zona && `Zona: ${envio.zona}`,
          envio.fecha_programada?.trim() && `Programada: ${formatFecha(envio.fecha_programada)}`,
        ].filter(Boolean).join(' · ') : '';
        const franja = findSlotLabel(fuente.deliverySlot);
        if (!decidido && !franja) return null;
        return (
          <div style={{ marginBottom: 'var(--duna-space-3)' }}>
            {decidido && <div className="duna-caption">{decidido}</div>}
            {franja && <div className="duna-caption">Franja pedida: {franja}</div>}
          </div>
        );
      })()}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--duna-space-2)' }}>
        {orden.estado === 'cancelado' ? null : !envio ? (
          <button type="button" className="duna-btn duna-btn--secondary" disabled={acciones.preparando}
                  onClick={() => acciones.abrirProgramar(fuente)}>
            {acciones.preparando ? 'Preparando…' : 'Preparar envío'}
          </button>
        ) : envio.estado === 'preparando' ? (
          <>
            <button type="button" className="duna-btn duna-btn--secondary" disabled={acciones.preparando}
                    onClick={() => acciones.abrirProgramar(fuente)}>
              {hasScheduleData(envio) ? 'Editar entrega' : 'Programar entrega'}
            </button>
            {isScheduledShipping(envio) ? (
              <button type="button" className="duna-btn duna-btn--secondary" disabled={enVuelo}
                      onClick={() => acciones.transicion.despachar({
                        id: envio.id, numeroOrden: orden.numero_orden, ordenPagada: orden.estado === 'pagado',
                      })}>
                Marcar en ruta
              </button>
            ) : hasScheduleData(envio) && (
              // Botón deshabilitado: el span es el trigger porque un disabled se
              // traga el hover de Radix (mismo patrón que Entregas).
              <DunaTooltip content={falta === 'mensajero' ? 'Falta el mensajero' : 'Falta la fecha'}>
                <span className="inline-flex cursor-not-allowed">
                  <button type="button" className="duna-btn duna-btn--secondary" disabled>
                    Marcar en ruta · {falta === 'mensajero' ? 'falta mensajero' : 'falta fecha'}
                  </button>
                </span>
              </DunaTooltip>
            )}
          </>
        ) : envio.estado === 'en_ruta' ? (
          <>
            <button type="button" className="duna-btn duna-btn--secondary" disabled={enVuelo}
                    onClick={() => acciones.transicion.marcarEntregado(envio.id)}>
              Marcar entregado
            </button>
            <button type="button" className="duna-btn duna-btn--ghost" disabled={enVuelo}
                    onClick={() => acciones.transicion.marcarFallido(envio.id)}>
              Marcar fallido
            </button>
          </>
        ) : envio.estado === 'fallido' ? (
          <button type="button" className="duna-btn duna-btn--secondary" disabled={acciones.preparando}
                  onClick={() => acciones.abrirProgramar(fuente)}>
            Reprogramar
          </button>
        ) : null}
      </div>
      <ErrorDialogo mensaje={acciones.errorAccion.mensaje} />

      {/* ── PAGO ─────────────────────────────────────────────────────────── */}
      {orden.estado === 'pendiente' && (
        <div style={{ marginTop: 'var(--duna-space-4)' }}>
          <button type="button" className="duna-btn duna-btn--primary" onClick={() => acciones.abrirCobrar(fuente)}>
            Registrar pago
          </button>
        </div>
      )}

      {/* ── COMPROBANTES · la evidencia, que no es la plata ─────────────────
          La caja VACÍA es una línea: el caso normal de una orden es no tener
          soportes, y el bloque grande ocupaba más que la sección que responde algo. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--duna-space-3)', marginTop: 'var(--duna-space-4)' }}>
        <span className="duna-caption">Comprobantes ({soportes.length})</span>
        {orden.estado !== 'cancelado' && (
          <SelectorComprobante
            onArchivo={(file) => acciones.control.adjuntar(orden.id, file)}
            disabled={acciones.control.subiendo}
            label={acciones.control.subiendo ? 'Subiendo…' : 'Adjuntar'}
            tooltip={`JPG, PNG, WebP o PDF · máx. ${MAX_COMPROBANTE_MB} MB. Adjuntar no registra el pago.`}
          />
        )}
      </div>
      {soportes.length > 0 && (
        <div style={{ marginTop: 'var(--duna-space-3)', display: 'grid', gap: 'var(--duna-space-3)' }}>
          {soportes.map(c => (
            <ComprobanteVista
              key={c.id}
              comprobante={c}
              onAmpliar={lightbox.ampliar}
              acciones={puedeDecidirse(c.estado) ? (
                <>
                  <button type="button" className="duna-btn duna-btn--secondary duna-btn--sm"
                          disabled={acciones.control.enVuelo(c.id)}
                          onClick={() => acciones.verificar(fuente, c)}>
                    Verificar
                  </button>
                  <button type="button" className="duna-btn duna-btn--ghost duna-btn--sm"
                          disabled={acciones.control.enVuelo(c.id)}
                          onClick={() => acciones.abrirRechazar(fuente, c)}>
                    Rechazar
                  </button>
                </>
              ) : undefined}
            />
          ))}
        </div>
      )}
      {/* El error FUERA de la caja, para que se vea igual con la caja colapsada —
          que es justo cuando falla la primera subida. */}
      <ErrorDialogo mensaje={acciones.control.error} />
      <ImageLightbox src={lightbox.abierto?.src ?? null} alt={lightbox.abierto?.alt} onClose={lightbox.cerrar} />

      <hr className="duna-divider" style={{ margin: 'var(--duna-space-5) 0' }} />

      {/* ── Recorrido ────────────────────────────────────────────────────────
          Sube por encima de Notas: es el CORAZÓN del detalle —el libro de
          transiciones— y con el textarea de notas encima quedaba empujado al
          fondo, fuera de la vista. Lo que crece o se consulta poco (notas) baja;
          lo que responde "¿qué pasó con este pedido?" queda arriba del pliegue. */}
      <div className="duna-eyebrow" style={{ marginBottom: 'var(--duna-space-3)' }}>Recorrido del pedido</div>
      {cargando && <p className="duna-sub" style={{ margin: 0 }}>Cargando el recorrido…</p>}
      {!cargando && pasos.length > 0 && (
        <>
          <Timeline entries={pasos.map(p => ({
            title: p.titulo,
            time:  hace(p.cuando),
            actor: p.actor,
            state: p.estado,
          }))} />
          {/* Un recorrido corto porque falta registro no es lo mismo que uno corto
              porque no pasó nada, y el operador no puede distinguirlos si nadie se
              lo dice. */}
          {tieneDerivados(pasos) && (
            <p className="duna-caption" style={{ marginTop: 'var(--duna-space-3)' }}>
              Este pedido es anterior al registro de cambios. Se muestra sólo lo que consta.
            </p>
          )}
        </>
      )}

      <hr className="duna-divider" style={{ margin: 'var(--duna-space-5) 0' }} />

      {/* ── NOTAS INTERNAS ───────────────────────────────────────────────────
          Entra CON el retiro de /admin/ordenes, no después: esa pantalla era el
          único sitio donde estas notas se podían leer y editar, y borrarla sin
          esto dejaría el campo de SÓLO ESCRITURA — el modal de crear las escribe
          y `POST /api/orders/[id]/address` les anexa una línea de auditoría cada
          vez que alguien agrega una dirección a mano. Un dato que el sistema
          sigue produciendo y que nadie puede ver no es una deuda heredada: la
          crearía el borrado.

          SE MUESTRA EL CAMPO COMPLETO, líneas de auditoría incluidas. Filtrarlas
          para dejar "sólo lo que el operador escribió" sería editorializar un
          registro — y justamente esas líneas son las que explican por qué una
          dirección aparece sin que nadie recuerde haberla puesto.

          Sin pliegue: el design-system no tiene primitiva de plegado, y
          `components/admin/Pliegue` es chrome de la app. Meterlo acá ampliaría la
          mezcla visual más allá de la excepción declarada (los modales), que es
          justo lo que la regla del sistema prohíbe. Va como una sección más, con
          el mismo `eyebrow` que las demás. */}
      <div className="duna-eyebrow" style={{ marginBottom: 'var(--duna-space-2)' }}>Notas internas</div>
      {/* VACÍA es una línea (misma regla que Comprobantes): el caso normal de un
          pedido es no tener notas, y un textarea vacío de 3 filas pesaba más que
          el Recorrido. Con notas o mientras se edita, el editor completo; sin
          nada, un disparador que al pulsarlo abre el editor (`borrador = ''`). */}
      {(fuente.notas_internas ?? '').trim() !== '' || borrador !== null ? (
        <>
          <textarea
            className="duna-input"
            rows={3}
            placeholder="Sin notas."
            // DERIVADO, no una copia congelada: el panel NO se remonta al cambiar de
            // pedido (no lleva `key`), así que un `useState(orden.notas_internas)`
            // seguiría mostrando las notas del pedido anterior. `null` = el operador
            // no ha tocado nada y manda el servidor. Es el mismo bug que ya costó una
            // reversión de pago con el Select de estado del detalle viejo.
            value={borrador ?? fuente.notas_internas ?? ''}
            onChange={(e) => setBorrador(e.target.value)}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--duna-space-3)', marginTop: 'var(--duna-space-2)' }}>
            <button
              type="button"
              className="duna-btn duna-btn--secondary"
              // Sin cambios no hay nada que guardar, y un botón vivo que no hace nada
              // invita a pulsarlo para averiguar si pasó algo. Además del borrador
              // intacto, un borrador igual al valor del servidor tampoco guarda —
              // así "Agregar nota" y no escribir nada no deja un guardado en vacío.
              disabled={acciones.guardandoNotas || borrador === null || borrador === (fuente.notas_internas ?? '')}
              onClick={() => acciones.guardarNotas(fuente, borrador ?? '', () => setBorrador(null))}
            >
              {acciones.guardandoNotas ? 'Guardando…' : 'Guardar notas'}
            </button>
            {borrador !== null && !acciones.guardandoNotas && (
              <button type="button" className="duna-btn duna-btn--ghost duna-btn--sm" onClick={() => setBorrador(null)}>
                Descartar
              </button>
            )}
          </div>
          <ErrorDialogo mensaje={acciones.errorNotas.mensaje} />
        </>
      ) : (
        <button type="button" className="duna-btn duna-btn--ghost duna-btn--sm" onClick={() => setBorrador('')}>
          Agregar nota interna
        </button>
      )}

      {/* ── Cancelar ─────────────────────────────────────────────────────── */}
      {orden.estado !== 'cancelado' && (
        <div style={{ marginTop: 'var(--duna-space-4)' }}>
          <button type="button" className="duna-btn duna-btn--ghost" onClick={() => acciones.abrirCancelar(fuente)}>
            Cancelar orden
          </button>
        </div>
      )}

    </div>
  );
}
