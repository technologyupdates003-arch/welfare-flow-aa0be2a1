// Re-uses the unified withdrawal approval workflow. The shared component
// detects the signed-in user's signatory role and shows pending requests
// from BOTH the penalty wallet and the donation wallet. The last
// signatory to approve triggers the B2C transfer automatically.
export { default } from "@/pages/admin/WithdrawalApproval";
