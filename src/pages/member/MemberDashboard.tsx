import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { 
  TrendingUp, Clock, AlertTriangle, Calendar, 
  Building2, Copy, CreditCard, User,
  CheckCircle, ChevronRight
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

export default function MemberDashboard() {
  const { memberId } = useAuth();
  const [payOpen, setPayOpen] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payPhone, setPayPhone] = useState("");
  const [paying, setPaying] = useState(false);

  const handlePayNow = async () => {
    const amt = Number(payAmount);
    if (!amt || amt <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    setPaying(true);
    try {
      const { data, error } = await supabase.functions.invoke("coop-stk-push", {
        body: { member_id: memberId, amount: amt, phone: payPhone || undefined },
      });
      if (error) throw error;
      if ((data as any)?.setup_required) {
        toast.error((data as any).error || "Bank STK Push not configured yet");
      } else if ((data as any)?.ok) {
        toast.success((data as any).message || "Check your phone for the M-Pesa prompt");
        setPayOpen(false);
        setPayAmount("");
      } else {
        toast.error((data as any)?.message || "Failed to initiate payment");
      }
    } catch (e: any) {
      toast.error(e?.message || "Payment failed");
    } finally {
      setPaying(false);
    }
  };

  const { data: member } = useQuery({
    queryKey: ["my-member", memberId],
    queryFn: async () => {
      if (!memberId) return null;
      const { data } = await supabase.from("members").select("*").eq("id", memberId).single();
      return data;
    },
    enabled: !!memberId,
  });

  const { data: contributions } = useQuery({
    queryKey: ["my-contributions", memberId],
    queryFn: async () => {
      if (!memberId) return [];
      const { data } = await supabase
        .from("contributions")
        .select("*")
        .eq("member_id", memberId)
        .order("year", { ascending: false })
        .order("month", { ascending: false });
      return data || [];
    },
    enabled: !!memberId,
  });

  const { data: penalties } = useQuery({
    queryKey: ["my-penalties", memberId],
    queryFn: async () => {
      if (!memberId) return [];
      const { data } = await supabase.from("penalties").select("*").eq("member_id", memberId).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!memberId,
  });

  const { data: latestNews = [] } = useQuery({
    queryKey: ["latest-news-dashboard"],
    queryFn: async () => {
      const { data } = await supabase
        .from("news")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(2);
      return data || [];
    },
  });

  const { data: settings } = useQuery({
    queryKey: ["welfare-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("welfare_settings").select("*").limit(1).maybeSingle();
      return data;
    },
  });

  const currentYear = new Date().getFullYear();
  const totalPaidThisYear = contributions
    ?.filter(c => c.status === "paid" && c.year === currentYear)
    .reduce((s, c) => s + Number(c.amount), 0) || 0;
  
  const unpaidContributions = contributions?.filter(c => c.status !== "paid") || [];
  const unpaidAmount = unpaidContributions.reduce((s, c) => s + Number(c.amount), 0);
  const unpaidPenalties = penalties?.filter(p => !p.is_paid).reduce((s, p) => s + Number(p.amount), 0) || 0;
  const overdueAmount = unpaidPenalties + unpaidAmount;

  // Get next due date
  const nextUnpaid = unpaidContributions[0];
  const nextDueDate = nextUnpaid ? new Date(nextUnpaid.due_date) : null;
  const daysUntilDue = nextDueDate ? Math.ceil((nextDueDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : null;

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(n => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const copyBankDetails = () => {
    const details = `Bank: ${(settings as any)?.bank_name || 'Co-operative Bank'}\nPaybill: ${(settings as any)?.paybill_number || '400200'}\nAccount: ${(settings as any)?.account_number || '40088588'}`;
    navigator.clipboard.writeText(details);
    toast.success("Bank details copied!");
  };

  const memberSince = member?.created_at ? new Date(member.created_at).getFullYear() : new Date().getFullYear();

  return (
    <div className="space-y-4 pb-4">
      {/* Profile Section — borderless, no card */}
      <div className="flex items-center gap-4 px-1 pt-1">
        <div className="relative shrink-0">
          <div className="absolute -inset-1 rounded-full gradient-brand opacity-70 blur-md" aria-hidden />
          <Avatar className="relative h-20 w-20 ring-2 ring-white/70 shadow-brand">
            <AvatarImage src={member?.profile_picture_url || ""} alt={member?.name || "Member"} />
            <AvatarFallback className="gradient-brand text-primary-foreground text-2xl font-bold">
              {member?.name ? getInitials(member.name) : <User className="h-8 w-8" />}
            </AvatarFallback>
          </Avatar>
          <div className="absolute -bottom-0.5 -right-0.5 bg-success rounded-full p-1 ring-2 ring-background">
            <CheckCircle className="h-3.5 w-3.5 text-white" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground">Welcome back 👋</p>
          <h2 className="text-xl sm:text-2xl font-bold truncate text-gradient-brand leading-tight">
            {member?.name || "Member"}
          </h2>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <Badge className="text-[10px] h-5 glass-brand text-primary border-primary/30">
              <CheckCircle className="h-3 w-3 mr-1" />
              Verified
            </Badge>
            <span className="text-[11px] text-muted-foreground">Member since {memberSince}</span>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="glass border-white/40 overflow-hidden relative hover:shadow-glass-lg transition-all cursor-pointer">
          <div className="absolute inset-0 bg-gradient-to-br from-success/30 to-success/5 opacity-60 pointer-events-none" />
          <CardContent className="relative p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 rounded-xl glass-brand flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Total Contributed</p>
            <p className="text-xl font-bold mt-1 break-words leading-tight">
              KES {totalPaidThisYear.toLocaleString()}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">This Year</p>
          </CardContent>
        </Card>

        <Card className="glass border-white/40 overflow-hidden relative hover:shadow-glass-lg transition-all cursor-pointer">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-primary-glow/10 opacity-60 pointer-events-none" />
          <CardContent className="relative p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 rounded-xl glass-brand flex items-center justify-center">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Unpaid Contributions</p>
            <p className="text-xl font-bold mt-1 break-words leading-tight">
              KES {unpaidAmount.toLocaleString()}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              {unpaidContributions.length} Month{unpaidContributions.length !== 1 ? 's' : ''} Pending
            </p>
          </CardContent>
        </Card>

        <Card className="glass border-white/40 overflow-hidden relative hover:shadow-glass-lg transition-all cursor-pointer">
          <div className="absolute inset-0 bg-gradient-to-br from-destructive/30 to-destructive/5 opacity-60 pointer-events-none" />
          <CardContent className="relative p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 rounded-xl glass-brand flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-primary" />
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Overdue Payments</p>
            <p className="text-xl font-bold mt-1 break-words leading-tight">
              KES {overdueAmount.toLocaleString()}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">Due Now</p>
          </CardContent>
        </Card>

        <Card className="glass border-white/40 overflow-hidden relative hover:shadow-glass-lg transition-all cursor-pointer">
          <div className="absolute inset-0 bg-gradient-to-br from-secondary/30 to-secondary/5 opacity-60 pointer-events-none" />
          <CardContent className="relative p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 rounded-xl glass-brand flex items-center justify-center">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Next Due Date</p>
            <p className="text-base font-bold mt-1 break-words leading-tight">
              {nextDueDate ? nextDueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'No pending'}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              {daysUntilDue !== null ? `In ${daysUntilDue} Days` : 'All paid up!'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Latest News */}
      {latestNews.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Latest News</h3>
            <Link to="/member/news" className="text-xs text-primary hover:underline flex items-center gap-1">
              View All <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="space-y-3">
            {latestNews.map((news: any) => (
              <Card key={news.id} className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex gap-3">
                    {news.image_url && (
                      <img 
                        src={news.image_url} 
                        alt={news.title}
                        className="w-16 h-16 rounded-lg object-cover"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm line-clamp-1">{news.title}</h4>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                        {news.content}
                      </p>
                      <div className="flex items-center justify-between mt-2">
                        <p className="text-xs text-muted-foreground">
                          {new Date(news.created_at).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric' 
                          })}
                        </p>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Bank Payment Details */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <h3 className="font-semibold">Bank Payment Details</h3>
            <Badge variant="outline" className="ml-auto text-xs">
              <CheckCircle className="h-3 w-3 mr-1 text-green-500" />
              Verified
            </Badge>
          </div>
          
          <div className="grid grid-cols-2 gap-3 text-sm mb-3">
            <div>
              <p className="text-muted-foreground text-xs">Bank Name</p>
              <p className="font-medium">{(settings as any)?.bank_name || 'Co-operative Bank'}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Paybill Number</p>
              <p className="font-medium">{(settings as any)?.paybill_number || '400200'}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Account Number</p>
              <p className="font-medium">{(settings as any)?.account_number || '40088588'}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Reference</p>
              <p className="font-medium">{member?.member_id || 'Your Member ID'}</p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={copyBankDetails}>
              <Copy className="h-4 w-4 mr-1" />
              Copy Details
            </Button>
            <Button size="sm" className="flex-1 bg-primary" onClick={() => {
              setPayAmount(String(unpaidAmount > 0 ? unpaidAmount : ""));
              setPayPhone(member?.phone || "");
              setPayOpen(true);
            }}>
              <CreditCard className="h-4 w-4 mr-1" />
              Pay Now
            </Button>
          </div>

          <p className="text-xs text-muted-foreground mt-2 text-center flex items-center justify-center gap-1">
            <CheckCircle className="h-3 w-3" />
            Secure payments. Your contributions make a difference.
          </p>
        </CardContent>
      </Card>

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              Pay via M-Pesa
            </DialogTitle>
            <DialogDescription>
              You'll receive an M-Pesa prompt on your phone. Enter your PIN to complete the payment.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="pay-amount">Amount (KES)</Label>
              <Input id="pay-amount" type="number" inputMode="numeric" min={1}
                value={payAmount} onChange={(e) => setPayAmount(e.target.value)}
                placeholder="e.g. 1000" />
            </div>
            <div>
              <Label htmlFor="pay-phone">M-Pesa Phone</Label>
              <Input id="pay-phone" type="tel" value={payPhone}
                onChange={(e) => setPayPhone(e.target.value)}
                placeholder="07XXXXXXXX or 2547XXXXXXXX" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)} disabled={paying}>
              Cancel
            </Button>
            <Button onClick={handlePayNow} disabled={paying}>
              {paying ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending…</> : "Send Prompt"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
