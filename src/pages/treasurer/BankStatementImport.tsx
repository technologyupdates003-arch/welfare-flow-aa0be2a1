import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, Landmark, Check, AlertCircle, Loader2, Users, UserPlus, Copy, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";

interface ParsedTx {
  phone: string;
  name: string;
  amount: number;
  date: string;
  reference: string;
  mpesaCode: string;
  rawDetails: string;
}

interface ImportResults {
  total: number;
  new_members: number;
  existing_members_updated: number;
  duplicates_skipped: number;
  transactions_imported: number;
  total_amount: number;
  failed: number;
  failures: { row: number; reason: string }[];
}

function normalizePhone(raw: string): string | null {
  if (!raw) return null;
  let cleaned = String(raw).replace(/\s+/g, "").replace(/-/g, "").replace(/\+/g, "");
  // keep only digits
  cleaned = cleaned.replace(/\D/g, "");
  if (cleaned.startsWith("254") && cleaned.length === 12) return "+" + cleaned;
  if (cleaned.startsWith("0") && cleaned.length === 10) return "+254" + cleaned.slice(1);
  if ((cleaned.startsWith("7") || cleaned.startsWith("1")) && cleaned.length === 9) return "+254" + cleaned;
  if (/^\d{9}$/.test(cleaned)) return "+254" + cleaned;
  return null;
}

// Find a Kenyan phone number anywhere inside a blob of text.
function extractPhone(text: string): string | null {
  if (!text) return null;
  const compact = text.replace(/[\s\-()]/g, "");
  const patterns = [
    /254[17]\d{8}/, // 2547xxxxxxxx / 2541xxxxxxxx
    /\b0[17]\d{8}\b/, // 07xxxxxxxx / 01xxxxxxxx
    /(?<!\d)[17]\d{8}(?!\d)/, // 7xxxxxxxx / 1xxxxxxxx standalone
  ];
  for (const p of patterns) {
    const m = compact.match(p);
    if (m) {
      const phone = normalizePhone(m[0]);
      if (phone) return phone;
    }
  }
  return null;
}

function excelDateToISO(val: any): string | null {
  if (val === null || val === undefined || val === "") return null;
  if (typeof val === "number") {
    const d = new Date((val - 25569) * 86400 * 1000);
    return isNaN(d.getTime()) ? null : d.toISOString().split("T")[0];
  }
  // Try common bank date formats: dd/mm/yyyy, dd-mm-yyyy, yyyy-mm-dd
  const s = String(val).trim();
  const dmy = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (dmy) {
    let [, dd, mm, yy] = dmy;
    if (yy.length === 2) yy = "20" + yy;
    const d = new Date(Number(yy), Number(mm) - 1, Number(dd));
    if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString().split("T")[0];
}

const SKIP_WORDS = ["balance", "forward", "total", "carried", "brought", "opening", "closing"];

// Header synonyms for the columns we need (all lower-cased, matched by "includes")
const DATE_HINTS = ["trans date", "transaction date", "txn date", "value date", "posting date", "date"];
const DETAIL_HINTS = ["transaction details", "details", "narration", "particulars", "description", "remarks", "narrative"];
const REF_HINTS = ["reference", "ref no", "ref.", "cheque", "transaction id", "txn id", "receipt"];
const CREDIT_HINTS = ["credit", "deposit", "money in", "cr amount", "amount in", "paid in"];
const AMOUNT_HINTS = ["amount", "value"];
const NAME_HINTS = ["name", "customer", "payer", "sender", "depositor"];
const PHONE_HINTS = ["phone", "mobile", "msisdn", "number", "tel"];

function isHeaderRow(vals: string[]): boolean {
  const hasDetail = vals.some((v) => DETAIL_HINTS.some((h) => v.includes(h)));
  const hasMoney =
    vals.some((v) => CREDIT_HINTS.some((h) => v.includes(h))) ||
    vals.some((v) => AMOUNT_HINTS.some((h) => v.includes(h)));
  const hasDate = vals.some((v) => DATE_HINTS.some((h) => v.includes(h)));
  // A header needs money + (details OR date) to be considered valid
  return hasMoney && (hasDetail || hasDate);
}

function firstCol(header: string[], hints: string[]): number {
  for (const h of hints) {
    const idx = header.findIndex((v) => v.includes(h));
    if (idx >= 0) return idx;
  }
  return -1;
}

function deriveName(text: string, phone: string): string {
  if (!text) return phone;
  let name = "";
  // Co-op / Mpesa style: code~amount~phone~NAME (last segment after ~)
  const parts = text.split("~");
  if (parts.length > 1) {
    name = parts[parts.length - 1].trim();
  }
  // If no tilde, try to grab a run of capitalised words / letters
  if (!name) {
    const m = text.match(/[A-Za-z][A-Za-z'.\- ]{3,}/);
    if (m) name = m[0].trim();
  }
  // clean up: remove digits, references, skip words
  name = name.replace(/\d+/g, " ").replace(/[~_|]/g, " ").replace(/\s+/g, " ").trim();
  for (const w of SKIP_WORDS) {
    const idx = name.toLowerCase().indexOf(w);
    if (idx > 0) name = name.slice(0, idx).trim();
  }
  return name || phone;
}

function parseWorkbook(wb: XLSX.WorkBook): ParsedTx[] {
  const out: ParsedTx[] = [];

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const grid = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, raw: true, defval: "" });
    if (!grid.length) continue;

    // Locate header row anywhere in the sheet (statements often have preamble rows)
    let hdr = -1;
    let header: string[] = [];
    for (let i = 0; i < grid.length; i++) {
      const vals = (grid[i] || []).map((v) => String(v).trim().toLowerCase());
      if (isHeaderRow(vals)) {
        hdr = i;
        header = vals;
        break;
      }
    }
    if (hdr === -1) continue;

    const cDate = firstCol(header, DATE_HINTS);
    const cDet = firstCol(header, DETAIL_HINTS);
    const cRef = firstCol(header, REF_HINTS);
    const cName = firstCol(header, NAME_HINTS);
    const cPhone = firstCol(header, PHONE_HINTS);
    // Prefer a dedicated credit/deposit column; fall back to a generic amount column
    let cCred = firstCol(header, CREDIT_HINTS);
    const cDebit = header.findIndex((v) => v.includes("debit") || v.includes("withdraw") || v.includes("money out") || v.includes("paid out"));
    if (cCred === -1) cCred = firstCol(header, AMOUNT_HINTS);

    type Cur = { date: any; det: string; ref: string; cred: any; debit: any; nameCell: string; phoneCell: string; all: string };
    let cur: Cur | null = null;

    const flush = () => {
      if (!cur) return;
      const credNum = Number(String(cur.cred).replace(/,/g, "").trim());
      const debitNum = cDebit >= 0 ? Number(String(cur.debit).replace(/,/g, "").trim()) : 0;
      // Only credits (money in) are contributions; skip debits/withdrawals
      if (!isNaN(credNum) && credNum > 0 && !(debitNum > 0)) {
        // Search phone in: dedicated phone cell -> details -> whole row text
        const phone =
          extractPhone(cur.phoneCell) || extractPhone(cur.det) || extractPhone(cur.all);
        if (phone) {
          const nameSource = (cur.nameCell || "").trim() || cur.det;
          const name = deriveName(nameSource, phone);
          // mpesa code: first token in details that looks like a code
          const codeMatch = cur.det.match(/\b[A-Z0-9]{8,12}\b/);
          const mpesaCode = codeMatch ? codeMatch[0] : "";
          const iso = excelDateToISO(cur.date);
          const reference =
            String(cur.ref || "").trim() ||
            mpesaCode ||
            `${phone}-${iso || "nd"}-${credNum}`;
          if (iso) {
            out.push({
              phone,
              name: name || phone,
              amount: credNum,
              date: iso,
              reference,
              mpesaCode,
              rawDetails: (cur.all || cur.det).trim().slice(0, 400),
            });
          }
        }
      }
      cur = null;
    };

    for (let i = hdr + 1; i < grid.length; i++) {
      const r = grid[i] || [];
      const allText = r.map((c) => String(c ?? "")).join(" ").replace(/\s+/g, " ").trim();
      const ref = cRef >= 0 ? String(r[cRef] ?? "").trim() : "";
      const det = cDet >= 0 ? String(r[cDet] ?? "").replace(/\n/g, " ").trim() : "";
      const nameCell = cName >= 0 ? String(r[cName] ?? "").trim() : "";
      const phoneCell = cPhone >= 0 ? String(r[cPhone] ?? "").trim() : "";
      const dateCell = cDate >= 0 ? r[cDate] : "";
      const credCell = cCred >= 0 ? String(r[cCred] ?? "").replace(/,/g, "").trim() : "";
      // A new transaction row starts when it has a reference OR a date OR a credit value
      const startsRow =
        (ref && ref.toLowerCase() !== "nan") || !!dateCell || (credCell !== "" && Number(credCell) > 0);

      if (startsRow) {
        flush();
        cur = {
          date: dateCell,
          det,
          ref,
          cred: cCred >= 0 ? r[cCred] : "",
          debit: cDebit >= 0 ? r[cDebit] : "",
          nameCell,
          phoneCell,
          all: allText,
        };
      } else if (cur && (det || allText) && (det || allText).toLowerCase() !== "nan") {
        const low = (det || allText).toLowerCase();
        if (!SKIP_WORDS.some((w) => low.includes(w))) {
          if (det) cur.det += " " + det;
          if (allText) cur.all += " " + allText;
          if (!cur.phoneCell && phoneCell) cur.phoneCell = phoneCell;
          if (!cur.nameCell && nameCell) cur.nameCell = nameCell;
        }
      }
    }
    flush();
  }

  // Deduplicate within the file itself (phone+ref+date+amount)
  const seen = new Set<string>();
  return out.filter((t) => {
    const k = `${t.phone}|${t.reference}|${t.date}|${t.amount}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export default function BankStatementImport() {
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<ParsedTx[]>([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [results, setResults] = useState<ImportResults | null>(null);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setResults(null);
    setRows([]);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: "binary", cellDates: false });
        const parsed = parseWorkbook(wb);
        if (parsed.length === 0) {
          toast.error("No contribution transactions found. Make sure this is a bank statement export.");
          return;
        }
        setRows(parsed);
        toast.success(`${parsed.length} contribution transactions detected`);
      } catch (err: any) {
        toast.error(`Failed to read file: ${err.message}`);
      }
    };
    reader.readAsBinaryString(file);
  }, []);

  const totalAmount = rows.reduce((s, r) => s + r.amount, 0);

  const handleImport = async () => {
    setImporting(true);
    setResults(null);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const url = `https://${projectId}.supabase.co/functions/v1/bank-statement-import`;
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        toast.error(data.error || "Import failed");
        return;
      }
      setResults(data);
      queryClient.invalidateQueries({ queryKey: ["members"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      queryClient.invalidateQueries({ queryKey: ["treasurer-stats"] });
      queryClient.invalidateQueries({ queryKey: ["contributions"] });
      toast.success(`${data.transactions_imported} transactions imported • ${data.new_members} new members`);
    } catch (err: any) {
      toast.error(`Import error: ${err.message}`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <Landmark className="h-7 w-7 text-primary" /> Bank Statement Import
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Upload a bank statement Excel file. Members are auto-created or updated by phone number, and
          contributions are recorded and synced to every dashboard.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upload Statement</CardTitle>
          <CardDescription>
            Supports multi-page Co-op Bank statement exports (.xlsx). Phone number, date, amount and
            reference are read automatically. Duplicate transactions are skipped.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input type="file" accept=".xlsx,.xls" onChange={handleFile} className="max-w-md" />

          {rows.length > 0 && (
            <>
              <div className="flex items-center gap-3 flex-wrap">
                <Badge variant="secondary">{rows.length} transactions</Badge>
                <Badge variant="outline">KES {totalAmount.toLocaleString()}</Badge>
                <span className="text-xs text-muted-foreground">{fileName}</span>
              </div>

              <div className="max-h-72 overflow-auto border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Reference</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.slice(0, 30).map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="capitalize">{r.name.toLowerCase()}</TableCell>
                        <TableCell className="font-mono text-xs">{r.phone}</TableCell>
                        <TableCell>KES {r.amount.toLocaleString()}</TableCell>
                        <TableCell>{r.date}</TableCell>
                        <TableCell className="font-mono text-xs">{r.reference}</TableCell>
                      </TableRow>
                    ))}
                    {rows.length > 30 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground text-sm">
                          ...and {rows.length - 30} more transactions
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              <Button onClick={handleImport} disabled={importing} className="w-full sm:w-auto">
                {importing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                {importing ? "Importing..." : `Import ${rows.length} Transactions`}
              </Button>
            </>
          )}

          {results && (
            <div className="space-y-3 p-4 rounded-lg border bg-muted/30">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <Check className="h-4 w-4 text-green-600" /> Import Summary
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <div className="text-center p-3 rounded bg-background">
                  <div className="text-2xl font-bold">{results.total}</div>
                  <div className="text-xs text-muted-foreground">Processed</div>
                </div>
                <div className="text-center p-3 rounded bg-blue-50 dark:bg-blue-950/30">
                  <div className="text-2xl font-bold text-blue-600 flex items-center justify-center gap-1">
                    <UserPlus className="h-4 w-4" />{results.new_members}
                  </div>
                  <div className="text-xs text-blue-600">New Members</div>
                </div>
                <div className="text-center p-3 rounded bg-green-50 dark:bg-green-950/30">
                  <div className="text-2xl font-bold text-green-600 flex items-center justify-center gap-1">
                    <Users className="h-4 w-4" />{results.existing_members_updated}
                  </div>
                  <div className="text-xs text-green-600">Members Updated</div>
                </div>
                <div className="text-center p-3 rounded bg-yellow-50 dark:bg-yellow-950/30">
                  <div className="text-2xl font-bold text-yellow-600 flex items-center justify-center gap-1">
                    <Copy className="h-4 w-4" />{results.duplicates_skipped}
                  </div>
                  <div className="text-xs text-yellow-600">Duplicates Skipped</div>
                </div>
                <div className="text-center p-3 rounded bg-background">
                  <div className="text-lg font-bold">KES {Number(results.total_amount).toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">Total Imported</div>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                {results.transactions_imported} contributions saved. New members can log in with their phone
                number and password <strong>Member2026</strong>.
              </p>

              {results.failures.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-destructive flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" /> {results.failures.length} rows failed
                  </p>
                  <div className="max-h-48 overflow-auto border rounded">
                    <Table>
                      <TableHeader>
                        <TableRow><TableHead className="w-20">Row</TableHead><TableHead>Reason</TableHead></TableRow>
                      </TableHeader>
                      <TableBody>
                        {results.failures.map((f, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-mono text-xs">{f.row}</TableCell>
                            <TableCell className="text-xs text-destructive">{f.reason}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
