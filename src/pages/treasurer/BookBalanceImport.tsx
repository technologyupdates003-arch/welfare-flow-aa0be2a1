import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, AlertCircle, CheckCircle, FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import * as XLSX from "xlsx";

export default function BookBalanceImport() {
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const { data: existingRecords = [] } = useQuery({
    queryKey: ["book-balance-records"],
    queryFn: async () => {
      const { data } = await supabase
        .from("book_balance")
        .select("*")
        .order("transaction_date", { ascending: false })
        .limit(5);
      return data || [];
    },
  });

  const parseBookBalanceFile = (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: "array" });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(firstSheet);

          console.log("[BookBalance Import] Raw rows from Excel:", rows);

          const transactions = rows
            .filter((row: any) => row["Trans Date"] && row["Reference No"]) // Filter valid rows
            .map((row: any, index: number) => {
              try {
                const transactionDate = row["Trans Date"];
                const referenceNo = row["Reference No"]; // Unique check number like CB0637161
                const credit = parseFloat(row["Credit"] || 0);
                const debit = parseFloat(row["Debit"] || 0);
                const bookBalance = row["Book Balance"];
                const transactionDetails = row["Transaction Details"] || "";

                // Parse book balance (remove "CR" or "DR" suffix and commas)
                const bookBalanceValue = bookBalance
                  ? parseFloat(String(bookBalance).replace(/,/g, "").replace(/\s*(CR|DR)/g, ""))
                  : 0;

                // Determine actual debit (use debit if > 0, otherwise use credit as debit if it's an outgoing)
                const actualDebit = debit > 0 ? debit : credit;

                if (!transactionDate || !referenceNo) {
                  console.log(
                    `[BookBalance Import] Row ${index} missing required fields:`,
                    { transactionDate, referenceNo }
                  );
                  return null;
                }

                // Parse date - handle Excel serial numbers and various formats
                let parsedDate;
                try {
                  const dateValue = transactionDate;
                  
                  // If it's a number (Excel serial date), convert it
                  if (typeof dateValue === 'number') {
                    // Excel dates start from 1900-01-01, but 1900-02-29 doesn't exist
                    // So we need to adjust for dates after Feb 28, 1900
                    const excelEpoch = new Date(1900, 0, 1);
                    const jsDate = new Date(excelEpoch.getTime() + (dateValue - 1) * 24 * 60 * 60 * 1000);
                    parsedDate = jsDate.toISOString().split("T")[0];
                  } else {
                    // Parse as string (DD-M-YYYY or other formats)
                    const dateStr = String(dateValue).trim();
                    
                    // Try DD-M-YYYY format first (like "01-6-2024")
                    const parts = dateStr.split('-');
                    if (parts.length === 3) {
                      const day = parseInt(parts[0], 10);
                      const month = parseInt(parts[1], 10);
                      const year = parseInt(parts[2], 10);
                      
                      if (day > 0 && day <= 31 && month > 0 && month <= 12 && year > 1900) {
                        const jsDate = new Date(year, month - 1, day);
                        parsedDate = jsDate.toISOString().split("T")[0];
                      } else {
                        throw new Error(`Invalid date components: ${dateStr}`);
                      }
                    } else {
                      // Try standard parsing as fallback
                      const jsDate = new Date(dateStr);
                      if (isNaN(jsDate.getTime())) {
                        throw new Error(`Cannot parse date: ${dateStr}`);
                      }
                      parsedDate = jsDate.toISOString().split("T")[0];
                    }
                  }
                } catch (dateError) {
                  console.log(`[BookBalance Import] Could not parse date: ${transactionDate}`, dateError);
                  return null;
                }

                return {
                  transaction_date: parsedDate,
                  check_number: String(referenceNo).trim().toUpperCase(),
                  debit: actualDebit,
                  book_balance: bookBalanceValue,
                  reason: transactionDetails.trim(),
                };
              } catch (rowError) {
                console.error(`[BookBalance Import] Error processing row ${index}:`, rowError);
                return null;
              }
            })
            .filter((t: any) => t !== null);

          console.log("[BookBalance Import] Parsed transactions:", transactions);

          if (transactions.length === 0) {
            reject(
              new Error(
                "No valid book balance transactions found. Make sure the Excel file has: Trans Date, Transaction Details, Reference No, Credit, Debit, Book Balance columns."
              )
            );
            return;
          }

          resolve(transactions);
        } catch (error) {
          console.error("[BookBalance Import] Parse error:", error);
          reject(error);
        }
      };

      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsArrayBuffer(file);
    });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      toast.error("Please upload an Excel file (.xlsx, .xls)");
      return;
    }

    setIsLoading(true);
    setUploadProgress(10);

    try {
      console.log("[BookBalance Import] Starting import for file:", file.name);

      const transactions = await parseBookBalanceFile(file);
      setUploadProgress(40);

      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      setUploadProgress(50);

      // Insert book balance records
      const { data, error: insertError } = await supabase
        .from("book_balance")
        .insert(
          transactions.map((t) => ({
            ...t,
            created_by: user.id,
          }))
        )
        .select();

      if (insertError) {
        console.error("[BookBalance Import] Insert error:", insertError);
        throw insertError;
      }

      setUploadProgress(90);

      console.log("[BookBalance Import] Successfully imported records:", data);

      toast.success(`✅ Imported ${data?.length || 0} book balance records`);

      setUploadProgress(100);

      // Refetch data
      queryClient.invalidateQueries({ queryKey: ["book-balance-records"] });
      queryClient.invalidateQueries({ queryKey: ["book-balance-list"] });

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      setTimeout(() => setUploadProgress(0), 1000);
    } catch (error: any) {
      console.error("[BookBalance Import] Error:", error);
      toast.error(error.message || "Failed to import book balance records");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-4">
      {/* Upload Card */}
      <Card className="border-2 border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileUp className="h-5 w-5" />
            Import Book Balance & Debits
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 p-8 text-center">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileUpload}
              disabled={isLoading}
              className="hidden"
            />

            <Upload className="mx-auto h-12 w-12 text-primary/60 mb-3" />

            <p className="text-sm font-medium mb-2">
              {isLoading ? "Importing..." : "Drop or click to upload Excel file"}
            </p>

            <p className="text-xs text-muted-foreground mb-4">
              Excel file should have columns: Transaction Date, Check Number, Debit, Book Balance
            </p>

            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <div className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin mr-2" />
                  Uploading ({uploadProgress}%)
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Select Excel File
                </>
              )}
            </Button>
          </div>

          {uploadProgress > 0 && (
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          )}

          {/* File Format Instructions */}
          <div className="rounded-lg bg-blue-50 p-4">
            <p className="text-sm font-medium text-blue-900 mb-2">📋 Required Excel Format:</p>
            <ul className="text-xs text-blue-800 space-y-1">
              <li>• Column A: Trans Date (Date format: DD-M-YYYY)</li>
              <li>• Column B: Transaction Details (Description with check info)</li>
              <li>• Column C: Value Date</li>
              <li>• Column D: Reference No (Unique check number - required)</li>
              <li>• Column E: Credit (Incoming amount)</li>
              <li>• Column F: Debit (Outgoing amount)</li>
              <li>• Column G: Book Balance (Running balance with CR/DR suffix)</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Recent Imports */}
      {existingRecords.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              Recent Records ({existingRecords.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {existingRecords.map((record: any) => (
                <div
                  key={record.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-sm">{record.check_number}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(record.transaction_date).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-sm text-red-600">
                      DR: KES {record.debit.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Bal: KES {record.book_balance.toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status Info */}
      <Card className="bg-amber-50 border-amber-200">
        <CardContent className="pt-6 flex gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <p className="font-medium">Import Notes:</p>
            <ul className="mt-2 space-y-1 text-xs">
              <li>• Debit amount and Book Balance are read-only after import</li>
              <li>• You can only edit the Reason field</li>
              <li>• Each Check Number must be unique</li>
              <li>• Duplicate check numbers will be rejected</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
