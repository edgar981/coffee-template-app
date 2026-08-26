// Barra de progreso de subida, presentacional. Va PEGADA al botón que disparó la subida (§ decisión:
// el progreso donde el ojo ya está, no en un indicador de cabecera que se va de vista). Tinta sobre
// borde, fina; el ancho del relleno es el %.
export default function BarraProgreso({ pct }: { pct: number }) {
  return (
    <span
      aria-hidden
      style={{
        position: 'relative', display: 'block', width: '100%', maxWidth: '360px', height: '4px',
        borderRadius: '2px', background: 'var(--duna-border)', overflow: 'hidden',
      }}
    >
      <span style={{ position: 'absolute', inset: 0, width: `${pct}%`, background: 'var(--duna-ink)', transition: 'width 120ms linear' }} />
    </span>
  );
}
