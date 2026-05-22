import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { initiateB2CWithdrawal } from "@/lib/b2c";
import { toast } from "sonner";

interface SignatoryInfo {
  id: string;
  signatory_role: string;
  status: "pending" | "approved" | "rejected";
  signature_url?: string;
  approved_at?: string;
  rejected_at?: string;
  rejection_reason?: string;
  signatory_user_id?: string;
}

interface WithdrawalRequest {
  id: string;
  amount: number;
  reason: string;
  status: string;
  phone_number?: string;
  signatories: SignatoryInfo[];
  type: "penalty" | "donation" | "operational";
}

export function useWithdrawalApproval() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Load signatories for a withdrawal
  const loadSignatories = useCallback(
    async (withdrawalId: string, walletType: "penalty" | "donation" | "operational") => {
      try {
        const signatoryTable =
          walletType === "penalty"
            ? "withdrawal_signatories"
            : walletType === "donation"
              ? "donation_withdrawal_signatories"
              : "operational_withdrawal_signatories";

        const { data, error } = await supabase
          .from(signatoryTable)
          .select("*")
          .eq("withdrawal_id", withdrawalId);

        if (error) throw error;
        return data || [];
      } catch (error) {
        console.error("Error loading signatories:", error);
        toast.error("Failed to load signatories");
        return [];
      }
    },
    []
  );

  // Approve a withdrawal
  const approveWithdrawal = useCallback(
    async (
      withdrawal: WithdrawalRequest,
      userRole: string
    ): Promise<{ success: boolean; allApproved?: boolean; error?: string }> => {
      if (!user) {
        return { success: false, error: "Not authenticated" };
      }

      try {
        setProcessing(true);

        // Get user's signature from office_bearer_signatures
        const sigRoleKey = userRole === "treasurer" ? "admin" : userRole;
        let mySignatureUrl: string | null = null;
        try {
          const { data: sigRow } = await supabase
            .from("office_bearer_signatures")
            .select("signature_url")
            .eq("role", sigRoleKey)
            .maybeSingle();
          mySignatureUrl = (sigRow as any)?.signature_url ?? null;
        } catch (_) {
          /* ignore */
        }

        // Get user's full name from member profile
        const { data: memberRow } = await supabase
          .from("members")
          .select("name")
          .eq("user_id", user.id)
          .maybeSingle();
        const myFullName: string | null = (memberRow as any)?.name ?? null;

        // Upsert into signatory_signatures
        try {
          await (supabase.from("signatory_signatures") as any).upsert(
            {
              user_id: user.id,
              signatory_role: userRole,
              signature_url: mySignatureUrl,
              full_name: myFullName,
              updated_by: user.id,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id,signatory_role" }
          );
        } catch (_) {
          /* ignore */
        }

        // Update signatory status
        const signatoryTable =
          withdrawal.type === "penalty"
            ? "withdrawal_signatories"
            : withdrawal.type === "donation"
              ? "donation_withdrawal_signatories"
              : "operational_withdrawal_signatories";

        const updatePayload: any = {
          status: "approved",
          approved_at: new Date().toISOString(),
          signatory_user_id: user.id,
        };
        if (mySignatureUrl) {
          updatePayload.signature_url = mySignatureUrl;
        }

        const { error: updateError } = await (supabase
          .from(signatoryTable) as any)
          .update(updatePayload)
          .eq("withdrawal_id", withdrawal.id)
          .eq("signatory_role", userRole);

        if (updateError) throw updateError;

        // Check if all signatories have approved
        const { data: allSignatories } = await supabase
          .from(signatoryTable)
          .select("status")
          .eq("withdrawal_id", withdrawal.id);

        const allApproved = allSignatories?.every((s) => s.status === "approved");

        if (allApproved) {
          // Trigger B2C transfer
          const toastId = toast.loading("Processing B2C transfer...");

          const b2cResult = await initiateB2CWithdrawal({
            withdrawalId: withdrawal.id,
            amount: withdrawal.amount,
            phoneNumber: withdrawal.phone_number || "",
            reason: withdrawal.reason,
            adminName: user.email || "Admin",
            walletType: withdrawal.type,
          });

          toast.dismiss(toastId);

          if (b2cResult.success) {
            // Update withdrawal status to completed
            const withdrawalTable =
              withdrawal.type === "penalty"
                ? "penalty_withdrawals"
                : withdrawal.type === "donation"
                  ? "donation_withdrawals"
                  : "operational_withdrawals";

            await supabase
              .from(withdrawalTable)
              .update({
                status: "completed",
                submitted_at: new Date().toISOString(),
              })
              .eq("id", withdrawal.id);

            toast.success(
              `✅ Withdrawal completed! KES ${withdrawal.amount.toLocaleString()} transferred to ${withdrawal.phone_number}`
            );
          } else {
            toast.error(`Approval complete but transfer failed: ${b2cResult.error}`);
          }
        } else {
          toast.success("Withdrawal approved by you");
        }

        return { success: true, allApproved };
      } catch (error) {
        console.error("Error approving withdrawal:", error);
        const errorMsg = (error as Error).message || "Failed to approve withdrawal";
        toast.error(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setProcessing(false);
      }
    },
    [user]
  );

  // Reject a withdrawal
  const rejectWithdrawal = useCallback(
    async (
      withdrawal: WithdrawalRequest,
      userRole: string,
      rejectionReason: string
    ): Promise<{ success: boolean; error?: string }> => {
      if (!user) {
        return { success: false, error: "Not authenticated" };
      }

      if (!rejectionReason.trim()) {
        return { success: false, error: "Rejection reason is required" };
      }

      try {
        setProcessing(true);

        // Update signatory status
        const signatoryTable =
          withdrawal.type === "penalty"
            ? "withdrawal_signatories"
            : withdrawal.type === "donation"
              ? "donation_withdrawal_signatories"
              : "operational_withdrawal_signatories";

        const { error: updateError } = await (supabase
          .from(signatoryTable) as any)
          .update({
            status: "rejected",
            rejected_at: new Date().toISOString(),
            rejection_reason: rejectionReason,
            signatory_user_id: user.id,
          })
          .eq("withdrawal_id", withdrawal.id)
          .eq("signatory_role", userRole);

        if (updateError) throw updateError;

        // Check if any signatory has rejected
        const { data: allSignatories } = await supabase
          .from(signatoryTable)
          .select("status")
          .eq("withdrawal_id", withdrawal.id);

        const anyRejected = allSignatories?.some((s) => s.status === "rejected");

        if (anyRejected) {
          // Update withdrawal status to rejected
          const withdrawalTable =
            withdrawal.type === "penalty"
              ? "penalty_withdrawals"
              : withdrawal.type === "donation"
                ? "donation_withdrawals"
                : "operational_withdrawals";

          await supabase
            .from(withdrawalTable)
            .update({
              status: "rejected",
            })
            .eq("id", withdrawal.id);
        }

        toast.success("Withdrawal rejected");
        return { success: true };
      } catch (error) {
        console.error("Error rejecting withdrawal:", error);
        const errorMsg = (error as Error).message || "Failed to reject withdrawal";
        toast.error(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setProcessing(false);
      }
    },
    [user]
  );

  // Check if all signatories have approved
  const checkAllApproved = useCallback(
    async (withdrawalId: string, walletType: "penalty" | "donation" | "operational") => {
      try {
        const signatoryTable =
          walletType === "penalty"
            ? "withdrawal_signatories"
            : walletType === "donation"
              ? "donation_withdrawal_signatories"
              : "operational_withdrawal_signatories";

        const { data: allSignatories } = await supabase
          .from(signatoryTable)
          .select("status")
          .eq("withdrawal_id", withdrawalId);

        return allSignatories?.every((s) => s.status === "approved") ?? false;
      } catch (error) {
        console.error("Error checking approval status:", error);
        return false;
      }
    },
    []
  );

  return {
    loading,
    processing,
    loadSignatories,
    approveWithdrawal,
    rejectWithdrawal,
    checkAllApproved,
  };
}
