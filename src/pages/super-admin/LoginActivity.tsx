import { useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Users, Loader2, Clock, ChevronLeft, ChevronRight, Download } from "lucide-react";

type Row = {
  member_id: string;
  user_id: string | null;
  name: string | null;
  phone: string | null;
  email: string | null;
  is_active: boolean | null;
  last_sign_in_at: string | null;
  created_at: string | null;
  total_count: number;
};

const PAGE_SIZE = 50;

function timeAgo(iso: string | null) {
  if (!iso) return "Never signed in";
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} day${d === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString();
}

export default function LoginActivity() {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(0);

  // debounce search input
  useState(() => undefined);
  const onSearch = (value: string) => {
    setSearch(value);
    window.clearTimeout((onSearch as any)._t);
    (onSearch as any)._t = window.setTimeout(() => {
      setPage(0);
      setDebounced(value.trim());
    }, 350);
  };

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["member-login-activity", debounced, page],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_member_login_activity", {
        _search: debounced || null,
        _limit: PAGE_SIZE,
        _offset: page * PAGE_SIZE,
      });
      if (error) throw error;
      return (data || []) as unknown as Row[];
    },
    placeholderData: keepPreviousData,
    staleTime: 20000,
    refetchInterval: 60000,
  });

  const rows = data || [];
  const total = rows.length ? Number(rows[0].total_count) : 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const signedInEver = rows.filter((r) => r.last_sign_in_at).length;

  const exportCsv = () => {
    const csv =
      "Name,Phone,Identifier,Status,Last Signed In\n" +
      rows
        .map((r) =>
          [
            `"${r.name || ""}"`,
            r.phone || "",
            r.email || "",
            r.is_active ? "Active" : "Inactive",
            r.last_sign_in_at ? new Date(r.last_sign_in_at).toLocaleString() : "Never",
          ].join(",")
        )
        .join("\n");
    const link = document.createElement("a");
    link.href = encodeURI("data:text/csv;charset=utf-8," + csv);
    link.download = `login_activity_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-r from-primary to-orange-600 rounded-xl flex items-center justify-center">
              <Users className="h-7 w-7 text-primary-foreground" />
            </div>
            Login Activity
          </h1>
          <p className="text-muted-foreground mt-2">
            Every member, their phone number and the last time they signed in
          </p>
        </div>
        <Button onClick={exportCsv} variant="outline">
          <Download className="h-4 w-4 mr-2" /> Export page
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <CardTitle className="text-foreground">
              {total} member{total === 1 ? "" : "s"}
              <span className="text-sm font-normal text-muted-foreground ml-2">
                ({signedInEver} on this page have signed in)
              </span>
            </CardTitle>
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or phone..."
                value={search}
                onChange={(e) => onSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
              <p className="text-muted-foreground">Loading members...</p>
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No members found</p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="py-2 pr-4 font-medium">Name</th>
                      <th className="py-2 pr-4 font-medium">Phone</th>
                      <th className="py-2 pr-4 font-medium">Status</th>
                      <th className="py-2 pr-4 font-medium">Last signed in</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.member_id} className="border-b border-border/50">
                        <td className="py-3 pr-4 font-medium text-foreground">
                          {r.name || "Unnamed member"}
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground">{r.phone || "—"}</td>
                        <td className="py-3 pr-4">
                          <Badge variant={r.is_active ? "default" : "secondary"}>
                            {r.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                        <td className="py-3 pr-4">
                          <span
                            className={
                              r.last_sign_in_at ? "text-foreground" : "text-muted-foreground"
                            }
                          >
                            {timeAgo(r.last_sign_in_at)}
                          </span>
                          {r.last_sign_in_at && (
                            <span className="block text-xs text-muted-foreground">
                              {new Date(r.last_sign_in_at).toLocaleString()}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden space-y-2">
                {rows.map((r) => (
                  <Card key={r.member_id} className="bg-muted/50">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate">
                            {r.name || "Unnamed member"}
                          </p>
                          <p className="text-xs text-muted-foreground">{r.phone || "—"}</p>
                        </div>
                        <Badge variant={r.is_active ? "default" : "secondary"}>
                          {r.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {timeAgo(r.last_sign_in_at)}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="flex items-center justify-between mt-4">
                <p className="text-xs text-muted-foreground">
                  Page {page + 1} of {pages} {isFetching && "· updating…"}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" /> Prev
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page + 1 >= pages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
