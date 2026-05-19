import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertTriangle, Search, Phone, Mail, TrendingDown, Users, TrendingUp } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function Defaulters() {
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch all members with their unpaid contributions and penalties
  const { data: defaulters = [], isLoading } = useQuery({
    queryKey: ["defaulters"],
    queryFn: async () => {
      // Get all members
      const { data: members } = await supabase
        .from("members")
        .select("*")
        .order("name");

      if (!members) return [];

      // Get unpaid contributions for each member
      const { data: contributions } = await supabase
        .from("contributions")
        .select("*")
        .neq("status", "paid");

      // Get unpaid penalties for each member
      const { data: penalties } = await supabase
        .from("penalties")
        .select("*")
        .eq("is_paid", false);

      // Calculate totals for each member
      const defaultersList = members
        .map((member) => {
          const memberContributions = contributions?.filter(
            (c) => c.member_id === member.id
          ) || [];
          const memberPenalties = penalties?.filter(
            (p) => p.member_id === member.id
          ) || [];

          const unpaidContributions = memberContributions.reduce(
            (sum, c) => sum + Number(c.amount),
            0
          );
          const unpaidPenalties = memberPenalties.reduce(
            (sum, p) => sum + Number(p.amount),
            0
          );
          const totalOwed = unpaidContributions + unpaidPenalties;

          return {
            ...member,
            unpaidContributions,
            unpaidPenalties,
            totalOwed,
            contributionCount: memberContributions.length,
            penaltyCount: memberPenalties.length,
          };
        })
        .filter((m) => m.totalOwed > 0) // Only show members with outstanding amounts
        .sort((a, b) => b.totalOwed - a.totalOwed); // Sort by highest amount owed

      return defaultersList;
    },
  });

  const filteredDefaulters = defaulters.filter(
    (member) =>
      member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.phone.includes(searchTerm) ||
      member.member_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalOwed = defaulters.reduce((sum, m) => sum + m.totalOwed, 0);
  const totalDefaulters = defaulters.length;
  const avgOwed = totalDefaulters > 0 ? totalOwed / totalDefaulters : 0;

  const sendReminder = async (member: any) => {
    toast.info(`Sending reminder to ${member.name}...`);
    // TODO: Implement SMS reminder via Edge Function
    setTimeout(() => {
      toast.success(`Reminder sent to ${member.name}`);
    }, 1000);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-sm text-muted-foreground">Loading defaulters...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Defaulters</h1>
        <p className="text-muted-foreground">
          Members with outstanding contributions and penalties
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Defaulters</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalDefaulters}</div>
            <p className="text-xs text-muted-foreground">
              Members with unpaid amounts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Amount Owed</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">KES {totalOwed.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Outstanding contributions & penalties
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Owed</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">KES {avgOwed.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
            <p className="text-xs text-muted-foreground">
              Per defaulting member
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, phone, or member ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Defaulters Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Defaulters List
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredDefaulters.length === 0 ? (
            <div className="text-center py-8">
              <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">
                {searchTerm ? "No defaulters found matching your search" : "No defaulters found"}
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead className="text-right">Unpaid Contributions</TableHead>
                    <TableHead className="text-right">Penalties</TableHead>
                    <TableHead className="text-right">Total Owed</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDefaulters.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{member.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {member.member_id}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 text-sm">
                            <Phone className="h-3 w-3" />
                            {member.phone}
                          </div>
                          {(member as any).email && (
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Mail className="h-3 w-3" />
                              {(member as any).email}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div>
                          <div className="font-medium">
                            KES {member.unpaidContributions.toLocaleString()}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {member.contributionCount} month{member.contributionCount !== 1 ? 's' : ''}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div>
                          <div className="font-medium">
                            KES {member.unpaidPenalties.toLocaleString()}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {member.penaltyCount} penalt{member.penaltyCount !== 1 ? 'ies' : 'y'}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="font-bold text-red-600">
                          KES {member.totalOwed.toLocaleString()}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={
                            member.totalOwed > 5000
                              ? "destructive"
                              : member.totalOwed > 2000
                              ? "default"
                              : "secondary"
                          }
                        >
                          {member.totalOwed > 5000
                            ? "Critical"
                            : member.totalOwed > 2000
                            ? "High"
                            : "Moderate"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => sendReminder(member)}
                        >
                          Send Reminder
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

