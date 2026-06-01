import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, X } from "lucide-react";

const EVENTS_SEEN_KEY = "member_last_seen_events_at";

const getLastSeenEventsAt = () => {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(EVENTS_SEEN_KEY);
};

const setLastSeenEventsAt = (value: string) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(EVENTS_SEEN_KEY, value);
};

export default function EventPopup() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(true);

  const { data: unseenEvents = [] } = useQuery({
    queryKey: ["unseen-events", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const lastSeenAt = getLastSeenEventsAt();
      const { data } = await supabase
        .from("events")
        .select("*")
        .eq("status", "active")
        .order("created_at", { ascending: false });
      if (!data) return [];

      const now = new Date();
      return data.filter(event => {
        // Hide events whose scheduled/rescheduled date has already passed
        const end = (event as any).rescheduled_date || (event as any).scheduled_date;
        if (end && new Date(end) < now) return false;
        if (!event.created_at) return false;
        if (!lastSeenAt) return true;
        return new Date(event.created_at) > new Date(lastSeenAt);
      });
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  const currentEvent = unseenEvents[0];
  const hasUnseenEvents = unseenEvents.length > 0 && isOpen;

  const handleMarkAsSeen = () => {
    if (!user) return;
    const latestTimestamp = unseenEvents[0]?.created_at || new Date().toISOString();
    setLastSeenEventsAt(latestTimestamp);
    setIsOpen(false);
    queryClient.invalidateQueries({ queryKey: ["unseen-events", user.id] });
    queryClient.invalidateQueries({ queryKey: ["unseen-event-count", user.id] });
  };

  if (!currentEvent) return null;

  return (
    <Dialog open={hasUnseenEvents} onOpenChange={open => setIsOpen(open)}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              <DialogTitle>New Event Alert</DialogTitle>
            </div>
            <Badge variant="destructive">
              {unseenEvents.length} new
            </Badge>
          </div>
          <DialogDescription>
            A new event has been posted. Review it now or mark it as seen.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <p className="text-sm font-semibold">{currentEvent.title}</p>
            <p className="text-xs text-muted-foreground">
              {currentEvent.event_type?.replace("_", " ")} · {new Date(currentEvent.created_at).toLocaleDateString()}
            </p>
          </div>
          {currentEvent.description && (
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{currentEvent.description}</p>
          )}
          <div className="flex gap-2 pt-4">
            <Button className="flex-1" onClick={handleMarkAsSeen}>
              Mark events as seen
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => setIsOpen(false)}>
              Dismiss
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
