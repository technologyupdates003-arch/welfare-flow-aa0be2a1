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
  const cleaned = String(raw).replace(/\s+/g, "").replace(/-/g, "").replace(/\+/g, "");
  if (cleaned.startsWith("254") && cleaned.length === 12) return "+" + cleaned;
  if (cleaned.startsWith("0") && cleaned.length === 10) return "+254" + cleaned.slice(1);
  if (cleaned.startsWith("7") && cleaned.length === 9) return "+254" + cleaned;
  if (/^\d{9}$/.test(cleaned)) return "+254" + cleaned;
  return null;
}

function excelDateToISO(val: any): string | null {
  if (val === null || val === undefined || val === "") return null;
  if (typeof val === "number") {
    const d = new Date((val - 25569) * 86400 * 1000);
    return isNaN(d.getTime()) ? null : d.toISOString().split("T")[0];
  }
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d.toISOString().split("T")[0];
}

const SKIP_WORDS = ["balance", "forward", "total", "carried", "brought"];

function parseWorkbook(wb: XLSX.WorkBook): ParsedTx[] {
  const out: ParsedTx[] = [];

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const grid = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, raw: true, defval: "" });
    if (!grid.length) continue;

    // Locate header row
    let hdr = -1;
    let header: string[] = [];
    for (let i = 0; i < Math.min(6, grid.length); i++) {
      const vals = (grid[i] || []).map((v) => String(v).trim().toLowerCase());
      if (vals.some((v) => v.includes("trans date")) && vals.some((v) => v.includes("transaction details"))) {
        hdr = i;
        header = vals;
        break;
      }
    }
    if (hdr === -1) continue;

    const colOf = (needle: string) => header.findIndex((v) => v.includes(needle));
    const cDate = colOf("trans date");
    const cDet = colOf("transaction details");
    const cRef = colOf("reference");
    const cCred = colOf("credit");

    let cur: { date: any; det: string; ref: string; cred: any } | null = null;
    const flush = () => {
      if (!cur) return;
      const credNum = Number(String(cur.cred).replace(/,/g, "").trim());
      if (!isNaN(credNum) && credNum > 0) {
        const compact = cur.det.replace(/\s+/g, "");
        const phoneMatch = compact.match(/254\d{9}/);
        if (phoneMatch) {
          const phone = "+" + phoneMatch[0];
          const parts = cur.det.split("~");
          let name = parts.length > 1 ? parts[parts.length - 1].trim() : "";
          name = name.replace(/^\d+\s*/, "").trim();
          // strip any trailing footer noise
          for (const w of SKIP_WORDS) {
            const idx = name.toLowerCase().indexOf(w);
            if (idx > 0) name = name.slice(0, idx).trim();
          }
          const mpesaCode = parts.length ? parts[0].trim().split(/\s/)[0] : "";
          const iso = excelDateToISO(cur.date);
          if (iso && cur.ref) {
            out.push({
              phone,
              name: name || phone,
              amount: credNum,
              date: iso,
              reference: String(cur.ref).trim(),
              mpesaCode,
              rawDetails: cur.det.trim().slice(0, 300),
            });
          }
        }
      }
      cur = null;
    };

    for (let i = hdr + 1; i < grid.length; i++) {
      const r = grid[i] || [];
      const ref = cRef >= 0 ? String(r[cRef] ?? "").trim() : "";
      const det = cDet >= 0 ? String(r[cDet] ?? "").replace(/\n/g, " ").trim() : "";
      const hasRef = ref && ref.toLowerCase() !== "nan";

      if (hasRef) {
        flush();
        cur = {
          date: cDate >= 0 ? r[cDate] : "",
          det,
          ref,
          cred: cCred >= 0 ? r[cCred] : "",
        };
      } else if (cur && det && det.toLowerCase() !== "nan") {
        const low = det.toLowerCase();
        if (!SKIP_WORDS.some((w) => low.includes(w))) {
          cur.det += " " + det;
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
