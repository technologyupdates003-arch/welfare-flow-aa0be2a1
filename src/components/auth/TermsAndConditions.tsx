import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TermsLinkProps {
  triggerLabel?: string;
}

export function TermsAndConditionsDialog({ triggerLabel = "Terms & Conditions" }: TermsLinkProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="font-medium text-primary underline underline-offset-2 hover:opacity-80"
        >
          {triggerLabel}
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            KHCW Welfare Group Financial Management System — User Terms &amp; Conditions
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh] pr-4">
          <div className="space-y-5 text-sm leading-relaxed text-muted-foreground">
            <section className="rounded-lg border border-border bg-muted/40 p-4">
              <p className="font-medium text-foreground">UI Onboarding Notice</p>
              <p className="mt-1">
                By ticking the box, you confirm that you are an active member of KHCW
                Welfare Group. You explicitly agree to honor all statutory obligations,
                including contributions, mandatory platform maintenance fees, and the
                Statutory Lifetime Onboarding Fee (payable as a one-off or lipa mdogo
                mdogo over 1 year). Furthermore, you grant express consent for the secure
                processing of your personal data under the Kenya Data Protection Act (2019).
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-foreground">
                1. Definitions and Acceptance of Terms
              </h3>
              <p>
                By accessing, registering, or utilizing the KHCW Welfare Group Management
                Progressive Web Application (PWA), you ("The Member") agree to be legally
                bound by these corporate Terms and Conditions. This digital ecosystem is the
                exclusive property of the KHCW Welfare Group. If you do not accept these
                parameters, transactional and administrative access to the platform will be
                withheld.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-foreground">
                2. Compliance with Statutory Financial Obligations
              </h3>
              <p>
                By onboarding and accessing the digital platform, the Member enters into an
                absolute agreement to fulfill all financial remissions as mandated by the
                KHCW Welfare Group Executive Committee. These statutory obligations include,
                but are not limited to:
              </p>
              <ul className="ml-5 mt-2 list-disc space-y-1">
                <li>
                  <strong>Core Welfare Contributions:</strong> Timely remittance of your
                  standard monthly welfare savings and capital pools.
                </li>
                <li>
                  <strong>System &amp; Platform Fees:</strong> Standard structural
                  maintenance dues required to sustain the core application infrastructure,
                  communication gateways, and data hosting protocols.
                </li>
                <li>
                  <strong>Contribution Management Fees:</strong> Internal transaction
                  processing or administrative fees associated with ledger management.
                </li>
              </ul>
              <p className="mt-2">
                All statutory fees will be settled internally in accordance with schedules
                and deduction pathways established by the Office of the Treasurer.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-foreground">
                3. Mandatory Statutory Lifetime Onboarding Fee
              </h3>
              <p>
                To preserve the administrative health of the welfare fund and sustain the
                group's digital ecosystem, access to the platform is contingent upon a
                Statutory Lifetime Onboarding Fee:
              </p>
              <ul className="ml-5 mt-2 list-disc space-y-1">
                <li>
                  <strong>Application:</strong> This non-refundable fee is a mandatory
                  statutory prerequisite for all new members registering on the platform. It
                  covers digital registration, system setup, secure credential provisioning,
                  and ledger initialization.
                </li>
                <li>
                  <strong>Flexible Payment Options:</strong> To ensure financial inclusivity,
                  the Member may settle this fee via two pathways:
                  <ol className="ml-5 mt-1 list-decimal space-y-1">
                    <li>
                      <strong>One-Off Payment:</strong> Full clearance of the statutory fee
                      immediately during the initial registration stage.
                    </li>
                    <li>
                      <strong>Lipa Mdogo Mdogo (Installment Plan):</strong> Distributed slowly
                      and steadily as micropayments over a maximum period of one (1) year,
                      structured internally through standard welfare remittance channels.
                    </li>
                  </ol>
                </li>
                <li>
                  <strong>Perpetual Revenue Utility:</strong> This fee operates as a permanent
                  institutional revenue stream for the KHCW Welfare Group. It is used
                  exclusively to support the continuous scale, security monitoring, and general
                  reserve funds of the group, and will remain an active entry requirement in
                  perpetuity.
                </li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold text-foreground">
                4. Data Privacy &amp; Compliance (Kenya Data Protection Act, 2019)
              </h3>
              <p>
                Pursuant to Section 25 of the Kenya Data Protection Act (2019), KHCW Welfare
                Group operates as a certified Data Controller. By onboarding, you grant
                explicit, informed consent for the system to securely process the following
                vectors:
              </p>
              <ul className="ml-5 mt-2 list-disc space-y-1">
                <li>
                  <strong>Personal Identifiers:</strong> Legal Names, National ID/Passport
                  Numbers, and Verified Mobile Phone Numbers.
                </li>
                <li>
                  <strong>Financial Ledgers:</strong> Personal contribution histories, wallet
                  balances, automatic penalty logs, and disbursement trackings.
                </li>
                <li>
                  <strong>Beneficiary Allocations:</strong> Legal names and contact parameters
                  of nominated beneficiaries for official welfare claims.
                </li>
                <li>
                  <strong>Usage Safeguard:</strong> Your operational data is strictly used for
                  welfare administration, automated receipting, and statutory logging. It will
                  never be shared, exposed, or leased to third-party commercial entities without
                  express secondary authorization.
                </li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold text-foreground">
                5. Revenue Layers, Wallets, and System Automation
              </h3>
              <ul className="ml-5 mt-2 list-disc space-y-1">
                <li>
                  <strong>M-Pesa Daraja Integration:</strong> All deposits, contributions, and
                  platform fees processed through the PWA interface route directly via the KHCW
                  Welfare Group official corporate Safaricom infrastructure into the locked
                  corporate bank account.
                </li>
                <li>
                  <strong>Automated Penalty Enforcement:</strong> The system's automated logic
                  will calculate and log financial defaults, arrears, or late statutory
                  contribution submissions based on constitutional deadlines.
                </li>
                <li>
                  <strong>Executive Multi-Signatory Disbursal:</strong> Financial liquid assets
                  cannot be triggered or disbursed from the system without digital consensus
                  signatures from the designated executive signatories.
                </li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold text-foreground">
                6. Digital Security &amp; Account Custody
              </h3>
              <ul className="ml-5 mt-2 list-disc space-y-1">
                <li>
                  <strong>Credential Protection:</strong> Members bear exclusive responsibility
                  for maintaining the absolute secrecy of their digital login parameters,
                  passwords, or One-Time PINs (OTPs).
                </li>
                <li>
                  <strong>Liability Boundaries:</strong> Any transaction or administrative
                  signature initiated via a member's authenticated profile will be legally
                  treated as authorized by that member. KHCW Welfare Group accepts zero
                  liability for losses arising from shared credentials or user device compromise.
                </li>
                <li>
                  <strong>System Audit Trails:</strong> Every profile adjustment, contribution
                  push, or payout claim is permanently logged on an unalterable digital audit
                  trail to maintain absolute financial transparency.
                </li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold text-foreground">7. Amendments to Terms</h3>
              <p>
                The KHCW Welfare Group Executive Committee retains the exclusive right to modify
                or adjust these digital terms as statutory, tax, or banking specifications
                evolve. Continued usage of the PWA portal following updates constitutes
                automatic acceptance of amended governance guidelines.
              </p>
            </section>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
