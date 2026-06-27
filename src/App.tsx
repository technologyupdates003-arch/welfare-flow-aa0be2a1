import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import InstallBanner from "@/components/InstallBanner";
import { useNotifications } from "@/hooks/useNotifications";
import Login from "@/pages/Login";
import AdminLayout from "@/components/layout/AdminLayout";
import SuperAdminLayout from "@/components/layout/SuperAdminLayout";
import MemberLayout from "@/components/layout/MemberLayout";
import OfficeLayout from "@/components/layout/OfficeLayout";
import AdminDashboard from "@/pages/admin/Dashboard";
import Members from "@/pages/admin/Members";
import MemberDetail from "@/pages/admin/MemberDetail";
import Contributions from "@/pages/admin/Contributions";
import ExcelImport from "@/pages/admin/ExcelImport";
import BeneficiaryImport from "@/pages/admin/BeneficiaryImport";
import Payments from "@/pages/admin/Payments";
import UnmatchedPayments from "@/pages/admin/UnmatchedPayments";
import BulkSms from "@/pages/admin/BulkSms";
import AdminEvents from "@/pages/admin/Events";
import Schedule from "@/pages/admin/Schedule";
import AdminDocuments from "@/pages/admin/Documents";
import AdminNews from "@/pages/admin/News";
import AdminMeetingMinutes from "@/pages/admin/MeetingMinutes";
import AdminNotifications from "@/pages/admin/Notifications";
import AdminSettings from "@/pages/admin/Settings";
import OfficeSignatures from "@/pages/admin/OfficeSignatures";
import BeneficiaryRequests from "@/pages/admin/BeneficiaryRequests";
import Beneficiaries from "@/pages/admin/Beneficiaries";
import Defaulters from "@/pages/admin/Defaulters";
import VerifyPenaltyPayments from "@/pages/admin/VerifyPenaltyPayments";
import PenaltyWallet from "@/pages/admin/PenaltyWallet";
import DonationWallet from "@/pages/admin/DonationWallet";
import DonationCampaigns from "@/pages/admin/DonationCampaigns";
import WithdrawalApproval from "@/pages/admin/WithdrawalApproval";
import MemberDashboard from "@/pages/member/MemberDashboard";
import PayPenalty from "@/pages/member/PayPenalty";
import Donate from "@/pages/member/Donate";
import MemberNews from "@/pages/member/MemberNews";
import MemberEvents from "@/pages/member/MemberEvents";
import MemberDocuments from "@/pages/member/MemberDocuments";
import MemberDownloads from "@/pages/member/MemberDownloads";
import WithdrawalReceipts from "@/pages/WithdrawalReceipts";
import MemberNotifications from "@/pages/member/MemberNotifications";
import MemberProfile from "@/pages/member/MemberProfile";
import MemberBeneficiaries from "@/pages/member/MemberBeneficiaries";
import ChairpersonDashboard from "@/pages/chairperson/ChairpersonDashboard";
import SignatureUpload from "@/pages/chairperson/SignatureUpload";
import ApproveMinutes from "@/pages/chairperson/ApproveMinutes";
import ChairpersonWithdrawalApprovals from "@/pages/chairperson/WithdrawalApprovals";
import ViceChairpersonDashboard from "@/pages/vice-chairperson/ViceChairpersonDashboard";
import SecretaryDashboard from "@/pages/secretary/SecretaryDashboard";
import MeetingMinutes from "@/pages/secretary/MeetingMinutes";
import SecretaryWithdrawalApprovals from "@/pages/secretary/WithdrawalApprovals";
import SecretarySignatureUpload from "@/pages/secretary/SecretarySignatureUpload";
import MinutesReview from "@/pages/secretary/MinutesReview";
import ViceSecretaryDashboard from "@/pages/vice-secretary/ViceSecretaryDashboard";
import MinutesManagement from "@/pages/vice-secretary/MinutesManagement";
import PatronDashboard from "@/pages/patron/PatronDashboard";
import SuperAdminDashboard from "@/pages/super-admin/SuperAdminDashboard";
import SuperAdminMemberDetail from "@/pages/super-admin/SuperAdminMemberDetail";
import TreasurerLayout from "@/components/layout/TreasurerLayout";
import TreasurerDashboard from "@/pages/treasurer/TreasurerDashboard";
import TreasurerWithdrawalApprovals from "@/pages/treasurer/WithdrawalApprovals";
import TreasurerPenaltyWallet from "@/pages/treasurer/PenaltyWallet";
import TreasurerDonationWallet from "@/pages/treasurer/DonationWallet";
import TreasurerContributions from "@/pages/treasurer/TreasurerContributions";
import ExpensesPayouts from "@/pages/treasurer/ExpensesPayouts";
import CreateMemo from "@/pages/treasurer/CreateMemo";
import MemoHistory from "@/pages/treasurer/MemoHistory";
import TreasurerDocuments from "@/pages/treasurer/TreasurerDocuments";
import TreasurerReports from "@/pages/treasurer/TreasurerReports";
import TreasurerSettings from "@/pages/treasurer/TreasurerSettings";
import BankSync from "@/pages/treasurer/BankSync";
import BankStatementImport from "@/pages/treasurer/BankStatementImport";
import BookBalanceImport from "@/pages/treasurer/BookBalanceImport";
import BookBalance from "@/pages/treasurer/BookBalance";
import OperationalWallet from "@/pages/treasurer/OperationalWallet";
import WalletReports from "@/pages/treasurer/WalletReports";
import SystemTroubleshooting from "@/pages/super-admin/SystemTroubleshooting";
import AuditLogs from "@/pages/super-admin/AuditLogs";
import SecuritySettings from "@/pages/super-admin/SecuritySettings";
import PasswordManagement from "@/pages/super-admin/PasswordManagement";
import AccessControl from "@/pages/super-admin/AccessControl";
import SystemMonitoring from "@/pages/super-admin/SystemMonitoring";
import RegistrationSettings from "@/pages/admin/RegistrationSettings";
import RegistrationManagement from "@/pages/admin/RegistrationManagement";
import RegistrationApiDocs from "@/pages/admin/RegistrationApiDocs";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

function AppRoutes() {
  const { user, role, roles, loading } = useAuth();
  useNotifications();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Login />;

  // Allow users with both admin and super_admin roles to access both dashboards
  if (roles.includes("super_admin") && roles.includes("admin")) {
    return (
      <Routes>
        {/* Super Admin Routes - Use SuperAdminLayout with sidebar */}
        <Route path="/super-admin" element={<SuperAdminLayout><SuperAdminDashboard /></SuperAdminLayout>} />
        <Route path="/super-admin/members" element={<SuperAdminLayout><SuperAdminDashboard /></SuperAdminLayout>} />
        <Route path="/super-admin/member/:memberId" element={<SuperAdminLayout><SuperAdminMemberDetail /></SuperAdminLayout>} />
        <Route path="/super-admin/troubleshooting" element={<SuperAdminLayout><SystemTroubleshooting /></SuperAdminLayout>} />
        <Route path="/super-admin/audit" element={<SuperAdminLayout><AuditLogs /></SuperAdminLayout>} />
        <Route path="/super-admin/security" element={<SuperAdminLayout><SecuritySettings /></SuperAdminLayout>} />
        <Route path="/super-admin/passwords" element={<SuperAdminLayout><PasswordManagement /></SuperAdminLayout>} />
        <Route path="/super-admin/access" element={<SuperAdminLayout><AccessControl /></SuperAdminLayout>} />
        <Route path="/super-admin/monitoring" element={<SuperAdminLayout><SystemMonitoring /></SuperAdminLayout>} />
        
        {/* Admin Routes - Use AdminLayout for sidebar functionality */}
        <Route path="/admin" element={<AdminLayout><AdminDashboard /></AdminLayout>} />
        <Route path="/admin/members" element={<AdminLayout><Members /></AdminLayout>} />
        <Route path="/admin/members/:memberId" element={<AdminLayout><MemberDetail /></AdminLayout>} />
        <Route path="/admin/contributions" element={<AdminLayout><Contributions /></AdminLayout>} />
        <Route path="/admin/import" element={<AdminLayout><ExcelImport /></AdminLayout>} />
        <Route path="/admin/beneficiary-import" element={<AdminLayout><BeneficiaryImport /></AdminLayout>} />
        <Route path="/admin/beneficiaries" element={<AdminLayout><Beneficiaries /></AdminLayout>} />
        <Route path="/admin/payments" element={<AdminLayout><Payments /></AdminLayout>} />
        <Route path="/admin/unmatched" element={<AdminLayout><UnmatchedPayments /></AdminLayout>} />
        <Route path="/admin/sms" element={<AdminLayout><BulkSms /></AdminLayout>} />
        <Route path="/admin/events" element={<AdminLayout><AdminEvents /></AdminLayout>} />
        <Route path="/admin/documents" element={<AdminLayout><AdminDocuments /></AdminLayout>} />
        <Route path="/admin/news" element={<AdminLayout><AdminNews /></AdminLayout>} />
        <Route path="/admin/minutes" element={<AdminLayout><AdminMeetingMinutes /></AdminLayout>} />
        <Route path="/admin/beneficiary-requests" element={<AdminLayout><BeneficiaryRequests /></AdminLayout>} />
        <Route path="/admin/defaulters" element={<AdminLayout><Defaulters /></AdminLayout>} />
        <Route path="/admin/notifications" element={<AdminLayout><AdminNotifications /></AdminLayout>} />
        <Route path="/admin/settings" element={<AdminLayout><AdminSettings /></AdminLayout>} />
        <Route path="/admin/signatures" element={<AdminLayout><OfficeSignatures /></AdminLayout>} />
        <Route path="/admin/penalty-payments" element={<AdminLayout><VerifyPenaltyPayments /></AdminLayout>} />
        <Route path="/admin/penalty-wallet" element={<AdminLayout><PenaltyWallet /></AdminLayout>} />
        <Route path="/admin/donations" element={<AdminLayout><DonationWallet /></AdminLayout>} />
        <Route path="/admin/donation-campaigns" element={<AdminLayout><DonationCampaigns /></AdminLayout>} />
        <Route path="/admin/withdrawal-approval" element={<AdminLayout><WithdrawalApproval /></AdminLayout>} />
        <Route path="/admin/withdrawal-receipts" element={<AdminLayout><WithdrawalReceipts /></AdminLayout>} />
        <Route path="/admin/registration-settings" element={<AdminLayout><RegistrationSettings /></AdminLayout>} />
        <Route path="/admin/registration-management" element={<AdminLayout><RegistrationManagement /></AdminLayout>} />
        <Route path="/admin/registration-api-docs" element={<AdminLayout><RegistrationApiDocs /></AdminLayout>} />
        
        {/* Treasurer Routes - Accessible by admin */}
        <Route path="/treasurer" element={<TreasurerLayout><TreasurerDashboard /></TreasurerLayout>} />
        <Route path="/treasurer/withdrawal-approvals" element={<TreasurerLayout><TreasurerWithdrawalApprovals /></TreasurerLayout>} />
        <Route path="/treasurer/penalty-wallet" element={<TreasurerLayout><TreasurerPenaltyWallet /></TreasurerLayout>} />
        <Route path="/treasurer/donation-wallet" element={<TreasurerLayout><TreasurerDonationWallet /></TreasurerLayout>} />
        <Route path="/treasurer/donation-campaigns" element={<TreasurerLayout><DonationCampaigns /></TreasurerLayout>} />
        <Route path="/treasurer/contributions" element={<TreasurerLayout><TreasurerContributions /></TreasurerLayout>} />
        <Route path="/treasurer/expenses" element={<TreasurerLayout><ExpensesPayouts /></TreasurerLayout>} />
        <Route path="/treasurer/memos" element={<TreasurerLayout><MemoHistory /></TreasurerLayout>} />
        <Route path="/treasurer/memos/create" element={<TreasurerLayout><CreateMemo /></TreasurerLayout>} />
        <Route path="/treasurer/memos/:id/edit" element={<TreasurerLayout><CreateMemo /></TreasurerLayout>} />
        <Route path="/treasurer/documents" element={<TreasurerLayout><TreasurerDocuments /></TreasurerLayout>} />
        <Route path="/treasurer/reports" element={<TreasurerLayout><TreasurerReports /></TreasurerLayout>} />
        <Route path="/treasurer/operational-wallet" element={<TreasurerLayout><OperationalWallet /></TreasurerLayout>} />
        <Route path="/treasurer/wallet-reports" element={<TreasurerLayout><WalletReports /></TreasurerLayout>} />
        <Route path="/treasurer/settings" element={<TreasurerLayout><TreasurerSettings /></TreasurerLayout>} />
        <Route path="/treasurer/bank-sync" element={<TreasurerLayout><BankSync /></TreasurerLayout>} />
        <Route path="/treasurer/bank-statement-import" element={<TreasurerLayout><BankStatementImport /></TreasurerLayout>} />
        
        {/* Member routes */}
        <Route path="/member" element={<MemberLayout><MemberDashboard /></MemberLayout>} />
        <Route path="/member/events" element={<MemberLayout><MemberEvents /></MemberLayout>} />
        <Route path="/member/documents" element={<MemberLayout><MemberDocuments /></MemberLayout>} />
        <Route path="/member/downloads" element={<MemberLayout><MemberDownloads /></MemberLayout>} />
        <Route path="/member/withdrawal-receipts" element={<MemberLayout><WithdrawalReceipts /></MemberLayout>} />
        <Route path="/member/news" element={<MemberLayout><MemberNews /></MemberLayout>} />
        <Route path="/member/beneficiaries" element={<MemberLayout><MemberBeneficiaries /></MemberLayout>} />
        <Route path="/member/notifications" element={<MemberLayout><MemberNotifications /></MemberLayout>} />
        <Route path="/member/profile" element={<MemberLayout><MemberProfile /></MemberLayout>} />
        <Route path="/member/pay-penalty" element={<MemberLayout><PayPenalty /></MemberLayout>} />
        <Route path="/member/donate" element={<MemberLayout><Donate /></MemberLayout>} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    );
  }

  if (role === "super_admin") {
    return (
      <Routes>
        <Route path="/super-admin" element={<SuperAdminLayout><SuperAdminDashboard /></SuperAdminLayout>} />
        <Route path="/super-admin/members" element={<SuperAdminLayout><SuperAdminDashboard /></SuperAdminLayout>} />
        <Route path="/super-admin/member/:memberId" element={<SuperAdminLayout><SuperAdminMemberDetail /></SuperAdminLayout>} />
        <Route path="/super-admin/troubleshooting" element={<SuperAdminLayout><SystemTroubleshooting /></SuperAdminLayout>} />
        <Route path="/super-admin/audit" element={<SuperAdminLayout><AuditLogs /></SuperAdminLayout>} />
        <Route path="/super-admin/security" element={<SuperAdminLayout><SecuritySettings /></SuperAdminLayout>} />
        <Route path="/super-admin/passwords" element={<SuperAdminLayout><PasswordManagement /></SuperAdminLayout>} />
        <Route path="/super-admin/access" element={<SuperAdminLayout><AccessControl /></SuperAdminLayout>} />
        <Route path="/super-admin/monitoring" element={<SuperAdminLayout><SystemMonitoring /></SuperAdminLayout>} />
        {/* Admin routes if user has admin role */}
        {roles.includes("admin") && (
          <>
            <Route path="/admin" element={<AdminLayout><AdminDashboard /></AdminLayout>} />
            <Route path="/admin/members" element={<AdminLayout><Members /></AdminLayout>} />
            <Route path="/admin/members/:memberId" element={<AdminLayout><MemberDetail /></AdminLayout>} />
            <Route path="/admin/contributions" element={<AdminLayout><Contributions /></AdminLayout>} />
            <Route path="/admin/import" element={<AdminLayout><ExcelImport /></AdminLayout>} />
            <Route path="/admin/payments" element={<AdminLayout><Payments /></AdminLayout>} />
            <Route path="/admin/unmatched" element={<AdminLayout><UnmatchedPayments /></AdminLayout>} />
            <Route path="/admin/sms" element={<AdminLayout><BulkSms /></AdminLayout>} />
            <Route path="/admin/events" element={<AdminLayout><AdminEvents /></AdminLayout>} />
            <Route path="/admin/documents" element={<AdminLayout><AdminDocuments /></AdminLayout>} />
            <Route path="/admin/news" element={<AdminLayout><AdminNews /></AdminLayout>} />
            <Route path="/admin/beneficiary-requests" element={<AdminLayout><BeneficiaryRequests /></AdminLayout>} />
            <Route path="/admin/defaulters" element={<AdminLayout><Defaulters /></AdminLayout>} />
            <Route path="/admin/notifications" element={<AdminLayout><AdminNotifications /></AdminLayout>} />
            <Route path="/admin/settings" element={<AdminLayout><AdminSettings /></AdminLayout>} />
            <Route path="/admin/signatures" element={<AdminLayout><OfficeSignatures /></AdminLayout>} />
            <Route path="/admin/penalty-payments" element={<AdminLayout><VerifyPenaltyPayments /></AdminLayout>} />
            <Route path="/admin/penalty-wallet" element={<AdminLayout><PenaltyWallet /></AdminLayout>} />
            <Route path="/admin/withdrawal-approval" element={<AdminLayout><WithdrawalApproval /></AdminLayout>} />
            <Route path="/admin/withdrawal-receipts" element={<AdminLayout><WithdrawalReceipts /></AdminLayout>} />
          </>
        )}
        
        {/* Treasurer Routes - Accessible by admin and super_admin */}
        <Route path="/treasurer" element={<TreasurerLayout><TreasurerDashboard /></TreasurerLayout>} />
        <Route path="/treasurer/withdrawal-approvals" element={<TreasurerLayout><TreasurerWithdrawalApprovals /></TreasurerLayout>} />
        <Route path="/treasurer/penalty-wallet" element={<TreasurerLayout><TreasurerPenaltyWallet /></TreasurerLayout>} />
        <Route path="/treasurer/donation-wallet" element={<TreasurerLayout><TreasurerDonationWallet /></TreasurerLayout>} />
        <Route path="/treasurer/donation-campaigns" element={<TreasurerLayout><DonationCampaigns /></TreasurerLayout>} />
        <Route path="/treasurer/contributions" element={<TreasurerLayout><TreasurerContributions /></TreasurerLayout>} />
        <Route path="/treasurer/expenses" element={<TreasurerLayout><ExpensesPayouts /></TreasurerLayout>} />
        <Route path="/treasurer/memos" element={<TreasurerLayout><MemoHistory /></TreasurerLayout>} />
        <Route path="/treasurer/memos/create" element={<TreasurerLayout><CreateMemo /></TreasurerLayout>} />
        <Route path="/treasurer/memos/:id/edit" element={<TreasurerLayout><CreateMemo /></TreasurerLayout>} />
        <Route path="/treasurer/documents" element={<TreasurerLayout><TreasurerDocuments /></TreasurerLayout>} />
        <Route path="/treasurer/reports" element={<TreasurerLayout><TreasurerReports /></TreasurerLayout>} />
        <Route path="/treasurer/operational-wallet" element={<TreasurerLayout><OperationalWallet /></TreasurerLayout>} />
        <Route path="/treasurer/wallet-reports" element={<TreasurerLayout><WalletReports /></TreasurerLayout>} />
        <Route path="/treasurer/settings" element={<TreasurerLayout><TreasurerSettings /></TreasurerLayout>} />
        <Route path="/treasurer/bank-sync" element={<TreasurerLayout><BankSync /></TreasurerLayout>} />
        <Route path="/treasurer/bank-statement-import" element={<TreasurerLayout><BankStatementImport /></TreasurerLayout>} />
        <Route path="/treasurer/book-balance-import" element={<TreasurerLayout><BookBalanceImport /></TreasurerLayout>} />
        <Route path="/treasurer/book-balance" element={<TreasurerLayout><BookBalance /></TreasurerLayout>} />
        
        {/* Member routes for super admin */}
        <Route path="/member" element={<MemberLayout><MemberDashboard /></MemberLayout>} />
        <Route path="/member/events" element={<MemberLayout><MemberEvents /></MemberLayout>} />
        <Route path="/member/documents" element={<MemberLayout><MemberDocuments /></MemberLayout>} />
        <Route path="/member/downloads" element={<MemberLayout><MemberDownloads /></MemberLayout>} />
        <Route path="/member/withdrawal-receipts" element={<MemberLayout><WithdrawalReceipts /></MemberLayout>} />
        <Route path="/member/news" element={<MemberLayout><MemberNews /></MemberLayout>} />
        <Route path="/member/beneficiaries" element={<MemberLayout><MemberBeneficiaries /></MemberLayout>} />
        <Route path="/member/notifications" element={<MemberLayout><MemberNotifications /></MemberLayout>} />
        <Route path="/member/profile" element={<MemberLayout><MemberProfile /></MemberLayout>} />
        <Route path="/member/pay-penalty" element={<MemberLayout><PayPenalty /></MemberLayout>} />
        <Route path="/member/donate" element={<MemberLayout><Donate /></MemberLayout>} />
        <Route path="*" element={<Navigate to="/super-admin" replace />} />
      </Routes>
    );
  }

  if (role === "admin") {
    return (
      <Routes>
        <Route path="/admin" element={<AdminLayout><AdminDashboard /></AdminLayout>} />
        <Route path="/admin/members" element={<AdminLayout><Members /></AdminLayout>} />
        <Route path="/admin/members/:memberId" element={<AdminLayout><MemberDetail /></AdminLayout>} />
        <Route path="/admin/contributions" element={<AdminLayout><Contributions /></AdminLayout>} />
        <Route path="/admin/import" element={<AdminLayout><ExcelImport /></AdminLayout>} />
        <Route path="/admin/beneficiaries" element={<AdminLayout><Beneficiaries /></AdminLayout>} />
        <Route path="/admin/payments" element={<AdminLayout><Payments /></AdminLayout>} />
        <Route path="/admin/unmatched" element={<AdminLayout><UnmatchedPayments /></AdminLayout>} />
        <Route path="/admin/sms" element={<AdminLayout><BulkSms /></AdminLayout>} />
        <Route path="/admin/events" element={<AdminLayout><AdminEvents /></AdminLayout>} />
        <Route path="/admin/documents" element={<AdminLayout><AdminDocuments /></AdminLayout>} />
        <Route path="/admin/news" element={<AdminLayout><AdminNews /></AdminLayout>} />
        <Route path="/admin/beneficiary-requests" element={<AdminLayout><BeneficiaryRequests /></AdminLayout>} />
        <Route path="/admin/defaulters" element={<AdminLayout><Defaulters /></AdminLayout>} />
        <Route path="/admin/notifications" element={<AdminLayout><AdminNotifications /></AdminLayout>} />
        <Route path="/admin/settings" element={<AdminLayout><AdminSettings /></AdminLayout>} />
        <Route path="/admin/signatures" element={<AdminLayout><OfficeSignatures /></AdminLayout>} />
        <Route path="/admin/penalty-payments" element={<AdminLayout><VerifyPenaltyPayments /></AdminLayout>} />
        <Route path="/admin/penalty-wallet" element={<AdminLayout><PenaltyWallet /></AdminLayout>} />
        <Route path="/admin/donations" element={<AdminLayout><DonationWallet /></AdminLayout>} />
        <Route path="/admin/donation-campaigns" element={<AdminLayout><DonationCampaigns /></AdminLayout>} />
        <Route path="/admin/withdrawal-approval" element={<AdminLayout><WithdrawalApproval /></AdminLayout>} />
        <Route path="/admin/withdrawal-receipts" element={<AdminLayout><WithdrawalReceipts /></AdminLayout>} />
        <Route path="/admin/registration-settings" element={<AdminLayout><RegistrationSettings /></AdminLayout>} />
        <Route path="/admin/registration-management" element={<AdminLayout><RegistrationManagement /></AdminLayout>} />
        <Route path="/admin/registration-api-docs" element={<AdminLayout><RegistrationApiDocs /></AdminLayout>} />
        
        {/* Treasurer Routes - Accessible by admin */}
        <Route path="/treasurer" element={<TreasurerLayout><TreasurerDashboard /></TreasurerLayout>} />
        <Route path="/treasurer/withdrawal-approvals" element={<TreasurerLayout><TreasurerWithdrawalApprovals /></TreasurerLayout>} />
        <Route path="/treasurer/penalty-wallet" element={<TreasurerLayout><TreasurerPenaltyWallet /></TreasurerLayout>} />
        <Route path="/treasurer/donation-wallet" element={<TreasurerLayout><TreasurerDonationWallet /></TreasurerLayout>} />
        <Route path="/treasurer/donation-campaigns" element={<TreasurerLayout><DonationCampaigns /></TreasurerLayout>} />
        <Route path="/treasurer/contributions" element={<TreasurerLayout><TreasurerContributions /></TreasurerLayout>} />
        <Route path="/treasurer/expenses" element={<TreasurerLayout><ExpensesPayouts /></TreasurerLayout>} />
        <Route path="/treasurer/memos" element={<TreasurerLayout><MemoHistory /></TreasurerLayout>} />
        <Route path="/treasurer/memos/create" element={<TreasurerLayout><CreateMemo /></TreasurerLayout>} />
        <Route path="/treasurer/memos/:id/edit" element={<TreasurerLayout><CreateMemo /></TreasurerLayout>} />
        <Route path="/treasurer/documents" element={<TreasurerLayout><TreasurerDocuments /></TreasurerLayout>} />
        <Route path="/treasurer/reports" element={<TreasurerLayout><TreasurerReports /></TreasurerLayout>} />
        <Route path="/treasurer/operational-wallet" element={<TreasurerLayout><OperationalWallet /></TreasurerLayout>} />
        <Route path="/treasurer/wallet-reports" element={<TreasurerLayout><WalletReports /></TreasurerLayout>} />
        <Route path="/treasurer/settings" element={<TreasurerLayout><TreasurerSettings /></TreasurerLayout>} />
        <Route path="/treasurer/bank-sync" element={<TreasurerLayout><BankSync /></TreasurerLayout>} />
        <Route path="/treasurer/bank-statement-import" element={<TreasurerLayout><BankStatementImport /></TreasurerLayout>} />
        
        {/* Super Admin routes if user has super_admin role */}
        {roles.includes("super_admin") && (
          <>
            <Route path="/super-admin" element={<SuperAdminLayout><SuperAdminDashboard /></SuperAdminLayout>} />
            <Route path="/super-admin/members" element={<SuperAdminLayout><SuperAdminDashboard /></SuperAdminLayout>} />
            <Route path="/super-admin/member/:memberId" element={<SuperAdminLayout><SuperAdminMemberDetail /></SuperAdminLayout>} />
            <Route path="/super-admin/troubleshooting" element={<SuperAdminLayout><SystemTroubleshooting /></SuperAdminLayout>} />
            <Route path="/super-admin/audit" element={<SuperAdminLayout><AuditLogs /></SuperAdminLayout>} />
            <Route path="/super-admin/security" element={<SuperAdminLayout><SecuritySettings /></SuperAdminLayout>} />
            <Route path="/super-admin/passwords" element={<SuperAdminLayout><PasswordManagement /></SuperAdminLayout>} />
            <Route path="/super-admin/access" element={<SuperAdminLayout><AccessControl /></SuperAdminLayout>} />
            <Route path="/super-admin/monitoring" element={<SuperAdminLayout><SystemMonitoring /></SuperAdminLayout>} />
          </>
        )}
        {/* Member routes for admin */}
        <Route path="/member" element={<MemberLayout><MemberDashboard /></MemberLayout>} />
        <Route path="/member/events" element={<MemberLayout><MemberEvents /></MemberLayout>} />
        <Route path="/member/documents" element={<MemberLayout><MemberDocuments /></MemberLayout>} />
        <Route path="/member/downloads" element={<MemberLayout><MemberDownloads /></MemberLayout>} />
        <Route path="/member/withdrawal-receipts" element={<MemberLayout><WithdrawalReceipts /></MemberLayout>} />
        <Route path="/member/news" element={<MemberLayout><MemberNews /></MemberLayout>} />
        <Route path="/member/beneficiaries" element={<MemberLayout><MemberBeneficiaries /></MemberLayout>} />
        <Route path="/member/notifications" element={<MemberLayout><MemberNotifications /></MemberLayout>} />
        <Route path="/member/profile" element={<MemberLayout><MemberProfile /></MemberLayout>} />
        <Route path="/member/pay-penalty" element={<MemberLayout><PayPenalty /></MemberLayout>} />
        <Route path="/member/donate" element={<MemberLayout><Donate /></MemberLayout>} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    );
  }

  if (role === "chairperson") {
    return (
      <Routes>
        <Route path="/chairperson" element={<OfficeLayout><ChairpersonDashboard /></OfficeLayout>} />
        <Route path="/chairperson/signature" element={<OfficeLayout><SignatureUpload /></OfficeLayout>} />
        <Route path="/chairperson/approve-minutes" element={<OfficeLayout><ApproveMinutes /></OfficeLayout>} />
        <Route path="/chairperson/withdrawal-approvals" element={<OfficeLayout><ChairpersonWithdrawalApprovals /></OfficeLayout>} />
        {/* Member routes for chairperson */}
        <Route path="/member" element={<MemberLayout><MemberDashboard /></MemberLayout>} />
        <Route path="/member/events" element={<MemberLayout><MemberEvents /></MemberLayout>} />
        <Route path="/member/documents" element={<MemberLayout><MemberDocuments /></MemberLayout>} />
        <Route path="/member/downloads" element={<MemberLayout><MemberDownloads /></MemberLayout>} />
        <Route path="/member/withdrawal-receipts" element={<MemberLayout><WithdrawalReceipts /></MemberLayout>} />
        <Route path="/member/news" element={<MemberLayout><MemberNews /></MemberLayout>} />
        <Route path="/member/beneficiaries" element={<MemberLayout><MemberBeneficiaries /></MemberLayout>} />
        <Route path="/member/notifications" element={<MemberLayout><MemberNotifications /></MemberLayout>} />
        <Route path="/member/profile" element={<MemberLayout><MemberProfile /></MemberLayout>} />
        <Route path="/member/pay-penalty" element={<MemberLayout><PayPenalty /></MemberLayout>} />
        <Route path="/member/donate" element={<MemberLayout><Donate /></MemberLayout>} />
        {/* Admin routes if user has admin role */}
        {roles.includes("admin") && (
          <>
            <Route path="/admin" element={<AdminLayout><AdminDashboard /></AdminLayout>} />
            <Route path="/admin/members" element={<AdminLayout><Members /></AdminLayout>} />
            <Route path="/admin/members/:memberId" element={<AdminLayout><MemberDetail /></AdminLayout>} />
            <Route path="/admin/contributions" element={<AdminLayout><Contributions /></AdminLayout>} />
            <Route path="/admin/import" element={<AdminLayout><ExcelImport /></AdminLayout>} />
            <Route path="/admin/payments" element={<AdminLayout><Payments /></AdminLayout>} />
            <Route path="/admin/unmatched" element={<AdminLayout><UnmatchedPayments /></AdminLayout>} />
            <Route path="/admin/sms" element={<AdminLayout><BulkSms /></AdminLayout>} />
            <Route path="/admin/events" element={<AdminLayout><AdminEvents /></AdminLayout>} />
            <Route path="/admin/documents" element={<AdminLayout><AdminDocuments /></AdminLayout>} />
            <Route path="/admin/news" element={<AdminLayout><AdminNews /></AdminLayout>} />
            <Route path="/admin/beneficiary-requests" element={<AdminLayout><BeneficiaryRequests /></AdminLayout>} />
            <Route path="/admin/defaulters" element={<AdminLayout><Defaulters /></AdminLayout>} />
            <Route path="/admin/notifications" element={<AdminLayout><AdminNotifications /></AdminLayout>} />
            <Route path="/admin/settings" element={<AdminLayout><AdminSettings /></AdminLayout>} />
            <Route path="/admin/signatures" element={<AdminLayout><OfficeSignatures /></AdminLayout>} />
            <Route path="/admin/penalty-payments" element={<AdminLayout><VerifyPenaltyPayments /></AdminLayout>} />
            <Route path="/admin/penalty-wallet" element={<AdminLayout><PenaltyWallet /></AdminLayout>} />
            <Route path="/admin/withdrawal-approval" element={<AdminLayout><WithdrawalApproval /></AdminLayout>} />
            <Route path="/admin/withdrawal-receipts" element={<AdminLayout><WithdrawalReceipts /></AdminLayout>} />
          </>
        )}
        {/* Super Admin routes if user has super_admin role */}
        {roles.includes("super_admin") && (
          <>
            <Route path="/super-admin" element={<SuperAdminLayout><SuperAdminDashboard /></SuperAdminLayout>} />
            <Route path="/super-admin/member/:memberId" element={<SuperAdminLayout><SuperAdminMemberDetail /></SuperAdminLayout>} />
            <Route path="/super-admin/troubleshooting" element={<SuperAdminLayout><SystemTroubleshooting /></SuperAdminLayout>} />
          </>
        )}
        <Route path="*" element={<Navigate to="/chairperson" replace />} />
      </Routes>
    );
  }

  if (role === "vice_chairperson") {
    return (
      <Routes>
        <Route path="/vice-chairperson" element={<OfficeLayout><ViceChairpersonDashboard /></OfficeLayout>} />
        {/* Member routes for vice chairperson */}
        <Route path="/member" element={<MemberLayout><MemberDashboard /></MemberLayout>} />
        <Route path="/member/events" element={<MemberLayout><MemberEvents /></MemberLayout>} />
        <Route path="/member/documents" element={<MemberLayout><MemberDocuments /></MemberLayout>} />
        <Route path="/member/downloads" element={<MemberLayout><MemberDownloads /></MemberLayout>} />
        <Route path="/member/withdrawal-receipts" element={<MemberLayout><WithdrawalReceipts /></MemberLayout>} />
        <Route path="/member/news" element={<MemberLayout><MemberNews /></MemberLayout>} />
        <Route path="/member/beneficiaries" element={<MemberLayout><MemberBeneficiaries /></MemberLayout>} />
        <Route path="/member/notifications" element={<MemberLayout><MemberNotifications /></MemberLayout>} />
        <Route path="/member/profile" element={<MemberLayout><MemberProfile /></MemberLayout>} />
        <Route path="/member/pay-penalty" element={<MemberLayout><PayPenalty /></MemberLayout>} />
        <Route path="/member/donate" element={<MemberLayout><Donate /></MemberLayout>} />
        {/* Admin routes if user has admin role */}
        {roles.includes("admin") && (
          <>
            <Route path="/admin" element={<AdminLayout><AdminDashboard /></AdminLayout>} />
            <Route path="/admin/members" element={<AdminLayout><Members /></AdminLayout>} />
            <Route path="/admin/members/:memberId" element={<AdminLayout><MemberDetail /></AdminLayout>} />
            <Route path="/admin/contributions" element={<AdminLayout><Contributions /></AdminLayout>} />
            <Route path="/admin/import" element={<AdminLayout><ExcelImport /></AdminLayout>} />
            <Route path="/admin/payments" element={<AdminLayout><Payments /></AdminLayout>} />
            <Route path="/admin/unmatched" element={<AdminLayout><UnmatchedPayments /></AdminLayout>} />
            <Route path="/admin/sms" element={<AdminLayout><BulkSms /></AdminLayout>} />
            <Route path="/admin/events" element={<AdminLayout><AdminEvents /></AdminLayout>} />
            <Route path="/admin/documents" element={<AdminLayout><AdminDocuments /></AdminLayout>} />
            <Route path="/admin/news" element={<AdminLayout><AdminNews /></AdminLayout>} />
            <Route path="/admin/beneficiary-requests" element={<AdminLayout><BeneficiaryRequests /></AdminLayout>} />
            <Route path="/admin/defaulters" element={<AdminLayout><Defaulters /></AdminLayout>} />
            <Route path="/admin/notifications" element={<AdminLayout><AdminNotifications /></AdminLayout>} />
            <Route path="/admin/settings" element={<AdminLayout><AdminSettings /></AdminLayout>} />
            <Route path="/admin/signatures" element={<AdminLayout><OfficeSignatures /></AdminLayout>} />
            <Route path="/admin/penalty-payments" element={<AdminLayout><VerifyPenaltyPayments /></AdminLayout>} />
            <Route path="/admin/penalty-wallet" element={<AdminLayout><PenaltyWallet /></AdminLayout>} />
            <Route path="/admin/withdrawal-approval" element={<AdminLayout><WithdrawalApproval /></AdminLayout>} />
            <Route path="/admin/withdrawal-receipts" element={<AdminLayout><WithdrawalReceipts /></AdminLayout>} />
          </>
        )}
        {/* Super Admin routes if user has super_admin role */}
        {roles.includes("super_admin") && (
          <>
            <Route path="/super-admin" element={<SuperAdminLayout><SuperAdminDashboard /></SuperAdminLayout>} />
            <Route path="/super-admin/member/:memberId" element={<SuperAdminLayout><SuperAdminMemberDetail /></SuperAdminLayout>} />
            <Route path="/super-admin/troubleshooting" element={<SuperAdminLayout><SystemTroubleshooting /></SuperAdminLayout>} />
          </>
        )}
        <Route path="*" element={<Navigate to="/vice-chairperson" replace />} />
      </Routes>
    );
  }

  if (role === "secretary") {
    return (
      <Routes>
        <Route path="/secretary" element={<OfficeLayout><SecretaryDashboard /></OfficeLayout>} />
        <Route path="/secretary/events" element={<OfficeLayout><AdminEvents /></OfficeLayout>} />
        <Route path="/secretary/minutes" element={<OfficeLayout><MeetingMinutes /></OfficeLayout>} />
        <Route path="/secretary/review" element={<OfficeLayout><MinutesReview /></OfficeLayout>} />
        <Route path="/secretary/signature" element={<OfficeLayout><SecretarySignatureUpload /></OfficeLayout>} />
        <Route path="/secretary/withdrawal-approvals" element={<OfficeLayout><SecretaryWithdrawalApprovals /></OfficeLayout>} />
        {/* Member routes for secretary */}
        <Route path="/member" element={<MemberLayout><MemberDashboard /></MemberLayout>} />
        <Route path="/member/events" element={<MemberLayout><MemberEvents /></MemberLayout>} />
        <Route path="/member/documents" element={<MemberLayout><MemberDocuments /></MemberLayout>} />
        <Route path="/member/downloads" element={<MemberLayout><MemberDownloads /></MemberLayout>} />
        <Route path="/member/withdrawal-receipts" element={<MemberLayout><WithdrawalReceipts /></MemberLayout>} />
        <Route path="/member/news" element={<MemberLayout><MemberNews /></MemberLayout>} />
        <Route path="/member/beneficiaries" element={<MemberLayout><MemberBeneficiaries /></MemberLayout>} />
        <Route path="/member/notifications" element={<MemberLayout><MemberNotifications /></MemberLayout>} />
        <Route path="/member/profile" element={<MemberLayout><MemberProfile /></MemberLayout>} />
        <Route path="/member/pay-penalty" element={<MemberLayout><PayPenalty /></MemberLayout>} />
        <Route path="/member/donate" element={<MemberLayout><Donate /></MemberLayout>} />
        {/* Admin routes if user has admin role */}
        {roles.includes("admin") && (
          <>
            <Route path="/admin" element={<AdminLayout><AdminDashboard /></AdminLayout>} />
            <Route path="/admin/members" element={<AdminLayout><Members /></AdminLayout>} />
            <Route path="/admin/members/:memberId" element={<AdminLayout><MemberDetail /></AdminLayout>} />
            <Route path="/admin/contributions" element={<AdminLayout><Contributions /></AdminLayout>} />
            <Route path="/admin/import" element={<AdminLayout><ExcelImport /></AdminLayout>} />
            <Route path="/admin/payments" element={<AdminLayout><Payments /></AdminLayout>} />
            <Route path="/admin/unmatched" element={<AdminLayout><UnmatchedPayments /></AdminLayout>} />
            <Route path="/admin/sms" element={<AdminLayout><BulkSms /></AdminLayout>} />
            <Route path="/admin/events" element={<AdminLayout><AdminEvents /></AdminLayout>} />
            <Route path="/admin/documents" element={<AdminLayout><AdminDocuments /></AdminLayout>} />
            <Route path="/admin/news" element={<AdminLayout><AdminNews /></AdminLayout>} />
            <Route path="/admin/beneficiary-requests" element={<AdminLayout><BeneficiaryRequests /></AdminLayout>} />
            <Route path="/admin/defaulters" element={<AdminLayout><Defaulters /></AdminLayout>} />
            <Route path="/admin/notifications" element={<AdminLayout><AdminNotifications /></AdminLayout>} />
            <Route path="/admin/settings" element={<AdminLayout><AdminSettings /></AdminLayout>} />
            <Route path="/admin/signatures" element={<AdminLayout><OfficeSignatures /></AdminLayout>} />
            <Route path="/admin/penalty-payments" element={<AdminLayout><VerifyPenaltyPayments /></AdminLayout>} />
            <Route path="/admin/penalty-wallet" element={<AdminLayout><PenaltyWallet /></AdminLayout>} />
            <Route path="/admin/withdrawal-approval" element={<AdminLayout><WithdrawalApproval /></AdminLayout>} />
            <Route path="/admin/withdrawal-receipts" element={<AdminLayout><WithdrawalReceipts /></AdminLayout>} />
          </>
        )}
        {/* Super Admin routes if user has super_admin role */}
        {roles.includes("super_admin") && (
          <>
            <Route path="/super-admin" element={<SuperAdminLayout><SuperAdminDashboard /></SuperAdminLayout>} />
            <Route path="/super-admin/member/:memberId" element={<SuperAdminLayout><SuperAdminMemberDetail /></SuperAdminLayout>} />
            <Route path="/super-admin/troubleshooting" element={<SuperAdminLayout><SystemTroubleshooting /></SuperAdminLayout>} />
          </>
        )}
        <Route path="*" element={<Navigate to="/secretary" replace />} />
      </Routes>
    );
  }

  if (role === "vice_secretary") {
    return (
      <Routes>
        <Route path="/vice-secretary" element={<OfficeLayout><ViceSecretaryDashboard /></OfficeLayout>} />
        <Route path="/vice-secretary/minutes" element={<OfficeLayout><MinutesManagement /></OfficeLayout>} />
        {/* Member routes for vice secretary */}
        <Route path="/member" element={<MemberLayout><MemberDashboard /></MemberLayout>} />
        <Route path="/member/events" element={<MemberLayout><MemberEvents /></MemberLayout>} />
        <Route path="/member/documents" element={<MemberLayout><MemberDocuments /></MemberLayout>} />
        <Route path="/member/downloads" element={<MemberLayout><MemberDownloads /></MemberLayout>} />
        <Route path="/member/withdrawal-receipts" element={<MemberLayout><WithdrawalReceipts /></MemberLayout>} />
        <Route path="/member/news" element={<MemberLayout><MemberNews /></MemberLayout>} />
        <Route path="/member/beneficiaries" element={<MemberLayout><MemberBeneficiaries /></MemberLayout>} />
        <Route path="/member/notifications" element={<MemberLayout><MemberNotifications /></MemberLayout>} />
        <Route path="/member/profile" element={<MemberLayout><MemberProfile /></MemberLayout>} />
        <Route path="/member/pay-penalty" element={<MemberLayout><PayPenalty /></MemberLayout>} />
        <Route path="/member/donate" element={<MemberLayout><Donate /></MemberLayout>} />
        {/* Admin routes if user has admin role */}
        {roles.includes("admin") && (
          <>
            <Route path="/admin" element={<AdminLayout><AdminDashboard /></AdminLayout>} />
            <Route path="/admin/members" element={<AdminLayout><Members /></AdminLayout>} />
            <Route path="/admin/members/:memberId" element={<AdminLayout><MemberDetail /></AdminLayout>} />
            <Route path="/admin/contributions" element={<AdminLayout><Contributions /></AdminLayout>} />
            <Route path="/admin/import" element={<AdminLayout><ExcelImport /></AdminLayout>} />
            <Route path="/admin/payments" element={<AdminLayout><Payments /></AdminLayout>} />
            <Route path="/admin/unmatched" element={<AdminLayout><UnmatchedPayments /></AdminLayout>} />
            <Route path="/admin/sms" element={<AdminLayout><BulkSms /></AdminLayout>} />
            <Route path="/admin/events" element={<AdminLayout><AdminEvents /></AdminLayout>} />
            <Route path="/admin/documents" element={<AdminLayout><AdminDocuments /></AdminLayout>} />
            <Route path="/admin/news" element={<AdminLayout><AdminNews /></AdminLayout>} />
            <Route path="/admin/beneficiary-requests" element={<AdminLayout><BeneficiaryRequests /></AdminLayout>} />
            <Route path="/admin/defaulters" element={<AdminLayout><Defaulters /></AdminLayout>} />
            <Route path="/admin/notifications" element={<AdminLayout><AdminNotifications /></AdminLayout>} />
            <Route path="/admin/settings" element={<AdminLayout><AdminSettings /></AdminLayout>} />
            <Route path="/admin/signatures" element={<AdminLayout><OfficeSignatures /></AdminLayout>} />
            <Route path="/admin/penalty-payments" element={<AdminLayout><VerifyPenaltyPayments /></AdminLayout>} />
            <Route path="/admin/penalty-wallet" element={<AdminLayout><PenaltyWallet /></AdminLayout>} />
            <Route path="/admin/withdrawal-approval" element={<AdminLayout><WithdrawalApproval /></AdminLayout>} />
            <Route path="/admin/withdrawal-receipts" element={<AdminLayout><WithdrawalReceipts /></AdminLayout>} />
          </>
        )}
        {/* Super Admin routes if user has super_admin role */}
        {roles.includes("super_admin") && (
          <>
            <Route path="/super-admin" element={<SuperAdminLayout><SuperAdminDashboard /></SuperAdminLayout>} />
            <Route path="/super-admin/member/:memberId" element={<SuperAdminLayout><SuperAdminMemberDetail /></SuperAdminLayout>} />
            <Route path="/super-admin/troubleshooting" element={<SuperAdminLayout><SystemTroubleshooting /></SuperAdminLayout>} />
          </>
        )}
        <Route path="*" element={<Navigate to="/vice-secretary" replace />} />
      </Routes>
    );
  }

  if (role === "patron") {
    return (
      <Routes>
        <Route path="/patron" element={<OfficeLayout><PatronDashboard /></OfficeLayout>} />
        {/* Member routes for patron */}
        <Route path="/member" element={<MemberLayout><MemberDashboard /></MemberLayout>} />
        <Route path="/member/events" element={<MemberLayout><MemberEvents /></MemberLayout>} />
        <Route path="/member/documents" element={<MemberLayout><MemberDocuments /></MemberLayout>} />
        <Route path="/member/downloads" element={<MemberLayout><MemberDownloads /></MemberLayout>} />
        <Route path="/member/withdrawal-receipts" element={<MemberLayout><WithdrawalReceipts /></MemberLayout>} />
        <Route path="/member/news" element={<MemberLayout><MemberNews /></MemberLayout>} />
        <Route path="/member/beneficiaries" element={<MemberLayout><MemberBeneficiaries /></MemberLayout>} />
        <Route path="/member/notifications" element={<MemberLayout><MemberNotifications /></MemberLayout>} />
        <Route path="/member/profile" element={<MemberLayout><MemberProfile /></MemberLayout>} />
        <Route path="/member/pay-penalty" element={<MemberLayout><PayPenalty /></MemberLayout>} />
        <Route path="/member/donate" element={<MemberLayout><Donate /></MemberLayout>} />
        {/* Admin routes if user has admin role */}
        {roles.includes("admin") && (
          <>
            <Route path="/admin" element={<AdminLayout><AdminDashboard /></AdminLayout>} />
            <Route path="/admin/members" element={<AdminLayout><Members /></AdminLayout>} />
            <Route path="/admin/members/:memberId" element={<AdminLayout><MemberDetail /></AdminLayout>} />
            <Route path="/admin/contributions" element={<AdminLayout><Contributions /></AdminLayout>} />
            <Route path="/admin/import" element={<AdminLayout><ExcelImport /></AdminLayout>} />
            <Route path="/admin/payments" element={<AdminLayout><Payments /></AdminLayout>} />
            <Route path="/admin/unmatched" element={<AdminLayout><UnmatchedPayments /></AdminLayout>} />
            <Route path="/admin/sms" element={<AdminLayout><BulkSms /></AdminLayout>} />
            <Route path="/admin/events" element={<AdminLayout><AdminEvents /></AdminLayout>} />
            <Route path="/admin/documents" element={<AdminLayout><AdminDocuments /></AdminLayout>} />
            <Route path="/admin/news" element={<AdminLayout><AdminNews /></AdminLayout>} />
            <Route path="/admin/beneficiary-requests" element={<AdminLayout><BeneficiaryRequests /></AdminLayout>} />
            <Route path="/admin/defaulters" element={<AdminLayout><Defaulters /></AdminLayout>} />
            <Route path="/admin/notifications" element={<AdminLayout><AdminNotifications /></AdminLayout>} />
            <Route path="/admin/settings" element={<AdminLayout><AdminSettings /></AdminLayout>} />
            <Route path="/admin/signatures" element={<AdminLayout><OfficeSignatures /></AdminLayout>} />
            <Route path="/admin/penalty-payments" element={<AdminLayout><VerifyPenaltyPayments /></AdminLayout>} />
            <Route path="/admin/penalty-wallet" element={<AdminLayout><PenaltyWallet /></AdminLayout>} />
            <Route path="/admin/withdrawal-approval" element={<AdminLayout><WithdrawalApproval /></AdminLayout>} />
            <Route path="/admin/withdrawal-receipts" element={<AdminLayout><WithdrawalReceipts /></AdminLayout>} />
          </>
        )}
        {/* Super Admin routes if user has super_admin role */}
        {roles.includes("super_admin") && (
          <>
            <Route path="/super-admin" element={<SuperAdminLayout><SuperAdminDashboard /></SuperAdminLayout>} />
            <Route path="/super-admin/member/:memberId" element={<SuperAdminLayout><SuperAdminMemberDetail /></SuperAdminLayout>} />
            <Route path="/super-admin/troubleshooting" element={<SuperAdminLayout><SystemTroubleshooting /></SuperAdminLayout>} />
          </>
        )}
        <Route path="*" element={<Navigate to="/patron" replace />} />
      </Routes>
    );
  }

  // Default to member routes
  return (
    <Routes>
      <Route path="/member" element={<MemberLayout><MemberDashboard /></MemberLayout>} />
      <Route path="/member/events" element={<MemberLayout><MemberEvents /></MemberLayout>} />
      <Route path="/member/documents" element={<MemberLayout><MemberDocuments /></MemberLayout>} />
      <Route path="/member/downloads" element={<MemberLayout><MemberDownloads /></MemberLayout>} />
      <Route path="/member/withdrawal-receipts" element={<MemberLayout><WithdrawalReceipts /></MemberLayout>} />
      <Route path="/member/news" element={<MemberLayout><MemberNews /></MemberLayout>} />
      <Route path="/member/beneficiaries" element={<MemberLayout><MemberBeneficiaries /></MemberLayout>} />
      <Route path="/member/notifications" element={<MemberLayout><MemberNotifications /></MemberLayout>} />
      <Route path="/member/profile" element={<MemberLayout><MemberProfile /></MemberLayout>} />
      <Route path="/member/pay-penalty" element={<MemberLayout><PayPenalty /></MemberLayout>} />
      <Route path="/member/donate" element={<MemberLayout><Donate /></MemberLayout>} />
      <Route path="*" element={<Navigate to="/member" replace />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider>
          <InstallBanner />
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;


