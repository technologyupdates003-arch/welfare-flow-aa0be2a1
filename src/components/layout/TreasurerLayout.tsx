import { ReactNode, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bell, Moon, Sun, LogOut, LayoutDashboard, Wallet, FileText, BarChart3, Settings, CreditCard, Menu, X, Landmark, FileSignature, Target } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import FloatingChatBubble from "@/components/chat/FloatingChatBubble";
import AIAssistant from "@/components/chat/AIAssistant";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import DashboardSwitcher from "@/components/layout/DashboardSwitcher";

interface TreasurerLayoutProps {
  children: ReactNode;
}

export default function TreasurerLayout({ children }: TreasurerLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut, roles } = useAuth();
  const { theme, setTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { data: notifications = [], refetch: refetchNotifs } = useQuery({
    queryKey: ["treasurer-bell-notifications", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("notifications")
        .select("id, title, message, is_read, created_at, type")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(15);
      return data || [];
    },
    refetchInterval: 30000,
  });
  const unreadCount = notifications.filter((n: any) => !n.is_read).length;

  const markAllRead = async () => {
    if (!user || unreadCount === 0) return;
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
    refetchNotifs();
  };

  const menuItems = [
    { to: "/treasurer", icon: LayoutDashboard, label: "Dashboard", exact: true },
    { to: "/treasurer/contributions", icon: CreditCard, label: "Contributions" },
    { to: "/treasurer/withdrawal-approvals", icon: FileSignature, label: "Withdrawal Approvals" },
    { to: "/treasurer/penalty-wallet", icon: Wallet, label: "Penalty Wallet" },
    { to: "/treasurer/donation-wallet", icon: Wallet, label: "Funds Wallet" },
    { to: "/treasurer/donation-campaigns", icon: Target, label: "Funds Drives" },
    { to: "/treasurer/operational-wallet", icon: Wallet, label: "Operational Wallet" },
    { to: "/treasurer/bank-sync", icon: Landmark, label: "Bank Sync" },
    { to: "/treasurer/expenses", icon: Wallet, label: "Expenses & Payouts" },
    { to: "/treasurer/memos", icon: FileText, label: "Memos" },
    { to: "/treasurer/documents", icon: FileText, label: "Documents" },
    { to: "/treasurer/reports", icon: BarChart3, label: "Reports" },
    { to: "/treasurer/wallet-reports", icon: BarChart3, label: "Wallet Reports" },
    { to: "/treasurer/settings", icon: Settings, label: "Settings" },
  ];

  const isActive = (path: string, exact?: boolean) => {
    if (exact) {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <div className="flex h-screen bg-[#F9FAFB]">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar - Collapsible on mobile, compact on desktop */}
      <aside className={cn(
        "w-[160px] bg-[#0B1F3A] text-white flex flex-col fixed h-full z-50",
        "lg:relative lg:z-auto",
        "transform transition-transform duration-200 ease-in-out lg:transform-none",
        sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        {/* Logo/Brand - More compact */}
        <div className="p-3 border-b border-white/10 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">KHCWW</h1>
            <p className="text-xs text-orange-400 mt-1">Treasurer</p>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="lg:hidden text-white hover:bg-white/10"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Navigation Menu - More compact */}
        <nav className="flex-1 py-3 px-2 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.to, item.exact);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-2 px-2 py-2 rounded-lg transition-all text-sm ${
                  active
                    ? "bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg"
                    : "text-white/70 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Bottom Profile Section */}
        <div className="p-3 border-t border-white/10">
          <button onClick={() => navigate("/member/profile")} className="flex items-center gap-2 mb-2 w-full text-left hover:bg-white/5 rounded-lg p-1 -m-1 transition-colors" title="My Profile">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-gradient-to-br from-orange-500 to-orange-600 text-white text-xs">
                {user?.email?.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{user?.email}</p>
              <p className="text-xs text-orange-400">Treasurer</p>
            </div>
          </button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            className="w-full justify-start text-white/70 hover:text-white hover:bg-white/5 text-xs"
          >
            <LogOut className="h-3 w-3 mr-2" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 ml-0 lg:ml-[160px] flex flex-col">
        {/* Top Navbar - Reduced height and padding */}
        <header className="h-[60px] bg-white border-b border-[#E5E7EB] flex items-center justify-between px-2 lg:px-3 fixed top-0 right-0 left-0 lg:left-[160px] z-10">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon" 
              className="lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <h2 className="text-lg lg:text-xl font-bold text-[#111827]">
              {menuItems.find(item => isActive(item.to, item.exact))?.label || "Dashboard"}
            </h2>
          </div>
          
          <div className="flex items-center gap-2 lg:gap-4">
            <DashboardSwitcher />

            {/* Notifications */}
            <Popover onOpenChange={(open) => { if (open) markAllRead(); }}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 min-w-[18px] h-[18px] px-1 bg-orange-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 p-0">
                <div className="px-3 py-2 border-b border-border flex items-center justify-between">
                  <h4 className="font-semibold text-sm">Notifications</h4>
                  {unreadCount > 0 && (
                    <button onClick={markAllRead} className="text-xs text-orange-600 hover:underline">
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="text-center text-xs text-muted-foreground py-6">No notifications</p>
                  ) : (
                    notifications.map((n: any) => (
                      <div key={n.id} className={cn("px-3 py-2 border-b border-border last:border-0 text-sm", !n.is_read && "bg-orange-50")}>
                        <p className="font-medium text-xs text-[#111827]">{n.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2">{n.message}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString()}</p>
                      </div>
                    ))
                  )}
                </div>
              </PopoverContent>
            </Popover>

            {/* Theme Toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>

            {/* Profile Avatar */}
            <Avatar className="h-9 w-9 cursor-pointer" onClick={() => navigate("/member/profile")} title="My Profile">
              <AvatarFallback className="bg-gradient-to-br from-orange-500 to-orange-600 text-white">
                {user?.email?.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>
        </header>

        {/* Main Content - Reduced padding and margin */}
        <main className="flex-1 mt-[60px] p-2 lg:p-4 overflow-auto">
          {children}
        </main>
      </div>

      {/* Floating Chat Bubble */}
      <FloatingChatBubble />
      
      {/* AI Assistant */}
      <AIAssistant />
    </div>
  );
}
