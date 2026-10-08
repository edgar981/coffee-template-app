'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, ExternalLink } from 'lucide-react';
import { useSiteSettings } from '@/components/admin/SiteSettingsProvider';
import { siteSettingsEditableSchema } from '@/lib/config/site-settings-schema';
import { payloadBaseDesdeSettings, repartirErroresBloque } from '@/lib/admin/configuracion-partes';
import {
  METODOS_PAGO_ORDEN, labelMetodo, claveMedioPago,
  type MetodoPagoTipo, type MetodoPagoGuardado,
} from '@/lib/checkout/metodos-pago';
import {
  CAMPOS_METODO, NOTA_CONTRAENTREGA, filasMediosPago, vistaClienteMetodos, vistaClientePasarela,
  chipsPasarela, nombreVisiblePasarela, nombreMedioPago, type FilaMedioPago, type ChipPasarela,
} from '@/lib/admin/medios-pago-vista';
import { pasarelaDisponibleEnEsteDespliegue } from '@/services/checkout.service';
import {
  metodosPasarelaParaComprador, cruzarMetodosPasarela, paraElPanel,
} from '@/lib/pagos/metodos-pasarela';
import { useAccionGuardada } from '@/hooks/useAccionGuardada';
import { useDescarteDeDrawer } from '@/hooks/useDescarteDeDrawer';
import { ConfirmDescartarDialog } from '@/components/admin/ConfirmDescartarDialog';
import { ConfirmDeleteDialog } from '@/components/admin/ConfirmDeleteDialog';
import { DunaSheet } from '@/components/admin/DunaSheet';
import { useCuentaPasarela, guardadoDe, type CuentaPasarelaEstado } from './useCuentaPasarela';

// ─── Subsección «Pagos y cobros» — rehecha como el prototipo (§ PANEL-CONFIG-PAGOS-1) ────────────
//
// REEMPLAZA el form único (editar TODO a la vez) que `PANEL-CONFIG-BLOQUES-1` había movido TAL
// CUAL desde `DatosNegocioSeccion` — esa tanda dejó escrito explícitamente que el rediseño de
// ESTA subsección era este slice (§ el comentario que encabezaba este archivo antes). Tres piezas:
//
//   1. «Cómo te pueden pagar» — UNA lista, orden CANÓNICO (`METODOS_PAGO_ORDEN`; sin arrastrar:
//      no hay un campo de orden propio, § docs/panel/REDISENO.md §5), cada fila con su Editar
//      INLINE (edita sólo ESA fila, no el array entero) y «Agregar medio» (una hoja con los
//      tipos del set cerrado).
//   2. «Pago en línea» — estado de conexión + los medios guardados en CHIPS TOGGLABLES (vuelta a
//      poner por `PANEL-PAGOS-PASARELA-CHIPS-1`, que cierra el open-followup
//      `PANEL-CONFIG-PAGOS-PASARELA-TOGGLE-PERDIDO-1`: ese toggle lo había construido
//      `PANEL-CONFIG-BLOQUES-1` dentro del form único, y este rediseño lo había dejado de SÓLO
//      LECTURA) + «Abrir Wompi ↗». El cruce guardado×cuenta sigue siendo
//      `cruzarMetodosPasarela`/`paraElPanel` (`lib/pagos/metodos-pasarela.ts`, sin tocar); lo
//      nuevo es que cada chip es un botón — tocarlo guarda de inmediato (un PATCH por toggle,
//      igual que «Agregar medio» guarda al confirmar, nunca una cola de cambios sin guardar).
//   3. «Así lo ve tu cliente» — vista fiel (no el componente real del checkout: su selector vive
//      inline dentro de `app/(storefront)/checkout/page.tsx`, sin extraer a un componente propio,
//      y extraerlo es tocar storefront — fuera de `touches`). Se arma con las MISMAS funciones
//      puras que usa el checkout real (`metodosDisponibles`, `subtituloPagoPasarela` —
//      `lib/admin/medios-pago-vista.ts`), actualizada en vivo con lo que se está editando.
//
// Sin campos nuevos en ningún lado: cada fila usa `CAMPOS_METODO[tipo]`, el mismo set de hoy.

type MetodoPagoDatos = Record<string, string>;

const PIDE_METODO: Record<MetodoPagoTipo, string> = {
  nequi:         'El número donde recibes',
  daviplata:     'El número donde recibes',
  breb:          'Tu llave',
  transferencia: 'Banco, tipo y número de cuenta',
  efectivo:      'Nada que configurar',
};

// El merchant panel público de Wompi — no es una llave ni una conexión (§ "sin tocar llaves ni
// la conexión"), sólo un enlace de salida para que el dueño administre su cuenta allá.
const URL_WOMPI = 'https://comercios.wompi.co';

function medioTieneDatos(m: MetodoPagoGuardado): boolean {
  return CAMPOS_METODO[m.tipo].some(c => (m.datos[c.name] ?? '').trim().length > 0);
}

/**
 * La lista con UN medio reemplazado/agregado — la base para "¿cómo queda el payload si guardo
 * esto?" tanto al editar una fila existente como al agregar una nueva.
 *
 * `transferencia` puede tener VARIAS cuentas (§ PAGOS-VARIAS-CUENTAS-1): `claveOriginal` dice
 * CUÁL fila se está tocando —su `claveMedioPago`— o `null` si es una cuenta NUEVA (agregada por
 * «Agregar medio» o «+ Otra cuenta»). El id de la cuenta se asigna (o se conserva) AQUÍ, nunca
 * antes: así una cuenta LEGADO sin id se autorrepara con uno real la próxima vez que se guarda,
 * en vez de quedar duplicada. Los demás cuatro tipos siguen siendo singleton, por tipo.
 */
function conMedio(
  lista: MetodoPagoGuardado[],
  tipo: MetodoPagoTipo,
  datos: MetodoPagoDatos,
  claveOriginal: string | null = null,
): MetodoPagoGuardado[] {
  if (tipo === 'transferencia') {
    const datosConId = { ...datos, id: datos.id || crypto.randomUUID() };
    const nuevo: MetodoPagoGuardado = { tipo, datos: datosConId };
    return claveOriginal === null
      ? [...lista, nuevo]
      : lista.map(m => (claveMedioPago(m) === claveOriginal ? nuevo : m));
  }
  const existe = lista.some(m => m.tipo === tipo);
  return existe ? lista.map(m => (m.tipo === tipo ? { tipo, datos } : m)) : [...lista, { tipo, datos }];
}

/** Quita UN medio guardado. `transferencia` se identifica por su `claveMedioPago` —puede haber
 *  varias cuentas, y sólo UNA se va—; los demás cuatro tipos, por tipo, como siempre. */
function sinMedio(lista: MetodoPagoGuardado[], medio: MetodoPagoGuardado): MetodoPagoGuardado[] {
  if (medio.tipo === 'transferencia') {
    const clave = claveMedioPago(medio);
    return lista.filter(m => claveMedioPago(m) !== clave);
  }
  return lista.filter(m => m.tipo !== medio.tipo);
}

function estadoConexion(estado: CuentaPasarelaEstado['tipo']): { label: string; clase: string } {
  if (estado === 'ok') return { label: 'Conectado', clase: 'duna-badge--ok' };
  if (estado === 'error') return { label: 'No se pudo conectar', clase: 'duna-badge--problem' };
  return { label: 'Consultando…', clase: 'duna-badge--neutral' };
}

export default function PagosCobrosBloque() {
  const settings = useSiteSettings();
  const router   = useRouter();

  // Acá la cuenta de pasarela SÍ se EDITA (a diferencia de los otros tres bloques, que sólo la
  // reenvían sin tocar vía `payloadBaseDesdeSettings`) — por eso usa `setCuentaPasarela` para
  // reflejar lo recién guardado sin un segundo viaje de red (§ PANEL-PAGOS-PASARELA-CHIPS-1,
  // el mismo patrón que `PANEL-CONFIG-BLOQUES-1` ya había construido antes de que
  // `PANEL-CONFIG-PAGOS-1` dejara el bloque de sólo lectura).
  const { estado: cuentaPasarela, setEstado: setCuentaPasarela } = useCuentaPasarela();
  const guardadoDeCuenta = () => guardadoDe(cuentaPasarela);

  // ─── «Pago en línea» — cada chip guarda de inmediato (un PATCH por toggle) ──────────────────
  const [errorPasarela, setErrorPasarela] = useState<string | null>(null);
  const guardaPasarela = useAccionGuardada();

  const guardarPayloadPasarela = (metodosPasarela: string[]) => siteSettingsEditableSchema.safeParse(
    payloadBaseDesdeSettings(settings, metodosPasarela),
  );

  /**
   * Alterna un tipo de pasarela — PRENDE lo agrega a `metodosPasarela`, APAGA lo quita. Sirve a
   * los TRES casos que un chip puede representar (§ `chipsPasarela`,
   * `lib/admin/medios-pago-vista.ts`): 'disponible' (apagarlo), 'disponible_no_ofrecido'
   * (prenderlo) y 'guardado_no_disponible' (el chip RANCIO — tocarlo también apaga, que es cómo
   * se quita un tipo que la cuenta ya no sostiene). No hay un refine de "al menos uno" para
   * `metodosPasarela` (§ `siteSettingsEditableSchema`: "la pasarela es una capacidad de
   * DESPLIEGUE que puede estar apagada, y `[]` es un estado legítimo"), así que apagar el ÚLTIMO
   * chip encendido guarda igual, sin aviso especial.
   */
  const alternarMetodoPasarela = (tipo: string, prender: boolean) => {
    if (editandoTipo !== null || sheetAbierto || guardaPasarela.enVuelo) return;
    setErrorPasarela(null);

    const actual    = guardadoDeCuenta();
    const siguiente = prender ? [...actual, tipo] : actual.filter(t => t !== tipo);

    const parsed = guardarPayloadPasarela(siguiente);
    if (!parsed.success) {
      setErrorPasarela(parsed.error.issues[0]?.message ?? 'No se pudo guardar.');
      return;
    }

    guardaPasarela.ejecutar(async () => {
      const res = await fetch('/api/site-settings', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(parsed.data),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setErrorPasarela(data?.error ?? 'No se pudo guardar. Intenta de nuevo.');
        return;
      }
      toast.success(`${nombreVisiblePasarela(tipo)} ${prender ? 'activado' : 'desactivado'}.`);
      // Refleja lo recién guardado sin un segundo viaje de red — el mismo patrón que
      // `PANEL-CONFIG-BLOQUES-1` ya usaba para este hook.
      setCuentaPasarela(c => (c.tipo === 'cargando' ? c : { ...c, guardado: siguiente }));
      router.refresh();
    });
  };

  // ─── Edición de UNA fila de «Cómo te pueden pagar» ──────────────────────────────────────────
  // `editandoClave` identifica la fila por su `claveMedioPago` (§ PAGOS-VARIAS-CUENTAS-1), no
  // por tipo: con varias cuentas de transferencia, el tipo solo no basta para saber CUÁL se
  // está editando.
  const [editandoClave, setEditandoClave] = useState<string | null>(null);
  const [valoresFila, setValoresFila]     = useState<MetodoPagoDatos>({});
  const [errorFila, setErrorFila]         = useState<string | null>(null);
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  const [confirmarQuitar, setConfirmarQuitar] = useState<MetodoPagoGuardado | null>(null);

  const guardaFila   = useAccionGuardada();
  const guardaQuitar = useAccionGuardada();

  const salirEdicionFila = () => {
    setEditandoClave(null);
    setValoresFila({});
    setErrorFila(null);
    setErrorServidor(null);
  };
  const descarteFila = useDescarteDeDrawer({
    enVuelo:  guardaFila.enVuelo || guardaQuitar.enVuelo,
    onCerrar: salirEdicionFila,
  });

  const medioEditando = editandoClave
    ? settings.metodosPago.find(m => claveMedioPago(m) === editandoClave)
    : undefined;
  const editandoTipo = medioEditando?.tipo ?? null;
  const suciaFila = editandoClave !== null
    && JSON.stringify(valoresFila) !== JSON.stringify(medioEditando?.datos ?? {});
  useEffect(() => { descarteFila.marcarCambios(suciaFila); }, [suciaFila, descarteFila]);

  const abrirEdicionFila = (fila: FilaMedioPago) => {
    if (editandoClave !== null || sheetAbierto) return; // una edición a la vez
    setEditandoClave(fila.clave);
    setValoresFila({ ...fila.medio.datos });
    setErrorFila(null);
    setErrorServidor(null);
  };

  const setValorFila = (campo: string, valor: string) => {
    setValoresFila(v => ({ ...v, [campo]: valor }));
  };

  const guardarPayload = (metodosPago: MetodoPagoGuardado[]) => siteSettingsEditableSchema.safeParse({
    ...payloadBaseDesdeSettings(settings, guardadoDeCuenta()),
    metodosPago,
  });

  const guardarFila = () => {
    if (!editandoClave || !medioEditando) return;
    setErrorServidor(null);

    const parsed = guardarPayload(conMedio(settings.metodosPago, medioEditando.tipo, valoresFila, editandoClave));
    if (!parsed.success) {
      const { propios, errorAjeno } = repartirErroresBloque(
        parsed.error.issues,
        campo => (campo === 'metodosPago' ? campo : null),
      );
      setErrorFila(propios.metodosPago ?? null);
      if (errorAjeno) setErrorServidor(errorAjeno);
      return;
    }
    setErrorFila(null);

    guardaFila.ejecutar(async () => {
      const res = await fetch('/api/site-settings', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(parsed.data),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setErrorServidor(data?.error ?? 'No se pudo guardar. Intenta de nuevo.');
        return;
      }
      // `nombreMedioPago`, no `labelMetodo`: con varias cuentas de transferencia (§
      // PAGOS-VARIAS-CUENTAS-1), el toast tiene que decir CUÁL —lleva el banco pegado.
      toast.success(`${nombreMedioPago(medioEditando)} guardado.`);
      salirEdicionFila();
      router.refresh();
    });
  };

  const quitarMedio = (m: MetodoPagoGuardado) => {
    const parsed = guardarPayload(sinMedio(settings.metodosPago, m));
    if (!parsed.success) {
      // El botón ya está deshabilitado cuando queda uno solo (§ abajo), así que esta rama es
      // sólo la red: nunca falla en silencio si de todos modos llega acá.
      setErrorServidor(parsed.error.issues[0]?.message ?? 'No se pudo quitar.');
      return Promise.resolve();
    }
    return guardaQuitar.ejecutar(async () => {
      const res = await fetch('/api/site-settings', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(parsed.data),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(data?.error ?? 'No se pudo quitar el método.');
        return;
      }
      toast.success(`${nombreMedioPago(m)} quitado.`);
      setConfirmarQuitar(null);
      salirEdicionFila();
      router.refresh();
    });
  };

  const onQuitarFilaClick = () => {
    if (!medioEditando || settings.metodosPago.length <= 1) return;
    if (medioTieneDatos(medioEditando)) { setConfirmarQuitar(medioEditando); return; }
    quitarMedio(medioEditando);
  };

  // ─── «Agregar medio» ─────────────────────────────────────────────────────────────────────────
  const [sheetAbierto, setSheetAbierto]     = useState(false);
  const [agregarTipo, setAgregarTipo]       = useState<MetodoPagoTipo | null>(null);
  const [valoresAgregar, setValoresAgregar] = useState<MetodoPagoDatos>({});
  const [errorAgregar, setErrorAgregar]     = useState<string | null>(null);
  const guardaAgregar = useAccionGuardada();

  const cerrarSheet = () => {
    setSheetAbierto(false);
    setAgregarTipo(null);
    setValoresAgregar({});
    setErrorAgregar(null);
  };
  const descarteAgregar = useDescarteDeDrawer({ enVuelo: guardaAgregar.enVuelo, onCerrar: cerrarSheet });

  const suciaAgregar = agregarTipo !== null && Object.values(valoresAgregar).some(v => v.trim().length > 0);
  useEffect(() => { descarteAgregar.marcarCambios(suciaAgregar); }, [suciaAgregar, descarteAgregar]);

  const abrirSheet = () => {
    if (editandoClave !== null) return;
    setSheetAbierto(true);
    setAgregarTipo(null);
    setValoresAgregar({});
    setErrorAgregar(null);
  };

  // «+ Otra cuenta» (§ PAGOS-VARIAS-CUENTAS-1) — la MISMA hoja que «Agregar medio», pero entra
  // directo al formulario de `transferencia` (sin pasar por `ListaTiposAgregar`, donde ya
  // aparecería marcada "Ya lo tienes"): es la puerta para una cuenta ADICIONAL, no la primera.
  const abrirAgregarCuenta = () => {
    if (editandoClave !== null) return;
    setSheetAbierto(true);
    setAgregarTipo('transferencia');
    setValoresAgregar({});
    setErrorAgregar(null);
  };

  const elegirTipoAgregar = (tipo: MetodoPagoTipo) => {
    setAgregarTipo(tipo);
    setValoresAgregar({});
    setErrorAgregar(null);
  };

  const setValorAgregar = (campo: string, valor: string) => {
    setValoresAgregar(v => ({ ...v, [campo]: valor }));
  };

  const confirmarAgregar = () => {
    if (!agregarTipo) return;
    setErrorAgregar(null);

    // `claveOriginal: null` — «Agregar medio»/«+ Otra cuenta» siempre crean una entrada NUEVA,
    // nunca reemplazan una existente (eso es lo que hace `guardarFila`, arriba).
    const parsed = guardarPayload(conMedio(settings.metodosPago, agregarTipo, valoresAgregar, null));
    if (!parsed.success) {
      const { propios, errorAjeno } = repartirErroresBloque(
        parsed.error.issues,
        campo => (campo === 'metodosPago' ? campo : null),
      );
      setErrorAgregar(propios.metodosPago ?? errorAjeno ?? 'No se pudo agregar.');
      return;
    }

    guardaAgregar.ejecutar(async () => {
      const res = await fetch('/api/site-settings', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(parsed.data),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setErrorAgregar(data?.error ?? 'No se pudo agregar. Intenta de nuevo.');
        return;
      }
      toast.success(`${nombreMedioPago({ tipo: agregarTipo, datos: valoresAgregar })} agregado.`);
      descarteAgregar.marcarCambios(false);
      cerrarSheet();
      router.refresh();
    });
  };

  // ─── La fuente de la vista previa — lo guardado, salvo que haya una edición en vuelo ──────────
  const metodosParaVista: MetodoPagoGuardado[] = (editandoClave && medioEditando)
    ? conMedio(settings.metodosPago, medioEditando.tipo, valoresFila, editandoClave)
    : (sheetAbierto && agregarTipo)
      ? conMedio(settings.metodosPago, agregarTipo, valoresAgregar, null)
      : settings.metodosPago;

  const vistaMetodos = vistaClienteMetodos(metodosParaVista);
  const pasarelaConectada    = cuentaPasarela.tipo === 'ok';
  const metodosOtrosPasarela = pasarelaConectada
    ? metodosPasarelaParaComprador(guardadoDeCuenta(), cuentaPasarela.metodos).map(d => d.tipo)
    : [];
  const pasarelaOfrecidaEnVista = pasarelaDisponibleEnEsteDespliegue() && pasarelaConectada;
  const opcionPasarela = pasarelaOfrecidaEnVista ? vistaClientePasarela(metodosOtrosPasarela) : null;

  const filas       = filasMediosPago(settings.metodosPago);
  const faltantes   = METODOS_PAGO_ORDEN.filter(t => !settings.metodosPago.some(m => m.tipo === t));
  const algoEnVuelo = guardaFila.enVuelo || guardaQuitar.enVuelo || guardaAgregar.enVuelo || guardaPasarela.enVuelo;
  const conexion    = estadoConexion(cuentaPasarela.tipo);
  const chipsDePasarela: ChipPasarela[] = cuentaPasarela.tipo === 'ok'
    ? chipsPasarela(paraElPanel(cruzarMetodosPasarela(guardadoDeCuenta(), cuentaPasarela.metodos)))
    : [];

  return (
    <div className="admin-medios-layout">
      <div className="admin-medios-main">
        <div className="duna-card duna-card__pad">
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--duna-space-4)', flexWrap: 'wrap' }}>
            <div style={{ minWidth: 0 }}>
              <h2 className="duna-title">Cómo te pueden pagar</h2>
              <p className="duna-sub" style={{ marginTop: '3px' }}>Tu cliente los ve en este orden.</p>
            </div>
            <button
              type="button"
              className="duna-btn duna-btn--secondary duna-btn--sm"
              onClick={abrirSheet}
              disabled={editandoClave !== null || algoEnVuelo}
            >
              <Plus /> Agregar medio
            </button>
          </div>

          {errorServidor && (
            <p className="duna-field__error" role="alert" style={{ marginTop: 'var(--duna-space-3)' }}>{errorServidor}</p>
          )}

          <div style={{ marginTop: 'var(--duna-space-4)' }}>
            {filas.map((fila, i) => {
              // «+ Otra cuenta» (§ PAGOS-VARIAS-CUENTAS-1) va después de la ÚLTIMA fila de
              // transferencia — el negocio puede tener varias cuentas, y ésta es la puerta para
              // agregar una más (distinta de «Agregar medio», que ofrece los OTROS tipos).
              const esUltimaTransferencia = fila.tipo === 'transferencia'
                && !filas.slice(i + 1).some(f => f.tipo === 'transferencia');
              return (
                <div className="admin-medio-fila" key={fila.clave}>
                  {editandoClave === fila.clave ? (
                    <EdicionFila
                      fila={fila}
                      valores={valoresFila}
                      setValor={setValorFila}
                      error={errorFila}
                      enVuelo={guardaFila.enVuelo || guardaQuitar.enVuelo}
                      puedeQuitar={settings.metodosPago.length > 1}
                      onGuardar={guardarFila}
                      onCancelar={descarteFila.intentarCerrar}
                      onQuitar={onQuitarFilaClick}
                    />
                  ) : (
                    <LecturaFila
                      fila={fila}
                      onEditar={() => abrirEdicionFila(fila)}
                      disabled={(editandoClave !== null) || sheetAbierto || algoEnVuelo}
                    />
                  )}
                  {esUltimaTransferencia && editandoClave === null && (
                    <button
                      type="button"
                      className="duna-btn duna-btn--ghost duna-btn--sm"
                      style={{ marginTop: 'var(--duna-space-2)' }}
                      onClick={abrirAgregarCuenta}
                      disabled={sheetAbierto || algoEnVuelo}
                    >
                      <Plus /> Otra cuenta
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {pasarelaDisponibleEnEsteDespliegue() && (
          <div className="duna-card duna-card__pad">
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--duna-space-3)', flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0 }}>
                <h2 className="duna-title">Pago en línea</h2>
                <p className="duna-sub" style={{ marginTop: '3px' }}>
                  Con Wompi tu cliente paga sin salir de la tienda y el pedido queda pagado solo.
                </p>
              </div>
              <span className={`duna-badge ${conexion.clase}`} style={{ flexShrink: 0 }}>
                <span className="duna-badge__dot" />{conexion.label}
              </span>
            </div>

            {errorPasarela && (
              <p className="duna-field__error" role="alert" style={{ marginTop: 'var(--duna-space-3)' }}>{errorPasarela}</p>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--duna-space-2)', marginTop: 'var(--duna-space-4)' }}>
              {cuentaPasarela.tipo === 'ok' ? (
                chipsDePasarela.length === 0 ? (
                  <p className="duna-body" style={{ margin: 0, color: 'var(--duna-muted)' }}>
                    Tu cuenta de pasarela no tiene métodos habilitados.
                  </p>
                ) : (
                  chipsDePasarela.map(chip => (
                    <button
                      key={chip.tipo}
                      type="button"
                      className={`admin-gw-chip${chip.on ? ' is-on' : ''}${chip.rancio ? ' is-rancio' : ''}`}
                      aria-pressed={chip.interactivo ? chip.on : undefined}
                      disabled={!chip.interactivo || editandoTipo !== null || sheetAbierto || algoEnVuelo}
                      title={chip.titulo}
                      onClick={() => alternarMetodoPasarela(chip.tipo, !chip.on)}
                    >
                      {chip.nombre}
                    </button>
                  ))
                )
              ) : cuentaPasarela.tipo === 'error' ? (
                guardadoDeCuenta().length === 0 ? (
                  <p className="duna-body" style={{ margin: 0, color: 'var(--duna-muted)' }}>
                    No ofreces ningún método de pasarela todavía.
                  </p>
                ) : (
                  guardadoDeCuenta().map(tipo => (
                    <span
                      key={tipo}
                      className="admin-gw-chip is-on"
                      style={{ cursor: 'default', pointerEvents: 'none' }}
                    >
                      {nombreVisiblePasarela(tipo)}
                    </span>
                  ))
                )
              ) : (
                <p className="duna-field__hint" style={{ margin: 0, fontStyle: 'italic' }}>
                  Consultando tu cuenta de pasarela…
                </p>
              )}
            </div>

            {cuentaPasarela.tipo === 'error' && (
              <p className="duna-field__hint" style={{ marginTop: 'var(--duna-space-3)' }}>
                No pudimos consultar tu cuenta de pasarela ahora mismo. Se muestra lo que ya
                tenías guardado; no puedes hacer cambios aquí hasta poder leerla de nuevo.
              </p>
            )}

            <div style={{
              display: 'flex', alignItems: 'center', gap: 'var(--duna-space-3)', flexWrap: 'wrap',
              marginTop: 'var(--duna-space-4)', paddingTop: 'var(--duna-space-4)', borderTop: '1px solid var(--duna-border)',
            }}>
              <p className="duna-field__hint" style={{ margin: 0, flex: '1 1 240px' }}>
                Wompi cobra su comisión en cada pago. Los medios se activan desde tu cuenta de Wompi.
              </p>
              <a
                href={URL_WOMPI}
                target="_blank"
                rel="noopener noreferrer"
                className="duna-btn duna-btn--ghost duna-btn--sm"
              >
                Abrir Wompi <ExternalLink />
              </a>
            </div>
          </div>
        )}
      </div>

      <aside className="admin-medios-preview duna-card duna-card__pad">
        <p className="duna-eyebrow" style={{ margin: 0 }}>Así lo ve tu cliente</p>
        <p className="duna-title" style={{ marginTop: 'var(--duna-space-2)', fontSize: 'var(--duna-text-heading)' }}>
          ¿Cómo quieres pagar?
        </p>

        {vistaMetodos.length === 0 && !opcionPasarela ? (
          <p className="duna-body" style={{ color: 'var(--duna-muted)' }}>
            Con esta configuración tu cliente no vería ningún método de pago.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--duna-space-2)', marginTop: 'var(--duna-space-3)' }}>
            {opcionPasarela && (
              <div className="admin-ck-opcion">
                <p className="duna-field__label" style={{ margin: 0 }}>{opcionPasarela.label}</p>
                <p className="duna-field__hint" style={{ margin: 0 }}>{opcionPasarela.desc}</p>
              </div>
            )}
            {vistaMetodos.map(op => (
              <div className="admin-ck-opcion" key={op.id}>
                <p className="duna-field__label" style={{ margin: 0 }}>{op.label}</p>
                <p className="duna-field__hint" style={{ margin: 0 }}>{op.desc}</p>
                {op.cuentas && (
                  <ul style={{ margin: 'var(--duna-space-2) 0 0', paddingLeft: '1.1em' }}>
                    {op.cuentas.map((cuenta, i) => (
                      <li key={i} className="duna-field__hint" style={{ margin: 0 }}>{cuenta}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}

        <p className="duna-field__hint" style={{ marginTop: 'var(--duna-space-4)' }}>
          Se actualiza mientras editas. Lo que falta configurar no aparece.
        </p>
      </aside>

      <DunaSheet
        abierto={sheetAbierto}
        onCerrar={descarteAgregar.intentarCerrar}
        anclaje="lado"
        titulo="Agregar un medio de pago"
        descripcion="Elige qué medio agregar a tu checkout. Los que ya tienes aparecen marcados."
      >
        <div className="duna-modal__head">
          <div className="duna-title">
            {agregarTipo ? `Agregar ${labelMetodo(agregarTipo)}` : 'Agregar un medio de pago'}
          </div>
        </div>
        {sheetAbierto && (
          agregarTipo ? (
            <FormularioAgregar
              tipo={agregarTipo}
              valores={valoresAgregar}
              setValor={setValorAgregar}
              error={errorAgregar}
              enVuelo={guardaAgregar.enVuelo}
              onVolver={() => { setAgregarTipo(null); setValoresAgregar({}); setErrorAgregar(null); }}
              onConfirmar={confirmarAgregar}
              onCancelar={descarteAgregar.intentarCerrar}
            />
          ) : (
            <ListaTiposAgregar
              yaTiene={METODOS_PAGO_ORDEN.filter(t => !faltantes.includes(t))}
              onElegir={elegirTipoAgregar}
              onCancelar={descarteAgregar.intentarCerrar}
            />
          )
        )}
      </DunaSheet>

      <ConfirmDescartarDialog
        abierto={descarteFila.confirmando}
        onDescartar={descarteFila.descartar}
        onSeguir={descarteFila.seguirEditando}
      />
      <ConfirmDescartarDialog
        abierto={descarteAgregar.confirmando}
        onDescartar={descarteAgregar.descartar}
        onSeguir={descarteAgregar.seguirEditando}
      />

      <ConfirmDeleteDialog
        open={!!confirmarQuitar}
        onOpenChange={(o) => { if (!o) setConfirmarQuitar(null); }}
        title={confirmarQuitar ? `Quitar ${nombreMedioPago(confirmarQuitar)}` : 'Quitar método de pago'}
        entityLabel={confirmarQuitar ? nombreMedioPago(confirmarQuitar) : ''}
        consequence="Se borran sus datos y deja de aparecer en tu checkout. Si lo vuelves a agregar, tienes que escribirlos otra vez."
        confirmLabel={confirmarQuitar ? `Quitar ${nombreMedioPago(confirmarQuitar)}` : 'Quitar'}
        busyLabel="Quitando…"
        onConfirm={async () => { if (confirmarQuitar) await quitarMedio(confirmarQuitar); }}
      />
    </div>
  );
}

// ─── La fila, en LECTURA ───────────────────────────────────────────────────────────────────────

function LecturaFila({ fila, onEditar, disabled }: {
  fila:     FilaMedioPago;
  onEditar: () => void;
  disabled: boolean;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--duna-space-3)' }}>
      <span className="admin-medio-chip" aria-hidden="true">{fila.iniciales}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p className="duna-field__label" style={{ margin: 0 }}>{fila.nombre}</p>
        <p className="admin-pagos-dato admin-pagos-dato--regla" style={{ marginTop: '2px' }}>
          {fila.datoClave ?? <span style={{ color: 'var(--duna-muted)' }}>Sin definir</span>}
        </p>
        {!fila.activo && fila.faltante && (
          <p className="duna-field__hint" style={{ margin: '2px 0 0', color: 'var(--duna-sol-ink)' }}>
            {fila.faltante}.
          </p>
        )}
      </div>
      <span className={`duna-badge ${fila.activo ? 'duna-badge--ok' : 'duna-badge--attention'}`} style={{ flexShrink: 0 }}>
        <span className="duna-badge__dot" />{fila.activo ? 'Activo' : 'Falta configurar'}
      </span>
      <button
        type="button"
        className="duna-btn duna-btn--ghost duna-btn--sm"
        style={{ flexShrink: 0 }}
        onClick={onEditar}
        disabled={disabled}
        aria-label={`Editar ${fila.nombre}`}
      >
        Editar
      </button>
    </div>
  );
}

// ─── La fila, en EDICIÓN — sólo ESTA fila, nunca el array entero ───────────────────────────────

function EdicionFila({ fila, valores, setValor, error, enVuelo, puedeQuitar, onGuardar, onCancelar, onQuitar }: {
  fila:        FilaMedioPago;
  valores:     MetodoPagoDatos;
  setValor:    (campo: string, valor: string) => void;
  error:       string | null;
  enVuelo:     boolean;
  puedeQuitar: boolean;
  onGuardar:   () => void;
  onCancelar:  () => void;
  onQuitar:    () => void;
}) {
  const campos = CAMPOS_METODO[fila.tipo];
  const esEfectivo = fila.tipo === 'efectivo';

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--duna-space-3)', marginBottom: 'var(--duna-space-3)' }}>
        <span className="admin-medio-chip" aria-hidden="true">{fila.iniciales}</span>
        <p className="duna-field__label" style={{ margin: 0, flex: 1 }}>{fila.nombre}</p>
      </div>

      {error && <p className="duna-field__error" style={{ marginBottom: 'var(--duna-space-3)' }}>{error}</p>}

      {esEfectivo ? (
        <p className="admin-pagos-dato admin-pagos-dato--regla">{NOTA_CONTRAENTREGA}</p>
      ) : (
        <div className="duna-form duna-form--sm">
          {campos.map(c => {
            const id = `pago-${fila.tipo}-${c.name}`;
            const esTipoCuenta = fila.tipo === 'transferencia' && c.name === 'tipoCuenta';
            return (
              <div className="duna-field" key={c.name}>
                <label className="duna-field__label" htmlFor={id}>{c.label}</label>
                {esTipoCuenta ? (
                  <select
                    id={id}
                    className="duna-input duna-select duna-input--sm"
                    value={valores[c.name] ?? ''}
                    onChange={e => setValor(c.name, e.target.value)}
                    disabled={enVuelo}
                  >
                    <option value="">—</option>
                    <option value="Ahorros">Ahorros</option>
                    <option value="Corriente">Corriente</option>
                  </select>
                ) : (
                  <input
                    id={id}
                    className="duna-input duna-input--sm"
                    value={valores[c.name] ?? ''}
                    onChange={e => setValor(c.name, e.target.value)}
                    disabled={enVuelo}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      <div style={{
        display: 'flex', alignItems: 'center', gap: 'var(--duna-space-3)',
        marginTop: 'var(--duna-space-4)', flexWrap: 'wrap',
      }}>
        <button
          type="button"
          className="duna-btn duna-btn--ghost duna-btn--sm"
          onClick={onQuitar}
          disabled={enVuelo || !puedeQuitar}
          title={puedeQuitar ? undefined : 'No puedes quitar el último medio de pago. Agrega otro primero.'}
        >
          Quitar este medio
        </button>
        <span style={{ flex: 1 }} />
        <button type="button" className="duna-btn duna-btn--ghost duna-btn--sm" onClick={onCancelar} disabled={enVuelo}>
          Cancelar
        </button>
        <button type="button" className="duna-btn duna-btn--primary duna-btn--sm" onClick={onGuardar} disabled={enVuelo}>
          {enVuelo ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
      {!puedeQuitar && (
        <p className="duna-field__hint" style={{ marginTop: 'var(--duna-space-2)' }}>
          No puedes quitar el último medio de pago. Agrega otro primero.
        </p>
      )}
    </div>
  );
}

// ─── «Agregar medio» — paso 1: la lista de tipos ───────────────────────────────────────────────

function ListaTiposAgregar({ yaTiene, onElegir, onCancelar }: {
  yaTiene:    MetodoPagoTipo[];
  onElegir:   (tipo: MetodoPagoTipo) => void;
  onCancelar: () => void;
}) {
  return (
    <>
      <div className="duna-modal__body" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 'var(--duna-space-3)' }}>
        {METODOS_PAGO_ORDEN.map(tipo => {
          const tiene = yaTiene.includes(tipo);
          return (
            <button
              key={tipo}
              type="button"
              className="admin-ck-opcion"
              onClick={() => { if (!tiene) onElegir(tipo); }}
              disabled={tiene}
              style={{ cursor: tiene ? 'default' : 'pointer', opacity: tiene ? 0.6 : 1 }}
            >
              <p className="duna-field__label" style={{ margin: 0 }}>{labelMetodo(tipo)}</p>
              <p className="duna-field__hint" style={{ margin: '2px 0 0' }}>{PIDE_METODO[tipo]}</p>
              <p className="duna-field__hint" style={{ margin: '4px 0 0', fontWeight: 'var(--duna-w-semi)' }}>
                {tiene ? 'Ya lo tienes' : 'Agregar'}
              </p>
            </button>
          );
        })}
      </div>
      <div className="duna-modal__foot">
        <div className="duna-modal__acciones">
          <button type="button" className="duna-btn duna-btn--ghost" onClick={onCancelar}>Cancelar</button>
        </div>
      </div>
    </>
  );
}

// ─── «Agregar medio» — paso 2: los campos del tipo elegido ─────────────────────────────────────

function FormularioAgregar({ tipo, valores, setValor, error, enVuelo, onVolver, onConfirmar, onCancelar }: {
  tipo:        MetodoPagoTipo;
  valores:     MetodoPagoDatos;
  setValor:    (campo: string, valor: string) => void;
  error:       string | null;
  enVuelo:     boolean;
  onVolver:    () => void;
  onConfirmar: () => void;
  onCancelar:  () => void;
}) {
  const campos = CAMPOS_METODO[tipo];
  const esEfectivo = tipo === 'efectivo';

  return (
    <>
      <div className="duna-modal__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--duna-space-4)' }}>
        <button type="button" className="duna-btn duna-btn--ghost duna-btn--sm" style={{ alignSelf: 'flex-start' }} onClick={onVolver} disabled={enVuelo}>
          ← Elegir otro tipo
        </button>

        {error && <p className="duna-field__error">{error}</p>}

        {esEfectivo ? (
          <p className="admin-pagos-dato admin-pagos-dato--regla">{NOTA_CONTRAENTREGA}</p>
        ) : (
          <div className="duna-form duna-form--sm">
            {campos.map(c => {
              const id = `agregar-${tipo}-${c.name}`;
              const esTipoCuenta = tipo === 'transferencia' && c.name === 'tipoCuenta';
              return (
                <div className="duna-field" key={c.name}>
                  <label className="duna-field__label" htmlFor={id}>{c.label}</label>
                  {esTipoCuenta ? (
                    <select
                      id={id}
                      className="duna-input duna-select duna-input--sm"
                      value={valores[c.name] ?? ''}
                      onChange={e => setValor(c.name, e.target.value)}
                      disabled={enVuelo}
                    >
                      <option value="">—</option>
                      <option value="Ahorros">Ahorros</option>
                      <option value="Corriente">Corriente</option>
                    </select>
                  ) : (
                    <input
                      id={id}
                      className="duna-input duna-input--sm"
                      value={valores[c.name] ?? ''}
                      onChange={e => setValor(c.name, e.target.value)}
                      disabled={enVuelo}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div className="duna-modal__foot">
        <div className="duna-modal__acciones">
          <button type="button" className="duna-btn duna-btn--ghost" onClick={onCancelar} disabled={enVuelo}>Cancelar</button>
          <button type="button" className="duna-btn duna-btn--primary" onClick={onConfirmar} disabled={enVuelo}>
            {enVuelo ? 'Agregando…' : 'Agregar y activar'}
          </button>
        </div>
      </div>
    </>
  );
}
