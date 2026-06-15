import { ReactNode, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { 
  LayoutDashboard, Newspaper, Bell, LogOut, Calendar, Download, User, Users, 
  Menu, X, FileText, Shield, AlertCircle, TrendingUp
} from "lucide-react";
import { cn } from "@/lib/utils";
import FloatingChatBubble from "@/components/chat/FloatingChatBubble";
import NewsPopup from "@/components/NewsPopup";
import EventPopup from "@/components/EventPopup";

const getMemberNavItems = (role: string | null) => {
  const memberItems = [
    { to: "/member", icon: LayoutDashboard, label: "Home" },
    { to: "/member/events", icon: Calendar, label: "Events" },
    { to: "/member/documents", icon: FileText, label: "Documents" },
    { to: "/member/beneficiaries", icon: Users, label: "Beneficiaries" },
    { to: "/member/downloads", icon: Download, label: "Downloads" },
    // Only show withdrawal receipts for users with roles (not plain members)
    ...(role && role !== "member" ? [{ to: "/member/withdrawal-receipts", icon: FileText, label: "Withdrawal Receipts" }] : []),
    { to: "/member/pay-penalty", icon: AlertCircle, label: "Pay Penalty" },
    { to: "/member/donate", icon: TrendingUp, label: "Contribute" },
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

  const { data: unreadNewsCount = 0 } = useQuery({
    queryKey: ["unread-news-count", user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { data: allNews } = await supabase.from("news").select("id");
      const { data: readNews } = await supabase.from("news_read").select("news_id").eq("user_id", user.id);
      const readIds = new Set(readNews?.map(r => r.news_id) || []);
      return allNews?.filter(news => !readIds.has(news.id)).length || 0;
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  const { data: unseenEventCount = 0 } = useQuery({
    queryKey: ["unseen-event-count", user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const lastSeenAt = typeof window !== "undefined" ? window.localStorage.getItem("member_last_seen_events_at") : null;
      const { data: events } = await supabase
        .from("events")
        .select("id, created_at")
        .order("created_at", { ascending: false });
      if (!events) return 0;
      return events.filter(event => {
        if (!event.created_at) return false;
        if (!lastSeenAt) return true;
        return new Date(event.created_at) > new Date(lastSeenAt);
      }).length;
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  const navItemsWithBadges = navItems.map((item: any) => {
    if (item.to === "/member/events") {
      return { ...item, showBadge: unseenEventCount > 0, badgeCount: unseenEventCount };
    }

    if (item.to === "/member/news") {
      return { ...item, showBadge: unreadNewsCount > 0, badgeCount: unreadNewsCount };
    }

    if (item.to === "/member/notifications") {
      return { ...item, showBadge: unreadNotifications > 0, badgeCount: unreadNotifications };
    }

    return item;
  });

  return (
    <div className="flex min-h-screen">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-foreground/20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-sidebar text-sidebar-foreground transform transition-transform lg:translate-x-0 lg:static lg:z-auto flex flex-col lg:m-3 lg:rounded-3xl lg:shadow-neu lg:border lg:border-sidebar-border/40",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col p-4 border-b border-sidebar-border/50">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-display font-bold text-gradient-brand">KIRINYAGA HCWW</h1>
            <Button variant="ghost" size="icon" className="lg:hidden text-sidebar-foreground" onClick={() => setSidebarOpen(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>
          {role && role !== "member" && (
            <span className="text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full mt-2 self-start font-medium shadow-neu-sm">
              {role === "admin" ? "Administrator" :
               role === "secretary" ? "Secretary" :
               role === "chairperson" ? "Chairperson" :
               role === "vice_chairperson" ? "Vice Chairperson" :
               role === "vice_secretary" ? "Vice Secretary" :
               role === "patron" ? "Patron" : "Member"}
            </span>
          )}
        </div>
        <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto pb-20 lg:pb-3 no-scrollbar">
          {navItemsWithBadges.map((item: any) => { const { to, icon: Icon, label, showBadge, badgeCount, divider } = item; return (
            <div key={to}>
              {divider && (
                <div className="my-3 border-t border-sidebar-border/50">
                  <p className="text-xs text-sidebar-foreground/50 px-3 py-2 font-medium">Role Dashboard</p>
                </div>
              )}
              <Link
                to={to}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all relative",
                  location.pathname === to
                    ? "bg-gradient-brand text-primary-foreground shadow-brand"
                    : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:shadow-neu-sm hover:bg-sidebar-accent"
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="flex-1">{label}</span>
                {showBadge && badgeCount > 0 && (
                  <span className="bg-red-500 text-white text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center">
                    {badgeCount > 9 ? "9+" : badgeCount}
                  </span>
                )}
              </Link>
            </div>
          ); })}
        </nav>
        <div className="p-3 border-t border-sidebar-border/50 hidden lg:block">
          <Button variant="ghost" className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" /> Sign Out
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center gap-3 mx-3 mt-3 rounded-2xl border border-border/40 bg-card px-4 py-3 lg:px-6 shadow-neu-sm">
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
        {navItemsWithBadges.slice(0, 4).map((item: any) => { const { to, icon: Icon, label, showBadge, badgeCount } = item; return (
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
              {showBadge && badgeCount > 0 && (
                <span className="absolute -top-1.5 -right-2 bg-red-500 text-white text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center min-w-[16px]">
                  {badgeCount > 9 ? "9+" : badgeCount}
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
      <EventPopup />
    </div>
  );
}

