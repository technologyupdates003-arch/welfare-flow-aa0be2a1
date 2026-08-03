// Shared "view as member" routes so an admin fully switches into a member's
// dashboard (all member sidebar pages, member's own data) from any role block.
import { Route } from "react-router-dom";
import {
  ImpersonateMemberDashboard,
  ImpersonateMemberEvents,
  ImpersonateMemberDocuments,
  ImpersonateMemberDownloads,
  ImpersonateWithdrawalReceipts,
  ImpersonateMemberNews,
  ImpersonateMemberBeneficiaries,
  ImpersonateMemberNotifications,
  ImpersonateMemberProfile,
  ImpersonatePayPenalty,
  ImpersonateDonate,
  ImpersonateExecutiveDashboard,
} from "@/pages/admin/ImpersonateWrappers";

const base = "/admin/members/:memberId/view-as-member";

export const impersonateRoutes = [
  <Route key="imp-root" path={base} element={<ImpersonateMemberDashboard />} />,
  <Route key="imp-dash" path={`${base}/dashboard`} element={<ImpersonateMemberDashboard />} />,
  <Route key="imp-events" path={`${base}/events`} element={<ImpersonateMemberEvents />} />,
  <Route key="imp-docs" path={`${base}/documents`} element={<ImpersonateMemberDocuments />} />,
  <Route key="imp-downloads" path={`${base}/downloads`} element={<ImpersonateMemberDownloads />} />,
  <Route key="imp-receipts" path={`${base}/withdrawal-receipts`} element={<ImpersonateWithdrawalReceipts />} />,
  <Route key="imp-news" path={`${base}/news`} element={<ImpersonateMemberNews />} />,
  <Route key="imp-benef" path={`${base}/beneficiaries`} element={<ImpersonateMemberBeneficiaries />} />,
  <Route key="imp-notif" path={`${base}/notifications`} element={<ImpersonateMemberNotifications />} />,
  <Route key="imp-profile" path={`${base}/profile`} element={<ImpersonateMemberProfile />} />,
  <Route key="imp-penalty" path={`${base}/pay-penalty`} element={<ImpersonatePayPenalty />} />,
  <Route key="imp-donate" path={`${base}/donate`} element={<ImpersonateDonate />} />,
  <Route key="imp-exec" path={`${base}/executive/:roleName`} element={<ImpersonateExecutiveDashboard />} />,
];
