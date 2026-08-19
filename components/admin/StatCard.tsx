import Link from "next/link";
import { ArrowUpRight, ArrowDownRight, Minus, LucideIcon } from "lucide-react";
import type { Trend } from "@/lib/metrics/trend";
import { resolveStatLine } from "@/lib/stat-line";
import { DunaTooltip } from "@/components/admin/DunaTooltip";

// ─── Affordance de stat card interactiva (fuente única) ───────────────────────
// Este bloque es EL patrón de card navegable del admin: la card del dashboard
// (`StatCardBody`, vía group-hover) y las páginas que arman sus tarjetas a mano
// (Clientes, Inventario, Entregas) consumen estos mismos valores. Están juntos y
// en un solo archivo a propósito — Tailwind exige la clase escrita literal, así
// que la única forma de que hover y activo no deriven es que sus tokens se
// declaren aquí, uno al lado del otro.
//
// Amber Minimal: el estado interactivo TIÑE, nunca rellena. El tinte es NEUTRO
// (`bg-muted/30`) y el color va solo en un borde fino de `--primary`; el sólido
// ámbar sigue siendo exclusivo de la acción primaria de la página. Antes el hover
// usaba `bg-accent`, que en el tema oscuro del admin es un ámbar saturado
// (`--accent: 22.7 82.5% 31.4%`) y rellenaba la tarjeta entera — el mismo
// incidente que ya se había corregido en el tema claro.

/** Lo que no depende del estado: caja del link, cursor y anillo de foco. */
const STAT_CARD_LINK_BASE =
  "block text-left w-full transition-colors cursor-pointer " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/** Card navegable en REPOSO: al pasar el mouse, tinte + borde de --ring (ámbar de marca) al 50%. */
const STAT_CARD_HOVER = "hover:bg-muted/30 hover:border-ring/50";

/**
 * Card cuyo FILTRO está aplicado. Un paso más que el hover — borde de --ring
 * completo en vez de al 50% — sobre el mismo tinte neutro y el mismo fondo de
 * card. La diferencia entre "puedo hacer clic" y "esto es lo que estás viendo"
 * es de intensidad de borde, no de relleno.
 */
const STAT_CARD_ACTIVE = "border-ring bg-muted/30";

/**
 * Clases de una stat card clickeable armada a mano. Se usa junto a `stat-card`:
 *
 *   className={`stat-card ${statCardLink(filtroAplicado)}`}
 *
 * Los dos estados se EXCLUYEN a propósito: una card activa no lleva las reglas
 * de hover, porque `hover:border-ring/50` le bajaría el borde justo cuando el
 * mouse está encima — y además el clic sobre la card ya activa es un no-op, así
 * que no hay nada que previsualizar.
 */
export function statCardLink(activo = false): string {
  return `${STAT_CARD_LINK_BASE} ${activo ? STAT_CARD_ACTIVE : STAT_CARD_HOVER}`;
}

/** El mismo hover, expresado desde el hijo cuando el link envuelve la card (`group/link`). */
export const STAT_CARD_LINK_BODY_HOVER =
  "group-hover/link:bg-muted/30 group-hover/link:border-ring/50";

interface StatCardProps {
  icon:   LucideIcon;
  label:  string;
  value:  string | number;
  /**
   * Línea de contexto de FALLBACK (scope, fuente, período). Se muestra solo si la
   * tarjeta no tiene insight — los dos compiten por el MISMO slot, ver abajo.
   */
  sub?:   string;
  /**
   * Hecho derivado de los datos de la tarjeta ("3 meses consecutivos a la baja",
   * "Último pago hace 3 días"). GANA el slot cuando existe: muted y SIN color ni
   * icono, porque no es una alerta (el rojo es de Alertas de Stock).
   */
  insight?: string;
  /**
   * Sufijo de VENTANA TEMPORAL que se apende a la línea que gane, entre paréntesis
   * ("últimos 30 días" → "Pagos recibidos (últimos 30 días)").
   *
   * Existe porque el período no puede depender de qué línea ganó el slot: una
   * tarjeta con ventana que mañana gane un insight seguiría necesitando declararla.
   * Solo para ventanas REALES — las métricas de estado actual (saldos, conteos
   * vigentes) no llevan período. Ver `scopeSuffix` en el registry de widgets.
   */
  scopeSuffix?: string;
  /**
   * `true` para los hechos de TENDENCIA: un paso más de contraste que el sub y que
   * los fallbacks, dentro de la misma familia muted (Amber Minimal: la jerarquía
   * es de tono neutro, nunca de color semántico).
   */
  insightEnfasis?: boolean;
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

export default function StatCard({ icon: Icon, label, value, sub, insight, insightEnfasis, scopeSuffix, trend, color, href }: StatCardProps) {
  const card = (
    <StatCardBody
      icon={Icon} label={label} value={value} sub={sub}
      insight={insight} insightEnfasis={insightEnfasis} scopeSuffix={scopeSuffix}
      trend={trend} color={color}
    />
  );

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

function StatCardBody({ icon: Icon, label, value, sub, insight, insightEnfasis, scopeSuffix, trend, color }: Omit<StatCardProps, "href">) {
  // EL SLOT ÚNICO de contexto: máximo dos líneas bajo el valor (título + una), así
  // que insight y sub NO coexisten. La regla (insight gana, scope se apende) vive
  // en `lib/stat-line.ts` — pura y testeada, porque preservar el scope es un
  // invariante de producto y no algo que deba recordarse en cada call site.
  const contexto = resolveStatLine({ insight, sub, insightEnfasis, scopeSuffix });

  return (
    // The `group-hover/link:` rules are inert unless a StatCard href wrapped this
    // in `group/link`, so the non-linked cards render exactly as before.
    <div className={`stat-card group ${STAT_CARD_LINK_BODY_HOVER}`}>
      <div className="flex items-start justify-between gap-2">
        {/* Icon chip — warm family (STAT_CHIP; red reserved for alerts). Callers
            pass the class from the centralized map, see CLAUDE.md / constants/stat-chip. */}
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
        {/* UNA sola línea de contexto (insight o, en su defecto, sub). Siempre
            muted y sin color: es un hecho, nunca una instrucción ni una alerta.
            Los de tendencia van un paso más de contraste — misma familia neutra. */}
        {contexto && (
          <p className={`text-xs mt-1 ${contexto.enfasis ? 'text-muted-foreground' : 'text-muted-foreground/70'}`}>
            {contexto.text}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Trend (text, not a pill) ─────────────────────────────────────────────────
// Regla 3: the MoM indicator is coloured TEXT — arrow + %, no fill — so the pill
// stops competing with the value. Up is good → green; down → red; flat/
// non-comparable → muted. AA-safe tones (green-700/red-700 on the light card;
// -400 on dark). The "vs. mes anterior" caption below stays muted.
function TrendPill({ trend }: { trend: Trend }) {
  if (!trend.comparable) {
    return (
      <DunaTooltip content="Sin base comparable (el mes anterior tuvo muy pocas órdenes)">
        <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
          <Minus className="w-3 h-3" /> sin comparativa
        </span>
      </DunaTooltip>
    );
  }

  const isUp   = trend.direction === "up";
  const isDown = trend.direction === "down";
  const Icon   = isUp ? ArrowUpRight : isDown ? ArrowDownRight : Minus;
  const tone   = isUp
    ? "text-emerald-700 dark:text-emerald-400"
    : isDown
    ? "text-red-700 dark:text-red-400"
    : "text-muted-foreground";
  const sign = (trend.pct ?? 0) > 0 ? "+" : "";

  return (
    <span
      title="vs. mes anterior"
      className={`flex items-center gap-1 text-xs font-semibold ${tone}`}
    >
      <Icon className="w-3 h-3" /> {sign}{trend.pct}%
    </span>
  );
}
