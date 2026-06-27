import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Search, Edit2, X, Check, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface BookBalanceRecord {
  id: string;
  transaction_date: string;
  check_number: string;
  debit: number;
  book_balance: number;
  reason: string | null;
  created_at: string;
}

interface EditingRecord {
  id: string;
  check_number: string;
  reason: string;
}

export default function BookBalance() {
  const [searchQuery, setSearchQuery] = useState("");
  const [editingRecord, setEditingRecord] = useState<EditingRecord | null>(null);
  const [editReason, setEditReason] = useState("");
  const queryClient = useQueryClient();

  // Fetch all book balance records
  const { data: records = [], isLoading } = useQuery({
    queryKey: ["book-balance-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("book_balance")
        .select("*")
        .order("transaction_date", { ascending: false });

      if (error) {
        console.error("[BookBalance] Query error:", error);
        throw error;
      }

      return (data || []) as BookBalanceRecord[];
    },
  });

  // Update reason mutation
  const updateReasonMutation = useMutation({
    mutationFn: async (data: { id: string; reason: string }) => {
      const { error } = await supabase
        .from("book_balance")
        .update({ reason: data.reason })
        .eq("id", data.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Reason updated successfully");
      queryClient.invalidateQueries({ queryKey: ["book-balance-list"] });
      setEditingRecord(null);
      setEditReason("");
    },
    onError: (error: any) => {
      console.error("[BookBalance] Update error:", error);
      toast.error(error.message || "Failed to update reason");
    },
  });

  // Filter records by search query
  const filteredRecords = useMemo(() => {
    if (!searchQuery.trim()) return records;

    const query = searchQuery.toLowerCase();
    return records.filter((record) =>
      record.check_number.toLowerCase().includes(query)
    );
  }, [records, searchQuery]);

  // Summary calculations
  const summary = useMemo(() => {
    if (filteredRecords.length === 0) {
      return {
        totalDebits: 0,
        count: 0,
        latestBalance: 0,
      };
    }

    return {
      totalDebits: filteredRecords.reduce((sum, r) => sum + r.debit, 0),
      count: filteredRecords.length,
      latestBalance: filteredRecords[0]?.book_balance || 0,
    };
  }, [filteredRecords]);

  const handleEditClick = (record: BookBalanceRecord) => {
    setEditingRecord({
      id: record.id,
      check_number: record.check_number,
      reason: record.reason || "",
    });
    setEditReason(record.reason || "");
  };

  const handleSaveReason = () => {
    if (!editingRecord) return;

    updateReasonMutation.mutate({
      id: editingRecord.id,
      reason: editReason,
    });
  };

  const handleCancel = () => {
    setEditingRecord(null);
    setEditReason("");
  };

  return (
    <div className="space-y-6 pb-4">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Book Balance & Debits</h1>
        <p className="text-muted-foreground mt-1">
          View and manage book balance records with debit information
        </p>
      </div>

      {/* Search Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by check number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {filteredRecords.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground mb-1">Total Debits</p>
              <p className="text-2xl font-bold text-red-600">
                KES {summary.totalDebits.toLocaleString()}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground mb-1">Records</p>
              <p className="text-2xl font-bold">{summary.count}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground mb-1">Latest Balance</p>
              <p className="text-2xl font-bold">
                KES {summary.latestBalance.toLocaleString()}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Records Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Book Balance Records</span>
            <Badge variant="outline">{filteredRecords.length} records</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <div className="inline-block h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              <p className="mt-2 text-sm text-muted-foreground">Loading records...</p>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">No records found</p>
              {searchQuery && (
                <p className="text-sm text-muted-foreground mt-1">
                  Try clearing your search
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {filteredRecords.map((record) => (
                <div
                  key={record.id}
                  className="flex items-start justify-between p-4 border rounded-lg hover:bg-gray-50/50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Badge variant="default" className="font-mono">
                        {record.check_number}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {new Date(record.transaction_date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs">Debit</p>
                        <p className="font-medium text-red-600">
                          KES {record.debit.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Book Balance</p>
                        <p className="font-medium">
                          KES {record.book_balance.toLocaleString()}
                        </p>
                      </div>
                    </div>

                    {record.reason && (
                      <p className="text-xs text-muted-foreground mt-2 italic">
                        Reason: {record.reason}
                      </p>
                    )}
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEditClick(record)}
                    className="ml-4 flex-shrink-0"
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Reason Dialog */}
      <Dialog open={!!editingRecord} onOpenChange={() => handleCancel()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Reason</DialogTitle>
          </DialogHeader>

          {editingRecord && (
            <div className="space-y-4">
              <div>
                <Badge variant="outline" className="font-mono mb-2 block">
                  {editingRecord.check_number}
                </Badge>
                <p className="text-sm text-muted-foreground">
                  ⚠️ Debit amount and Book Balance cannot be edited
                </p>
              </div>

              <div>
                <Label htmlFor="reason">Reason (Optional)</Label>
                <textarea
                  id="reason"
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  placeholder="Enter reason for this transaction..."
                  className="mt-2 w-full p-2 border rounded-lg text-sm min-h-[100px] focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={handleCancel}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveReason}
                  disabled={updateReasonMutation.isPending}
                >
                  {updateReasonMutation.isPending ? (
                    <>
                      <div className="h-3 w-3 rounded-full border-2 border-white border-t-transparent animate-spin mr-2" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Save Reason
                    </>
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Info Box */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6 flex gap-3">
          <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium">Read-Only Fields:</p>
            <ul className="mt-2 space-y-1 text-xs">
              <li>• Check Number - Cannot be changed</li>
              <li>• Transaction Date - Cannot be changed</li>
              <li>• Debit Amount - Cannot be changed</li>
              <li>• Book Balance - Cannot be changed</li>
              <li>✓ Only "Reason" field can be edited</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
