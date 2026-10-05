'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Trash2, Plus } from 'lucide-react';
import { useSiteSettings } from '@/components/admin/SiteSettingsProvider';
import { siteSettingsEditableSchema } from '@/lib/config/site-settings-schema';
import { payloadBaseDesdeSettings, repartirErroresBloque } from '@/lib/admin/configuracion-partes';
import {
  METODOS_PAGO_ORDEN, CAMPOS_METODO, labelMetodo, metodoIncompleto,
  type MetodoPagoTipo, type MetodoPagoGuardado,
} from '@/lib/checkout/metodos-pago';
import { pasarelaDisponibleEnEsteDespliegue } from '@/services/checkout.service';
import {
  cruzarMetodosPasarela, paraElPanel, type MetodoPasarelaCruzado, type EstadoMetodoPasarela,
} from '@/lib/pagos/metodos-pasarela';
import { useAccionGuardada } from '@/hooks/useAccionGuardada';
import { useDescarteDeDrawer } from '@/hooks/useDescarteDeDrawer';
import { ConfirmDescartarDialog } from '@/components/admin/ConfirmDescartarDialog';
import { ConfirmDeleteDialog } from '@/components/admin/ConfirmDeleteDialog';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { EncabezadoBloque } from './EncabezadoBloque';
import { PieFormularioBloque } from './PieFormularioBloque';
import { useCuentaPasarela, guardadoDe } from './useCuentaPasarela';

// ─── Subsección «Pagos y cobros» ──────────────────────────────────────────────────────────────
//
// MOVIDO TAL CUAL desde `DatosNegocioSeccion` — SIN REDISEÑO. El rediseño de esta subsección
// («Cómo te pueden pagar», reordenar arrastrando, «Así lo ve tu cliente» en vivo) es
// `PANEL-CONFIG-PAGOS-1`, fuera de este slice (§ `docs/panel/REDISENO.md` § 3 «Configuración»:
// "Pagos y cobros (rehecho en la v2 del prototipo)"). Lo único que cambió acá es que el bloque
// Pagos+Pasarela gana SU PROPIO Editar/Cancelar/Guardar, independiente de Identidad/Contacto/
// Correos — antes los seis vivían detrás de un solo botón.

interface FormPagos {
  metodosPago:     MetodoPagoGuardado[];
  metodosPasarela: string[];
}

function desde(metodosPago: MetodoPagoGuardado[], metodosPasarela: string[]): FormPagos {
  return { metodosPago, metodosPasarela };
}

/** Los valores no vacíos de los campos de un método, unidos en UNA línea. */
function datosMetodoTexto(m: MetodoPagoGuardado): string {
  return CAMPOS_METODO[m.tipo]
    .map(c => (m.datos[c.name] ?? '').trim())
    .filter(Boolean)
    .join(' · ');
}

function metodoTieneDatos(m: MetodoPagoGuardado): boolean {
  return datosMetodoTexto(m).length > 0;
}

function enOrdenCanonico(metodos: MetodoPagoGuardado[]): MetodoPagoGuardado[] {
  return METODOS_PAGO_ORDEN
    .map(t => metodos.find(m => m.tipo === t))
    .filter((m): m is MetodoPagoGuardado => m !== undefined);
}

const GRUPOS_PAGO: { titulo: string; nota: string; tipos: MetodoPagoTipo[] }[] = [
  { titulo: 'Pagan antes',      nota: 'El cliente envía la plata y su comprobante',       tipos: ['nequi', 'daviplata', 'breb', 'transferencia'] },
  { titulo: 'Pagan al recibir', nota: 'Cambia la ruta del dinero, no sólo la instrucción', tipos: ['efectivo'] },
];

const PIDE_METODO: Record<MetodoPagoTipo, string> = {
  nequi:         'El número donde recibes',
  daviplata:     'El número donde recibes',
  breb:          'Tu llave',
  transferencia: 'Banco, tipo y número de cuenta',
  efectivo:      'Nada que configurar',
};

const NOTA_CONTRAENTREGA = 'Solo Bogotá · el cliente paga al recibir, la orden nace contraentrega.';

const EXPLICACION_NO_ENCENDIBLE: Record<
  Exclude<EstadoMetodoPasarela, 'disponible' | 'disponible_no_ofrecido'>,
  { titulo: string; detalle?: string }
> = {
  guardado_no_disponible: { titulo: 'Ya no está disponible en tu cuenta.' },
  no_implementado:        { titulo: 'Disponible pronto' },
  no_cobrable:            { titulo: 'Es una etiqueta agregadora del proveedor, no un método propio' },
};

function esEncendible(estado: EstadoMetodoPasarela): estado is 'disponible' | 'disponible_no_ofrecido' {
  return estado === 'disponible' || estado === 'disponible_no_ofrecido';
}

function renderPasarelaSoloLectura(guardado: string[]) {
  if (guardado.length === 0) {
    return <p className="duna-body" style={{ margin: 0, color: 'var(--duna-muted)' }}>No ofreces ningún método de pasarela.</p>;
  }
  return (
    <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
      {guardado.map(tipo => <li key={tipo} className="duna-body">{tipo}</li>)}
    </ul>
  );
}

function renderPasarelaCruzada(
  cruzado: MetodoPasarelaCruzado[],
  guardado: string[],
  onToggle: (tipo: string, prender: boolean) => void,
  onQuitarNoEncendible: (tipo: string) => void,
) {
  if (cruzado.length === 0) {
    return <p className="duna-body" style={{ margin: 0, color: 'var(--duna-muted)' }}>Tu cuenta de pasarela no tiene métodos habilitados.</p>;
  }
  return (
    <div className="duna-form duna-form--sm" style={{ gap: 'var(--duna-space-2)' }}>
      {cruzado.map(c => (
        <div
          key={c.tipo}
          className="admin-pagos-fila"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--duna-space-3)' }}
        >
          {esEncendible(c.estado) ? (
            <label className="duna-check" style={{ display: 'flex', alignItems: 'center', gap: 'var(--duna-space-2)' }}>
              <input
                type="checkbox"
                className="duna-check__box"
                checked={c.estado === 'disponible'}
                onChange={e => onToggle(c.tipo, e.target.checked)}
              />
              <span className="duna-field__label">{c.tipo}</span>
            </label>
          ) : (
            <>
              <div style={{ minWidth: 0 }}>
                <span className="duna-field__label">{c.tipo}</span>
                <p className="duna-field__hint" style={{ margin: 0 }}>{EXPLICACION_NO_ENCENDIBLE[c.estado].titulo}</p>
                {EXPLICACION_NO_ENCENDIBLE[c.estado].detalle && (
                  <p className="duna-field__hint" style={{ margin: 0 }}>{EXPLICACION_NO_ENCENDIBLE[c.estado].detalle}</p>
                )}
              </div>
              {guardado.includes(c.tipo) && (
                <button
                  type="button"
                  className="duna-btn duna-btn--ghost duna-btn--sm"
                  onClick={() => onQuitarNoEncendible(c.tipo)}
                >
                  Quitar
                </button>
              )}
            </>
          )}
        </div>
      ))}
    </div>
  );
}

function renderGruposPago(metodos: MetodoPagoGuardado[], renderFila: (m: MetodoPagoGuardado) => React.ReactNode) {
  if (metodos.length === 0) {
    return (
      <div className="admin-pagos-vacio">
        <p className="duna-body" style={{ margin: 0, color: 'var(--duna-ink-2)' }}>
          No ofreces ningún método de pago · Tu checkout no puede cobrar hasta que agregues al
          menos uno.
        </p>
      </div>
    );
  }
  const ordenado = enOrdenCanonico(metodos);
  return GRUPOS_PAGO.map(grupo => {
    const enGrupo = ordenado.filter(m => grupo.tipos.includes(m.tipo));
    if (enGrupo.length === 0) return null;
    return (
      <div className="admin-pagos-grupo" key={grupo.titulo}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--duna-space-2)', flexWrap: 'wrap', marginBottom: 'var(--duna-space-2)' }}>
          <span className="duna-field__label">{grupo.titulo}</span>
          <span className="duna-field__hint">{grupo.nota}</span>
        </div>
        {enGrupo.map(renderFila)}
      </div>
    );
  });
}

function renderFilaMetodoLectura(m: MetodoPagoGuardado) {
  const falta = metodoIncompleto(m);
  const esEfectivo = m.tipo === 'efectivo';
  const datos = datosMetodoTexto(m);
  return (
    <div className="admin-pagos-fila" key={m.tipo}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--duna-space-3)' }}>
        <div style={{ minWidth: 0 }}>
          <p className="duna-field__label" style={{ margin: 0 }}>{labelMetodo(m.tipo)}</p>
          {esEfectivo ? (
            <p className="admin-pagos-dato admin-pagos-dato--regla" style={{ marginTop: 'var(--duna-space-1)' }}>{NOTA_CONTRAENTREGA}</p>
          ) : datos ? (
            <p className="admin-pagos-dato" style={{ marginTop: 'var(--duna-space-1)' }}>{datos}</p>
          ) : (
            <p className="duna-body" style={{ margin: 'var(--duna-space-1) 0 0', color: 'var(--duna-muted)' }}>Sin definir</p>
          )}
          {falta && (
            <p style={{
              margin: 'var(--duna-space-1) 0 0', fontSize: 'var(--duna-text-caption)',
              fontWeight: 'var(--duna-w-semi)', color: 'var(--duna-sol-ink)',
            }}>
              No se muestra en la tienda hasta que lo completes.
            </p>
          )}
        </div>
        {falta && (
          <span className="duna-badge duna-badge--attention" style={{ flexShrink: 0 }}>
            <span className="duna-badge__dot" />{falta}
          </span>
        )}
      </div>
    </div>
  );
}

function renderFilaMetodoEdicion(
  m: MetodoPagoGuardado,
  onQuitarClick: (m: MetodoPagoGuardado) => void,
  setDatoMetodo: (tipo: MetodoPagoTipo, campo: string, valor: string) => void,
) {
  const falta = metodoIncompleto(m);
  const esEfectivo = m.tipo === 'efectivo';
  const campos = CAMPOS_METODO[m.tipo];
  return (
    <div className="admin-pagos-fila" key={m.tipo}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--duna-space-3)' }}>
        <span className="duna-field__label" style={{ margin: 0 }}>{labelMetodo(m.tipo)}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--duna-space-2)', flexShrink: 0 }}>
          {falta && (
            <span className="duna-badge duna-badge--attention">
              <span className="duna-badge__dot" />{falta}
            </span>
          )}
          <button
            type="button"
            className="duna-btn duna-btn--ghost duna-btn--sm"
            aria-label={`Quitar ${labelMetodo(m.tipo)}`}
            onClick={() => onQuitarClick(m)}
          >
            <Trash2 />
          </button>
        </div>
      </div>
      {esEfectivo ? (
        <p className="admin-pagos-dato admin-pagos-dato--regla" style={{ marginTop: 'var(--duna-space-2)' }}>{NOTA_CONTRAENTREGA}</p>
      ) : campos.length > 0 && (
        <div className="duna-form duna-form--sm" style={{ marginTop: 'var(--duna-space-3)' }}>
          {campos.map(c => {
            const id = `met-${m.tipo}-${c.name}`;
            const esTipoCuenta = m.tipo === 'transferencia' && c.name === 'tipoCuenta';
            return (
              <div className="duna-field" key={c.name}>
                <label className="duna-field__label" htmlFor={id}>{c.label}</label>
                {esTipoCuenta ? (
                  <select
                    id={id}
                    className="duna-input duna-select duna-input--sm"
                    value={m.datos[c.name] ?? ''}
                    onChange={e => setDatoMetodo(m.tipo, c.name, e.target.value)}
                  >
                    <option value="">—</option>
                    <option value="Ahorros">Ahorros</option>
                    <option value="Corriente">Corriente</option>
                  </select>
                ) : (
                  <input
                    id={id}
                    className="duna-input duna-input--sm"
                    value={m.datos[c.name] ?? ''}
                    onChange={e => setDatoMetodo(m.tipo, c.name, e.target.value)}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function PagosCobrosBloque() {
  const settings = useSiteSettings();
  const router   = useRouter();
  const guarda   = useAccionGuardada();

  // Acá la cuenta de pasarela SÍ es editable, a diferencia de los otros tres bloques (que sólo
  // la reenvían sin tocar vía `payloadBaseDesdeSettings`) — por eso además de leer el hook
  // COMPARTIDO (mismo fetch, sin duplicarlo) este bloque usa su `setEstado` para reflejar lo
  // recién guardado sin un segundo viaje de red.
  const { estado: cuentaPasarela, setEstado: setCuentaPasarela } = useCuentaPasarela();

  const guardadoDeCuenta = () => guardadoDe(cuentaPasarela);

  const [editando, setEditando]           = useState(false);
  const [form, setForm]                   = useState<FormPagos>(() => desde(settings.metodosPago, []));
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  const [errorMetodos, setErrorMetodos]   = useState<string | undefined>();
  const [errorPasarela, setErrorPasarela] = useState<string | undefined>();
  const [confirmarQuitar, setConfirmarQuitar] = useState<MetodoPagoGuardado | null>(null);

  const salirDeEdicion = () => { setEditando(false); setErrorServidor(null); setErrorMetodos(undefined); setErrorPasarela(undefined); };
  const descarte = useDescarteDeDrawer({ enVuelo: guarda.enVuelo, onCerrar: salirDeEdicion });

  const actual = desde(settings.metodosPago, guardadoDeCuenta());
  const sucio  = editando && JSON.stringify(form) !== JSON.stringify(actual);
  useEffect(() => { descarte.marcarCambios(sucio); }, [sucio, descarte]);

  const abrirEdicion = () => {
    setForm(desde(settings.metodosPago, guardadoDeCuenta()));
    setErrorServidor(null);
    setErrorMetodos(undefined);
    setErrorPasarela(undefined);
    setEditando(true);
  };

  const toggleMetodoPasarela = (tipo: string, prender: boolean) => {
    setForm(f => ({
      ...f,
      metodosPasarela: prender
        ? [...f.metodosPasarela, tipo]
        : f.metodosPasarela.filter(t => t !== tipo),
    }));
  };

  const quitarPasarelaNoEncendible = (tipo: string) => {
    setForm(f => ({ ...f, metodosPasarela: f.metodosPasarela.filter(t => t !== tipo) }));
    toast.success(`${tipo} quitado.`, {
      action: {
        label: 'Deshacer',
        onClick: () => setForm(f => (
          f.metodosPasarela.includes(tipo) ? f : { ...f, metodosPasarela: [...f.metodosPasarela, tipo] }
        )),
      },
    });
  };

  const faltantes = METODOS_PAGO_ORDEN.filter(t => !form.metodosPago.some(m => m.tipo === t));

  const agregarMetodo = (tipo: MetodoPagoTipo) => {
    setForm(f => ({ ...f, metodosPago: [...f.metodosPago, { tipo, datos: {} }] }));
  };

  const quitarConDeshacer = (m: MetodoPagoGuardado) => {
    setForm(f => ({ ...f, metodosPago: f.metodosPago.filter(x => x.tipo !== m.tipo) }));
    toast.success(`${labelMetodo(m.tipo)} quitado.`, {
      action: {
        label: 'Deshacer',
        onClick: () => setForm(f => (
          f.metodosPago.some(x => x.tipo === m.tipo) ? f : { ...f, metodosPago: [...f.metodosPago, m] }
        )),
      },
    });
  };

  const onQuitarClick = (m: MetodoPagoGuardado) => {
    if (metodoTieneDatos(m)) setConfirmarQuitar(m);
    else quitarConDeshacer(m);
  };

  const setDatoMetodo = (tipo: MetodoPagoTipo, campo: string, valor: string) => {
    setForm(f => ({
      ...f,
      metodosPago: f.metodosPago.map(m => (m.tipo === tipo ? { ...m, datos: { ...m.datos, [campo]: valor } } : m)),
    }));
  };

  const guardar = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorServidor(null);

    const payload = {
      ...payloadBaseDesdeSettings(settings, form.metodosPasarela),
      metodosPago: form.metodosPago,
    };

    const parsed = siteSettingsEditableSchema.safeParse(payload);
    if (!parsed.success) {
      // Un error AJENO (nombre, WhatsApp, correos…) no puede perderse en silencio — mismo
      // mecanismo que los otros tres bloques.
      const { propios, errorAjeno } = repartirErroresBloque(
        parsed.error.issues,
        campo => (campo === 'metodosPago' || campo === 'metodosPasarela' ? campo : null),
      );
      setErrorMetodos(propios.metodosPago);
      setErrorPasarela(propios.metodosPasarela);
      if (errorAjeno) setErrorServidor(errorAjeno);
      return;
    }
    setErrorMetodos(undefined);
    setErrorPasarela(undefined);

    guarda.ejecutar(async () => {
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
      toast.success('Pagos y cobros guardados.');
      setEditando(false);
      setCuentaPasarela(c => (c.tipo === 'cargando' ? c : { ...c, guardado: form.metodosPasarela }));
      router.refresh();
    });
  };

  return (
    <div className="duna-card duna-card__pad">
      <EncabezadoBloque
        titulo="Cómo te pueden pagar"
        descripcion="Los métodos que ofreces en el checkout."
        editando={editando}
        onEditar={abrirEdicion}
      />

      {editando ? (
        <form onSubmit={guardar} className="admin-bloques" style={{ marginTop: 'var(--duna-space-4)' }} noValidate>
          <div className="admin-bloque">
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--duna-space-2)', flexWrap: 'wrap', marginBottom: 'var(--duna-space-1)' }}>
              <span className="duna-eyebrow">Pagos</span>
              <span className="duna-caption">Cómo te pagan en el checkout</span>
            </div>
            <p className="duna-field__hint" style={{ marginTop: 0, marginBottom: 'var(--duna-space-3)' }}>
              Agrega los métodos que ofreces; cada uno pide sus datos aquí mismo. Un método sin sus
              datos no se muestra en la tienda.
            </p>

            {errorMetodos && (
              <p className="duna-field__error" style={{ marginBottom: 'var(--duna-space-3)' }}>{errorMetodos}</p>
            )}

            {renderGruposPago(form.metodosPago, m => renderFilaMetodoEdicion(m, onQuitarClick, setDatoMetodo))}

            <div style={{ marginTop: 'var(--duna-space-4)', paddingTop: 'var(--duna-space-4)', borderTop: '1px solid var(--duna-border)' }}>
              {faltantes.length > 0 ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button type="button" className="duna-btn duna-btn--secondary duna-btn--sm">
                      <Plus /> Agregar método de pago
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    style={{
                      background:   'var(--duna-surface)',
                      borderColor:  'var(--duna-border-2)',
                      borderRadius: 'var(--duna-r-m)',
                      boxShadow:    'var(--duna-shadow-2)',
                    }}
                  >
                    {faltantes.map(t => (
                      <DropdownMenuItem key={t} onSelect={() => agregarMetodo(t)} className="cursor-pointer">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span>{labelMetodo(t)}</span>
                          <span className="duna-field__hint">{PIDE_METODO[t]}</span>
                        </div>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <button type="button" className="duna-btn duna-btn--secondary duna-btn--sm" disabled>
                  <Plus /> Ya ofreces los cinco métodos que Duna soporta.
                </button>
              )}
            </div>
          </div>

          {pasarelaDisponibleEnEsteDespliegue() && (
            <div className="admin-bloque">
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--duna-space-2)', flexWrap: 'wrap', marginBottom: 'var(--duna-space-1)' }}>
                <span className="duna-eyebrow">Pasarela</span>
                <span className="duna-caption">Tarjeta, PSE y los demás métodos de tu cuenta de pasarela</span>
              </div>
              <p className="duna-field__hint" style={{ marginTop: 0, marginBottom: 'var(--duna-space-3)' }}>
                Leídos directo de tu cuenta — sólo puedes ofrecer lo que ella ya tiene habilitado.
              </p>

              {errorPasarela && (
                <p className="duna-field__error" style={{ marginBottom: 'var(--duna-space-3)' }}>{errorPasarela}</p>
              )}

              {cuentaPasarela.tipo === 'error' && (
                <p className="duna-field__error" role="alert" style={{ marginBottom: 'var(--duna-space-3)' }}>
                  No pudimos consultar tu cuenta de pasarela ahora mismo. Se muestra lo que ya
                  tenías guardado; no puedes hacer cambios aquí hasta poder leerla de nuevo.
                </p>
              )}
              {cuentaPasarela.tipo === 'cargando' && (
                <p className="duna-field__hint" style={{ marginBottom: 'var(--duna-space-3)', fontStyle: 'italic' }}>
                  Consultando tu cuenta de pasarela…
                </p>
              )}

              {cuentaPasarela.tipo === 'ok'
                ? renderPasarelaCruzada(
                    paraElPanel(cruzarMetodosPasarela(form.metodosPasarela, cuentaPasarela.metodos)),
                    form.metodosPasarela,
                    toggleMetodoPasarela,
                    quitarPasarelaNoEncendible,
                  )
                : renderPasarelaSoloLectura(form.metodosPasarela)}
            </div>
          )}

          <PieFormularioBloque enVuelo={guarda.enVuelo} onCancelar={descarte.intentarCerrar} errorServidor={errorServidor} />
        </form>
      ) : (
        <div className="admin-bloques" style={{ marginTop: 'var(--duna-space-4)' }}>
          <div className="admin-bloque">
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--duna-space-2)', flexWrap: 'wrap', marginBottom: 'var(--duna-space-3)' }}>
              <span className="duna-eyebrow">Pagos</span>
              <span className="duna-caption">Cómo te pagan en el checkout</span>
            </div>
            {renderGruposPago(settings.metodosPago, renderFilaMetodoLectura)}
          </div>

          {pasarelaDisponibleEnEsteDespliegue() && (
            <div className="admin-bloque">
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--duna-space-2)', flexWrap: 'wrap', marginBottom: 'var(--duna-space-1)' }}>
                <span className="duna-eyebrow">Pasarela</span>
                <span className="duna-caption">Tarjeta, PSE y los demás métodos de tu cuenta de pasarela</span>
              </div>
              <p className="duna-field__hint" style={{ marginTop: 0, marginBottom: 'var(--duna-space-3)' }}>
                Los métodos de tu cuenta de pasarela que ofreces en el checkout.
              </p>
              {renderPasarelaSoloLectura(guardadoDeCuenta())}
            </div>
          )}
        </div>
      )}

      <ConfirmDescartarDialog
        abierto={descarte.confirmando}
        onDescartar={descarte.descartar}
        onSeguir={descarte.seguirEditando}
      />

      <ConfirmDeleteDialog
        open={!!confirmarQuitar}
        onOpenChange={(o) => { if (!o) setConfirmarQuitar(null); }}
        title={confirmarQuitar ? `Quitar ${labelMetodo(confirmarQuitar.tipo)}` : 'Quitar método de pago'}
        entityLabel={confirmarQuitar ? labelMetodo(confirmarQuitar.tipo) : ''}
        consequence={confirmarQuitar
          ? `Se borran sus datos (${datosMetodoTexto(confirmarQuitar)}) y deja de aparecer en tu checkout. Si lo vuelves a agregar, tienes que escribirlos otra vez.`
          : ''}
        confirmLabel={confirmarQuitar ? `Quitar ${labelMetodo(confirmarQuitar.tipo)}` : 'Quitar'}
        busyLabel="Quitando…"
        onConfirm={async () => { if (confirmarQuitar) quitarConDeshacer(confirmarQuitar); }}
      />
    </div>
  );
}
