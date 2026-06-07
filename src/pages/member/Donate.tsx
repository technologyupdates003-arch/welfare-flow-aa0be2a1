import { useEffect, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Loader2, AlertCircle, CheckCircle, Phone, Wallet } from "lucide-react";
import { toast } from "sonner";
import { initiateDonationSTKPush } from "@/lib/stkpush";
import { Link } from "react-router-dom";

interface DonationCampaign {
  id: string;
  title: string;
  description: string;
  amount: number;
  goal_type?: "fixed" | "shared";
  target_total?: number | null;
  allow_partial?: boolean;
  active: boolean;
  created_at: string;
}

interface Member {
  id: string;
  phone: string;
  name: string;
}

export default function Donate() {
  const { user } = useAuth();
  const [member, setMember] = useState<Member | null>(null);
  const [campaigns, setCampaigns] = useState<DonationCampaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [paidSoFar, setPaidSoFar] = useState(0);
  const [payMode, setPayMode] = useState<"full" | "partial">("full");
  const [customAmount, setCustomAmount] = useState("");
  const [processing, setProcessing] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const selectedCampaign =
    campaigns.find((campaign) => campaign.id === selectedCampaignId) || campaigns[0] || null;

  const perMemberTarget = selectedCampaign ? Number(selectedCampaign.amount) : 0;
  const remaining = Math.max(perMemberTarget - paidSoFar, 0);
  const allowPartial = selectedCampaign?.allow_partial ?? false;
  const progressPct = perMemberTarget > 0 ? Math.min((paidSoFar / perMemberTarget) * 100, 100) : 0;

  const { isLoading, error: queryError } = useQuery<DonationCampaign[]>({
    queryKey: ["active-donation-campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("donation_campaigns")
        .select("*")
        .eq("active", true)
        .order("created_at", { ascending: false });

      if (error) {
        toast.error("Unable to load funds drives: " + error.message);
        return [];
      }

      const list = (data || []) as any as DonationCampaign[];
      setCampaigns(list);
      if (!selectedCampaignId && list.length > 0) {
        setSelectedCampaignId(list[0].id);
      }
      return list;
    },
    retry: 3,
    retryDelay: 1000,
  });

  useEffect(() => {
    const fetchMember = async () => {
      if (!user) return;
      const { data: memberData, error } = await supabase
        .from("members")
        .select("id, phone, name")
        .eq("user_id", user.id)
        .single();

      if (error) {
        toast.error("Unable to load your member profile");
        return;
      }

      setMember(memberData);
      setPhoneNumber(memberData.phone || "");
    };

    fetchMember();
  }, [user]);

  // Load how much this member has already contributed to the selected drive
  const loadProgress = useCallback(async () => {
    if (!member || !selectedCampaign) {
      setPaidSoFar(0);
      return;
    }
    const { data } = await supabase
      .from("donation_payment_records")
      .select("amount")
      .eq("member_id", member.id)
      .eq("campaign_id", selectedCampaign.id)
      .eq("status", "verified");

    const total = (data || []).reduce((sum, r: any) => sum + Number(r.amount || 0), 0);
    setPaidSoFar(total);
  }, [member, selectedCampaign]);

  useEffect(() => {
    loadProgress();
    setPayMode("full");
    setCustomAmount("");
  }, [loadProgress]);

  const handleDonate = async () => {
    if (!member || !selectedCampaign) {
      toast.error("Select a funds drive first");
      return;
    }
    if (!phoneNumber.trim()) {
      toast.error("Please enter your M-Pesa phone number");
      return;
    }

    // Resolve amount to charge
    let amountToPay = remaining > 0 ? remaining : perMemberTarget;
    if (payMode === "partial") {
      const custom = parseFloat(customAmount);
      if (!custom || custom <= 0) {
        toast.error("Enter an amount to pay");
        return;
      }
      amountToPay = custom;
    }

    if (amountToPay <= 0) {
      toast.error("You have already completed this funds drive");
      return;
    }

    setProcessing(true);
    setPaymentStatus("pending");
    setErrorMessage("");

    try {
      const result = await initiateDonationSTKPush(
        member.id,
        selectedCampaign.id,
        amountToPay,
        phoneNumber
      );

      if (result.success) {
        setPaymentStatus("success");
        toast.success("Payment prompt sent to your phone. Enter your M-Pesa PIN.");
        if (result.checkoutRequestId) {
          pollDonationStatus(result.checkoutRequestId);
        }
      } else {
        setPaymentStatus("error");
        setErrorMessage(result.error || "Failed to initiate payment");
        toast.error(result.error || "Failed to initiate payment");
      }
    } catch (error) {
      setPaymentStatus("error");
      const message = error instanceof Error ? error.message : "Unknown error";
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setProcessing(false);
    }
  };

  const pollDonationStatus = (checkoutRequestId: string) => {
    let attempts = 0;
    const maxAttempts = 30;

    const poll = async () => {
      attempts += 1;
      const { data } = await supabase
        .from("donation_payment_records")
        .select("status")
        .eq("mpesa_transaction_id", checkoutRequestId)
        .single();

      if (data?.status === "verified") {
        setPaymentStatus("success");
        toast.success("Payment verified successfully.");
        loadProgress();
        return;
      }

      if (data?.status === "failed" || attempts >= maxAttempts) {
        setPaymentStatus("error");
        setErrorMessage("Payment failed or timed out.");
        return;
      }

      setTimeout(poll, 10000);
    };

    poll();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Funds Drive</h1>
        <p className="text-gray-600 mt-2">Choose a funds drive and contribute via M-Pesa STK Push.</p>
      </div>

      {paymentStatus === "success" && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription>Payment prompt sent successfully. Check your phone to complete payment.</AlertDescription>
        </Alert>
      )}
      {paymentStatus === "error" && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      {campaigns.length === 0 && isLoading ? (
        <Card>
          <CardContent className="pt-6 space-y-3">
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
            <CardTitle className="text-center">Loading funds drives...</CardTitle>
          </CardContent>
        </Card>
      ) : campaigns.length === 0 ? (
        <Card>
          <CardContent className="pt-6 space-y-3">
            <CardTitle>No active funds drives</CardTitle>
            <CardDescription>There are no funds drives available right now. Check back later.</CardDescription>
            {queryError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>Error loading funds drives. Please try again.</AlertDescription>
              </Alert>
            )}
            <Link to="/member">
              <Button>Go back to dashboard</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Funds Drives</CardTitle>
                <CardDescription>Select a funds drive and pay your share.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {campaigns.map((campaign) => (
                  <button
                    key={campaign.id}
                    type="button"
                    onClick={() => setSelectedCampaignId(campaign.id)}
                    className={`block w-full rounded-2xl border p-4 text-left transition ${
                      campaign.id === selectedCampaign?.id
                        ? "border-primary bg-primary/5"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold">{campaign.title}</p>
                        <p className="text-sm text-slate-600 mt-1 line-clamp-2">{campaign.description}</p>
                        {campaign.allow_partial && (
                          <span className="mt-2 inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                            Lipa Mdogo Mdogo
                          </span>
                        )}
                      </div>
                      <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                        KES {Number(campaign.amount).toLocaleString()}
                      </div>
                    </div>
                  </button>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Your Contribution</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedCampaign ? (
                <>
                  <div className="space-y-2">
                    <p className="text-sm text-slate-500">Funds Drive</p>
                    <p className="font-semibold text-lg">{selectedCampaign.title}</p>
                    <p className="text-sm text-slate-600">{selectedCampaign.description}</p>
                  </div>

                  {/* Progress */}
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">Your share</span>
                      <span className="font-semibold">KES {perMemberTarget.toLocaleString()}</span>
                    </div>
                    <Progress value={progressPct} className="h-2" />
                    <div className="flex items-center justify-between text-xs text-slate-600">
                      <span>Paid: KES {paidSoFar.toLocaleString()}</span>
                      <span>Remaining: KES {remaining.toLocaleString()}</span>
                    </div>
                  </div>

                  {remaining <= 0 ? (
                    <Alert className="border-green-200 bg-green-50">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <AlertDescription>You have completed your share. Asante!</AlertDescription>
                    </Alert>
                  ) : (
                    <>
                      {/* Payment mode */}
                      {allowPartial && (
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setPayMode("full")}
                            className={`rounded-lg border p-2 text-sm transition ${
                              payMode === "full" ? "border-primary bg-primary/5 font-semibold" : "border-slate-200"
                            }`}
                          >
                            Pay full
                            <span className="block text-xs text-slate-500">
                              KES {remaining.toLocaleString()}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setPayMode("partial")}
                            className={`rounded-lg border p-2 text-sm transition ${
                              payMode === "partial" ? "border-primary bg-primary/5 font-semibold" : "border-slate-200"
                            }`}
                          >
                            Lipa Mdogo Mdogo
                            <span className="block text-xs text-slate-500">Pay any amount</span>
                          </button>
                        </div>
                      )}

                      {allowPartial && payMode === "partial" && (
                        <div>
                          <label className="block text-sm font-medium text-slate-700">Amount to pay (KES)</label>
                          <div className="mt-2 flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
                            <Wallet className="h-4 w-4 text-slate-400" />
                            <Input
                              type="number"
                              min="1"
                              value={customAmount}
                              onChange={(e) => setCustomAmount(e.target.value)}
                              placeholder="e.g. 100"
                            />
                          </div>
                        </div>
                      )}

                      <div>
                        <label className="block text-sm font-medium text-slate-700">M-Pesa Phone Number</label>
                        <div className="mt-2 flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
                          <Phone className="h-4 w-4 text-slate-400" />
                          <Input
                            type="tel"
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(e.target.value)}
                            placeholder="0722XXXXXX"
                          />
                        </div>
                      </div>

                      <Button onClick={handleDonate} disabled={processing} className="w-full">
                        {processing ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...
                          </>
                        ) : payMode === "partial" ? (
                          `Pay KES ${(parseFloat(customAmount) || 0).toLocaleString()}`
                        ) : (
                          `Pay KES ${remaining.toLocaleString()}`
                        )}
                      </Button>

                      <div className="rounded-2xl bg-blue-50 p-3 text-sm text-blue-800">
                        {allowPartial
                          ? "You can pay in bits (Lipa Mdogo Mdogo) until you reach your share."
                          : "Complete the M-Pesa prompt on your phone to proceed."}
                      </div>
                    </>
                  )}
                </>
              ) : (
                <p className="text-sm text-slate-600">Select a funds drive to continue.</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
