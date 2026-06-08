import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import ConversationList from "@/components/chat/ConversationList";
import ChatWindow from "@/components/chat/ChatWindow";
import NewChatDialog from "@/components/chat/NewChatDialog";
import { usePresence } from "@/hooks/usePresence";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import "@/styles/chat-glassmorphism.css";

export default function MemberChat() {
  usePresence();
  const { user } = useAuth();
  const [activeConv, setActiveConv] = useState<string | null>("group");
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [showList, setShowList] = useState(true);

  const { data: chatName } = useQuery({
    queryKey: ["chat-name", activeConv, user?.id],
    queryFn: async () => {
      if (!activeConv || activeConv === "group") return "Welfare Chat";
      const { data: conv } = await supabase.from("conversations").select("type, name").eq("id", activeConv).single();
      if (!conv) return "Chat";
      if (conv.type === "group") return conv.name || "Group Chat";
      // Private: get other participant's name
      const { data: parts } = await supabase.from("conversation_participants").select("user_id").eq("conversation_id", activeConv).neq("user_id", user!.id);
      if (!parts || parts.length === 0) return "Chat";
      const otherUserId = parts[0].user_id;
      const { data: role } = await supabase.from("user_roles").select("role").eq("user_id", otherUserId).maybeSingle();
      if (role?.role === "admin") return "Admin";
      const { data: member } = await supabase.from("members").select("name").eq("user_id", otherUserId).maybeSingle();
      return member?.name || "Chat";
    },
    enabled: !!activeConv && !!user,
  });

  return (
    <div className="flex flex-col h-[calc(100vh-160px)] rounded-2xl overflow-hidden bg-gradient-to-br from-[#ECEEF3] via-[#E8EBF1] to-[#F4F6FA]">{/* Mobile: toggle between list and chat */}
      <div className="md:hidden">
        {showList ? (
          <div className="h-full">
            <ConversationList
              activeId={activeConv}
              onSelect={(id) => { setActiveConv(id); setShowList(false); }}
              onNewChat={() => setNewChatOpen(true)}
              onGroupChat={() => setNewGroupOpen(true)}
            />
          </div>
        ) : (
          <div className="flex flex-col h-full">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-card">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowList(true)}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <h3 className="font-semibold text-sm">
                {chatName || "Chat"}
              </h3>
            </div>
            <ChatWindow conversationId={activeConv} />
          </div>
        )}
      </div>

      {/* Desktop: side by side */}
      <div className="hidden md:flex h-full rounded-xl border border-border overflow-hidden bg-background">
        <div className="w-72 border-r border-border flex-shrink-0 flex flex-col">
          <ConversationList
            activeId={activeConv}
            onSelect={setActiveConv}
            onNewChat={() => setNewChatOpen(true)}
            onGroupChat={() => setNewGroupOpen(true)}
          />
        </div>
        <div className="flex-1 flex flex-col min-w-0">
          <div className="border-b border-border px-4 py-3 bg-card">
            <h3 className="font-semibold text-sm">
              {chatName || "Chat"}
            </h3>
          </div>
          <ChatWindow conversationId={activeConv} />
        </div>
      </div>

      <NewChatDialog open={newChatOpen} onOpenChange={setNewChatOpen} onCreated={(id) => { setActiveConv(id); setShowList(false); }} />
      <NewChatDialog open={newGroupOpen} onOpenChange={setNewGroupOpen} onCreated={(id) => { setActiveConv(id); setShowList(false); }} isGroup />
    </div>
  );
}
