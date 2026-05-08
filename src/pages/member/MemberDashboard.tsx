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
      {/* Profile Section */}
      <Card className="border-0 shadow-sm">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="relative">
              <Avatar className="h-20 w-20 border-4 border-background shadow-lg">
                <AvatarImage src={member?.profile_picture_url || ""} alt={member?.name || "Member"} />
                <AvatarFallback className="bg-gradient-to-br from-primary to-primary/70 text-white text-2xl font-bold">
                  {member?.name ? getInitials(member.name) : <User className="h-8 w-8" />}
                </AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-1 -right-1 bg-primary rounded-full p-1">
                <CheckCircle className="h-4 w-4 text-white" />
              </div>
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold flex items-center gap-2">
                {member?.name || "Member"} 👋
              </h2>
              <p className="text-sm text-muted-foreground">Active Member since {memberSince}</p>
              <Badge variant="secondary" className="mt-1 text-xs">
                <CheckCircle className="h-3 w-3 mr-1" />
                Verified Member
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Total Contributed */}
        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800 cursor-pointer hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-green-500 rounded-lg">
                <TrendingUp className="h-5 w-5 text-white" />
              </div>
              <ChevronRight className="h-4 w-4 text-green-600" />
            </div>
            <p className="text-xs text-green-700 dark:text-green-300 font-medium mb-1">Total Contributed</p>
            <p className="text-2xl font-bold text-green-900 dark:text-green-100">
              KES {totalPaidThisYear.toLocaleString()}
            </p>
            <p className="text-xs text-green-600 dark:text-green-400 mt-1">This Year</p>
          </CardContent>
        </Card>

        {/* Unpaid Contributions */}
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800 cursor-pointer hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-blue-500 rounded-lg">
                <Clock className="h-5 w-5 text-white" />
              </div>
              <ChevronRight className="h-4 w-4 text-blue-600" />
            </div>
            <p className="text-xs text-blue-700 dark:text-blue-300 font-medium mb-1">Unpaid Contributions</p>
            <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
              KES {unpaidAmount.toLocaleString()}
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
              {unpaidContributions.length} Month{unpaidContributions.length !== 1 ? 's' : ''} Pending
            </p>
          </CardContent>
        </Card>

        {/* Overdue Payments */}
        <Card className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950 dark:to-red-900 border-red-200 dark:border-red-800 cursor-pointer hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-red-500 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-white" />
              </div>
              <ChevronRight className="h-4 w-4 text-red-600" />
            </div>
            <p className="text-xs text-red-700 dark:text-red-300 font-medium mb-1">Overdue Payments</p>
            <p className="text-2xl font-bold text-red-900 dark:text-red-100">
              KES {overdueAmount.toLocaleString()}
            </p>
            <p className="text-xs text-red-600 dark:text-red-400 mt-1">Due Now</p>
          </CardContent>
        </Card>

        {/* Next Due Date */}
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800 cursor-pointer hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-purple-500 rounded-lg">
                <Calendar className="h-5 w-5 text-white" />
              </div>
              <ChevronRight className="h-4 w-4 text-purple-600" />
            </div>
            <p className="text-xs text-purple-700 dark:text-purple-300 font-medium mb-1">Next Due Date</p>
            <p className="text-lg font-bold text-purple-900 dark:text-purple-100">
              {nextDueDate ? nextDueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'No pending'}
            </p>
            <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
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
            <Button size="sm" className="flex-1 bg-primary">
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
    </div>
  );
}
