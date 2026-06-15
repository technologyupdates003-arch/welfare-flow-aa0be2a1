import { ReactNode, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import DashboardLock from "@/components/DashboardLock";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard, Users, TrendingUp, FileSpreadsheet,
  Newspaper, Bell, LogOut, Menu, X,
  AlertTriangle, CreditCard, Send, Calendar, FileText, Settings,
  Shield, Award, Eye, UserCheck, FileSignature, Wrench
} from "lucide-react";
import { cn } from "@/lib/utils";
import FloatingChatBubble from "@/components/chat/FloatingChatBubble";
import AIAssistant from "@/components/chat/AIAssistant";

const getOfficeNavItems = (role: string) => {
  const baseItems = [
    { to: `/${role.replace("_", "-")}`, icon: LayoutDashboard, label: "Dashboard" },
  ];

  // Member navigation items for office bearers
  const memberItems = [
    { to: "/member", icon: LayoutDashboard, label: "My Dashboard", divider: true },
    { to: "/member/events", icon: Calendar, label: "Events" },
    { to: "/member/documents", icon: FileText, label: "Documents" },
    { to: "/member/news", icon: Newspaper, label: "News" },
    { to: "/member/beneficiaries", icon: Users, label: "My Beneficiaries" },
    { to: "/member/notifications", icon: Bell, label: "Notifications" },
    { to: "/member/profile", icon: Settings, label: "My Profile" },
  ];

  switch (role) {
    case "chairperson":
      return [
        ...baseItems,
        { to: "/chairperson/approve-minutes", icon: FileText, label: "Approve Minutes" },
        { to: "/chairperson/withdrawal-approvals", icon: FileSignature, label: "Withdrawal Approvals" },
        { to: "/chairperson/signature", icon: FileSignature, label: "Upload Signature", divider: true },
        ...memberItems,
      ];
    
    case "vice_chairperson":
      return [
        ...baseItems,
        ...memberItems,
      ];
    
    case "secretary":
      return [
        ...baseItems,
        { to: "/secretary/events", icon: Calendar, label: "Manage Events" },
        { to: "/secretary/minutes", icon: FileText, label: "Meeting Minutes" },
        { to: "/secretary/review", icon: Eye, label: "Review Minutes" },
        { to: "/secretary/withdrawal-approvals", icon: FileSignature, label: "Withdrawal Approvals" },
        { to: "/secretary/signature", icon: FileSignature, label: "Upload Signature", divider: true },
        ...memberItems,
      ];
    
    case "vice_secretary":
      return [
        ...baseItems,
        { to: "/vice-secretary/minutes", icon: FileText, label: "Manage Minutes", divider: true },
        ...memberItems,
      ];
    
    case "patron":
      return [
        ...baseItems,
        ...memberItems,
      ];
    
    default:
      return baseItems;
  }
};

const getRoleTitle = (role: string) => {
  switch (role) {
    case "chairperson": return "Chairperson";
    case "vice_chairperson": return "Vice Chairperson";
    case "secretary": return "Secretary";
    case "vice_secretary": return "Vice Secretary";
    case "patron": return "Patron";
    default: return "Office Bearer";
  }
};

const getRoleBadge = (role: string) => {
  switch (role) {
    case "chairperson": return "Read Only";
    case "vice_chairperson": return "Read Only";
    case "secretary": return "Event Management";
    case "vice_secretary": return "Records";
    case "patron": return "Oversight";
    default: return null;
  }
};

export default function OfficeLayout({ children }: { children: ReactNode }) {
  const { signOut, role, roles } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  const navItems = getOfficeNavItems(role || "member");
  const roleTitle = getRoleTitle(role || "member");
  const roleBadge = getRoleBadge(role || "member");

  return (
    <DashboardLock area="office">
    <div className="flex min-h-screen">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-foreground/20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Office Bearer Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-sidebar text-sidebar-foreground flex flex-col",
        "lg:relative lg:translate-x-0 lg:z-auto lg:block lg:m-3 lg:rounded-3xl lg:shadow-neu lg:border lg:border-sidebar-border/40",
        "transform transition-transform duration-200 ease-in-out",
        sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        <div className="flex flex-col p-4 border-b border-sidebar-border/50">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-display font-bold text-gradient-brand">{roleTitle}</h1>
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>
          {roleBadge && (
            <span className="text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full mt-2 self-start font-medium shadow-neu-sm">
              {roleBadge}
            </span>
          )}
        </div>
        <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto no-scrollbar">
          {navItems.map((item: any, index) => { const { to, icon: Icon, label, divider } = item; return (
            <div key={to}>
              {divider && (
                <div className="my-3 border-t border-sidebar-border/50">
                  <p className="text-xs text-sidebar-foreground/50 px-3 py-2 font-medium">Member Features</p>
                </div>
              )}
              <Link
                to={to}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                  location.pathname === to
                    ? "bg-gradient-brand text-primary-foreground shadow-brand"
                    : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:shadow-neu-sm hover:bg-sidebar-accent"
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="flex-1">{label}</span>
              </Link>
            </div>
          ); })}
        </nav>
        <div className="p-3 border-t border-sidebar-border/50">
          <Button variant="ghost" className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" /> Sign Out
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center justify-between gap-3 mx-3 mt-3 rounded-2xl border border-border/40 bg-card px-4 py-3 lg:px-6 shadow-neu-sm">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
              <Menu className="h-5 w-5" />
            </Button>
            <h2 className="text-lg font-display font-semibold truncate">
              {navItems.find(n => n.to === location.pathname)?.label || "Dashboard"}
            </h2>
          </div>
          <div className="flex gap-2">
            <Link to="/member">
              <Button variant={location.pathname.startsWith("/member") ? "default" : "outline"} size="sm">
                Member Dashboard
              </Button>
            </Link>
            {(roles.includes("admin") || roles.includes("super_admin")) && (
              <>
                <Link to="/admin">
                  <Button variant={location.pathname.startsWith("/admin") ? "default" : "outline"} size="sm">
                    Admin Dashboard
                  </Button>
                </Link>
                {roles.includes("super_admin") && (
                  <Link to="/super-admin">
                    <Button variant={location.pathname.startsWith("/super-admin") ? "default" : "outline"} size="sm">
                      Super Admin
                    </Button>
                  </Link>
                )}
              </>
            )}
          </div>
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
