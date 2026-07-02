interface ChipProps {
  label: string;
  value: string;
}

export default function Chip({
  label,
  value,
}: ChipProps) {
  return (
    <div className="rounded-lg bg-[#f0e8de] px-3 py-2 text-xs">
      <p className="mb-0.5 text-[#a07050]">
        {label}
      </p>

      <p className="font-semibold text-[#1a0f08]">
        {value}
      </p>
    </div>
  );
}