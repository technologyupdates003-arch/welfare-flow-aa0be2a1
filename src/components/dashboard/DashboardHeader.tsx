import { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Props {
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  badge?: string;
}

export default function DashboardHeader({ title, subtitle, icon: Icon, badge }: Props) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl gradient-brand flex items-center justify-center shadow-brand">
            <Icon className="h-6 w-6 text-primary-foreground" />
          </div>
          <span className="text-gradient-brand">{title}</span>
        </h1>
        {subtitle && (
          <p className="text-muted-foreground mt-2 text-sm">{subtitle}</p>
        )}
      </div>
      {badge && (
        <Badge className="self-start sm:self-auto text-sm px-3 py-1.5 glass-brand text-primary border-primary/30">
          {badge}
        </Badge>
      )}
    </div>
  );
}
