import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useEffectiveIdentity } from "@/lib/impersonate-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

export default function MemberNotifications() {
  const { user } = useAuth();
  const { userId: effectiveUserId } = useEffectiveIdentity();
  const queryClient = useQueryClient();

  const { data: notifications } = useQuery({
    queryKey: ["my-notifications", effectiveUserId],
    queryFn: async () => {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", effectiveUserId!)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!effectiveUserId,
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["my-notifications"] }),
  });

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-display font-bold">Notifications</h2>
      {notifications?.map(n => (
        <Card key={n.id} className={n.is_read ? "opacity-60" : ""}>
          <CardContent className="flex items-start justify-between py-3">
            <div>
              <p className="font-medium text-sm">{n.title}</p>
              <p className="text-sm text-muted-foreground">{n.message}</p>
              <p className="text-xs text-muted-foreground mt-1">{new Date(n.created_at).toLocaleDateString()}</p>
            </div>
            {!n.is_read && (
              <Button size="icon" variant="ghost" onClick={() => markRead.mutate(n.id)}>
                <Check className="h-4 w-4" />
              </Button>
            )}
          </CardContent>
        </Card>
      ))}
      {notifications?.length === 0 && <p className="text-muted-foreground">No notifications</p>}
    </div>
  );
}
