import { ReactNode, useState } from "react";
import { useAuth } from "@/lib/auth";
import DashboardLock from "@/components/DashboardLock";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { 
  LogOut, Menu, X, Users, Wrench, Shield, 
  LayoutDashboard, Calendar, FileText, Newspaper, 
  Bell, Settings, Database, Key, Eye, Lock, ChevronDown
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import FloatingChatBubble from "@/components/chat/FloatingChatBubble";
import AIAssistant from "@/components/chat/AIAssistant";

const getSuperAdminNavItems = () => {
  return [
    { to: "/super-admin", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/super-admin/members", icon: Users, label: "Member Management" },
    { to: "/super-admin/troubleshooting", icon: Wrench, label: "System Troubleshooting" },
    { to: "/super-admin/audit", icon: Database, label: "Audit Logs" },
    { to: "/super-admin/security", icon: Shield, label: "Security Settings" },
    { to: "/super-admin/passwords", icon: Key, label: "Password Management" },
    { to: "/super-admin/access", icon: Lock, label: "Access Control" },
    { to: "/super-admin/monitoring", icon: Eye, label: "System Monitoring" },
    { divider: true },
    { to: "/member", icon: LayoutDashboard, label: "Member Dashboard" },
    { to: "/member/events", icon: Calendar, label: "Events" },
    { to: "/member/documents", icon: FileText, label: "Documents" },
    { to: "/member/news", icon: Newspaper, label: "News" },
    { to: "/member/notifications", icon: Bell, label: "Notifications" },
    { to: "/member/profile", icon: Settings, label: "My Profile" },
  ];
};

export default function SuperAdminLayout({ children }: { children: ReactNode }) {
  const { signOut, roles } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navItems = getSuperAdminNavItems();

  const dashboardOptions = [
    { to: "/super-admin", label: "Super Admin", icon: Shield, show: true },
    { to: "/admin", label: "Admin", icon: LayoutDashboard, show: roles.includes("admin") },
    { to: "/secretary", label: "Secretary", icon: FileText, show: roles.includes("secretary") },
    { to: "/chairperson", label: "Chairperson", icon: Users, show: roles.includes("chairperson") },
    { to: "/vice-chairperson", label: "Vice Chairperson", icon: Users, show: roles.includes("vice_chairperson") },
    { to: "/vice-secretary", label: "Vice Secretary", icon: FileText, show: roles.includes("vice_secretary") },
    { to: "/patron", label: "Patron", icon: Shield, show: roles.includes("patron") },
    { to: "/member", label: "Member", icon: LayoutDashboard, show: true },
  ].filter(o => o.show);

  const currentDashboard =
    dashboardOptions.find(o => location.pathname === o.to || location.pathname.startsWith(o.to + "/"))?.label
    || "Dashboards";

  return (
    <DashboardLock area="super_admin">
    <div className="flex min-h-screen">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Super Admin Sidebar - Dark gradient with WowDash styling */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-slate-900/90 backdrop-blur-sm text-white flex flex-col border-r border-slate-700/50",
        "lg:relative lg:translate-x-0 lg:z-auto lg:block",
        "transform transition-transform duration-200 ease-in-out",
        sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        <div className="flex flex-col p-4 border-b border-slate-700/50">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-white bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">
              Super Admin
            </h1>
            <Button variant="ghost" size="icon" className="lg:hidden text-white hover:bg-slate-800/50" onClick={() => setSidebarOpen(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>
          <span className="text-xs bg-gradient-to-r from-blue-600/30 to-cyan-600/30 text-blue-300 px-2 py-1 rounded-full mt-2 self-start">
            Full System Access
          </span>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label, divider }, index) => (
            <div key={to || `divider-${index}`}>
              {divider && (
                <div className="my-3 border-t border-slate-700/50">
                  <p className="text-xs text-slate-400 px-3 py-2 font-medium">Member Features</p>
                </div>
              )}
              {to ? (
                <Link
                  to={to}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    location.pathname === to
                      ? "bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-lg"
                      : "text-slate-300 hover:bg-slate-800/50 hover:text-white"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="flex-1">{label}</span>
                </Link>
              ) : null}
            </div>
          ))}
        </nav>
        <div className="p-3 border-t border-slate-700/50">
          <Button 
            variant="ghost" 
            className="w-full justify-start text-slate-300 hover:text-white hover:bg-slate-800/50"
            onClick={signOut}
          >
            <LogOut className="mr-2 h-4 w-4" /> Sign Out
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center justify-between gap-2 border-b border-border/60 glass px-3 py-2.5 sm:px-4 sm:py-3 lg:px-6 sticky top-0 z-30">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Button variant="ghost" size="icon" className="lg:hidden shrink-0 h-8 w-8" onClick={() => setSidebarOpen(true)}>
              <Menu className="h-5 w-5" />
            </Button>
            <h2 className="text-sm sm:text-lg font-semibold truncate">
              {navItems.find(n => n.to === location.pathname)?.label || "Super Admin Dashboard"}
            </h2>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="gradient-brand text-primary-foreground shrink-0 h-8 px-3 text-xs sm:text-sm gap-1.5">
                <LayoutDashboard className="h-4 w-4" />
                <span className="hidden xs:inline sm:inline">Dashboards</span>
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 glass-strong">
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Switch dashboard · {currentDashboard}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {dashboardOptions.map(opt => {
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
        </header>
        <div className="flex-1 p-4 lg:p-6 overflow-auto">
          {children}
        </div>
      </main>

      <FloatingChatBubble />
      <AIAssistant />
    </div>
    </DashboardLock>
  );
}