interface ChipProps {
  label: string;
  value: string;
}

export default function Chip({
  label,
  value,
}: ChipProps) {
  // Los dos roles floreados contra `--sf-superficie` (§ TEMAS-P6-FAMILIAS-1, familia `superficie`),
  // no contra `--sf-tostado-3`/`--sf-tinta` (de OTRAS familias, medido 2.30–3.63:1 en las 6
  // paletas del censo, NUNCA ≥4.5). `var(--sf-sobre-superficie*,<token de hoy>)`: sin raíces
  // custom (Nayoli) cae exactamente al texto de hoy.
  return (
    <div className="sf-radio-lg bg-[var(--sf-superficie)] px-3 py-2 text-xs">
      <p className="mb-0.5 text-[var(--sf-sobre-superficie-suave,var(--sf-tostado-3))]">
        {label}
      </p>

      <p className="font-semibold text-[var(--sf-sobre-superficie,var(--sf-tinta))]">
        {value}
      </p>
    </div>
  );
}