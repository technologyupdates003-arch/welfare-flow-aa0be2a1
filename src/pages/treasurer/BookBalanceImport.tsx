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
            .slice(0, -1) // Remove last row if it's summary
            .map((row: any, index: number) => {
              const transactionDate = row["Transaction Date"] || row["Date"];
              const checkNumber = row["Check Number"] || row["Check No"] || row["Cheque No"];
              const debit = row["Debit"] || row["Amount"];
              const bookBalance = row["Book Balance"] || row["Balance"];

              if (!transactionDate || !checkNumber || !debit || bookBalance === undefined) {
                console.log(
                  `[BookBalance Import] Row ${index} missing required fields:`,
                  { transactionDate, checkNumber, debit, bookBalance }
                );
                return null;
              }

              return {
                transaction_date: new Date(transactionDate).toISOString().split("T")[0],
                check_number: String(checkNumber).trim().toUpperCase(),
                debit: parseFloat(debit),
                book_balance: parseFloat(bookBalance),
                reason: row["Reason"] || row["Notes"] || "",
              };
            })
            .filter((t: any) => t !== null);

          console.log("[BookBalance Import] Parsed transactions:", transactions);

          if (transactions.length === 0) {
            reject(new Error("No valid book balance transactions found. Make sure the Excel file has: Transaction Date, Check Number, Debit, Book Balance columns."));
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
              <li>• Column A: Transaction Date (YYYY-MM-DD format)</li>
              <li>• Column B: Check Number (unique identifier)</li>
              <li>• Column C: Debit (amount)</li>
              <li>• Column D: Book Balance (running balance)</li>
              <li>• Column E: Reason (optional notes)</li>
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
