import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Landmark, RefreshCw, CheckCircle2, AlertCircle, Phone } from "lucide-react";
import { toast } from "sonner";

export default function BankSync() {
  const qc = useQueryClient();
  const [lastResult, setLastResult] = useState<any>(null);

  const { data: recentPayments = [] } = useQuery({
    queryKey: ["coop-recent-payments"],
    queryFn: async () => {
      const { data } = await supabase
        .from("payments")
        .select("id, amount, transaction_ref, raw_message, matched, member_id, received_at, source")
        .eq("source", "coop_bank")
        .order("received_at", { ascending: false })
        .limit(25);
      return data || [];
    },
    refetchInterval: 60000,
  });

  const { data: unmatched = [] } = useQuery({
    queryKey: ["coop-unmatched"],
    queryFn: async () => {
      const { data } = await supabase
        .from("unmatched_payments" as any)
        .select("id, raw_message, extracted_phone, extracted_amount, created_at, resolved")
        .eq("resolved", false)
        .order("created_at", { ascending: false })
        .limit(25);
      return (data as any[]) || [];
    },
  });

  const sync = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("coop-bank-sync", {
        body: { noOfTransactions: 100 },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error || (data as any).message);
      return data;
    },
    onSuccess: (data) => {
      setLastResult(data);
      const s = (data as any)?.summary;
      if (s) {
        toast.success(
          `Synced ${s.processed} new transactions • ${s.matched} matched • ${s.unmatched} unmatched`
        );
      } else {
        toast.success("Sync complete");
      }
      qc.invalidateQueries({ queryKey: ["coop-recent-payments"] });
      qc.invalidateQueries({ queryKey: ["coop-unmatched"] });
    },
    onError: (e: any) => {
      toast.error(e?.message || "Sync failed");
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Landmark className="h-7 w-7 text-primary" />
            Co-operative Bank Sync
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Auto-match member contributions from bank statements using phone numbers as the identifier.
          </p>
        </div>
        <Button onClick={() => sync.mutate()} disabled={sync.isPending}>
          <RefreshCw className={`h-4 w-4 mr-2 ${sync.isPending ? "animate-spin" : ""}`} />
          {sync.isPending ? "Syncing…" : "Sync Now"}
        </Button>
      </div>

      {lastResult?.setup_required && (
        <Card className="border-yellow-300 bg-yellow-50">
          <CardContent className="p-4 text-sm text-yellow-900 flex gap-2">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <div>
              <strong>Bank API not configured.</strong> Add the Co-op Bank API credentials
              (<code>COOP_CONSUMER_KEY</code>, <code>COOP_CONSUMER_SECRET</code>, <code>COOP_ACCOUNT_NUMBER</code>)
              in backend secrets, then retry.
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Recent Bank Payments</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{recentPayments.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Matched</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-green-600">{recentPayments.filter((p:any)=>p.matched).length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Unmatched (queue)</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-yellow-600">{unmatched.length}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Recent Bank Transactions</CardTitle></CardHeader>
        <CardContent className="p-0">
          {recentPayments.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground text-center">
              No bank transactions yet. Click <strong>Sync Now</strong> to pull the latest statements.
            </p>
          ) : (
            <div className="divide-y">
              {recentPayments.map((p: any) => (
                <div key={p.id} className="p-4 flex items-center gap-3 text-sm">
                  {p.matched ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-yellow-600 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="truncate">{p.raw_message || p.transaction_ref}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(p.received_at).toLocaleString()} • Ref: {p.transaction_ref}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">KES {Number(p.amount).toLocaleString()}</div>
                    <Badge variant={p.matched ? "default" : "secondary"} className="text-xs">
                      {p.matched ? "Matched" : "Unmatched"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {unmatched.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Unmatched Queue</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {unmatched.map((u: any) => (
                <div key={u.id} className="p-4 text-sm">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                    <Phone className="h-3 w-3" />
                    {u.extracted_phone || "no phone detected"}
                    <span>• KES {Number(u.extracted_amount || 0).toLocaleString()}</span>
                  </div>
                  <div className="truncate">{u.raw_message}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
