import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useImpersonate } from "@/lib/impersonate-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, ArrowLeft, Award, CheckCircle } from "lucide-react";
import { useState, useMemo } from "react";

export default function ExecutiveDashboard() {
  const { roleName } = useParams();
  const navigate = useNavigate();
  const { memberId, roles } = useAuth();
  const { impersonatedMemberId, isImpersonating } = useImpersonate();
  const effectiveMemberId = isImpersonating ? impersonatedMemberId : memberId;
  const [selectedRole, setSelectedRole] = useState(roleName);

  // Fetch member data
  const { data: member } = useQuery({
    queryKey: ["my-member", effectiveMemberId],
    queryFn: async () => {
      if (!effectiveMemberId) return null;
      const { data } = await supabase.from("members").select("*").eq("id", effectiveMemberId).single();
      return data;
    },
    enabled: !!effectiveMemberId,
  });

  // Fetch executive badge info
  const { data: badgeInfo } = useQuery({
    queryKey: ["executive-badge", selectedRole],
    queryFn: async () => {
      if (!selectedRole) return null;
      const { data } = await supabase
        .from("executive_badges")
        .select("*")
        .eq("role_name", selectedRole)
        .maybeSingle();
      return data;
    },
    enabled: !!selectedRole,
  });

  // Fetch member's executive roles
  const { data: memberRoles = [] } = useQuery({
    queryKey: ["member-executive-roles", effectiveMemberId],
    queryFn: async () => {
      if (!effectiveMemberId) return [];
      const { data } = await supabase
        .from("member_executive_roles")
        .select("*")
        .eq("member_id", effectiveMemberId)
        .eq("is_active", true);
      return data || [];
    },
    enabled: !!effectiveMemberId,
  });

  // Check if this member has the selected role
  const hasRole = useMemo(() => {
    return memberRoles.some(r => r.role_name === selectedRole);
  }, [memberRoles, selectedRole]);

  // Available executive roles
  const executiveRoles = [
    { id: "chairperson", label: "Chairperson" },
    { id: "vice_chairperson", label: "Vice Chairperson" },
    { id: "secretary", label: "Secretary" },
    { id: "vice_secretary", label: "Vice Secretary" },
    { id: "executive", label: "Executive" },
  ];

  const currentRoleLabel = executiveRoles.find(r => r.id === selectedRole)?.label || selectedRole;

  if (!hasRole) {
    return (
      <div className="space-y-4 pb-4">
        <Button variant="outline" onClick={() => navigate("/member")} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-6 flex gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-amber-900">Access Denied</p>
              <p className="text-amber-800 mt-1">You don't have the {currentRoleLabel} role assigned.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // For "executive" role, don't show full dashboard - just show badge
  if (selectedRole === "executive") {
    const memberRole = memberRoles.find(r => r.role_name === "executive");

    return (
      <div className="space-y-6 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={() => navigate("/member")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Executive Badge</h1>
              <p className="text-muted-foreground mt-1">Your official executive membership badge</p>
            </div>
          </div>
        </div>

        {/* Badge Display */}
        {badgeInfo && (
          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5 text-primary" />
                Executive Member
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Badge Image */}
              <div className="flex justify-center">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/5 rounded-2xl blur-xl" />
                  <img
                    src={badgeInfo.badge_url}
                    alt="Executive badge"
                    className="relative h-48 w-48 object-contain drop-shadow-lg"
                  />
                </div>
              </div>

              {/* Badge Info */}
              <div className="space-y-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="text-base px-3 py-1">
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Executive Member
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {badgeInfo.description || "You are part of the executive membership of the organization."}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                  <div>
                    <p className="text-xs text-muted-foreground">Member Name</p>
                    <p className="font-medium">{member?.name || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Member ID</p>
                    <p className="font-medium">{member?.member_id || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Assigned Date</p>
                    <p className="font-medium">
                      {memberRole?.created_at
                        ? new Date(memberRole.created_at).toLocaleDateString()
                        : "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Status</p>
                    <p className="font-medium flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-green-500" />
                      Active
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Info Card */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6 flex gap-3">
            <CheckCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium">Executive Member Benefits</p>
              <ul className="mt-2 space-y-1 text-xs">
                <li>• Access to executive meeting minutes</li>
                <li>• Receive executive communications</li>
                <li>• Participate in executive discussions</li>
                <li>• Official member of the executive body</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const memberRole = memberRoles.find(r => r.role_name === selectedRole);

  return (
    <div className="space-y-6 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => navigate("/member")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{currentRoleLabel} Dashboard</h1>
            <p className="text-muted-foreground mt-1">Executive member portal</p>
          </div>
        </div>
      </div>

      {/* Role Selection Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {memberRoles.map((role) => (
          <Button
            key={role.id}
            variant={selectedRole === role.role_name ? "default" : "outline"}
            onClick={() => setSelectedRole(role.role_name)}
            className="whitespace-nowrap"
          >
            {executiveRoles.find(r => r.id === role.role_name)?.label || role.role_name}
          </Button>
        ))}
      </div>

      {/* Badge Display */}
      {badgeInfo && (
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" />
              Executive Badge
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Badge Image */}
            <div className="flex justify-center">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/5 rounded-2xl blur-xl" />
                <img
                  src={badgeInfo.badge_url}
                  alt={badgeInfo.role_name}
                  className="relative h-48 w-48 object-contain drop-shadow-lg"
                />
              </div>
            </div>

            {/* Badge Info */}
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Badge className="text-base px-3 py-1">
                    <CheckCircle className="h-4 w-4 mr-2" />
                    {currentRoleLabel}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {badgeInfo.description || `Official badge for the ${currentRoleLabel} position.`}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div>
                  <p className="text-xs text-muted-foreground">Member Name</p>
                  <p className="font-medium">{member?.name || "N/A"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Member ID</p>
                  <p className="font-medium">{member?.member_id || "N/A"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Assigned Date</p>
                  <p className="font-medium">
                    {memberRole?.created_at
                      ? new Date(memberRole.created_at).toLocaleDateString()
                      : "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <p className="font-medium flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-green-500" />
                    Active
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Role Description */}
      <Card>
        <CardHeader>
          <CardTitle>About This Role</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {selectedRole === "chairperson" && (
            <div className="space-y-2">
              <p className="text-sm">
                As Chairperson, you are the head of the organization and responsible for:
              </p>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Presiding over all meetings</li>
                <li>Approving meeting minutes</li>
                <li>Providing leadership and direction</li>
                <li>Representing the organization</li>
              </ul>
            </div>
          )}
          {selectedRole === "vice_chairperson" && (
            <div className="space-y-2">
              <p className="text-sm">
                As Vice Chairperson, you support the Chairperson and:
              </p>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Assist with organizational leadership</li>
                <li>Cover for the Chairperson when needed</li>
                <li>Support meeting proceedings</li>
                <li>Contribute to strategic decisions</li>
              </ul>
            </div>
          )}
          {selectedRole === "secretary" && (
            <div className="space-y-2">
              <p className="text-sm">
                As Secretary, you maintain organizational records and:
              </p>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Record meeting minutes</li>
                <li>Manage organizational documents</li>
                <li>Handle correspondence</li>
                <li>Maintain membership records</li>
              </ul>
            </div>
          )}
          {selectedRole === "vice_secretary" && (
            <div className="space-y-2">
              <p className="text-sm">
                As Vice Secretary, you support the Secretary and:
              </p>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Assist with minute recording</li>
                <li>Support document management</li>
                <li>Help with administrative tasks</li>
                <li>Cover for the Secretary when needed</li>
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6 flex gap-3">
          <CheckCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium">Executive Role Portal</p>
            <p className="mt-1">
              This badge represents your official position in the organization. Keep it with pride as you fulfill your duties.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
