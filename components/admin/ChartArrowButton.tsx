'use client';

// LA flecha de los carouseles de gráficos del dashboard. Nació dentro de
// DashboardChartCarousel (Ventas/Pedidos); se extrajo cuando el pie de
// distribución necesitó el MISMO control, para que no hubiera dos flechas con
// estilos que se separan con el tiempo. Presentación pura: el ciclado (índice,
// módulo) lo hace cada tarjeta.
export default function ChartArrowButton({ label, onClick, children }: {
  /** Texto del aria-label — describe QUÉ cicla ("Gráfico siguiente", "Vista siguiente"). */
  label:    string;
  onClick:  () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {children}
    </button>
  );
}
