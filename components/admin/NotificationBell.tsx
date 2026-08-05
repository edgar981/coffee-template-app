'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, CheckCheck, Volume2, VolumeX } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Notification } from '@/types/notification';
import { AnimatedIcon } from '@/components/admin/AnimatedIcon';
import { Button } from '@/components/ui/button';
import { useAccionGuardada, useAccionesPorFila } from '@/hooks/useAccionGuardada';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { tiempoRelativo } from '@/lib/format-fecha';
import { ADMIN_ICON_BUTTON } from '@/components/admin/iconButton';
import { AUTOMATION_MAP } from '@/constants/automations';

// ─── Constantes ───────────────────────────────────────────────────────────────

/** Cadencia del polling. Se PAUSA con la pestaña oculta y se reanuda al volver. */
const POLL_MS = 45_000;

/** Preferencia de dispositivo, no de cuenta: localStorage es el lugar correcto. */
const SILENCIO_KEY = 'admin:notificaciones:silencio';

/** Regla de inmutabilidad de public/: reemplazar el sonido = nombre nuevo (-v2). */
const SONIDO_SRC = '/sounds/notificacion-v1.wav';

/** Cuántos toasts como máximo por ciclo — 12 avisos de golpe no son 12 toasts. */
const MAX_TOASTS = 3;

const DEFAULT_ICON = Bell;

// ─── Componente ───────────────────────────────────────────────────────────────

export default function NotificationBell() {
  const router                            = useRouter();
  const [open, setOpen]                   = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [now, setNow]                     = useState(() => Date.now());
  const [silencio, setSilencio]           = useState(false);
  const ref                               = useRef<HTMLDivElement>(null);

  // Ids ya vistos. `null` = todavía no hay línea base: la PRIMERA carga sólo
  // establece el estado inicial, nunca anuncia (si no, entrar al panel dispararía
  // un toast por cada notificación vieja).
  const vistosRef    = useRef<Set<string> | null>(null);
  const audioRef     = useRef<HTMLAudioElement | null>(null);
  const desbloqueado = useRef(false);
  // Espejo del silencio para que el callback del polling lea el valor actual sin
  // recrearse (y sin reiniciar el intervalo en cada toggle).
  const silencioRef  = useRef(false);

  const noLeidas = notifications.filter(n => !n.leida);
  const unread   = noLeidas.length;

  // Amber Minimal: el color es información. El rojo aparece SÓLO si algo entre lo
  // no leído es una alerta real —plata sin cobrar, stock agotado, entrega que
  // volvió—, y sale del registry (`severidad`), no de un segundo mapa aquí. Tres
  // órdenes nuevas dejan la campana en el primario: son buenas noticias.
  const hayAlerta = noLeidas.some(n => AUTOMATION_MAP[n.tipo]?.severidad === 'alerta');

  // ── Preferencia de silencio ────────────────────────────────────────────────
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- lectura de localStorage tras montar (evita mismatch de hidratación)
      setSilencio(window.localStorage.getItem(SILENCIO_KEY) === '1');
    } catch { /* Safari en modo privado: se queda con el sonido activo */ }
  }, []);

  useEffect(() => { silencioRef.current = silencio; }, [silencio]);

  const toggleSilencio = () => {
    setSilencio(prev => {
      const next = !prev;
      try { window.localStorage.setItem(SILENCIO_KEY, next ? '1' : '0'); } catch { /* no-op */ }
      return next;
    });
  };

  // ── Audio: desbloqueo silencioso en la primera interacción ─────────────────
  // Los navegadores bloquean el audio hasta que el usuario interactúa con la
  // página. El patrón estándar: al PRIMER click/tecla se reproduce el archivo en
  // mute y se rebobina — inaudible, pero deja el elemento habilitado para sonar
  // después sin gesto. Si nunca hay interacción, no hay sonido: sólo toast y badge.
  useEffect(() => {
    const el = new Audio(SONIDO_SRC);
    el.preload = 'auto';
    audioRef.current = el;

    const desbloquear = () => {
      if (desbloqueado.current) return;
      desbloqueado.current = true;
      el.muted = true;
      el.play()
        .then(() => { el.pause(); el.currentTime = 0; el.muted = false; })
        .catch(() => { el.muted = false; }); // sigue bloqueado: degradamos a toast
      quitar();
    };
    const quitar = () => {
      window.removeEventListener('pointerdown', desbloquear);
      window.removeEventListener('keydown', desbloquear);
    };

    window.addEventListener('pointerdown', desbloquear);
    window.addEventListener('keydown', desbloquear);
    return quitar;
  }, []);

  const sonar = useCallback(() => {
    const el = audioRef.current;
    if (!el || silencioRef.current || !desbloqueado.current) return;
    el.currentTime = 0;
    // Un autoplay rechazado no es un error que reportar — el badge y el toast ya
    // hicieron el trabajo.
    el.play().catch(() => {});
  }, []);

  // ── Carga + detección de novedades ─────────────────────────────────────────
  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications');
      if (!res.ok) throw new Error(`GET /api/notifications ${res.status}`);
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error(`Expected array, got ${typeof data}`);

      const lista = data as Notification[];
      setNotifications(lista);

      const ids = new Set(lista.map(n => n.id));
      const previos = vistosRef.current;
      vistosRef.current = ids;
      if (previos === null) return; // primera carga: sólo línea base

      const nuevas = lista.filter(n => !previos.has(n.id) && !n.leida);
      if (nuevas.length === 0) return;

      sonar();
      for (const n of nuevas.slice(0, MAX_TOASTS)) {
        const href = n.href;
        toast(n.titulo, {
          description: n.mensaje,
          ...(href ? { action: { label: 'Ver', onClick: () => router.push(href) } } : {}),
        });
      }
      if (nuevas.length > MAX_TOASTS) {
        toast(`${nuevas.length - MAX_TOASTS} notificaciones más`);
      }
    } catch (err) {
      console.error('Error loading notifications:', err);
    }
  }, [router, sonar]);

  // ── Polling, pausado con la pestaña oculta ─────────────────────────────────
  // Una pestaña de fondo no necesita refrescar: el navegador ya estrangula sus
  // timers, y despertarla cada 45s sólo gasta batería y cuota de la DB. Al volver
  // a primer plano se refresca de inmediato, así que el usuario nunca ve datos
  // viejos por haber cambiado de pestaña.
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    const arrancar = () => { if (timer === null) timer = setInterval(load, POLL_MS); };
    const parar    = () => { if (timer !== null) { clearInterval(timer); timer = null; } };

    const onVisibilidad = () => {
      if (document.hidden) parar();
      else { load(); arrancar(); }
    };

    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch inicial: el estado lo escribe el callback del fetch, no el cuerpo del efecto
    load();
    if (!document.hidden) arrancar();
    document.addEventListener('visibilitychange', onVisibilidad);
    return () => { parar(); document.removeEventListener('visibilitychange', onVisibilidad); };
  }, [load]);

  // Reloj de los timestamps relativos (`tiempoRelativo`), para que se actualicen solos sin
  // leer Date.now() durante el render.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  // Cerrar al hacer click fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Guarda de doble-submit. Era el tercer caso confirmado del patrón
  // sin-feedback: el owner clickeó dos veces porque nada indicaba que la primera
  // hubiera tomado. El PATCH es idempotente, así que lo que se arregla no es la
  // base — es que el control no decía nada.
  const marcarTodas = useAccionGuardada();
  const markAllRead = () => marcarTodas.ejecutar(async () => {
    await fetch('/api/notifications/read-all', { method: 'PATCH' });
    setNotifications(prev => prev.map(n => ({ ...n, leida: true })));
  });

  // Marcar UNA como leída. Es idempotente en el server, así que la guarda no
  // protege el dato — cierra la ventana de silencio: el estado se actualizaba
  // DESPUÉS del await, así que durante todo el vuelo la fila seguía viéndose sin
  // leer y admitía otro click.
  //
  // Por eso el pintado pasa a ser OPTIMISTA y va ANTES del fetch: en una fila de
  // notificación no cabe un "Marcando…" —el feedback correcto es que el punto de
  // no-leída desaparezca—, y hacerlo al instante es a la vez la mitad visible de
  // la guarda y lo que vuelve imposible el segundo click (el `!n.leida` del call
  // site ya no pasa). Si el PATCH falla, el badge queda desactualizado como
  // máximo hasta el próximo poll.
  const filasLeida = useAccionesPorFila();
  const markRead = (id: string) => filasLeida.ejecutar(id, async () => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, leida: true } : n));
    await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
  });

  return (
    <div className="relative" ref={ref}>
      {/* Botón campana — control sólo-ícono, por eso siempre lleva tooltip. */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => setOpen(!open)}
            aria-label="Notificaciones"
            className={cn(ADMIN_ICON_BUTTON, 'relative h-9 w-9')}
          >
            <AnimatedIcon icon={Bell} anim="bell" size={16} />
            {unread > 0 && (
              <span
                className={cn(
                  'absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold',
                  hayAlerta
                    ? 'bg-destructive text-destructive-foreground'
                    : 'bg-primary text-primary-foreground',
                )}
              >
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Notificaciones</TooltipContent>
      </Tooltip>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-11 z-50 w-80 rounded-2xl border border-border bg-card shadow-xl overflow-hidden">
          {/* Header — UNA línea. El conteo va integrado en el título y no en un
              chip-píldora: el chip repetía lo que el badge de la campana acaba de
              decir, y dos elementos compitiendo por decir "4" en 320 px es lo que
              hacía ver amontonado el header. El único color acá es el número, con
              el mismo tono de severidad que el badge — una vez, no tres veces. */}
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border">
            <h3 className="text-sm font-medium">
              Notificaciones
              {unread > 0 && (
                <>
                  <span className="text-muted-foreground"> · </span>
                  <span className={cn('font-semibold', hayAlerta ? 'text-destructive' : 'text-primary')}>
                    {unread}
                  </span>
                </>
              )}
            </h3>
            <div className="flex shrink-0 items-center gap-0.5">
              {/* Acción SECUNDARIA: ghost + muted, el patrón que ya usan los
                  "Limpiar filtros" del admin. Antes iba en color de primario, que
                  la ponía al nivel de una acción principal que no es. */}
              {unread > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={markAllRead}
                  disabled={marcarTodas.enVuelo}
                  className="h-7 gap-1.5 px-2 text-xs text-muted-foreground"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  {marcarTodas.enVuelo ? 'Marcando…' : 'Marcar todas'}
                </Button>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={toggleSilencio}
                    aria-label={silencio ? 'Activar sonido' : 'Silenciar sonido'}
                    aria-pressed={silencio}
                    className={cn(ADMIN_ICON_BUTTON, 'h-7 w-7')}
                  >
                    {silencio
                      ? <VolumeX className="h-3.5 w-3.5 text-muted-foreground" />
                      : <Volume2 className="h-3.5 w-3.5 text-muted-foreground" />}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {silencio ? 'Sonido silenciado' : 'Sonido activo'}
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Lista */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                <Bell className="w-8 h-8 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">Sin notificaciones</p>
              </div>
            ) : (
              notifications.map(n => {
                // El ícono Y el tono salen del REGISTRY: `tipo` es la key de la
                // automatización que la generó, así que la campana y la card de
                // Automatizaciones muestran el mismo símbolo sin un segundo mapa
                // que mantener.
                const def  = AUTOMATION_MAP[n.tipo];
                const Icon = def?.icono ?? DEFAULT_ICON;
                // El chip seguía el MISMO ámbar para toda no-leída, así que dentro
                // del dropdown una alerta de plata y una orden nueva se veían
                // idénticas — justo lo que el badge ya distinguía afuera. Ahora
                // sigue `severidad`, con tokens del tema y no con ámbar a mano.
                const tono = n.leida
                  ? 'bg-muted text-muted-foreground'
                  : def?.severidad === 'alerta'
                    ? 'bg-destructive/10 text-destructive'
                    : 'bg-primary/10 text-primary';

                const content = (
                  <div
                    className={`flex items-start gap-3 px-4 py-3 hover:bg-muted/40 transition-colors cursor-pointer ${!n.leida ? 'bg-primary/5' : ''}`}
                    onClick={() => !n.leida && markRead(n.id)}
                  >
                    <div className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', tono)}>
                      <Icon className="h-4 w-4" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-xs font-medium leading-tight ${!n.leida ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {n.titulo}
                        </p>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {tiempoRelativo(n.createdAt, now)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                        {n.mensaje}
                      </p>
                    </div>

                    {!n.leida && (
                      <div className="mt-1.5 w-2 h-2 rounded-full bg-primary shrink-0" />
                    )}
                  </div>
                );

                return n.href ? (
                  <Link
                    key={n.id}
                    href={n.href}
                    onClick={() => { markRead(n.id); setOpen(false); }}
                  >
                    {content}
                  </Link>
                ) : (
                  <div key={n.id}>{content}</div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
