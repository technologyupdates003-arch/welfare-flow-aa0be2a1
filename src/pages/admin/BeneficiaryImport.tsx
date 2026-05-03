import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Upload, Loader2, CheckCircle, AlertCircle, Download } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

interface BeneficiaryEntry {
  name: string;
  relationship: string;
  phone?: string;
  id_number?: string;
}

interface ParsedRow {
  memberPhone: string;
  memberName: string;
  beneficiaries: BeneficiaryEntry[];
}

const normalizePhone = (phone: string): string => {
  if (!phone) return "";
  const digits = String(phone).replace(/\D/g, "");
  if (digits.startsWith("254")) return "+" + digits;
  if (digits.startsWith("0")) return "+254" + digits.substring(1);
  if (digits.length === 9) return "+254" + digits;
  return "+" + digits;
};

const pick = (row: any, keys: string[]): string => {
  for (const k of keys) {
    const found = Object.keys(row).find(rk => rk.trim().toLowerCase() === k.trim().toLowerCase());
    if (found && row[found] != null && String(row[found]).trim() !== "") {
      return String(row[found]).trim();
    }
  }
  return "";
};

export default function BeneficiaryImport() {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ParsedRow[]>([]);

  const { data: members = [] } = useQuery({
    queryKey: ["members-for-beneficiary"],
    queryFn: async () => {
      const { data } = await supabase.from("members").select("id, name, phone").order("name");
      return data || [];
    },
  });

  const parseExcelFile = async (f: File) => {
    try {
      const buffer = await f.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data: any[] = XLSX.utils.sheet_to_json(ws);

      const rows: ParsedRow[] = data.map((row: any) => {
        const memberPhone = pick(row, ["PHONE NUMBER", "Phone Number", "PHONE", "Phone", "Member Phone"]);
        const memberName = pick(row, ["MEMBER NAME", "Member Name", "NAME", "Name"]) ||
          [pick(row, ["FIRST NAME", "First Name"]), pick(row, ["SURNAME", "Surname", "Last Name"])].filter(Boolean).join(" ");

        const beneficiaries: BeneficiaryEntry[] = [];

        // Spouse
        const spouseName = [
          pick(row, ["SPOUSE FIRST NAME", "Spouse First Name"]),
          pick(row, ["SPOUSE SURNAME", "Spouse Surname"]),
          pick(row, ["SPOUSE OTHER NAMES", "Spouse Other Names"]),
        ].filter(Boolean).join(" ").trim() || pick(row, ["BENEFICIARIES [SPOUSE]", "SPOUSE"]);
        if (spouseName) {
          beneficiaries.push({
            name: spouseName,
            relationship: "spouse",
            phone: pick(row, ["SPOUSE PHONE"]) || undefined,
            id_number: pick(row, ["SPOUSE ID", "Spouse ID Number"]) || undefined,
          });
        }

        // Children 1-6
        for (let i = 1; i <= 6; i++) {
          const cName = [
            pick(row, [`CHILD ${i} OTHER NAMES`, `Child ${i} Other Names`, `${i}. OTHER NAMES`]),
            pick(row, [`CHILD ${i} SURNAME`, `Child ${i} Surname`, `${i}. SURNAME`]),
          ].filter(Boolean).join(" ").trim();
          if (cName) beneficiaries.push({ name: cName, relationship: "child" });
        }

        // Parents
        const father = [pick(row, ["FATHER OTHER NAMES", "Father Other Names"]), pick(row, ["FATHER SURNAME", "SURNAME OF FATHER"])].filter(Boolean).join(" ").trim();
        if (father) beneficiaries.push({ name: father, relationship: "father" });
        const mother = [pick(row, ["MOTHER OTHER NAMES", "Mother Other Names"]), pick(row, ["MOTHER SURNAME", "SURNAME OF MOTHER"])].filter(Boolean).join(" ").trim();
        if (mother) beneficiaries.push({ name: mother, relationship: "mother" });

        // NOK
        const nok = pick(row, ["NOK NAME", "NAME OF N.O.K", "Next of Kin"]);
        if (nok) beneficiaries.push({
          name: nok,
          relationship: "next_of_kin",
          phone: pick(row, ["NOK CONTACT", "CONTACT DETAILS"]) || undefined,
        });

        return { memberPhone, memberName, beneficiaries };
      }).filter(r => r.memberPhone && r.beneficiaries.length > 0);

      setPreview(rows);
      toast.success(`Parsed ${rows.length} member rows with ${rows.reduce((s, r) => s + r.beneficiaries.length, 0)} beneficiaries`);
    } catch (error: any) {
      toast.error(`Failed to parse file: ${error.message}`);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.name.match(/\.(xlsx|xls)$/i)) {
      toast.error("Please upload an Excel file (.xlsx or .xls)");
      return;
    }
    setFile(f);
    await parseExcelFile(f);
  };

  const importMutation = useMutation({
    mutationFn: async () => {
      let success = 0, errors = 0;
      const errorList: string[] = [];

      for (const row of preview) {
        const target = normalizePhone(row.memberPhone);
        const member = members.find(m => normalizePhone(m.phone) === target);

        if (!member) {
          errors++;
          errorList.push(`Member with phone ${row.memberPhone} not found`);
          continue;
        }

        // Replace existing beneficiaries for clean re-import
        await supabase.from("beneficiaries").delete().eq("member_id", member.id);

        const records = row.beneficiaries.map(b => ({
          member_id: member.id,
          name: b.name,
          relationship: b.relationship,
          phone: b.phone || null,
          id_number: b.id_number || null,
        }));

        const { error } = await supabase.from("beneficiaries").insert(records);
        if (error) {
          errors++;
          errorList.push(`${row.memberName || row.memberPhone}: ${error.message}`);
        } else {
          success += records.length;
        }
      }

      if (errors > 0) {
        throw new Error(`Imported ${success} beneficiaries with ${errors} errors. ${errorList.slice(0, 3).join("; ")}`);
      }
      return success;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["beneficiaries"] });
      toast.success(`Successfully imported ${count} beneficiary records`);
      setPreview([]);
      setFile(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const downloadTemplate = () => {
    const template = [{
      "MEMBER NAME": "John Doe",
      "PHONE NUMBER": "0712345678",
      "SPOUSE FIRST NAME": "Jane",
      "SPOUSE SURNAME": "Doe",
      "SPOUSE PHONE": "0712345679",
      "SPOUSE ID": "12345678",
      "CHILD 1 OTHER NAMES": "Junior",
      "CHILD 1 SURNAME": "Doe",
      "CHILD 2 OTHER NAMES": "",
      "CHILD 2 SURNAME": "",
      "FATHER OTHER NAMES": "Senior",
      "FATHER SURNAME": "Doe",
      "MOTHER OTHER NAMES": "Mary",
      "MOTHER SURNAME": "Doe",
      "NOK NAME": "Jane Doe",
      "NOK CONTACT": "0712345679",
    }];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Beneficiaries");
    XLSX.writeFile(wb, "beneficiary-template.xlsx");
    toast.success("Template downloaded");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Upload className="h-8 w-8" /> Import Beneficiaries
        </h1>
        <Badge variant="outline">Excel Import</Badge>
      </div>

      <Card>
        <CardHeader><CardTitle>Upload Beneficiary Excel File</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Members are automatically matched by phone number. Each member can have spouse, children, parents and next of kin.
          </p>
          <div>
            <Label htmlFor="bf">Select Excel File</Label>
            <Input id="bf" type="file" accept=".xlsx,.xls" onChange={handleFileChange} className="cursor-pointer" />
          </div>
          <Button variant="outline" onClick={downloadTemplate} className="w-full">
            <Download className="h-4 w-4 mr-2" /> Download Template
          </Button>
        </CardContent>
      </Card>

      {preview.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Preview ({preview.length} members, {preview.reduce((s, r) => s + r.beneficiaries.length, 0)} beneficiaries)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted">
                  <tr>
                    <th className="text-left p-2">Phone</th>
                    <th className="text-left p-2">Member</th>
                    <th className="text-left p-2">Beneficiaries</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((r, i) => {
                    const matched = members.find(m => normalizePhone(m.phone) === normalizePhone(r.memberPhone));
                    return (
                      <tr key={i} className="border-t">
                        <td className="p-2">{r.memberPhone} {!matched && <span className="text-destructive text-xs">(not found)</span>}</td>
                        <td className="p-2">{matched?.name || r.memberName}</td>
                        <td className="p-2">{r.beneficiaries.map(b => `${b.name} (${b.relationship})`).join(", ")}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Button onClick={() => importMutation.mutate()} disabled={importMutation.isPending} className="w-full">
              {importMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Importing...</> : <><CheckCircle className="h-4 w-4 mr-2" /> Import {preview.reduce((s, r) => s + r.beneficiaries.length, 0)} Beneficiaries</>}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
        <CardContent className="pt-6">
          <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
            <AlertCircle className="h-4 w-4" /> How It Works
          </h3>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li>Members are matched automatically by phone number (any format: 0712..., 254712..., +254712...)</li>
            <li>Existing beneficiaries for matched members are replaced with the new list</li>
            <li>Each beneficiary is stored with name, relationship, phone and ID number</li>
            <li>Live updates: beneficiaries appear instantly on the member's profile</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
