import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Newspaper, X } from "lucide-react";
import { toast } from "sonner";

export default function NewsPopup() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [currentNewsIndex, setCurrentNewsIndex] = useState(0);

  // Get unread news
  const { data: unreadNews = [] } = useQuery({
    queryKey: ["unread-news", user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      // Get all published news
      const { data: allNews } = await supabase
        .from("news")
        .select("*")
        .order("created_at", { ascending: false });

      if (!allNews) return [];

      // Get news that user has read
      const { data: readNews } = await supabase
        .from("news_read")
        .select("news_id")
        .eq("user_id", user.id);

      const readNewsIds = new Set(readNews?.map(r => r.news_id) || []);
      
      // Filter out read news
      return allNews.filter(news => !readNewsIds.has(news.id));
    },
    enabled: !!user,
    refetchInterval: 30000, // Check every 30 seconds
  });

  const markAsRead = useMutation({
    mutationFn: async (newsId: string) => {
      const { error } = await supabase
        .from("news_read")
        .insert({ news_id: newsId, user_id: user!.id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unread-news"] });
    },
  });

  const handleMarkAsRead = () => {
    if (unreadNews[currentNewsIndex]) {
      markAsRead.mutate(unreadNews[currentNewsIndex].id);
      
      // Move to next unread news or close
      if (currentNewsIndex < unreadNews.length - 1) {
        setCurrentNewsIndex(currentNewsIndex + 1);
      } else {
        setCurrentNewsIndex(0);
      }
    }
  };

  const currentNews = unreadNews[currentNewsIndex];
  const hasUnreadNews = unreadNews.length > 0;

  return (
    <Dialog open={hasUnreadNews} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Newspaper className="h-5 w-5" />
              Latest News
            </DialogTitle>
            <Badge variant="destructive">
              {currentNewsIndex + 1} of {unreadNews.length} unread
            </Badge>
          </div>
          <DialogDescription>
            You have unread news. Please read to continue.
          </DialogDescription>
        </DialogHeader>
        
        {currentNews && (
          <div className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">{currentNews.title}</h3>
              <p className="text-sm text-muted-foreground">
                {new Date(currentNews.created_at).toLocaleDateString()}
              </p>
            </div>
            
            <div className="prose prose-sm max-w-none">
              <p className="whitespace-pre-wrap">{currentNews.content}</p>
            </div>

            {(currentNews as any).image_url && (
              <img 
                src={(currentNews as any).image_url} 
                alt={currentNews.title}
                className="w-full rounded-lg object-cover max-h-64"
              />
            )}

            <div className="flex gap-2 pt-4">
              <Button 
                onClick={handleMarkAsRead}
                className="flex-1"
                disabled={markAsRead.isPending}
              >
                {currentNewsIndex < unreadNews.length - 1 
                  ? "Mark as Read & Next" 
                  : "Mark as Read & Close"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
