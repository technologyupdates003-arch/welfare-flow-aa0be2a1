import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle, CheckCircle, Phone } from "lucide-react";
import { toast } from "sonner";
import { initiateDonationSTKPush } from "@/lib/stkpush";
import { Link } from "react-router-dom";

interface DonationCampaign {
  id: string;
  title: string;
  description: string;
  amount: number;
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
  const [processing, setProcessing] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const selectedCampaign = campaigns.find((campaign) => campaign.id === selectedCampaignId) || campaigns[0] || null;

  const { data: activeCampaigns = [] } = useQuery<DonationCampaign[]>({
    queryKey: ["active-donation-campaigns"],
    queryFn: async () => {
      const { data } = await supabase
        .from("donation_campaigns")
        .select("*")
        .eq("active", true)
        .order("created_at", { ascending: false });
      const list = (data || []) as any as DonationCampaign[];
      setCampaigns(list);
      if (!selectedCampaignId && list.length > 0) {
        setSelectedCampaignId(list[0].id);
      }
      return list;
    },
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

  const handleDonate = async () => {
    if (!member || !selectedCampaign) {
      toast.error("Select a donation campaign first");
      return;
    }

    if (!phoneNumber.trim()) {
      toast.error("Please enter your M-Pesa phone number");
      return;
    }

    setProcessing(true);
    setPaymentStatus("pending");
    setErrorMessage("");

    try {
      const result = await initiateDonationSTKPush(
        member.id,
        selectedCampaign.id,
        selectedCampaign.amount,
        phoneNumber
      );

      if (result.success) {
        setPaymentStatus("success");
        toast.success("Donation prompt sent to your phone. Enter your M-Pesa PIN.");

        if (result.checkoutRequestId) {
          pollDonationStatus(result.checkoutRequestId);
        }
      } else {
        setPaymentStatus("error");
        setErrorMessage(result.error || "Failed to initiate donation payment");
        toast.error(result.error || "Failed to initiate donation payment");
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
        toast.success("Donation payment verified successfully.");
        return;
      }

      if (data?.status === "failed" || attempts >= maxAttempts) {
        setPaymentStatus("error");
        setErrorMessage("Donation payment failed or timed out.");
        return;
      }

      setTimeout(poll, 10000);
    };

    poll();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Donation Wallet</h1>
        <p className="text-gray-600 mt-2">Choose a donation request and pay via M-Pesa STK Push.</p>
      </div>

      {paymentStatus === "success" && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription>Donation prompt sent successfully. Check your phone to complete payment.</AlertDescription>
        </Alert>
      )}
      {paymentStatus === "error" && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      {campaigns.length === 0 ? (
        <Card>
          <CardContent className="space-y-3">
            <CardTitle>No active donation campaigns</CardTitle>
            <CardDescription>There are no donation requests available right now. Check back later.</CardDescription>
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
                <CardTitle>Donation Campaigns</CardTitle>
                <CardDescription>Select a campaign and pay the requested amount.</CardDescription>
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
              <CardTitle>Selected Donation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedCampaign ? (
                <>
                  <div className="space-y-2">
                    <p className="text-sm text-slate-500">Campaign</p>
                    <p className="font-semibold text-lg">{selectedCampaign.title}</p>
                    <p className="text-sm text-slate-600">{selectedCampaign.description}</p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm text-slate-500">Amount</p>
                    <p className="mt-1 text-2xl font-bold">KES {Number(selectedCampaign.amount).toLocaleString()}</p>
                  </div>

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
                    ) : (
                      `Donate KES ${Number(selectedCampaign.amount).toLocaleString()}`
                    )}
                  </Button>

                  <div className="rounded-2xl bg-blue-50 p-3 text-sm text-blue-800">
                    Your donation will be requested through M-Pesa STK push. Complete the prompt on your phone to proceed.
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-600">Select a campaign to continue.</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
