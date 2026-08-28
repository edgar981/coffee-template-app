interface ChipProps {
  label: string;
  value: string;
}

export default function Chip({
  label,
  value,
}: ChipProps) {
  return (
    <div className="rounded-lg bg-[var(--sf-superficie)] px-3 py-2 text-xs">
      <p className="mb-0.5 text-[var(--sf-tostado-3)]">
        {label}
      </p>

      <p className="font-semibold text-[var(--sf-tinta)]">
        {value}
      </p>
    </div>
  );
}