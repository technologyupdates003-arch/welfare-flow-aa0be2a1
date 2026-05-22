import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { WalletStatement } from "@/components/WalletStatement";
import { Loader2, Plus, Send, AlertCircle, TrendingUp, TrendingDown } from "lucide-react";
import { toast } from "sonner";

interface OperationalWallet {
  id: string;
  total_received: number;
  total_withdrawn: number;
  total_balance: number;
  updated_at: string;
}

export default function OperationalWallet() {
  const { user } = useAuth();
  const [wallet, setWallet] = useState<OperationalWallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [showTopUpDialog, setShowTopUpDialog] = useState(false);
  const [showWithdrawDialog, setShowWithdrawDialog] = useState(false);
  const [topUpType, setTopUpType] = useState<"stk_push" | "manual">("manual");
  const [topUpAmount, setTopUpAmount] = useState("");
  const [topUpPhone, setTopUpPhone] = useState("");
  const [topUpNotes, setTopUpNotes] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawReason, setWithdrawReason] = useState("");
  const [withdrawPhone, setWithdrawPhone] = useState("");

  // Fetch wallet data
  useEffect(() => {
    const fetchWallet = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from("operational_wallet")
          .select("*")
          .limit(1)
          .maybeSingle();

        if (error) throw error;
        setWallet(data);
      } catch (error) {
        console.error("Error fetching wallet:", error);
        toast.error("Failed to load wallet data");
      } finally {
        setLoading(false);
      }
    };

    fetchWallet();

    // Subscribe to real-time updates
    const subscription = supabase
      .channel("operational_wallet")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "operational_wallet",
        },
        () => {
          fetchWallet();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Handle top-up
  const handleTopUp = async () => {
    if (!topUpAmount || parseFloat(topUpAmount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    if (topUpType === "stk_push" && !topUpPhone) {
      toast.error("Please enter a phone number for STK push");
      return;
    }

    try {
      setProcessing(true);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/operational-topup`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
          body: JSON.stringify({
            type: topUpType,
            amount: parseFloat(topUpAmount),
            phone_number: topUpPhone,
            notes: topUpNotes,
            created_by: user?.id,
          }),
        }
      );

      const result = await response.json();

      if (result.success) {
        toast.success(
          topUpType === "stk_push"
            ? `STK push sent to ${topUpPhone}`
            : `Manual top-up of KES ${topUpAmount} recorded`
        );
        setShowTopUpDialog(false);
        setTopUpAmount("");
        setTopUpPhone("");
        setTopUpNotes("");
      } else {
        toast.error(result.message || "Failed to process top-up");
      }
    } catch (error) {
      console.error("Error processing top-up:", error);
      toast.error("Failed to process top-up");
    } finally {
      setProcessing(false);
    }
  };

  // Handle withdrawal
  const handleWithdraw = async () => {
    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    if (!withdrawReason.trim()) {
      toast.error("Please provide a reason for withdrawal");
      return;
    }

    if (!withdrawPhone) {
      toast.error("Please enter a phone number");
      return;
    }

    if (parseFloat(withdrawAmount) > (wallet?.total_balance || 0)) {
      toast.error("Insufficient balance");
      return;
    }

    try {
      setProcessing(true);

      // Create withdrawal request
      const { data: withdrawal, error } = await supabase
        .from("operational_withdrawals")
        .insert({
          amount: parseFloat(withdrawAmount),
          reason: withdrawReason,
          phone_number: withdrawPhone,
          requested_by: user?.id,
          status: "pending",
        })
        .select()
        .single();

      if (error) throw error;

      // Create signatory records (chairperson, secretary, treasurer)
      const signatories = ["chairperson", "secretary", "treasurer"];
      await supabase.from("operational_withdrawal_signatories").insert(
        signatories.map((role) => ({
          withdrawal_id: withdrawal.id,
          signatory_role: role,
          status: "pending",
        }))
      );

      toast.success(
        `Withdrawal request created. Awaiting approval from ${signatories.join(", ")}`
      );
      setShowWithdrawDialog(false);
      setWithdrawAmount("");
      setWithdrawReason("");
      setWithdrawPhone("");
    } catch (error) {
      console.error("Error creating withdrawal:", error);
      toast.error("Failed to create withdrawal request");
    } finally {
      setProcessing(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Operational Wallet</h1>
        <p className="text-gray-600 mt-2">
          Manage operational funds for expenses and payouts
        </p>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              Total Received
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-600">
              {formatCurrency(wallet?.total_received || 0)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-600" />
              Total Withdrawn
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-red-600">
              {formatCurrency(wallet?.total_withdrawn || 0)}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-900">
              Available Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-blue-900">
              {formatCurrency(wallet?.total_balance || 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button
          onClick={() => setShowTopUpDialog(true)}
          className="flex-1"
          size="lg"
        >
          <Plus className="h-4 w-4 mr-2" />
          Top Up Wallet
        </Button>
        <Button
          onClick={() => setShowWithdrawDialog(true)}
          variant="outline"
          className="flex-1"
          size="lg"
        >
          <Send className="h-4 w-4 mr-2" />
          Request Withdrawal
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="statement" className="w-full">
        <TabsList>
          <TabsTrigger value="statement">Statement</TabsTrigger>
          <TabsTrigger value="info">Information</TabsTrigger>
        </TabsList>

        <TabsContent value="statement" className="space-y-4">
          <WalletStatement walletType="operational" limit={100} />
        </TabsContent>

        <TabsContent value="info" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>About Operational Wallet</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Purpose</h3>
                <p className="text-sm text-gray-600">
                  The operational wallet holds funds for day-to-day expenses,
                  payouts, and operational costs. It is separate from penalty
                  and donation wallets.
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Top-Up Methods</h3>
                <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                  <li>STK Push: Send M-Pesa payment via phone</li>
                  <li>Manual Entry: Admin records cash or bank transfers</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Withdrawal Process</h3>
                <p className="text-sm text-gray-600">
                  Withdrawals require approval from chairperson, secretary, and
                  treasurer. Once all approve, funds are transferred via B2C.
                </p>
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Last updated: {wallet?.updated_at ? new Date(wallet.updated_at).toLocaleString() : "—"}
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Top-Up Dialog */}
      <Dialog open={showTopUpDialog} onOpenChange={setShowTopUpDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Top Up Operational Wallet</DialogTitle>
            <DialogDescription>
              Add funds to the operational wallet
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Top-Up Type */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Top-Up Method</label>
              <div className="flex gap-2">
                <Button
                  variant={topUpType === "manual" ? "default" : "outline"}
                  onClick={() => setTopUpType("manual")}
                  className="flex-1"
                >
                  Manual Entry
                </Button>
                <Button
                  variant={topUpType === "stk_push" ? "default" : "outline"}
                  onClick={() => setTopUpType("stk_push")}
                  className="flex-1"
                >
                  STK Push
                </Button>
              </div>
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Amount (KES)</label>
              <Input
                type="number"
                placeholder="0"
                value={topUpAmount}
                onChange={(e) => setTopUpAmount(e.target.value)}
                disabled={processing}
              />
            </div>

            {/* Phone (for STK Push) */}
            {topUpType === "stk_push" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Phone Number</label>
                <Input
                  type="tel"
                  placeholder="254712345678"
                  value={topUpPhone}
                  onChange={(e) => setTopUpPhone(e.target.value)}
                  disabled={processing}
                />
              </div>
            )}

            {/* Notes */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Notes (Optional)</label>
              <Textarea
                placeholder="Add any notes about this top-up"
                value={topUpNotes}
                onChange={(e) => setTopUpNotes(e.target.value)}
                disabled={processing}
                rows={3}
              />
            </div>

            {/* Buttons */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowTopUpDialog(false)}
                disabled={processing}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleTopUp}
                disabled={processing}
                className="flex-1"
              >
                {processing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Top Up"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Withdrawal Dialog */}
      <Dialog open={showWithdrawDialog} onOpenChange={setShowWithdrawDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Withdrawal</DialogTitle>
            <DialogDescription>
              Request a withdrawal from the operational wallet
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Amount */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Amount (KES)</label>
              <Input
                type="number"
                placeholder="0"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                disabled={processing}
              />
              <p className="text-xs text-gray-600">
                Available: {formatCurrency(wallet?.total_balance || 0)}
              </p>
            </div>

            {/* Reason */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Reason</label>
              <Textarea
                placeholder="Explain the purpose of this withdrawal"
                value={withdrawReason}
                onChange={(e) => setWithdrawReason(e.target.value)}
                disabled={processing}
                rows={3}
              />
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Phone Number</label>
              <Input
                type="tel"
                placeholder="254712345678"
                value={withdrawPhone}
                onChange={(e) => setWithdrawPhone(e.target.value)}
                disabled={processing}
              />
            </div>

            {/* Info */}
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This withdrawal will require approval from chairperson, secretary,
                and treasurer before funds are transferred.
              </AlertDescription>
            </Alert>

            {/* Buttons */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowWithdrawDialog(false)}
                disabled={processing}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleWithdraw}
                disabled={processing}
                className="flex-1"
              >
                {processing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Request Withdrawal"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
