// Centralised contribution calculation (display-only, does NOT mutate stored rows).
//
// Business rule (agreed with the group):
//   * Every month a member owes a flat MONTHLY_CONTRIBUTION (KES 300).
//   * A member may pay several months at once (a lump sum). We therefore never
//     trust individual per-month "pending" rows; instead we take the member's
//     TOTAL money paid and divide by 300 to know how many months are covered.
//   * Expected months are counted from a fixed group start month (June 2024),
//     but never before the member's own first recorded contribution — so a
//     member who joined later is not charged for months before they existed.

export const MONTHLY_CONTRIBUTION = 300;

// Fixed group inception month.
export const GROUP_START_YEAR = 2024;
export const GROUP_START_MONTH = 6; // June 2024

export interface ContributionLike {
  amount: number | string | null;
  status?: string | null;
  paid_date?: string | null;
  year?: number | null;
  month?: number | null;
}

export interface ContributionSummary {
  monthly: number;
  totalPaid: number;
  monthsCovered: number;
  expectedMonths: number;
  monthsPending: number;
  pendingAmount: number;
  /** leftover money that is less than one full month (carried credit) */
  creditRemainder: number;
  upToDate: boolean;
  startYear: number;
  startMonth: number;
}

/** Inclusive count of months from (sy,sm) to (ey,em). */
export function monthsInclusive(sy: number, sm: number, ey: number, em: number): number {
  return (ey - sy) * 12 + (em - sm) + 1;
}

function isPaidRow(c: ContributionLike): boolean {
  return c.status === "paid" || !!c.paid_date;
}

export function computeContributionSummary(
  contributions: ContributionLike[] | null | undefined,
  opts?: { monthly?: number; now?: Date },
): ContributionSummary {
  const monthly = opts?.monthly && opts.monthly > 0 ? opts.monthly : MONTHLY_CONTRIBUTION;
  const now = opts?.now ?? new Date();
  const curY = now.getFullYear();
  const curM = now.getMonth() + 1;

  const rows = contributions ?? [];

  // Total money the member has actually paid (across all years / lump sums).
  const totalPaid = rows
    .filter(isPaidRow)
    .reduce((sum, c) => sum + Number(c.amount || 0), 0);

  // Determine the member's own earliest recorded month.
  let firstY: number | null = null;
  let firstM: number | null = null;
  for (const c of rows) {
    if (c.year == null || c.month == null) continue;
    if (firstY == null || c.year < firstY || (c.year === firstY && c.month < firstM!)) {
      firstY = c.year;
      firstM = c.month;
    }
  }

  // Start = later of the group start and the member's first recorded month.
  let startY = GROUP_START_YEAR;
  let startM = GROUP_START_MONTH;
  if (firstY != null && (firstY > startY || (firstY === startY && firstM! > startM))) {
    startY = firstY;
    startM = firstM!;
  }

  const expectedMonths = Math.max(0, monthsInclusive(startY, startM, curY, curM));
  const monthsCovered = Math.floor(totalPaid / monthly);
  const monthsPending = Math.max(0, expectedMonths - monthsCovered);
  const pendingAmount = monthsPending * monthly;
  const creditRemainder = totalPaid - monthsCovered * monthly;

  return {
    monthly,
    totalPaid,
    monthsCovered,
    expectedMonths,
    monthsPending,
    pendingAmount,
    creditRemainder,
    upToDate: monthsPending === 0,
    startYear: startY,
    startMonth: startM,
  };
}
