// Wrapper components for member pages when accessed through admin impersonation
// These maintain the ImpersonateProvider context so data shows for the impersonated member

import { ImpersonateProvider } from "@/lib/impersonate-context";
import MemberLayout from "@/components/layout/MemberLayout";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, AlertCircle } from "lucide-react";
import { useState, useEffect } from "react";

// Individual page imports
import MemberDashboard from "@/pages/member/MemberDashboard";
import MemberEvents from "@/pages/member/MemberEvents";
import MemberDocuments from "@/pages/member/MemberDocuments";
import MemberDownloads from "@/pages/member/MemberDownloads";
import WithdrawalReceipts from "@/pages/WithdrawalReceipts";
import MemberNews from "@/pages/member/MemberNews";
import MemberBeneficiaries from "@/pages/member/MemberBeneficiaries";
import MemberNotifications from "@/pages/member/MemberNotifications";
import MemberProfile from "@/pages/member/MemberProfile";
import PayPenalty from "@/pages/member/PayPenalty";
import Donate from "@/pages/member/Donate";
import ExecutiveDashboard from "@/pages/member/ExecutiveDashboard";

// Base wrapper component for admin viewing member pages
const ImpersonatePageWrapper = ({ 
  children,
  onBackToAdmin 
}: { 
  children: React.ReactNode;
  onBackToAdmin: () => void;
}) => {
  const { memberId } = useParams();
  const navigate = useNavigate();
  const { role } = useAuth();
  const [isAuthorized, setIsAuthorized] = useState(false);

  // Verify admin is viewing
  const { data: member, isLoading } = useQuery({
    queryKey: ["member-impersonate", memberId],
    queryFn: async () => {
      if (!memberId) return null;
      const { data } = await supabase.from("members").select("*").eq("id", memberId).single();
      return data;
    },
    enabled: !!memberId,
  });

  // Check if user is admin
  useEffect(() => {
    if (role === "admin" || role === "super_admin") {
      setIsAuthorized(true);
    }
  }, [role]);

  if (!isAuthorized) {
    return (
      <div className="space-y-4 pb-4">
        <Button variant="outline" onClick={() => navigate("/admin/members")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Members
        </Button>
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6 flex gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-red-900">Access Denied</p>
              <p className="text-red-800 mt-1">Only admins can impersonate members.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4 pb-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">Loading member data...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!member) {
    return (
      <div className="space-y-4 pb-4">
        <Button variant="outline" onClick={() => navigate("/admin/members")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Members
        </Button>
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-6 flex gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-amber-900">Member Not Found</p>
              <p className="text-amber-800 mt-1">The member you're trying to view does not exist.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render with impersonation context
  return (
    <ImpersonateProvider impersonatedMemberId={memberId}>
      <MemberLayout 
        impersonateMode={true}
        impersonatedMemberId={memberId}
        onBackToAdmin={onBackToAdmin}
      >
        {children}
      </MemberLayout>
    </ImpersonateProvider>
  );
};

// Export individual wrapped components
export const ImpersonateMemberDashboard = () => {
  const navigate = useNavigate();
  return (
    <ImpersonatePageWrapper onBackToAdmin={() => navigate("/admin/members")}>
      <MemberDashboard impersonateMode={true} />
    </ImpersonatePageWrapper>
  );
};

export const ImpersonateMemberEvents = () => {
  const navigate = useNavigate();
  return (
    <ImpersonatePageWrapper onBackToAdmin={() => navigate("/admin/members")}>
      <MemberEvents />
    </ImpersonatePageWrapper>
  );
};

export const ImpersonateMemberDocuments = () => {
  const navigate = useNavigate();
  return (
    <ImpersonatePageWrapper onBackToAdmin={() => navigate("/admin/members")}>
      <MemberDocuments />
    </ImpersonatePageWrapper>
  );
};

export const ImpersonateMemberDownloads = () => {
  const navigate = useNavigate();
  return (
    <ImpersonatePageWrapper onBackToAdmin={() => navigate("/admin/members")}>
      <MemberDownloads />
    </ImpersonatePageWrapper>
  );
};

export const ImpersonateWithdrawalReceipts = () => {
  const navigate = useNavigate();
  return (
    <ImpersonatePageWrapper onBackToAdmin={() => navigate("/admin/members")}>
      <WithdrawalReceipts />
    </ImpersonatePageWrapper>
  );
};

export const ImpersonateMemberNews = () => {
  const navigate = useNavigate();
  return (
    <ImpersonatePageWrapper onBackToAdmin={() => navigate("/admin/members")}>
      <MemberNews />
    </ImpersonatePageWrapper>
  );
};

export const ImpersonateMemberBeneficiaries = () => {
  const navigate = useNavigate();
  return (
    <ImpersonatePageWrapper onBackToAdmin={() => navigate("/admin/members")}>
      <MemberBeneficiaries />
    </ImpersonatePageWrapper>
  );
};

export const ImpersonateMemberNotifications = () => {
  const navigate = useNavigate();
  return (
    <ImpersonatePageWrapper onBackToAdmin={() => navigate("/admin/members")}>
      <MemberNotifications />
    </ImpersonatePageWrapper>
  );
};

export const ImpersonateMemberProfile = () => {
  const navigate = useNavigate();
  return (
    <ImpersonatePageWrapper onBackToAdmin={() => navigate("/admin/members")}>
      <MemberProfile />
    </ImpersonatePageWrapper>
  );
};

export const ImpersonatePayPenalty = () => {
  const navigate = useNavigate();
  return (
    <ImpersonatePageWrapper onBackToAdmin={() => navigate("/admin/members")}>
      <PayPenalty />
    </ImpersonatePageWrapper>
  );
};

export const ImpersonateDonate = () => {
  const navigate = useNavigate();
  return (
    <ImpersonatePageWrapper onBackToAdmin={() => navigate("/admin/members")}>
      <Donate />
    </ImpersonatePageWrapper>
  );
};

export const ImpersonateExecutiveDashboard = () => {
  const navigate = useNavigate();
  return (
    <ImpersonatePageWrapper onBackToAdmin={() => navigate("/admin/members")}>
      <ExecutiveDashboard />
    </ImpersonatePageWrapper>
  );
};
