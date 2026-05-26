import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface WalletTransaction {
  id: string;
  wallet_type: string;
  direction: "in" | "out";
  source: string;
  party_name?: string;
  party_phone?: string;
  gross_amount: number;
  mpesa_charge: number;
  system_fee: number;
  net_amount: number;
  running_balance: number;
  status: string;
  mpesa_receipt?: string;
  reference_id?: string;
  notes?: string;
  occurred_at: string;
  created_at: string;
}

interface WalletStatementProps {
  walletType: "penalty" | "donation" | "operational";
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  onTransactionClick?: (transaction: WalletTransaction) => void;
}

export function WalletStatement({
  walletType,
  dateFrom,
  dateTo,
  limit = 50,
  onTransactionClick,
}: WalletStatementProps) {
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalIn, setTotalIn] = useState(0);
  const [totalOut, setTotalOut] = useState(0);

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        setLoading(true);

        let query = supabase
          .from("wallet_transactions")
          .select("*")
          .eq("wallet_type", walletType)
          .order("occurred_at", { ascending: false })
          .limit(limit);

        if (dateFrom) {
          query = query.gte("occurred_at", dateFrom);
        }
        if (dateTo) {
          query = query.lte("occurred_at", dateTo);
        }

        const { data, error } = await query;

        if (error) throw error;

        setTransactions((data || []) as WalletTransaction[]);

        // Calculate totals
        const inTotal = (data || [])
          .filter((t) => t.direction === "in")
          .reduce((sum, t) => sum + (t.net_amount || 0), 0);

        const outTotal = (data || [])
          .filter((t) => t.direction === "out")
          .reduce((sum, t) => sum + (t.net_amount || 0), 0);

        setTotalIn(inTotal);
        setTotalOut(outTotal);
      } catch (error) {
        console.error("Error fetching transactions:", error);
        toast.error("Failed to load wallet statement");
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();

    // Subscribe to real-time updates
    const subscription = supabase
      .channel(`wallet_transactions:${walletType}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "wallet_transactions",
          filter: `wallet_type=eq.${walletType}`,
        },
        () => {
          fetchTransactions();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [walletType, dateFrom, dateTo, limit]);

  const getSourceBadgeColor = (source: string) => {
    switch (source) {
      case "c2b":
        return "bg-blue-100 text-blue-800";
      case "b2c":
        return "bg-green-100 text-green-800";
      case "stk_push":
        return "bg-purple-100 text-purple-800";
      case "topup":
      case "manual_topup":
        return "bg-orange-100 text-orange-800";
      case "expense":
        return "bg-red-100 text-red-800";
      case "transfer":
        return "bg-indigo-100 text-indigo-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "completed":
        return "default";
      case "pending":
        return "outline";
      case "failed":
        return "destructive";
      default:
        return "secondary";
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-KE", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total In
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(totalIn)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Out
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">
              {formatCurrency(totalOut)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Net Position
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className={`text-2xl font-bold ${
                totalIn - totalOut >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              {formatCurrency(totalIn - totalOut)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Transaction History</CardTitle>
              <CardDescription>
                {transactions.length} transactions
              </CardDescription>
            </div>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="text-center text-gray-600 py-8">
              No transactions found
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Party</TableHead>
                    <TableHead className="text-right">Gross</TableHead>
                    <TableHead className="text-right">Charge</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reference</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx) => (
                    <TableRow
                      key={tx.id}
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => onTransactionClick?.(tx)}
                    >
                      <TableCell className="text-sm">
                        {formatDate(tx.occurred_at)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-xs font-semibold ${
                              tx.direction === "in"
                                ? "text-green-600"
                                : "text-red-600"
                            }`}
                          >
                            {tx.direction === "in" ? "↓ IN" : "↑ OUT"}
                          </span>
                          <Badge
                            variant="outline"
                            className={getSourceBadgeColor(tx.source)}
                          >
                            {tx.source}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {tx.party_name || tx.party_phone || "—"}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium">
                        {formatCurrency(tx.gross_amount)}
                      </TableCell>
                      <TableCell className="text-right text-sm text-gray-600">
                        {tx.mpesa_charge > 0 || tx.system_fee > 0
                          ? formatCurrency(tx.mpesa_charge + tx.system_fee)
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right text-sm font-semibold">
                        {formatCurrency(tx.net_amount)}
                      </TableCell>
                      <TableCell className="text-right text-sm font-bold">
                        {formatCurrency(tx.running_balance)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(tx.status)}>
                          {tx.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-gray-600">
                        {tx.mpesa_receipt || tx.reference_id?.slice(0, 8) || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
