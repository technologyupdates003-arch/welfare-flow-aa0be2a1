import { ReactNode, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { 
  LayoutDashboard, Newspaper, Bell, LogOut, Calendar, Download, User, Users, 
  Menu, X, FileText, Shield, AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import FloatingChatBubble from "@/components/chat/FloatingChatBubble";
import NewsPopup from "@/components/NewsPopup";

const getMemberNavItems = (role: string | null) => {
  const memberItems = [
    { to: "/member", icon: LayoutDashboard, label: "Home" },
    { to: "/member/events", icon: Calendar, label: "Events" },
    { to: "/member/documents", icon: FileText, label: "Documents" },
    { to: "/member/beneficiaries", icon: Users, label: "Beneficiaries" },
    { to: "/member/downloads", icon: Download, label: "Downloads" },
    { to: "/member/pay-penalty", icon: AlertCircle, label: "Pay Penalty" },
    { to: "/member/notifications", icon: Bell, label: "Alerts", showBadge: true },
    { to: "/member/profile", icon: User, label: "Profile" },
  ];

  // Add role dashboard link if user has a role
  if (role && role !== "member") {
    const rolePath = role === "admin" ? "/admin" : `/${role.replace("_", "-")}`;
    const roleLabel = role === "admin" ? "Admin Dashboard" : 
                     role === "secretary" ? "Secretary Dashboard" :
                     role === "chairperson" ? "Chairperson Dashboard" :
                     role === "vice_chairperson" ? "Vice Chairperson Dashboard" :
                     role === "vice_secretary" ? "Vice Secretary Dashboard" :
                     role === "patron" ? "Patron Dashboard" : "Role Dashboard";
    
    return [
      { to: rolePath, icon: Shield, label: roleLabel, divider: true },
      ...memberItems,
    ];
  }

  return memberItems;
};

export default function MemberLayout({ children }: { children: ReactNode }) {
  const { user, signOut, role } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navItems = getMemberNavItems(role);

  const { data: unreadNotifications = 0 } = useQuery({
    queryKey: ["unread-notification-count", user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { count } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_read", false);
      return count || 0;
    },
    enabled: !!user,
    refetchInterval: 10000,
  });

  return (
    <div className="flex min-h-screen">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-foreground/20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-sidebar text-sidebar-foreground transform transition-transform lg:translate-x-0 lg:static lg:z-auto flex flex-col",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col p-4 border-b border-sidebar-border">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-display font-bold text-sidebar-primary">KIRINYAGA HCWW</h1>
            <Button variant="ghost" size="icon" className="lg:hidden text-sidebar-foreground" onClick={() => setSidebarOpen(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>
          {role && role !== "member" && (
            <span className="text-xs bg-sidebar-primary/20 text-sidebar-primary px-2 py-1 rounded-full mt-2 self-start">
              {role === "admin" ? "Administrator" :
               role === "secretary" ? "Secretary" :
               role === "chairperson" ? "Chairperson" :
               role === "vice_chairperson" ? "Vice Chairperson" :
               role === "vice_secretary" ? "Vice Secretary" :
               role === "patron" ? "Patron" : "Member"}
            </span>
          )}
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto pb-20 lg:pb-3">
          {navItems.map((item: any) => { const { to, icon: Icon, label, showBadge, divider } = item; return (
            <div key={to}>
              {divider && (
                <div className="my-3 border-t border-sidebar-border">
                  <p className="text-xs text-sidebar-foreground/50 px-3 py-2 font-medium">Role Dashboard</p>
                </div>
              )}
              <Link
                to={to}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors relative",
                  location.pathname === to
                    ? "bg-sidebar-accent text-sidebar-primary"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="flex-1">{label}</span>
                {showBadge && unreadNotifications > 0 && (
                  <span className="bg-red-500 text-white text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center">
                    {unreadNotifications > 9 ? "9+" : unreadNotifications}
                  </span>
                )}
              </Link>
            </div>
          ); })}
        </nav>
        <div className="p-3 border-t border-sidebar-border hidden lg:block">
          <Button variant="ghost" className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" /> Sign Out
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center gap-3 border-b border-border bg-card px-4 py-3 lg:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <h2 className="text-lg font-display font-semibold truncate">
            {navItems.find(n => n.to === location.pathname)?.label || "Dashboard"}
          </h2>
        </header>
        <div className="flex-1 p-4 lg:p-6 overflow-auto pb-20 lg:pb-6">
          {children}
        </div>
      </main>

      {/* Bottom Navigation (Mobile Only) */}
      <nav className="fixed bottom-0 inset-x-0 bg-card border-t border-border flex justify-around py-2 z-40 lg:hidden">
        {navItems.slice(0, 4).map((item: any) => { const { to, icon: Icon, label, showBadge } = item; return (
          <Link
            key={to}
            to={to}
            className={cn(
              "flex flex-col items-center gap-1 px-2 py-1 text-xs transition-colors relative",
              location.pathname === to ? "text-primary" : "text-muted-foreground"
            )}
          >
            <div className="relative">
              <Icon className="h-5 w-5" />
              {showBadge && unreadNotifications > 0 && (
                <span className="absolute -top-1.5 -right-2 bg-red-500 text-white text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center min-w-[16px]">
                  {unreadNotifications > 9 ? "9+" : unreadNotifications}
                </span>
              )}
            </div>
            <span className="truncate max-w-[60px]">{label}</span>
          </Link>
        ); })}
        <button
          onClick={signOut}
          className="flex flex-col items-center gap-1 px-2 py-1 text-xs text-muted-foreground transition-colors"
        >
          <LogOut className="h-5 w-5" />
          <span>Logout</span>
        </button>
      </nav>

      <FloatingChatBubble />
      <NewsPopup />
    </div>
  );
}
