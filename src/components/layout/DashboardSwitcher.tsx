import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  LayoutDashboard, Shield, Users, FileText, ChevronDown, Banknote,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  className?: string;
}

export default function DashboardSwitcher({ className }: Props) {
  const { roles } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const options = [
    { to: "/super-admin", label: "Super Admin", icon: Shield, show: roles.includes("super_admin") },
    { to: "/admin", label: "Admin", icon: LayoutDashboard, show: roles.includes("admin") },
    { to: "/treasurer", label: "Treasurer", icon: Banknote, show: true },
    { to: "/secretary", label: "Secretary", icon: FileText, show: roles.includes("secretary") },
    { to: "/chairperson", label: "Chairperson", icon: Users, show: roles.includes("chairperson") },
    { to: "/vice-chairperson", label: "Vice Chairperson", icon: Users, show: roles.includes("vice_chairperson") },
    { to: "/vice-secretary", label: "Vice Secretary", icon: FileText, show: roles.includes("vice_secretary") },
    { to: "/patron", label: "Patron", icon: Shield, show: roles.includes("patron") },
    { to: "/member", label: "Member", icon: LayoutDashboard, show: true },
  ].filter(o => o.show);

  const current =
    options.find(o => location.pathname === o.to || location.pathname.startsWith(o.to + "/"))?.label
    || "Dashboards";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" className={cn("gradient-brand text-primary-foreground shrink-0 h-8 px-3 text-xs sm:text-sm gap-1.5", className)}>
          <LayoutDashboard className="h-4 w-4" />
          <span>Dashboards</span>
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 glass-strong">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Switch dashboard · {current}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.map(opt => {
          const Icon = opt.icon;
          const active = location.pathname === opt.to || location.pathname.startsWith(opt.to + "/");
          return (
            <DropdownMenuItem
              key={opt.to}
              onClick={() => navigate(opt.to)}
              className={cn("gap-2 cursor-pointer", active && "bg-primary/10 text-primary font-medium")}
            >
              <Icon className="h-4 w-4" />
              {opt.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
