import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, AlertCircle } from "lucide-react";
import { useEffect, useState } from "react";

export default function MemberDetailAsImpersonate() {
  const { memberId } = useParams();
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const [isAuthorized, setIsAuthorized] = useState(false);

  // Verify admin is viewing and get member info
  const { data: member, isLoading } = useQuery({
    queryKey: ["member-impersonate", memberId],
    queryFn: async () => {
      if (!memberId) return null;
      const { data } = await supabase.from("members").select("*").eq("id", memberId).single();
      return data;
    },
    enabled: !!memberId,
  });

  // Check if user is admin and authorize
  useEffect(() => {
    if (role === "admin" || role === "super_admin") {
      setIsAuthorized(true);
    }
  }, [role]);

  // If authorized and member exists, redirect to the impersonate dashboard
  useEffect(() => {
    if (isAuthorized && member && memberId) {
      navigate(`/admin/members/${memberId}/view-as-member/dashboard`);
    }
  }, [isAuthorized, member, memberId, navigate]);

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

  // Redirecting...
  return (
    <div className="space-y-4 pb-4">
      <Card>
        <CardContent className="pt-6 text-center">
          <p className="text-muted-foreground">Loading member dashboard...</p>
        </CardContent>
      </Card>
    </div>
  );
}
