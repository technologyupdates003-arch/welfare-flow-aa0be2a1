import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DollarSign, Users, AlertTriangle, TrendingUp } from "lucide-react";
import { GlassStatsGrid } from "@/components/dashboard/GlassStatCard";

export default function StatsCards() {
  const { data: stats } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [members, contributions, settings, penalties] = await Promise.all([
        supabase.from("members").select("id, is_active", { count: "exact" }),
        supabase.from("contributions").select("amount, status"),
        supabase.from("welfare_settings").select("*").single(),
        supabase.from("penalties").select("amount, is_paid"),
      ]);

      const allContribs = contributions.data || [];
      const totalCollected = allContribs.filter(c => c.status === "paid").reduce((s, c) => s + Number(c.amount), 0);
      const totalExpected = allContribs.reduce((s, c) => s + Number(c.amount), 0);
      const outstanding = totalExpected - totalCollected;
      const defaulters = new Set(allContribs.filter(c => c.status === "overdue")).size;
      const totalPenalties = (penalties.data || []).reduce((s, p) => s + Number(p.amount), 0);

      return {
        totalMembers: members.count || 0,
        totalCollected,
        totalExpected,
        outstanding,
        defaulters,
        totalPenalties,
        monthlyAmount: settings.data?.monthly_contribution_amount || 0,
      };
    },
  });

  return (
    <GlassStatsGrid
      cols="grid-cols-2 lg:grid-cols-3"
      stats={[
        { label: "Total Collected", value: `KES ${(stats?.totalCollected || 0).toLocaleString()}`, icon: DollarSign, sub: "All paid contributions", accent: "from-success/30 to-success/5" },
        { label: "Expected (All Time)", value: `KES ${(stats?.totalExpected || 0).toLocaleString()}`, icon: TrendingUp, sub: "Total invoiced", accent: "from-primary/30 to-primary-glow/10" },
        { label: "Outstanding", value: `KES ${(stats?.outstanding || 0).toLocaleString()}`, icon: AlertTriangle, sub: "Not yet collected", accent: "from-warning/30 to-warning/5" },
        { label: "Total Members", value: (stats?.totalMembers || 0).toLocaleString(), icon: Users, sub: "Registered members", accent: "from-primary/30 to-primary-glow/10" },
        { label: "Defaulters", value: stats?.defaulters || 0, icon: AlertTriangle, sub: "Overdue accounts", accent: "from-destructive/30 to-destructive/5" },
        { label: "Penalties Collected", value: `KES ${(stats?.totalPenalties || 0).toLocaleString()}`, icon: DollarSign, sub: "Penalty wallet", accent: "from-secondary/30 to-secondary/5" },
      ]}
    />
  );
}
