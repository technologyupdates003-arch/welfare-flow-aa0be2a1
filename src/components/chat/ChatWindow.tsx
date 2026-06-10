import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, X, Phone, Smile, Paperclip } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import MessageBubble from "./MessageBubble";
import EmojiPicker from "./EmojiPicker";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import "@/styles/chat-glassmorphism.css";

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
          const memberData = memberByUserIdMap?.get(r.user_id) || null;
          return [r.id, {
            ...r,
            resolvedName: memberData?.name || r.members?.name || "Unknown User"
          }];
        }));
      }

      // Get reactions
      const messageIds = data.map((m: any) => m.id);
      let reactionsMap = new Map<string, any[]>();
      if (messageIds.length > 0) {
        const { data: reactions } = await supabase
          .from("message_reactions")
          .select("*")
          .in("message_id", messageIds);
        reactionsMap = new Map<string, any[]>();
        (reactions || []).forEach((r: any) => {
          if (!reactionsMap.has(r.message_id)) reactionsMap.set(r.message_id, []);
          const existing = reactionsMap.get(r.message_id);
          if (existing) existing.push(r);
        });
      }

      return data.map((m: any) => {
        // Ensure maps exist with fallback empty maps
        const safeRoleMap = roleMap || new Map();
        const safeMemberByUserIdMap = memberByUserIdMap || new Map();
        const safeReplyMap = replyMap || new Map();
        const safeReactionsMap = reactionsMap || new Map();

        const role = safeRoleMap.get(m.user_id) || "member";
        // Get name from member lookup by user_id (most reliable)
        const memberData = safeMemberByUserIdMap.get(m.user_id);
        const resolvedName = memberData?.name || m.members?.name || "Unknown User";
        const resolvedPicture = memberData?.profile_picture_url || m.members?.profile_picture_url || null;
        
        // Debug logging
        if (!memberData) {
          console.log("No member data for user_id:", m.user_id, "Available members:", Array.from(safeMemberByUserIdMap.keys()));
        }
        
        const replyMsg = m.reply_to_id ? safeReplyMap.get(m.reply_to_id) : null;
        
        return {
          ...m,
          userRole: role,
          resolvedName,
          resolvedPicture,
          message_reactions: safeReactionsMap.get(m.id) || [],
          replyMessage: replyMsg,
          replyRole: replyMsg ? (safeRoleMap.get(replyMsg.user_id) || "member") : null,
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
    <div className="flex flex-col h-full bg-gradient-to-br from-[#F4F6FA] to-[#ECEEF3]">
      <ScrollArea className="flex-1 p-4">
        <div className="flex flex-col gap-1 max-w-6xl mx-auto">
          {messages?.map((m: any) => {
            const isAdmin = m.userRole === 'admin';
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

      {/* Reply preview with glassmorphism */}
      {replyTo && (
        <div className="px-4 py-3 mx-2 mb-2 border-l-4 border-[#0A84FF] glass-card bg-white/50 rounded-lg">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-[#0A84FF]">Replying to {
                replyTo.userRole === 'admin' 
                  ? "Admin" 
                  : replyTo.resolvedName
              }</p>
              <p className="text-sm text-gray-700 truncate">{replyTo.content}</p>
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0" onClick={() => setReplyTo(null)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Message composer with glassmorphism */}
      <div className="p-4 border-t border-white/20">
        <div className="composer-glass p-3 flex items-center gap-2 max-w-6xl mx-auto">
          {/* Emoji picker button */}
          <div className="flex-shrink-0">
            <EmojiPicker onSelect={(e) => setMessage((prev) => prev + e)} />
          </div>
          
          {/* Message input */}
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type a message or @ mention..."
            className="flex-1 rounded-full border-0 text-sm h-10 bg-transparent placeholder:text-gray-400 focus:outline-none focus:ring-0"
            onKeyDown={(e) => e.key === "Enter" && message.trim() && sendMessage.mutate()}
          />
          
          {/* Attachment button */}
          <button className="p-2 hover:bg-white/20 rounded-full transition-colors flex-shrink-0" title="Attach file">
            <Paperclip className="h-5 w-5 text-gray-600" />
          </button>
          
          {/* Send button */}
          <Button
            size="icon"
            className="rounded-full h-10 w-10 send-button-gradient border-0 text-white flex-shrink-0"
            onClick={() => message.trim() && sendMessage.mutate()}
            disabled={sendMessage.isPending}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
