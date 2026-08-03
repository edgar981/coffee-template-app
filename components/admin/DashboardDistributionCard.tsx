'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import ArrowButton from '@/components/admin/ChartArrowButton';
import { DASHBOARD_COLORS, tooltipStyle } from '@/constants/dashb-styles';
import type { DashboardDistribuciones, DistribucionSlice } from '@/types/dashboard';

// El pie del dashboard: título fijo ("Ventas") y tres cortes del mismo período
// (año en curso, America/Bogota, sin `SN-`) que se ciclan con las flechas —
// categoría de producto, presentación (peso) y método de pago.
//
// Hubo una vista "Por molienda": se retiró (decisión de producto) porque en este
// catálogo replicaba el split de la categoría — dos vistas mostrando el mismo
// 54/46 no informan. El DATO (`OrderItem.moliendaSeleccionada`) sigue vivo en
// órdenes y productos; lo que se fue es la vista.
// Las flechas son LAS del carousel Ventas/Pedidos (ChartArrowButton), así que los
// dos módulos de gráfico se ciclan igual.
//
// La vista es estado LOCAL a propósito: los gráficos están fuera del sistema de
// personalización (v1 = solo stat cards), así que esto NO se persiste en
// DashboardPreference. Si algún día se persiste, la decisión es meter los
// gráficos al registry — no colgar una preferencia suelta.

type VistaId = keyof DashboardDistribuciones;

interface Vista {
  id: VistaId;
  /**
   * Sub de la tarjeta: declara QUÉ vista es y sobre QUÉ base reparte. Lo segundo
   * no es adorno — categoría y presentación reparten ventas de producto
   * (`OrderItem.subtotal`, sin envío) y método de pago reparte dinero recibido
   * (`Payment.monto`, con envío), así que sus porcentajes no cuadran entre sí.
   */
  subtitulo: string;
}

// El TÍTULO de la tarjeta es fijo ("Ventas"): las flechas cambian la vista, no el
// tema. Con el título cambiando, el ojo leía tres tarjetas distintas apareciendo
// en el mismo hueco en vez de una con tres cortes.
const TITULO = 'Ventas';

const VISTAS: Vista[] = [
  { id: 'categoria',  subtitulo: 'Distribución por categoría de producto' },
  { id: 'peso',       subtitulo: 'Distribución por presentación (peso)' },
  { id: 'metodoPago', subtitulo: 'Pagos registrados por método' },
];

export default function DashboardDistributionCard({ data, loading }: {
  /** `null` = la fuente falló o no cargó todavía. */
  data:    DashboardDistribuciones | null;
  loading: boolean;
}) {
  const [index, setIndex] = useState(0);
  const vista = VISTAS[index];
  const slices: DistribucionSlice[] = data?.[vista.id] ?? [];

  const step = (delta: number) =>
    setIndex(i => (i + delta + VISTAS.length) % VISTAS.length);

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      {/* Header: ‹ título › — mismo patrón que el carousel de Ventas/Pedidos */}
      <div className="flex items-center gap-1 mb-1">
        <ArrowButton label="Vista anterior" onClick={() => step(-1)}>
          <ChevronLeft className="w-4 h-4" />
        </ArrowButton>
        <div className="px-1 min-w-0">
          <h3 className="font-semibold text-foreground truncate">{TITULO}</h3>
        </div>
        <ArrowButton label="Vista siguiente" onClick={() => step(1)}>
          <ChevronRight className="w-4 h-4" />
        </ArrowButton>
      </div>
      <p className="text-xs text-muted-foreground mb-4">{vista.subtitulo}</p>

      {slices.length === 0 ? (
        <div className="h-40 flex items-center justify-center text-center text-muted-foreground text-sm">
          {loading ? 'Cargando...' : 'Sin ventas registradas todavía.'}
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie
                // `key` por vista: sin esto Recharts anima entre dos repartos
                // distintos como si fueran el mismo, y las porciones se
                // "arrastran" de una vista a la otra.
                key={vista.id}
                data={slices} cx="50%" cy="50%"
                innerRadius={40} outerRadius={65}
                paddingAngle={3} dataKey="value"
              >
                {slices.map((_, i) => (
                  <Cell key={i} fill={DASHBOARD_COLORS[i % DASHBOARD_COLORS.length]} />
                ))}
              </Pie>
              {/* El valor YA es un porcentaje; el sufijo lo dice para que el
                  tooltip no se lea como pesos ni unidades. */}
              <Tooltip contentStyle={tooltipStyle} formatter={v => `${v ?? 0}%`} />
            </PieChart>
          </ResponsiveContainer>
          {/* Leyenda con dots — mismo patrón (y mismos colores) que antes */}
          <div className="space-y-1.5 mt-2">
            {slices.map((item, i) => (
              <div key={item.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: DASHBOARD_COLORS[i % DASHBOARD_COLORS.length] }} />
                  <span className="text-muted-foreground truncate">{item.name}</span>
                </div>
                <span className="font-medium text-foreground shrink-0">{item.value}%</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
