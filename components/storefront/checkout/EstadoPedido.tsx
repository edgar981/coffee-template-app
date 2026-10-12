"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle, Clock, XCircle, MessageCircle, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { formatCOP } from "@duna/core/utils";
import { contenidoEstadoPedido, type EstadoPedidoPagina, type MetodoPedido } from "@/lib/checkout/estado-pedido";
import { composicionConfirmacion, stickerConfirmacion, etiquetaMetodoPedido } from "@/lib/checkout/composiciones-compra";
import { useSiteContent } from "@/components/storefront/SiteContentProvider";
import { vendedorEstaCompleto, lineaVendedor } from "@/lib/legal/plantillas";
import { formatFecha } from "@duna/core/format-fecha";

// CHECKOUT-LISTO-PARA-VENDER-1 — LA PÁGINA DE ESTADO ÚNICA (§ refero-compra.md §3): una sola
// plantilla para los cinco estados que el spec nombra (aprobado, pendiente, rechazado,
// confirmación manual, sin referencia), consumida tanto por la pantalla "¡Pedido recibido!"
// de `checkout/page.tsx` como por las vistas terminales de `app/(storefront)/checkout/retorno/
// RetornoCliente.tsx`. Antes CADA pantalla tenía su propio texto cosido a mano por rama; esta
// pieza es la ÚNICA forma visual, y `lib/checkout/estado-pedido.ts` es la ÚNICA fuente de las
// palabras — las dos no pueden divergir entre las dos pantallas (misma razón que
// `razonDelServidor`/`cruzoMinimo`, CLAUDE.md).
//
// NO sustituye los estados de FORMULARIO de `RetornoCliente.tsx` (pidiendo el correo,
// buscando, techo de 5 minutos con "Volver a consultar") — ésos piden una ACCIÓN del
// comprador antes de poder anunciar nada, y no son uno de los cinco estados de la página.

const ICONO_POR_ESTADO: Record<EstadoPedidoPagina, { Icono: typeof CheckCircle; claseFondo: string; claseIcono: string; pulso?: boolean }> = {
  aprobado:       { Icono: CheckCircle, claseFondo: 'bg-emerald-100', claseIcono: 'text-emerald-600' },
  pendiente:      { Icono: Clock,       claseFondo: 'bg-amber-100',   claseIcono: 'text-amber-600', pulso: true },
  rechazado:      { Icono: XCircle,     claseFondo: 'bg-red-100',     claseIcono: 'text-red-600' },
  manual:         { Icono: Clock,       claseFondo: 'bg-amber-100',   claseIcono: 'text-amber-600' },
  sin_referencia: { Icono: XCircle,     claseFondo: 'bg-[var(--sf-superficie)]', claseIcono: 'text-[var(--sf-tostado-2)]' },
};

export interface ItemResumenEstadoPedido {
  nombre: string;
  cantidad: number;
  subtotal: number;
  molienda?: string | null;
}

export interface ResumenEstadoPedido {
  items: ItemResumenEstadoPedido[];
  subtotal: number;
  envio: number;
  total: number;
  metodoEnvioLabel?: string | null;
  direccionDetalle?: string | null;
}

export interface AccionEstadoPedido {
  label: string;
  href?: string;
  onClick?: () => void;
  /** `primaria` (sólida, tinta), `secundaria` (borde), `whatsapp` (terciaria, con ícono). */
  variante: 'primaria' | 'secundaria' | 'whatsapp';
  /** Abre en pestaña nueva — para el enlace de WhatsApp. */
  externo?: boolean;
}

export interface EstadoPedidoProps {
  estado: EstadoPedidoPagina;
  metodo: MetodoPedido;
  /** `null` sólo en `sin_referencia` — ahí no hay pedido que mostrar. */
  numeroOrden: string | null;
  correo?: string | null;
  nombre?: string | null;
  resumen?: ResumenEstadoPedido | null;
  acciones: AccionEstadoPedido[];
  /** Ranura adicional bajo el bloque de "Qué sigue" — el widget de Wompi en curso, o el
   *  formulario de correo de `RetornoCliente.tsx`. */
  children?: React.ReactNode;
}

function claseBoton(variante: AccionEstadoPedido['variante']): string {
  if (variante === 'primaria') {
    return 'block w-full bg-[var(--sf-tinta)] text-[var(--sf-sobre)] font-semibold py-3.5 rounded-xl text-sm hover:bg-[var(--sf-tinta-2)] transition-colors text-center';
  }
  if (variante === 'secundaria') {
    return 'block w-full sf-borde border-[var(--sf-linea)] text-[var(--sf-texto)] font-medium py-3.5 rounded-xl text-sm hover:bg-[var(--sf-superficie)] transition-colors text-center';
  }
  return 'flex items-center justify-center gap-1.5 py-1 text-xs text-[var(--sf-texto-suave)] hover:text-[var(--sf-texto)] transition-colors';
}

export default function EstadoPedido({ estado, metodo, numeroOrden, correo, nombre, resumen, acciones, children }: EstadoPedidoProps) {
  const contenido = contenidoEstadoPedido(estado, metodo, nombre);
  const { Icono, claseFondo, claseIcono, pulso } = ICONO_POR_ESTADO[estado];
  const [copiado, setCopiado] = useState(false);
  // TIENDA-LEGAL-1 — el bloque «Vendedor», gateado por `vendedorEstaCompleto` (nunca un dato
  // inventado). `EstadoPedido` vive siempre dentro de `SiteContentProvider` (sus dos consumidores,
  // `checkout/page.tsx` y `RetornoCliente.tsx`, están bajo `app/(storefront)/`).
  const { vendedor, compra } = useSiteContent();
  const vendedorCompleto = vendedorEstaCompleto(vendedor);
  const lineaVendedorTexto = vendedorCompleto ? lineaVendedor(vendedor) : null;

  // COMPRA-LINEAS-ONIX-CHAMISAS-1 — la confirmación gana una composición ELEGIBLE por tienda.
  // `'comun'` (AUSENTE, el default) rinde EXACTAMENTE el bloque de "Número de orden" de siempre,
  // byte-idéntico — el branch de abajo sólo entra con 'boleto'/'lamina' puestos por el dueño.
  const confirmacion = composicionConfirmacion(compra.confirmacion);
  const esBoleto = confirmacion === 'boleto';
  const esLamina = confirmacion === 'lamina';

  const copiarNumero = async () => {
    if (!numeroOrden) return;
    try {
      await navigator.clipboard.writeText(numeroOrden);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Clipboard API ausente/bloqueada (http sin TLS, permiso denegado) — el número ya está
      // visible en pantalla para copiar a mano; no hay nada más que hacer acá.
      toast.error('No se pudo copiar. El número ya está escrito arriba.');
    }
  };

  return (
    <div className="max-w-md w-full text-center">
      <div className={`w-20 h-20 ${claseFondo} rounded-full flex items-center justify-center mx-auto mb-6`}>
        <Icono className={`w-10 h-10 ${claseIcono} ${pulso ? 'animate-pulse' : ''}`} />
      </div>
      <h1 className="text-3xl font-playfair text-[var(--sf-tinta)] mb-2">{contenido.titulo}</h1>
      <p className="text-sm text-[var(--sf-texto)] mb-4">{contenido.frase}</p>

      {/* COMPRA-LINEAS-ONIX-CHAMISAS-1 — las animaciones de las dos composiciones, scoped a este
          componente (nunca `app/globals.css`, fuera de `touches:`). El guard GLOBAL de reduced-
          motion (`app/globals.css`, `@media (prefers-reduced-motion: reduce) { *, *::before,
          *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1
          !important; } }`) ya cubre a las dos sin que esta hoja necesite su propio guard — es el
          MISMO mecanismo que ya protege `duna-horizonte-desplaza` en el panel. */}
      <style>{`
        @keyframes compra-fundido { from { opacity: 0; } to { opacity: 1; } }
        .compra-boleto { animation: compra-fundido 200ms ease-out; }
        @keyframes compra-filete-bucle { 0% { width: 0%; } 100% { width: 100%; } }
        .compra-boleto__filete-pendiente { animation: compra-filete-bucle 2.4s linear infinite; }
        @keyframes compra-lamina-pega { from { transform: scale(0.96) rotate(-4deg); } to { transform: scale(1) rotate(-4deg); } }
        .compra-lamina__sticker { animation: compra-lamina-pega 180ms ease-out; }
      `}</style>

      {numeroOrden && esBoleto ? (
        // «Boleto» (Onix, § refero-compra.md §4): bloque en el acento de la tienda, con muescas
        // laterales (dos círculos del color de la página, "perforando" los bordes) y línea
        // troquelada antes de las filas de dato — número de pedido en serif grande.
        <div className="compra-boleto relative bg-[var(--sf-acento)] text-[var(--sf-acento-txt)] rounded-xl p-5 mb-4 text-left overflow-hidden">
          <span aria-hidden="true" className="absolute left-0 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--sf-fondo)]" />
          <span aria-hidden="true" className="absolute right-0 top-1/2 h-4 w-4 translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--sf-fondo)]" />
          <p className="text-xs uppercase tracking-wider opacity-80 mb-1 text-center">Número de orden</p>
          <div className="flex items-center justify-center gap-2 mb-1">
            <p className="font-playfair text-3xl">{numeroOrden}</p>
            <button
              type="button"
              onClick={copiarNumero}
              aria-label="Copiar número de orden"
              className="p-1.5 rounded-lg hover:bg-black/10 transition-colors"
            >
              {copiado ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          {correo && (
            <p className="text-xs opacity-80 text-center mb-2">Te enviamos copia a {correo}.</p>
          )}
          <div className="mt-3 pt-3 border-t border-dashed border-current/30 space-y-1 text-xs">
            <div className="flex justify-between"><span className="opacity-80">Fecha</span><span>{formatFecha(new Date())}</span></div>
            <div className="flex justify-between"><span className="opacity-80">Método</span><span>{etiquetaMetodoPedido(metodo)}</span></div>
            {resumen?.metodoEnvioLabel && (
              <div className="flex justify-between"><span className="opacity-80">Envío a</span><span className="text-right">{resumen.metodoEnvioLabel}</span></div>
            )}
            {resumen && (
              <div className="flex justify-between font-semibold"><span>Total</span><span>{formatCOP(resumen.total)}</span></div>
            )}
          </div>
          {/* En PENDIENTE, un filete que se llena en bucle lento (§ el spec, "Movimiento"). */}
          {estado === 'pendiente' && (
            <div aria-hidden="true" className="mt-3 h-0.5 w-full overflow-hidden rounded-full bg-black/10">
              <div className="compra-boleto__filete-pendiente h-full rounded-full bg-current" />
            </div>
          )}
        </div>
      ) : numeroOrden && esLamina ? (
        // «Lámina» (Las Chamisas, § refero-compra.md §4): tarjeta de álbum con borde punteado,
        // tejido arriba, y el sticker de estado inclinado — se "pega" (key=estado remonta la
        // animación cada vez que el estado cambia).
        <div className="relative rounded-3xl border-2 border-dashed border-[var(--sf-linea)] bg-[var(--sf-tarjeta)] p-5 pt-7 mb-4 text-left overflow-hidden">
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-2"
            style={{ backgroundImage: 'repeating-linear-gradient(45deg, var(--sf-acento) 0, var(--sf-acento) 6px, var(--sf-tostado-4,var(--sf-acento-4)) 6px, var(--sf-tostado-4,var(--sf-acento-4)) 12px)' }}
          />
          <span
            key={estado}
            aria-hidden="true"
            className="compra-lamina__sticker absolute -top-2 -right-2 -rotate-6 rounded-full bg-[var(--sf-tostado-4,var(--sf-acento-3))] px-3 py-1 text-xs font-semibold text-[var(--sf-tinta)] shadow-sm"
          >
            {stickerConfirmacion(estado)}
          </span>
          <p className="text-xs text-[var(--sf-texto-suave)] mb-1 text-center">Número de orden</p>
          <div className="flex items-center justify-center gap-2 mb-1">
            <p className="text-2xl font-bold text-[var(--sf-acento-texto)]">{numeroOrden}</p>
            <button
              type="button"
              onClick={copiarNumero}
              aria-label="Copiar número de orden"
              className="p-1.5 rounded-lg hover:bg-[var(--sf-linea)]/40 text-[var(--sf-texto-suave)] transition-colors"
            >
              {copiado ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          {correo && (
            <p className="text-xs text-[var(--sf-texto-suave)] text-center">
              Te enviamos copia a {correo}.
            </p>
          )}
        </div>
      ) : numeroOrden ? (
        <div className="bg-[var(--sf-superficie)] rounded-2xl p-5 mb-4 text-left">
          <p className="text-xs text-[var(--sf-sobre-superficie-suave,var(--sf-texto-suave))] mb-1 text-center">Número de orden</p>
          <div className="flex items-center justify-center gap-2 mb-1">
            <p className="text-2xl font-bold text-[var(--sf-sobre-superficie,var(--sf-acento-texto))]">{numeroOrden}</p>
            <button
              type="button"
              onClick={copiarNumero}
              aria-label="Copiar número de orden"
              className="p-1.5 rounded-lg hover:bg-[var(--sf-linea)]/40 text-[var(--sf-sobre-superficie-suave,var(--sf-texto-suave))] transition-colors"
            >
              {copiado ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          {correo && (
            <p className="text-xs text-[var(--sf-sobre-superficie-suave,var(--sf-texto-suave))] text-center">
              Te enviamos copia a {correo}.
            </p>
          )}
        </div>
      ) : null}

      {contenido.queSigue && (
        <div className="bg-[var(--sf-superficie)] rounded-xl p-4 mb-4 text-left text-xs text-[var(--sf-sobre-superficie,var(--sf-texto))]">
          <p className="font-semibold mb-0.5">Qué sigue</p>
          <p>{contenido.queSigue}</p>
        </div>
      )}

      {resumen && (
        <div className="bg-[var(--sf-superficie)] rounded-2xl p-5 mb-4 text-left">
          <div className="space-y-2">
            {resumen.items.map((item, i) => (
              <div key={i} className="flex justify-between text-xs text-[var(--sf-sobre-superficie,var(--sf-texto))]">
                <span className="min-w-0 truncate pr-2">
                  {item.nombre}
                  {item.molienda ? ` · ${item.molienda}` : ''} × {item.cantidad}
                </span>
                <span className="shrink-0 font-medium">{formatCOP(item.subtotal)}</span>
              </div>
            ))}
          </div>
          <div className="space-y-2 pt-3 mt-3 sf-divisor-t border-[var(--sf-linea)] text-sm">
            <div className="flex justify-between text-[var(--sf-sobre-superficie,var(--sf-texto))]">
              <span>Subtotal</span><span>{formatCOP(resumen.subtotal)}</span>
            </div>
            <div className="flex justify-between text-[var(--sf-sobre-superficie,var(--sf-texto))]">
              <span>Envío</span>
              <span className={resumen.envio === 0 ? 'text-emerald-600' : ''}>{resumen.envio === 0 ? 'Gratis' : formatCOP(resumen.envio)}</span>
            </div>
            {resumen.metodoEnvioLabel && (
              <div className="flex justify-between text-[var(--sf-sobre-superficie,var(--sf-texto))]">
                <span>Entrega</span>
                <span className="text-right">{resumen.metodoEnvioLabel}</span>
              </div>
            )}
            {resumen.direccionDetalle && (
              <div className="flex justify-between text-[var(--sf-sobre-superficie,var(--sf-texto))]">
                <span>Detalles</span>
                <span className="text-right">{resumen.direccionDetalle}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-[var(--sf-sobre-superficie,var(--sf-tinta))] text-base pt-1 sf-divisor-t border-[var(--sf-linea)]">
              <span>Total</span><span>{formatCOP(resumen.total)}</span>
            </div>
          </div>
        </div>
      )}

      {children}

      {/* TIENDA-LEGAL-1 — el bloque «Vendedor» (razón social, documento, ciudad, enlaces), bajo
          el resumen y antes de las acciones. Gateado por `vendedorEstaCompleto`: sin la info del
          vendedor configurada, no renderiza nada en su lugar (nunca un dato inventado). */}
      {vendedorCompleto && lineaVendedorTexto && (
        <div className="bg-[var(--sf-superficie)] rounded-xl p-4 mb-4 text-left text-xs text-[var(--sf-sobre-superficie,var(--sf-texto))]">
          <p className="font-semibold mb-0.5">Vendedor</p>
          <p>{lineaVendedorTexto}</p>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
            <Link href="/legal/terminos-y-condiciones" className="underline hover:no-underline">Términos y condiciones</Link>
            <Link href="/legal/tratamiento-de-datos" className="underline hover:no-underline">Tratamiento de datos</Link>
            <Link href="/legal/envios-y-devoluciones" className="underline hover:no-underline">Cambios y devoluciones</Link>
          </div>
        </div>
      )}

      {acciones.length > 0 && (
        <div className="flex flex-col gap-3">
          {acciones.map((a, i) =>
            a.variante === 'whatsapp' ? (
              <a key={i} href={a.href} target={a.externo ? '_blank' : undefined} rel={a.externo ? 'noopener' : undefined} onClick={a.onClick} className={claseBoton(a.variante)}>
                <MessageCircle className="w-3.5 h-3.5" />
                {a.label}
              </a>
            ) : a.href ? (
              <Link key={i} href={a.href} onClick={a.onClick} className={claseBoton(a.variante)}>{a.label}</Link>
            ) : (
              <button key={i} type="button" onClick={a.onClick} className={claseBoton(a.variante)}>{a.label}</button>
            ),
          )}
        </div>
      )}
    </div>
  );
}
