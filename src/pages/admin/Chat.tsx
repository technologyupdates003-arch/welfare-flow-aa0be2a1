import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import ConversationList from "@/components/chat/ConversationList";
import ChatWindow from "@/components/chat/ChatWindow";
import NewChatDialog from "@/components/chat/NewChatDialog";
import { usePresence } from "@/hooks/usePresence";
import "@/styles/chat-glassmorphism.css";

export default function Chat() {
  usePresence();
  const { user } = useAuth();
  const [activeConv, setActiveConv] = useState<string | null>("group");
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [newGroupOpen, setNewGroupOpen] = useState(false);

  const { data: chatName } = useQuery({
    queryKey: ["chat-name", activeConv, user?.id],
    queryFn: async () => {
      if (!activeConv || activeConv === "group") return "Welfare Chat";
      const { data: conv } = await supabase.from("conversations").select("type, name").eq("id", activeConv).single();
      if (!conv) return "Chat";
      if (conv.type === "group") return conv.name || "Group Chat";
      const { data: parts } = await supabase.from("conversation_participants").select("user_id").eq("conversation_id", activeConv).neq("user_id", user!.id);
      if (!parts || parts.length === 0) return "Chat";
      const { data: member } = await supabase.from("members").select("name").eq("user_id", parts[0].user_id).maybeSingle();
      return member?.name || "Chat";
    },
    enabled: !!activeConv && !!user,
  });

  return (
    <div className="flex h-[calc(100vh-120px)] rounded-2xl overflow-hidden bg-gradient-to-br from-[#ECEEF3] via-[#E8EBF1] to-[#F4F6FA]">
      {/* Sidebar */}
      <div className="w-80 border-r border-white/20 flex-shrink-0 hidden md:flex flex-col">
        <ConversationList
          activeId={activeConv}
          onSelect={setActiveConv}
          onNewChat={() => setNewChatOpen(true)}
          onGroupChat={() => setNewGroupOpen(true)}
        />
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0 bg-gradient-to-br from-[#F4F6FA] to-[#ECEEF3]">
        {/* Header with glassmorphism */}
        <div className="h-16 px-6 py-3 border-b border-white/20 glass-card bg-white/40 backdrop-blur-xl flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#0A84FF] to-[#2196F3] flex-shrink-0 flex items-center justify-center shadow-md">
              <span className="text-white font-semibold text-sm">W</span>
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-sm text-gray-900 truncate">
                {chatName || "Chat"}
              </h3>
              <p className="text-xs text-gray-500">Active conversation</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 hover:bg-white/40 rounded-full transition-colors">
              <svg className="h-5 w-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </button>
            <button className="p-2 hover:bg-white/40 rounded-full transition-colors">
              <svg className="h-5 w-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Messages area */}
        <ChatWindow conversationId={activeConv} />
      </div>

      <NewChatDialog open={newChatOpen} onOpenChange={setNewChatOpen} onCreated={setActiveConv} />
      <NewChatDialog open={newGroupOpen} onOpenChange={setNewGroupOpen} onCreated={setActiveConv} isGroup />
    </div>
  );
}
