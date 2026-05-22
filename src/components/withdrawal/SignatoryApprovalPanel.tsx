import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, AlertCircle } from "lucide-react";

interface SignatoryInfo {
  id: string;
  signatory_role: string;
  status: "pending" | "approved" | "rejected";
  signature_url?: string;
  approved_at?: string;
  rejected_at?: string;
  rejection_reason?: string;
  signatory_user_id?: string;
  full_name?: string;
  profile_photo_url?: string;
}

interface SignatoryApprovalPanelProps {
  signatory: SignatoryInfo;
  showSignature?: boolean;
}

export function SignatoryApprovalPanel({
  signatory,
  showSignature = true,
}: SignatoryApprovalPanelProps) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "approved":
        return <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />;
      case "rejected":
        return <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />;
      case "pending":
        return <AlertCircle className="h-5 w-5 text-yellow-500 flex-shrink-0" />;
      default:
        return null;
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "approved":
        return "default";
      case "rejected":
        return "destructive";
      case "pending":
        return "outline";
      default:
        return "secondary";
    }
  };

  const formatTimestamp = (timestamp?: string) => {
    if (!timestamp) return null;
    return new Date(timestamp).toLocaleString();
  };

  return (
    <Card className="border border-gray-200">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between gap-4">
          {/* Left: Profile & Info */}
          <div className="flex items-start gap-3 flex-1">
            {/* Profile Photo */}
            {signatory.profile_photo_url ? (
              <img
                src={signatory.profile_photo_url}
                alt={signatory.full_name || signatory.signatory_role}
                className="h-12 w-12 rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <div className="h-12 w-12 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-semibold text-gray-600">
                  {(signatory.full_name || signatory.signatory_role)
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()}
                </span>
              </div>
            )}

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="font-semibold capitalize text-sm">
                  {signatory.full_name || signatory.signatory_role}
                </p>
                {signatory.status !== "pending" && getStatusIcon(signatory.status)}
              </div>

              <p className="text-xs text-gray-600 capitalize mb-2">
                {signatory.signatory_role}
              </p>

              {/* Timestamp */}
              {signatory.status === "approved" && signatory.approved_at && (
                <p className="text-xs text-green-600">
                  Approved {formatTimestamp(signatory.approved_at)}
                </p>
              )}
              {signatory.status === "rejected" && signatory.rejected_at && (
                <div>
                  <p className="text-xs text-red-600">
                    Rejected {formatTimestamp(signatory.rejected_at)}
                  </p>
                  {signatory.rejection_reason && (
                    <p className="text-xs text-red-500 mt-1 italic">
                      Reason: {signatory.rejection_reason}
                    </p>
                  )}
                </div>
              )}
              {signatory.status === "pending" && (
                <p className="text-xs text-yellow-600">Awaiting approval</p>
              )}

              {/* Signature Display */}
              {showSignature &&
                signatory.status === "approved" &&
                signatory.signature_url && (
                  <div className="mt-3">
                    <p className="text-xs font-medium text-gray-600 mb-1">
                      Signature:
                    </p>
                    <img
                      src={signatory.signature_url}
                      alt={`${signatory.signatory_role} signature`}
                      className="h-16 object-contain bg-gray-50 p-1 rounded border border-gray-200"
                    />
                  </div>
                )}
            </div>
          </div>

          {/* Right: Status Badge */}
          <Badge variant={getStatusBadgeVariant(signatory.status) as any}>
            {signatory.status}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
