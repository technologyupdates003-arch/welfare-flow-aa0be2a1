import { ReactNode, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard, Users, TrendingUp, FileSpreadsheet,
  Newspaper, Bell, LogOut, Menu, X,
  AlertTriangle, CreditCard, Send, Calendar, FileText, Settings,
  Shield, Award, Eye, UserCheck, FileSignature, Wrench, AlertCircle, Target
} from "lucide-react";
import { cn } from "@/lib/utils";
import FloatingChatBubble from "@/components/chat/FloatingChatBubble";
import AIAssistant from "@/components/chat/AIAssistant";
import EventPopup from "@/components/EventPopup";
import DashboardSwitcher from "@/components/layout/DashboardSwitcher";

const getNavItems = (role: string) => {
  const baseItems = [
    { to: `/${role === "admin" ? "admin" : role === "super_admin" ? "super-admin" : role.replace("_", "-")}`, icon: LayoutDashboard, label: "Dashboard" },
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
    case "super_admin":
      return [
        ...baseItems,
        { to: "/super-admin/troubleshooting", icon: Wrench, label: "System Troubleshooting" },
        { to: "/super-admin", icon: Users, label: "Member Management", divider: true },
        ...memberItems,
      ];
    
    case "admin":
      return [
        ...baseItems,
        { to: "/admin/members", icon: Users, label: "Members" },
        { to: "/admin/contributions", icon: TrendingUp, label: "Contributions" },
        { to: "/admin/import", icon: FileSpreadsheet, label: "Excel Import" },
        { to: "/admin/beneficiary-import", icon: Users, label: "Beneficiary Import" },
        { to: "/admin/beneficiaries", icon: UserCheck, label: "Beneficiary Dashboard" },
        { to: "/admin/payments", icon: CreditCard, label: "Payments" },
        { to: "/admin/unmatched", icon: AlertTriangle, label: "Unmatched" },
        { to: "/admin/penalty-payments", icon: AlertCircle, label: "Verify Penalties" },
        { to: "/admin/penalty-wallet", icon: TrendingUp, label: "Penalty Wallet" },
        { to: "/admin/donations", icon: TrendingUp, label: "Funds Wallet" },
        
        { to: "/admin/withdrawal-approval", icon: FileSignature, label: "Withdrawal Approvals" },
        { to: "/admin/withdrawal-receipts", icon: FileText, label: "Withdrawal Receipts" },
        { to: "/admin/sms", icon: Send, label: "Bulk SMS" },
        { to: "/admin/schedule", icon: Calendar, label: "Schedule Manager" },
        { to: "/admin/events", icon: Calendar, label: "Events" },
        { to: "/admin/documents", icon: FileText, label: "Documents" },
        { to: "/admin/news", icon: Newspaper, label: "News" },
        { to: "/admin/minutes", icon: FileText, label: "Meeting Minutes" },
        { to: "/admin/defaulters", icon: AlertTriangle, label: "Defaulters" },
        { to: "/admin/beneficiary-requests", icon: UserCheck, label: "Beneficiary Requests" },
        { to: "/admin/notifications", icon: Bell, label: "Notifications" },
        { to: "/admin/signatures", icon: FileSignature, label: "Office Signatures" },
        { to: "/admin/settings", icon: Settings, label: "Settings" },
      ];
    
    case "chairperson":
      return [
        ...baseItems,
        { to: "/chairperson/approve-minutes", icon: FileText, label: "Approve Minutes" },
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
        { to: "/secretary/signature", icon: FileSignature, label: "Upload Signature", divider: true },
        ...memberItems,
      ];
    
    case "vice_secretary":
      return [
        ...baseItems,
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
    case "super_admin": return "Super Admin";
    case "admin": return "Welfare Admin";
    case "chairperson": return "Chairperson";
    case "vice_chairperson": return "Vice Chairperson";
    case "secretary": return "Secretary";
    case "vice_secretary": return "Vice Secretary";
    case "patron": return "Patron";
    default: return "Welfare System";
  }
};

const getRoleBadge = (role: string) => {
  switch (role) {
    case "super_admin": return "Full System Access";
    case "admin": return null;
    case "chairperson": return "Read Only";
    case "vice_chairperson": return "Read Only";
    case "secretary": return "Event Management";
    case "vice_secretary": return "Records";
    case "patron": return "Oversight";
    default: return null;
  }
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { signOut, role, roles } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // AdminLayout is specifically for admin dashboard - always show admin navigation
  const navItems = getNavItems("admin");
  const roleTitle = getRoleTitle("admin");
  const roleBadge = getRoleBadge("admin");

  const { data: unseenEventCount = 0 } = useQuery({
    queryKey: ["unseen-admin-event-count", role],
    queryFn: async () => {
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
    enabled: !!role,
    refetchInterval: 30000,
  });

  const navItemsWithBadges = navItems.map((item: any) => {
    if (item.to.endsWith("/events")) {
      return { ...item, showBadge: unseenEventCount > 0, badgeCount: unseenEventCount };
    }
    return item;
  });

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Admin Sidebar - Always visible on desktop */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white flex flex-col border-r border-slate-700",
        "lg:relative lg:translate-x-0 lg:z-auto lg:block",
        "transform transition-transform duration-200 ease-in-out",
        sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        <div className="flex flex-col p-4 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold text-white">{roleTitle}</h1>
            <Button variant="ghost" size="icon" className="lg:hidden text-white hover:bg-slate-800" onClick={() => setSidebarOpen(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>
          {roleBadge && (
            <span className="text-xs bg-blue-600/20 text-blue-400 px-2 py-1 rounded-full mt-2 self-start">
              {roleBadge}
            </span>
          )}
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItemsWithBadges.map((item: any, index) => { const { to, icon: Icon, label, showBadge, badgeCount, divider } = item; return (
            <div key={to}>
              {divider && (
                <div className="my-3 border-t border-slate-700">
                  <p className="text-xs text-slate-400 px-3 py-2 font-medium">Member Features</p>
                </div>
              )}
              <Link
                to={to}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  location.pathname === to
                    ? "bg-blue-600 text-white"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
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
        <div className="p-3 border-t border-slate-700">
          <Button variant="ghost" className="w-full justify-start text-slate-300 hover:text-white hover:bg-slate-800" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" /> Sign Out
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-3 lg:px-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
              <Menu className="h-5 w-5" />
            </Button>
            <h2 className="text-lg font-display font-semibold truncate">
              {navItems.find(n => n.to === location.pathname)?.label || "Dashboard"}
            </h2>
          </div>
          <DashboardSwitcher />
        </header>
        <EventPopup />
        <div className="flex-1 p-4 lg:p-6 overflow-auto">
          {children}
        </div>
      </main>
      <FloatingChatBubble />
      <AIAssistant />
    </div>
  );
}
