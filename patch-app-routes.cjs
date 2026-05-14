const fs = require('fs');
const p = 'src/App.tsx';
let text = fs.readFileSync(p, 'utf8');
const oldAdmin = `        <Route path="/admin/penalty-wallet" element={<AdminLayout><PenaltyWallet /></AdminLayout>} />
        <Route path="/admin/withdrawal-approval" element={<AdminLayout><WithdrawalApproval /></AdminLayout>} />
`;
const newAdmin = `        <Route path="/admin/penalty-wallet" element={<AdminLayout><PenaltyWallet /></AdminLayout>} />
        <Route path="/admin/donations" element={<AdminLayout><DonationWallet /></AdminLayout>} />
        <Route path="/admin/withdrawal-approval" element={<AdminLayout><WithdrawalApproval /></AdminLayout>} />
`;
const oldMember = `        <Route path="/member/pay-penalty" element={<MemberLayout><PayPenalty /></MemberLayout>} />
`;
const newMember = `        <Route path="/member/pay-penalty" element={<MemberLayout><PayPenalty /></MemberLayout>} />
        <Route path="/member/donate" element={<MemberLayout><Donate /></MemberLayout>} />
`;
const adminCount = (text.match(new RegExp(oldAdmin.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'),'g')) || []).length;
const memberCount = (text.match(new RegExp(oldMember.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'),'g')) || []).length;
console.log('adminCount', adminCount, 'memberCount', memberCount);
text = text.split(oldAdmin).join(newAdmin);
text = text.split(oldMember).join(newMember);
fs.writeFileSync(p, text, 'utf8');
