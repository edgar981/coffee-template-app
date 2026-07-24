import Link from "next/link";
import { ArrowUpRight, ArrowDownRight, Minus, LucideIcon } from "lucide-react";
import type { Trend } from "@/lib/metrics/trend";

interface StatCardProps {
  icon:   LucideIcon;
  label:  string;
  value:  string | number;
  sub?:   string;
  /** Month-over-month pill. Omit for widgets that are states/queues, not trends. */
  trend?: Trend;
  color:  string;
  /**
   * Makes the whole card a link to the list this number came from. When set, the
   * card gains a hover/focus affordance; cards without it render exactly as
   * before. The href MUST filter to the same rows the value counts — see
   * lib/metrics/month-range.ts for the shared definition that guarantees it.
   */
  href?:  string;
}

export default function StatCard({ icon: Icon, label, value, sub, trend, color, href }: StatCardProps) {
  const card = <StatCardBody icon={Icon} label={label} value={value} sub={sub} trend={trend} color={color} />;

  if (!href) return card;

  return (
    <Link
      href={href}
      // `group/link` drives the extra affordance on the body below. `.stat-card`
      // already lifts on hover for every card, so a linkable one adds a border
      // tint — token-based, so it reads the same in light and dark. The focus
      // ring is explicit: this is a block link, not a button.
      className="group/link block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      {card}
    </Link>
  );
}

function StatCardBody({ icon: Icon, label, value, sub, trend, color }: Omit<StatCardProps, "href">) {
  return (
    // The `group-hover/link:` rules are inert unless a StatCard href wrapped this
    // in `group/link`, so the non-linked cards render exactly as before.
    <div className="stat-card group group-hover/link:border-primary/50 group-hover/link:bg-muted/30">
      <div className="flex items-start justify-between gap-2">
        {/* Pastel per-card chip — deliberate choice (see CLAUDE.md admin design system). */}
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        {/* The pill's % IS the month-over-month comparison, so its "vs. mes
            anterior" caption lives here with the pill — not on the (historic)
            value's subtitle. Only shown when the trend is comparable. */}
        {trend && (
          <div className="flex flex-col items-end gap-0.5">
            <TrendPill trend={trend} />
            {trend.comparable && (
              <span className="text-[10px] leading-none text-muted-foreground/70 whitespace-nowrap">
                vs. mes anterior
              </span>
            )}
          </div>
        )}
      </div>
      <div className="mt-3">
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-sm text-muted-foreground mt-0.5">{label}</p>
        {sub && <p className="text-xs text-muted-foreground/70 mt-1">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Trend pill ───────────────────────────────────────────────────────────────
// For these 4 KPIs, up is always good → emerald; down → red/destructive; flat or
// non-comparable → neutral. Colours are subtle tints, distinct from the chips.
function TrendPill({ trend }: { trend: Trend }) {
  if (!trend.comparable) {
    return (
      <span
        title="Sin base comparable (el mes anterior tuvo muy pocas órdenes)"
        className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
      >
        <Minus className="w-3 h-3" /> sin comparativa
      </span>
    );
  }

  const isUp   = trend.direction === "up";
  const isDown = trend.direction === "down";
  const Icon   = isUp ? ArrowUpRight : isDown ? ArrowDownRight : Minus;
  const tone   = isUp
    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
    : isDown
    ? "bg-red-500/10 text-red-600 dark:text-red-400"
    : "bg-muted text-muted-foreground";
  const sign = (trend.pct ?? 0) > 0 ? "+" : "";

  return (
    <span
      title="vs. mes anterior"
      className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}
    >
      <Icon className="w-3 h-3" /> {sign}{trend.pct}%
    </span>
  );
}
