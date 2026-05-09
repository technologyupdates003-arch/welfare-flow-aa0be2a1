import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Download, Eye, FileText, ScrollText, Mail } from "lucide-react";
import { toast } from "sonner";

export default function MemberDownloads() {
  const { user, memberId } = useAuth();
  const [showConstitution, setShowConstitution] = useState(false);
  const [showStatement, setShowStatement] = useState(false);
  const [showMinute, setShowMinute] = useState(false);
  const [selectedMinute, setSelectedMinute] = useState<any>(null);
  const [statementHtml, setStatementHtml] = useState("");
  const [showMemo, setShowMemo] = useState(false);
  const [selectedMemo, setSelectedMemo] = useState<any>(null);

  const { data: memos = [], refetch: refetchMemos } = useQuery({
    queryKey: ["my-memos", memberId],
    queryFn: async () => {
      if (!memberId) return [];
      const { data } = await supabase
        .from("memo_recipients")
        .select("id, seen_at, downloaded_at, memos(*)")
        .eq("member_id", memberId)
        .order("created_at", { ascending: false });
      return (data || []).filter((r: any) => r.memos && r.memos.status === "sent");
    },
    enabled: !!memberId,
  });

  const { data: orgSettings } = useQuery({
    queryKey: ["org-settings-memo"],
    queryFn: async () => {
      const { data } = await supabase.from("organization_settings").select("*").maybeSingle();
      return data;
    },
  });

  const generateMemoHtml = (memo: any) => {
    const orgName = orgSettings?.organization_name || "KIRINYAGA HEALTHCARE WORKERS' WELFARE";
    const orgAddress = orgSettings?.organization_address || "P.O.BOX 24-10300 KERUGOYA, LOCATION: KCRH";
    const orgEmail = orgSettings?.organization_email || "Khcww2020@gmail.com";
    const orgPhone = orgSettings?.organization_phone || "+254 712 345 678";
    const logo = orgSettings?.logo_url || "";
    const signature = orgSettings?.signature_url || "";
    const stamp = orgSettings?.stamp_url || "";
    const dateStr = new Date(memo.sent_at || memo.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${memo.title}</title>
<style>
  body{font-family:'Times New Roman',Times,serif;margin:0;padding:40px;background:#fff;color:#111827;max-width:850px;margin:0 auto}
  .header{border-bottom:4px solid #f97316;padding-bottom:16px;margin-bottom:24px;display:flex;justify-content:space-between;align-items:flex-start;gap:16px}
  .logo{height:80px;width:80px;object-fit:contain}
  .org{text-align:right;flex:1}
  .org h1{font-size:18px;margin:0 0 4px;color:#111827}
  .org p{margin:2px 0;font-size:12px;color:#6B7280}
  .org .email{color:#ea580c;font-weight:500}
  .watermark{text-align:center;margin-bottom:16px;font-size:12px;font-weight:bold;color:#f97316;letter-spacing:3px}
  .title{font-size:16px;font-weight:bold;margin:0 0 8px}
  .meta{font-size:12px;color:#6B7280;margin-bottom:24px}
  .meta p{margin:2px 0}
  .content{font-size:14px;line-height:1.7;white-space:pre-wrap;margin-bottom:48px}
  .footer{margin-top:48px;padding-top:24px;border-top:2px solid #E5E7EB;display:flex;justify-content:space-between;align-items:flex-end}
  .sig img{height:64px;object-fit:contain;display:block;margin-bottom:4px}
  .sig .line{border-top:2px solid #111827;padding-top:4px;width:220px}
  .sig .role{font-size:12px;font-weight:bold;margin:0}
  .sig .auth{font-size:11px;color:#6B7280;margin:4px 0 0}
  .stamp{height:96px;width:96px;object-fit:contain;opacity:0.9}
  .contact{margin-top:32px;padding-top:16px;border-top:1px solid #E5E7EB;text-align:center;font-size:11px;color:#6B7280}
  .contact .name{font-weight:600}
  @media print{body{padding:20px}}
</style></head><body>
  <div class="header">
    ${logo ? `<img class="logo" src="${logo}" alt="Logo">` : '<div class="logo"></div>'}
    <div class="org">
      <h1>${orgName}</h1>
      <p>${orgAddress}</p>
      <p class="email">Email: ${orgEmail}</p>
      <p>Tel: ${orgPhone}</p>
    </div>
  </div>
  <div class="watermark">KHCWW OFFICIAL MEMO</div>
  <h2 class="title">${memo.title}</h2>
  <div class="meta">
    <p>Date: ${dateStr}</p>
    <p>Reference: ${memo.reference_number || '—'}</p>
  </div>
  <div class="content">${memo.content}</div>
  <div class="footer">
    <div class="sig">
      ${signature ? `<img src="${signature}" alt="Signature">` : ''}
      <div class="line">
        <p class="role">Treasurer</p>
        <p class="auth">Authorized by Treasurer</p>
      </div>
    </div>
    ${stamp ? `<img class="stamp" src="${stamp}" alt="Stamp">` : ''}
  </div>
  <div class="contact">
    <p class="name">${orgName}</p>
    <p>${orgAddress}</p>
    <p>Email: ${orgEmail} | Tel: ${orgPhone}</p>
  </div>
</body></html>`;
  };

  const viewMemo = async (recipient: any) => {
    setSelectedMemo(recipient.memos);
    setShowMemo(true);
    if (!recipient.seen_at) {
      await supabase.from("memo_recipients").update({ seen_at: new Date().toISOString() }).eq("id", recipient.id);
      refetchMemos();
    }
  };

  const downloadMemo = async (recipient: any) => {
    const memo = recipient.memos;
    const blob = new Blob([generateMemoHtml(memo)], { type: 'text/html' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `memo-${(memo.reference_number || memo.title).replace(/\s+/g,'-')}.html`;
    document.body.appendChild(a); a.click(); window.URL.revokeObjectURL(url); document.body.removeChild(a);
    if (!recipient.downloaded_at) {
      await supabase.from("memo_recipients").update({ downloaded_at: new Date().toISOString(), seen_at: recipient.seen_at || new Date().toISOString() }).eq("id", recipient.id);
      refetchMemos();
    }
    toast.success("Memo downloaded!");
  };

  const { data: member } = useQuery({
    queryKey: ["my-profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("members").select("*").eq("user_id", user!.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: contributions } = useQuery({
    queryKey: ["my-contributions-statement", memberId],
    queryFn: async () => {
      const { data } = await supabase.from("contributions").select("*").eq("member_id", memberId!).order("year", { ascending: false }).order("month", { ascending: false });
      return data || [];
    },
    enabled: !!memberId,
  });

  const { data: publishedMinutes = [] } = useQuery({
    queryKey: ["published-minutes", user?.id],
    queryFn: async () => {
      // First get all approved minutes
      const { data: allMinutes } = await supabase
        .from("meeting_minutes")
        .select("*")
        .eq("status", "approved")
        .order("meeting_date", { ascending: false });

      if (!allMinutes) return [];

      // Get current user's roles
      const { data: userRoles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id);

      const hasRole = userRoles && userRoles.length > 0;
      
      // Filter minutes based on meeting type and user role
      return allMinutes.filter((minute: any) => {
        if (minute.meeting_type === "executive") {
          // For executive meetings, check if user has a role or is in visible_to_members
          if (!hasRole) return false;
          
          // If visible_to_members is empty, all role holders can see it
          if (!minute.visible_to_members || minute.visible_to_members.length === 0) {
            return true;
          }
          
          // Get current user's member name
          const memberName = member?.name;
          if (!memberName) return false;
          
          // Check if user is in visible_to_members list
          return minute.visible_to_members.includes(memberName);
        }
        
        // General meetings are visible to all
        return true;
      });
    },
    enabled: !!user,
  });

  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  const generateStatementHtml = () => {
    const totalPaid = contributions?.filter(c => c.status === "paid").reduce((s, c) => s + Number(c.amount), 0) || 0;
    const totalUnpaid = contributions?.filter(c => c.status !== "paid").reduce((s, c) => s + Number(c.amount), 0) || 0;
    return `<!DOCTYPE html><html><head><title>Statement - ${member?.name}</title>
    <style>body{font-family:Arial,sans-serif;margin:40px;line-height:1.6}
    .header{text-align:center;margin-bottom:30px;border-bottom:3px solid #16a34a;padding-bottom:20px}
    table{width:100%;border-collapse:collapse;margin:20px 0}
    th,td{border:1px solid #ddd;padding:10px;text-align:left}
    th{background:#16a34a;color:white}
    .paid{color:#16a34a;font-weight:bold}.unpaid{color:#ef4444;font-weight:bold}
    .summary{display:flex;gap:20px;margin:20px 0}
    .summary-card{flex:1;padding:15px;border-radius:8px;text-align:center}
    .total{background:#f0fdf4;border:1px solid #16a34a}.pend{background:#fef2f2;border:1px solid #ef4444}
    </style></head><body>
    <div class="header"><h1>KIRINYAGA HCWW</h1><h2>Member Statement</h2>
    <p><strong>${member?.name}</strong> | ${member?.phone} | ID: ${member?.member_id || 'N/A'}</p>
    <p>Generated: ${new Date().toLocaleDateString()}</p></div>
    <div class="summary"><div class="summary-card total"><h3>Total Paid</h3><h2>KES ${totalPaid.toLocaleString()}</h2></div>
    <div class="summary-card pend"><h3>Unpaid</h3><h2>KES ${totalUnpaid.toLocaleString()}</h2></div></div>
    <table><thead><tr><th>Period</th><th>Amount</th><th>Due Date</th><th>Paid Date</th><th>Status</th></tr></thead><tbody>
    ${(contributions || []).map(c => `<tr><td>${months[c.month-1]} ${c.year}</td><td>KES ${Number(c.amount).toLocaleString()}</td>
    <td>${c.due_date}</td><td>${c.paid_date || '—'}</td>
    <td class="${c.status === 'paid' ? 'paid' : 'unpaid'}">${c.status === 'paid' ? 'PAID' : 'UNPAID'}</td></tr>`).join('')}
    </tbody></table>
    <p style="margin-top:40px;text-align:center;color:#666;font-size:12px">This is an auto-generated statement from KIRINYAGA HCWW System</p>
    </body></html>`;
  };

  const previewStatement = () => {
    setStatementHtml(generateStatementHtml());
    setShowStatement(true);
  };

  const downloadStatement = () => {
    const html = generateStatementHtml();
    const blob = new Blob([html], { type: 'text/html' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `statement-${member?.name?.replace(/\s+/g, '-') || 'member'}.html`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    toast.success("Statement downloaded!");
  };

  const constitutionHtml = `<!DOCTYPE html><html><head><title>KIRINYAGA HCWW Constitution</title>
<style>body{font-family:Arial,sans-serif;margin:20px;line-height:1.8;max-width:800px;margin:0 auto;padding:20px}
.header{text-align:center;margin-bottom:30px;border-bottom:3px solid #16a34a;padding-bottom:20px}
.header h1{margin:0;color:#16a34a}.header p{margin:2px 0;font-size:14px;color:#555}
.section{margin-bottom:25px}.section h3{color:#16a34a;border-bottom:1px solid #ddd;padding-bottom:5px;margin-bottom:10px}
.section h4{color:#333;margin:10px 0 5px}
ol,ul{padding-left:25px}li{margin-bottom:6px}
.sub-list{list-style-type:lower-alpha}
</style></head><body>
<div class="header">
<h1>KIRINYAGA HEALTHCARE WORKERS' WELFARE CONSTITUTION</h1>
<p><strong>NAME:</strong> KIRINYAGA HCW WELFARE</p>
<p>P.O.BOX 24-10300 KERUGOYA</p>
<p>Khcww2020@gmail.com</p>
<p>LOCATION: KCRH</p>
<p><em>(2025 Dec. 11th Edition)</em></p>
</div>

<div class="section"><h3>A) INTRODUCTION</h3>
<p>Kirinyaga HealthCare Workers' welfare (KHCWW) was initiated to strengthen cohesiveness, relationship, interaction and support one another among the health workers. The welfare involves all the Healthcare Workers in Kirinyaga County who are willing to join welfare. The welfare shall perform activities agreed upon by the members during the initial formation meeting and any other activity that the members shall agree on during any other meeting where two-third votes shall approve.</p></div>

<div class="section"><h3>B) OBJECTIVES</h3>
<h4>Main objective</h4><p>To bring KHCWs together and cater for their welfare.</p>
<h4>Specific objectives</h4>
<ul><li>To unite the KHCWs</li>
<li>To help the KHCWs in times of need</li>
<li>To encourage participation amongst the KHCWs in times of joy and sorrow</li>
<li>To bring the overall development of the KHCWs socially, economically and professionally.</li></ul></div>

<div class="section"><h3>C) MEMBERSHIP</h3>
<ol type="a"><li>Membership is open to all KHCWS and it is voluntary</li>
<li>A person becomes a member upon paying a registration fee of Ksh.400.</li>
<li>There shall be a registration form to capture member's personal information which shall be in agreement with the constitution – done online.</li>
<li>Every registered member shall be required to pay a monthly contribution of Ksh 300.</li>
<li>A new member shall be required to wait for a period of about six months before enjoying the welfare packages.</li>
<li>Every registered member shall be required to participate fully in activities organized by the welfare.</li></ol></div>

<div class="section"><h3>D) DISCIPLINE</h3>
<ol><li>Monthly contribution shall be required on or before 15th of every month, failure to which it shall attract a penalty of Ksh 50 every month.</li>
<li>Personal contribution shall be required to be up to date for any member to benefit from the welfare.</li>
<li>Failure to pay monthly contribution for 2 consecutive months will lead to the member getting a warning. In the event that such a member, one month after the warning, does not pay up, he(s) ceases to be a member of the welfare.</li>
<li>A newly employed person including officers transferred from elsewhere willing to join the welfare shall do so only in January.</li>
<li>In view of clause C.c. above on registration, if it is verified that a member willfully gave wrong information with intention to mislead/or to defraud the welfare of any amount of money, such a member shall be required:
<ol type="a"><li>To pay a fine of amount equivalent to one year contribution.</li>
<li>The member shall not benefit from the welfare with what may have been otherwise given to the relative as the case may be.</li></ol></li></ol></div>

<div class="section"><h3>E) OFFICE BEARERS</h3>
<h4>1. CHAIRPERSON</h4>
<ol type="i"><li>The chairperson responsibilities shall include:</li>
<li>Chairing all committees and general meetings</li>
<li>Signatory to the bank account</li>
<li>Chief executive of the welfare</li></ol>
<h4>2. VICE CHAIRPERSON</h4>
<p>Shall deputize the chairperson on all responsibilities except being signatory to the bank account.</p>
<h4>3. SECRETARY</h4>
<ol type="i"><li>Shall keep up records of welfare</li>
<li>Receive and file all correspondences</li>
<li>Send all correspondences</li>
<li>Take the minutes during the meetings</li>
<li>Be a signatory to the bank account</li></ol>
<h4>4. VICE SECRETARY</h4>
<p>Shall deputize the secretary on all responsibilities except being a signatory to the bank account</p>
<h4>5. TREASURER</h4>
<ol type="i"><li>Shall receive and pay all money of the welfare</li>
<li>Shall be a signatory to the bank account</li>
<li>Shall keep up to date financial records of the welfare</li>
<li>Prepare annual report and submit to the members during general meetings.</li></ol>
<h4>6. PATRON: KCRH MANAGER</h4>
<ol type="i"><li>Must be a member of the welfare</li>
<li>Shall oversee all the elections of the welfare</li>
<li>Shall link the welfare with administration and other important offices.</li></ol></div>

<div class="section"><h3>F) GENERAL ELECTIONS</h3>
<ol type="i"><li>Elections shall be held every 3 years</li>
<li>They will be done through secret ballot</li>
<li>Only registered active members will be allowed to participate in the elections</li>
<li>Elections shall be held on one person one vote basis</li>
<li>Departments shall forward representatives 3 days prior to elections</li>
<li>Any registered member can be elected to hold any office</li></ol></div>

<div class="section"><h3>G) BY ELECTION</h3>
<ul><li>If an official dies, resigns, transfers or ceases to be a member, a by-election shall be conducted within one month.</li>
<li>If more than half of the office bearers cease to be members, retires, transfers, resigns a general election shall be conducted within one month.</li></ul></div>

<div class="section"><h3>H) VOTE OF NO CONFIDENCE</h3>
<ol type="i"><li>A vote of no confidence can be passed on any office bearer.</li>
<li>A vote of no confidence shall require the support of more than two thirds (2/3) of the committee members</li>
<li>If a vote of no confidence is passed on more than half (1/2) of the office bearers a general election shall be conducted within one month.</li></ol></div>

<div class="section"><h3>I) FINANCES</h3>
<h4>a) Sources:</h4>
<ol type="i"><li>Members contribution</li><li>Projects</li><li>Well-wishers and friends</li></ol>
<h4>b) BANKING:</h4>
<ol type="i"><li>All moneys shall be banked at Cooperative bank Kerugoya branch:
<ul><li>through Lipa na M-pesa. Pay bill No. 400200 then Account No. 40088588</li>
<li>or direct deposit at Co-operative bank through A/C No. 01134568843700.</li></ul></li>
<li>The signatories shall be the Chairman, Secretary and the Treasurer.</li>
<li>Withdrawals shall be made by all the three signatories.</li></ol></div>

<div class="section"><h3>J) ACTIVITIES/EXPENDITURE</h3>
<h4>a. Joyous Moments</h4>
<p>In case of a wedding, the welfare shall contribute:</p>
<ul><li>One principal member – Ksh.25,000</li>
<li>Two principal members – Ksh.50,000</li></ul></div>

<div class="section"><h3>K) Somber Moments</h3>
<p>To support the members in case of death of nuclear family and the four (4) parents as follows:</p>
<ol type="i"><li>Principal members – Ksh.50,000</li>
<li>Nuclear family – Spouse- Ksh.40,000, Child – Ksh. 30,000</li>
<li>Parent – Ksh.20,000</li></ol>
<p>Members to have representation for burial with at least 5 members. If possible, every department ought to be represented.</p>
<p>In case of an occurrence where two principle members are involved, each member shall benefit equally as per the constitution.</p></div>

<div class="section"><h3>L) END OF YEAR</h3>
<p>There shall be an end of year AGM and teambuilding party in December each year. The remaining funds shall be appropriated in investment as per the AGM 2025 11th December Financial Statement and Investment report.</p></div>

<div class="section"><h3>M) RETIREMENT</h3>
<ul><li>During the AGM the retirees will be appreciated with a farewell gift of Ksh. 20,000</li>
<li>The retiree shall notify the welfare executive through the secretary by January each year.</li>
<li>Any member, after retirement, willing to continue being a member of the welfare shall be allowed to do so and therefore continue with the monthly contributions.</li>
<li>Such a member shall be eligible for all other benefits provided for by the welfare except for retirement.</li></ul></div>

<div class="section"><h3>N) MEETINGS</h3>
<h4>General meetings:</h4>
<h4>1. AGM</h4>
<ul><li>Shall be held annually</li>
<li>One (1) month notice shall be given</li>
<li>Financial report shall be required during meetings</li>
<li>A quorum of half (1/2) of the members shall be required</li></ul>
<h4>2. Ordinary meetings:</h4>
<p>Ordinary meetings shall be held anytime as need may arise.</p></div>

<div class="section"><h3>O) AMENDMENTS</h3>
<ol type="i"><li>Any clause in the constitution can be amended by not less than 2/3 of the members.</li>
<li>In case of a clause being repealed more than 2/3 of the members shall be required to support.</li></ol></div>

<div class="section"><h3>P) DISSOLUTION</h3>
<ol type="i"><li>Members can call for dissolution of the welfare.</li>
<li>Dissolution shall require the support of 2/3 or more members.</li>
<li>Upon dissolution the assets shall be divided amongst the registered members or dealt with in any other way the members shall deem appropriate.</li></ol></div>
</body></html>`;

  const downloadConstitution = () => {
    const blob = new Blob([constitutionHtml], { type: 'text/html' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'KIRINYAGA-HCWW-Constitution.html';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    toast.success("Constitution downloaded!");
  };

  const generateMinuteHtml = (minute: any) => {
    return `<!DOCTYPE html><html><head><title>${minute.title}</title>
    <style>body{font-family:Arial,sans-serif;margin:40px;line-height:1.8;max-width:900px;margin:0 auto;padding:40px}
    .header{text-align:center;margin-bottom:40px;border-bottom:3px solid #16a34a;padding-bottom:20px}
    .header h1{margin:0;color:#16a34a;font-size:28px}.header h2{margin:10px 0;color:#333;font-size:20px}
    .meta{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:20px 0;padding:15px;background:#f9fafb;border-radius:8px}
    .meta-item{font-size:14px}.meta-label{font-weight:bold;color:#666}
    .section{margin:30px 0}.section h3{color:#16a34a;border-bottom:2px solid #e5e7eb;padding-bottom:8px;margin-bottom:15px;font-size:18px}
    .section-content{padding-left:15px;white-space:pre-wrap;line-height:1.8}
    .attendees{display:flex;flex-wrap:wrap;gap:8px;padding-left:15px}
    .attendee-badge{background:#e5e7eb;padding:6px 12px;border-radius:20px;font-size:13px}
    .signatures{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:60px;padding-top:30px;border-top:2px solid #e5e7eb}
    .signature-block{text-align:center}
    .signature-img{max-width:200px;max-height:80px;margin:10px auto;display:block}
    .signature-line{border-top:2px solid #333;margin:20px auto 10px;width:200px}
    .signature-name{font-weight:bold;margin-top:5px}
    .signature-title{font-size:12px;color:#666}
    @media print{body{margin:20px}}</style></head><body>
    <div class="header">
    <h1>KIRINYAGA HEALTHCARE WORKERS' WELFARE</h1>
    <h2>Meeting Minutes</h2>
    <h3>${minute.title}</h3>
    </div>
    <div class="meta">
    <div class="meta-item"><span class="meta-label">Meeting Date:</span> ${new Date(minute.meeting_date).toLocaleDateString()}</div>
    <div class="meta-item"><span class="meta-label">Meeting Type:</span> ${minute.meeting_type.replace('_', ' ').toUpperCase()}</div>
    <div class="meta-item"><span class="meta-label">Status:</span> ${minute.status.toUpperCase()}</div>
    ${minute.next_meeting_date ? `<div class="meta-item"><span class="meta-label">Next Meeting:</span> ${new Date(minute.next_meeting_date).toLocaleDateString()}</div>` : ''}
    </div>
    ${minute.attendees && minute.attendees.length > 0 ? `<div class="section"><h3>Attendees</h3>
    <div class="attendees">${minute.attendees.map((a: string) => `<span class="attendee-badge">${a}</span>`).join('')}</div></div>` : ''}
    ${minute.agenda ? `<div class="section"><h3>Agenda</h3><div class="section-content">${minute.agenda}</div></div>` : ''}
    ${minute.discussions ? `<div class="section"><h3>Discussions</h3><div class="section-content">${minute.discussions}</div></div>` : ''}
    ${minute.decisions ? `<div class="section"><h3>Decisions Made</h3><div class="section-content">${minute.decisions}</div></div>` : ''}
    ${minute.action_items ? `<div class="section"><h3>Action Items</h3><div class="section-content">${minute.action_items}</div></div>` : ''}
    <div class="signatures">
      <div class="signature-block">
        ${minute.chairperson_signature_url ? `<img src="${minute.chairperson_signature_url}" alt="Chairperson Signature" class="signature-img" />` : '<div class="signature-line"></div>'}
        <div class="signature-name">${minute.chairperson_name || '_____________________'}</div>
        <div class="signature-title">Chairperson</div>
      </div>
      <div class="signature-block">
        ${minute.secretary_signature_url ? `<img src="${minute.secretary_signature_url}" alt="Secretary Signature" class="signature-img" />` : '<div class="signature-line"></div>'}
        <div class="signature-name">${minute.secretary_name || '_____________________'}</div>
        <div class="signature-title">Secretary</div>
      </div>
    </div>
    <p style="margin-top:60px;text-align:center;color:#666;font-size:12px;border-top:1px solid #e5e7eb;padding-top:20px">
    Generated from KIRINYAGA HCWW System | ${new Date().toLocaleDateString()}</p>
    </body></html>`;
  };

  const viewMinute = (minute: any) => {
    setSelectedMinute(minute);
    setShowMinute(true);
  };

  const downloadMinute = (minute: any) => {
    const html = generateMinuteHtml(minute);
    const blob = new Blob([html], { type: 'text/html' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `minutes-${minute.title.replace(/\s+/g, '-')}-${minute.meeting_date}.html`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    toast.success("Minutes downloaded!");
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-display font-bold">Downloads</h2>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ScrollText className="h-5 w-5 text-primary" /> Constitution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">KIRINYAGA Healthcare Workers' Welfare Constitution (2025 Dec. 11th Edition)</p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowConstitution(true)} className="flex-1">
              <Eye className="h-4 w-4 mr-2" /> Read
            </Button>
            <Button variant="outline" onClick={downloadConstitution}>
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" /> My Statement
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">Your contribution statement showing payment history and balances</p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={previewStatement} className="flex-1">
              <Eye className="h-4 w-4 mr-2" /> Preview
            </Button>
            <Button variant="outline" onClick={downloadStatement}>
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Meeting Minutes */}
      {publishedMinutes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" /> Meeting Minutes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">Approved meeting minutes available for download</p>
            <div className="space-y-2">
              {publishedMinutes.map((minute: any) => (
                <div key={minute.id} className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-accent/50 transition">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{minute.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(minute.meeting_date).toLocaleDateString()} • {minute.meeting_type.replace('_', ' ')}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => viewMinute(minute)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => downloadMinute(minute)}>
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Memos */}
      {memos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" /> Memos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">Official memos sent to you</p>
            <div className="space-y-2">
              {memos.map((r: any) => (
                <div key={r.id} className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-accent/50 transition">
                  <div className="flex-1">
                    <p className="font-medium text-sm flex items-center gap-2">
                      {r.memos.title}
                      {!r.seen_at && <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">NEW</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {r.memos.reference_number} • {new Date(r.memos.sent_at || r.memos.created_at).toLocaleDateString()} • {(r.memos.category || '').replace(/_/g, ' ')}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => viewMemo(r)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => downloadMemo(r)}>
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Memo Preview Dialog */}
      <Dialog open={showMemo} onOpenChange={setShowMemo}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>{selectedMemo?.title}</DialogTitle>
            <DialogDescription>
              {selectedMemo?.reference_number} • {selectedMemo && new Date(selectedMemo.sent_at || selectedMemo.created_at).toLocaleDateString()}
            </DialogDescription>
          </DialogHeader>
          {selectedMemo && <div dangerouslySetInnerHTML={{ __html: generateMemoHtml(selectedMemo) }} />}
        </DialogContent>
      </Dialog>

      {/* Statement Preview Dialog */}
      <Dialog open={showStatement} onOpenChange={setShowStatement}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>My Statement</DialogTitle>
            <DialogDescription>Preview your contribution statement</DialogDescription>
          </DialogHeader>
          <div dangerouslySetInnerHTML={{ __html: statementHtml }} />
          <Button onClick={downloadStatement} className="w-full"><Download className="h-4 w-4 mr-2" /> Download</Button>
        </DialogContent>
      </Dialog>

      {/* Constitution Dialog */}
      <Dialog open={showConstitution} onOpenChange={setShowConstitution}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>KIRINYAGA HCWW Constitution</DialogTitle>
            <DialogDescription>2025 Dec. 11th Edition</DialogDescription>
          </DialogHeader>
          <div dangerouslySetInnerHTML={{ __html: constitutionHtml }} />
          <Button onClick={downloadConstitution} className="w-full"><Download className="h-4 w-4 mr-2" /> Download</Button>
        </DialogContent>
      </Dialog>

      {/* Minute Preview Dialog */}
      <Dialog open={showMinute} onOpenChange={setShowMinute}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>{selectedMinute?.title}</DialogTitle>
            <DialogDescription>
              {selectedMinute && new Date(selectedMinute.meeting_date).toLocaleDateString()}
            </DialogDescription>
          </DialogHeader>
          {selectedMinute && (
            <div dangerouslySetInnerHTML={{ __html: generateMinuteHtml(selectedMinute) }} />
          )}
          {selectedMinute && (
            <Button onClick={() => downloadMinute(selectedMinute)} className="w-full">
              <Download className="h-4 w-4 mr-2" /> Download
            </Button>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
