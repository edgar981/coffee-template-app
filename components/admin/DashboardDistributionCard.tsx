'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import ArrowButton from '@/components/admin/ChartArrowButton';
import { DASHBOARD_COLORS, tooltipStyle } from '@/constants/dashb-styles';
import type { DashboardDistribuciones, DistribucionSlice } from '@/types/dashboard';

// El pie del dashboard con vistas conmutables: la misma métrica (% de ingresos
// atribuibles del año en curso) repartida por categoría o por peso.
//
// Hubo una tercera vista, "Por molienda": se retiró (decisión de producto) porque
// en este catálogo la molienda replicaba el split de la categoría — dos vistas
// distintas mostrando el mismo 54/46 no informan, solo dan trabajo a las flechas.
// El DATO (`OrderItem.moliendaSeleccionada`) sigue vivo en órdenes y productos;
// lo que se fue es la vista.
// Las flechas son LAS del carousel Ventas/Pedidos (ChartArrowButton), así que los
// dos módulos de gráfico se ciclan igual.
//
// La vista es estado LOCAL a propósito: los gráficos están fuera del sistema de
// personalización (v1 = solo stat cards), así que esto NO se persiste en
// DashboardPreference. Si algún día se persiste, la decisión es meter los
// gráficos al registry — no colgar una preferencia suelta.

type VistaId = keyof DashboardDistribuciones;

interface Vista {
  id:       VistaId;
  titulo:   string;
  /** Qué agrupa esta vista, en una línea (va bajo el título). */
  subtitulo: string;
}

const VISTAS: Vista[] = [
  { id: 'categoria', titulo: 'Por Categoría', subtitulo: 'Distribución de ventas' },
  { id: 'peso',      titulo: 'Por Peso',      subtitulo: 'Presentación del producto' },
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
          <h3 className="font-semibold text-foreground truncate">{vista.titulo}</h3>
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
