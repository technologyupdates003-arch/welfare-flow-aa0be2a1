import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import MessageBubble from "./MessageBubble";
import EmojiPicker from "./EmojiPicker";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface ChatWindowProps {
  conversationId: string | null;
  darkMode?: boolean;
}

export default function ChatWindow({ conversationId, darkMode = false }: ChatWindowProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const [replyTo, setReplyTo] = useState<any>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isGroup = !conversationId || conversationId === "group";
  const queryKey = ["chat-messages", conversationId || "group"];

  const { data: messages } = useQuery({
    queryKey,
    queryFn: async () => {
      let q = supabase
        .from("messages")
        .select(`
          *, 
          members!messages_member_id_fkey(name, profile_picture_url)
        `)
        .order("created_at", { ascending: true })
        .limit(200);

      if (isGroup) q = q.is("conversation_id", null);
      else q = q.eq("conversation_id", conversationId!);

      const { data } = await q;
      if (!data) return [];

      // Get roles for all user_ids in messages
      const userIds = [...new Set(data.map((m: any) => m.user_id))];
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", userIds);
      const roleMap = new Map((roles || []).map((r: any) => [r.user_id, r.role]));

      // Fetch ALL members to get names by user_id
      const { data: allMembers } = await supabase
        .from("members")
        .select("user_id, name, profile_picture_url")
        .in("user_id", userIds);
      
      // Create member map
      const memberByUserIdMap = new Map((allMembers || []).map((m: any) => [m.user_id, m]));

      // Get reply messages if needed
      const replyIds = data.filter((m: any) => m.reply_to_id).map((m: any) => m.reply_to_id);
      let replyMap = new Map();
      if (replyIds.length > 0) {
        const { data: replies } = await supabase
          .from("messages")
          .select("id, content, user_id, members!messages_member_id_fkey(name)")
          .in("id", replyIds);
        
        // Enrich reply messages with member names from our map
        replyMap = new Map((replies || []).map((r: any) => {
          const memberData = memberByUserIdMap.get(r.user_id);
          return [r.id, {
            ...r,
            resolvedName: memberData?.name || r.members?.name || "Unknown User"
          }];
        }));
      }

      // Get reactions
      const messageIds = data.map((m: any) => m.id);
      const { data: reactions } = await supabase
        .from("message_reactions")
        .select("*")
        .in("message_id", messageIds);
      const reactionsMap = new Map<string, any[]>();
      (reactions || []).forEach((r: any) => {
        if (!reactionsMap.has(r.message_id)) reactionsMap.set(r.message_id, []);
        reactionsMap.get(r.message_id)!.push(r);
      });

      return data.map((m: any) => {
        const role = roleMap.get(m.user_id) || "member";
        // Get name from member lookup by user_id (most reliable)
        const memberData = memberByUserIdMap.get(m.user_id);
        const resolvedName = memberData?.name || m.members?.name || "Unknown User";
        const resolvedPicture = memberData?.profile_picture_url || m.members?.profile_picture_url || null;
        
        // Debug logging
        if (!memberData) {
          console.log("No member data for user_id:", m.user_id, "Available members:", Array.from(memberByUserIdMap.keys()));
        }
        
        const replyMsg = m.reply_to_id ? replyMap.get(m.reply_to_id) : null;
        
        return {
          ...m,
          userRole: role,
          resolvedName,
          resolvedPicture,
          message_reactions: reactionsMap.get(m.id) || [],
          replyMessage: replyMsg,
          replyRole: replyMsg ? (roleMap.get(replyMsg.user_id) || "member") : null,
        };
      });
    },
  });

  // Mark messages as read when opening chat
  useEffect(() => {
    if (!user || !messages) return;
    const unread = messages.filter((m: any) => m.user_id !== user.id && m.status !== "read");
    if (unread.length === 0) return;
    const ids = unread.map((m: any) => m.id);
    supabase.from("messages").update({ status: "read" }).in("id", ids).then(() => {
      queryClient.invalidateQueries({ queryKey });
    });
  }, [messages, user]);

  // Mark delivered on receive
  useEffect(() => {
    if (!user || !messages) return;
    const delivered = messages.filter((m: any) => m.user_id !== user.id && m.status === "sent");
    if (delivered.length === 0) return;
    const ids = delivered.map((m: any) => m.id);
    supabase.from("messages").update({ status: "delivered" }).in("id", ids).then(() => {
      queryClient.invalidateQueries({ queryKey });
    });
  }, [messages, user]);

  useEffect(() => {
    const channel = supabase
      .channel(`chat-${conversationId || "group"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => {
        queryClient.invalidateQueries({ queryKey });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "message_reactions" }, () => {
        queryClient.invalidateQueries({ queryKey });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversationId, queryClient]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useMutation({
    mutationFn: async () => {
      const { data: member } = await supabase.from("members").select("id").eq("user_id", user!.id).maybeSingle();
      const { error } = await supabase.from("messages").insert({
        user_id: user!.id,
        member_id: member?.id || null,
        content: message,
        conversation_id: isGroup ? null : conversationId,
        reply_to_id: replyTo?.id || null,
        status: "sent",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setMessage("");
      setReplyTo(null);
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const deleteMessage = useMutation({
    mutationFn: async (messageId: string) => {
      const { error } = await supabase
        .from("messages")
        .update({ content: "🚫 This message was deleted", status: "deleted" })
        .eq("id", messageId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const editMessage = useMutation({
    mutationFn: async ({ messageId, content }: { messageId: string; content: string }) => {
      const { error } = await (supabase as any)
        .from("messages")
        .update({ content, edited_at: new Date().toISOString() })
        .eq("id", messageId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  // Messages can be edited by their author within 15 minutes of sending
  const EDIT_WINDOW_MS = 15 * 60 * 1000;

  const toggleReaction = useMutation({
    mutationFn: async ({ messageId, emoji }: { messageId: string; emoji: string }) => {
      const { data: existing } = await supabase
        .from("message_reactions").select("id")
        .eq("message_id", messageId).eq("user_id", user!.id).eq("emoji", emoji).maybeSingle();
      if (existing) await supabase.from("message_reactions").delete().eq("id", existing.id);
      else await supabase.from("message_reactions").insert({ message_id: messageId, user_id: user!.id, emoji });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const groupReactions = (reactions: any[]) => {
    const map = new Map<string, { count: number; reacted: boolean }>();
    reactions?.forEach((r: any) => {
      const existing = map.get(r.emoji) || { count: 0, reacted: false };
      existing.count++;
      if (r.user_id === user?.id) existing.reacted = true;
      map.set(r.emoji, existing);
    });
    return Array.from(map.entries()).map(([emoji, data]) => ({ emoji, ...data }));
  };

  const { data: presenceData } = useQuery({
    queryKey: ["presence"],
    queryFn: async () => {
      const { data } = await supabase.from("user_presence").select("user_id, is_online");
      return new Map((data || []).map((p: any) => [p.user_id, p.is_online]));
    },
    refetchInterval: 10000,
  });

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 p-3">
        <div className="flex flex-col gap-1">
          {messages?.map((m: any) => {
            const isAdmin = m.userRole === 'admin';
            // Always use resolvedName which is fetched from members table by user_id
            const senderName = isAdmin ? "Admin" : m.resolvedName;
            
            const isToday = new Date(m.created_at).toDateString() === new Date().toDateString();
            const timeLabel = isToday
              ? format(new Date(m.created_at), "HH:mm")
              : format(new Date(m.created_at), "dd MMM, HH:mm");
            const canEdit =
              m.user_id === user?.id &&
              m.status !== "deleted" &&
              Date.now() - new Date(m.created_at).getTime() < EDIT_WINDOW_MS;

            return (
              <MessageBubble
                key={m.id}
                content={m.content}
                senderName={senderName}
                isOwn={m.user_id === user?.id}
                time={timeLabel}
                edited={!!m.edited_at}
                reactions={groupReactions(m.message_reactions)}
                replyTo={m.replyMessage ? { 
                  senderName: m.replyRole === 'admin' 
                    ? "Admin" 
                    : m.replyMessage.resolvedName, 
                  content: m.replyMessage.content 
                } : null}
                onReply={() => setReplyTo(m)}
                onReact={(emoji) => toggleReaction.mutate({ messageId: m.id, emoji })}
                isOnline={presenceData?.get(m.user_id) ?? false}
                darkMode={darkMode}
                status={m.status}
                onDelete={m.user_id === user?.id ? () => deleteMessage.mutate(m.id) : undefined}
                onEdit={canEdit ? (newContent: string) => editMessage.mutate({ messageId: m.id, content: newContent }) : undefined}
                canEdit={canEdit}
                isDeleted={m.status === "deleted"}
                profilePicture={m.resolvedPicture}
              />
            );
          })}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {replyTo && (
        <div className={cn("px-3 py-2 border-t flex items-center gap-2", darkMode ? "bg-[#1F2C34] border-[#2A3942] text-gray-300" : "bg-muted/30 border-border")}>
          <div className="flex-1 text-xs truncate">
            <span className="font-semibold">Replying to {
              replyTo.userRole === 'admin' 
                ? "Admin" 
                : replyTo.resolvedName
            }: </span>
            <span className={darkMode ? "text-gray-400" : "text-muted-foreground"}>{replyTo.content}</span>
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setReplyTo(null)}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      <div className={cn("p-2 border-t flex items-center gap-2", darkMode ? "bg-[#1F2C34] border-[#2A3942]" : "bg-card border-border")}>
        <EmojiPicker onSelect={(e) => setMessage((prev) => prev + e)} />
        <Input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type a message..."
          className={cn("flex-1 rounded-full border-0 text-sm h-9", darkMode ? "bg-[#2A3942] text-white placeholder:text-gray-400" : "bg-muted")}
          onKeyDown={(e) => e.key === "Enter" && message.trim() && sendMessage.mutate()}
        />
        <Button
          size="icon"
          className={cn("rounded-full h-9 w-9", darkMode ? "bg-[#00A884] hover:bg-[#00957A]" : "")}
          onClick={() => message.trim() && sendMessage.mutate()}
          disabled={sendMessage.isPending}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
