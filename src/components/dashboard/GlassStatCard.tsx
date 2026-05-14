import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

export type GlassStat = {
  label: string;
  value: string | number;
  icon: LucideIcon;
  sub?: string;
  /** tailwind gradient classes used for the soft tint, e.g. "from-primary/30 to-primary-glow/10" */
  accent?: string;
  subIcon?: LucideIcon;
};

interface Props extends GlassStat {
  className?: string;
}

export default function GlassStatCard({
  label,
  value,
  icon: Icon,
  sub,
  accent = "from-primary/30 to-primary-glow/10",
  subIcon: SubIcon = TrendingUp,
  className,
}: Props) {
  return (
    <Card
      className={cn(
        "glass border-white/40 overflow-hidden relative group hover:shadow-glass-lg transition-all",
        className
      )}
    >
      <div className={cn("absolute inset-0 bg-gradient-to-br opacity-60 pointer-events-none", accent)} />
      <CardContent className="relative p-4 sm:p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] sm:text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {label}
            </p>
            <div className="text-base sm:text-2xl font-bold mt-1.5 break-words leading-tight">
              {value}
            </div>
          </div>
          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl glass-brand flex items-center justify-center shrink-0">
            <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
          </div>
        </div>
        {sub && (
          <p className="text-[11px] sm:text-xs text-muted-foreground mt-3 flex items-center gap-1">
            <SubIcon className="h-3 w-3" /> {sub}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

interface GridProps {
  stats: GlassStat[];
  cols?: string; // e.g. "grid-cols-2 lg:grid-cols-4"
}

export function GlassStatsGrid({ stats, cols = "grid-cols-2 lg:grid-cols-4" }: GridProps) {
  return (
    <div className={cn("grid gap-3 sm:gap-4", cols)}>
      {stats.map((s, i) => (
        <GlassStatCard key={i} {...s} />
      ))}
    </div>
  );
}
