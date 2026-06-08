import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Users, MessageCircle, UserPlus, Search, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import "@/styles/chat-glassmorphism.css";

interface ConversationListProps {
  activeId: string | null;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onGroupChat: () => void;
  darkMode?: boolean;
}

type FilterTab = "all" | "unread" | "mentions";

interface ConversationWithData {
  id: string;
  name?: string;
  displayName: string;
  type: "private" | "group";
  profilePicture: string | null;
  unreadCount: number;
  mentionCount: number;
  lastMessage?: string;
  created_at: string;
  updated_at: string;
}

export default function ConversationList({ activeId, onSelect, onNewChat, onGroupChat, darkMode = false }: ConversationListProps) {
  const { user } = useAuth();
  const [filterTab, setFilterTab] = useState<FilterTab>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: conversations, error: conversationsError } = useQuery({
    queryKey: ["conversations", user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data: participations } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .eq("user_id", user.id);
      
      if (!participations || participations.length === 0) return [];
      
      const conversationIds = participations.map(p => p.conversation_id);
      
      const { data: conversations } = await supabase
        .from("conversations")
        .select("*")
        .in("id", conversationIds)
        .order("updated_at", { ascending: false });
      
      if (!conversations) return [];
      
      const conversationsWithData = await Promise.all(conversations.map(async (conv) => {
        let displayName = conv.name;
        let profilePicture: string | null = null;
        let unreadCount = 0;
        let mentionCount = 0;
        
        if (conv.type === "private") {
          const { data: parts } = await supabase
            .from("conversation_participants")
            .select("user_id")
            .eq("conversation_id", conv.id)
            .neq("user_id", user.id);
          
          if (parts && parts.length > 0) {
            const otherUserId = parts[0].user_id;
            const { data: roleData } = await supabase
              .from("user_roles")
              .select("role")
              .eq("user_id", otherUserId)
              .maybeSingle();
            
            if (roleData?.role === "admin") {
              displayName = "Admin";
            } else {
              const { data: memberData } = await supabase
                .from("members")
                .select("name, profile_picture_url")
                .eq("user_id", otherUserId)
                .maybeSingle();
              displayName = memberData?.name || "Unknown";
              profilePicture = memberData?.profile_picture_url || null;
            }
          }
        }
        
        return { 
          ...conv, 
          displayName, 
          profilePicture, 
          unreadCount,
          mentionCount,
          lastMessage: ""
        } as ConversationWithData;
      }));
      
      return conversationsWithData;
    },
    enabled: !!user,
    refetchInterval: 5000,
  });

  const { data: presenceData } = useQuery({
    queryKey: ["presence"],
    queryFn: async () => {
      const { data } = await supabase.from("user_presence").select("user_id, is_online");
      return new Map((data || []).map((p: any) => [p.user_id, p.is_online]));
    },
    refetchInterval: 10000,
  });

  const filteredConversations = conversations?.filter((conv) => {
    if (filterTab === "unread" && conv.unreadCount === 0) return false;
    if (filterTab === "mentions" && conv.mentionCount === 0) return false;
    if (searchQuery && !conv.displayName?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  }) || [];

  const onlineCount = presenceData ? Array.from(presenceData.values()).filter(Boolean).length : 0;

  return (
    <div className={cn("flex flex-col h-full bg-gradient-to-b from-[#ECEEF3] to-[#F4F6FA]", darkMode ? "text-gray-100" : "")}>
      {/* Header with action buttons */}
      <div className="p-4 border-b border-white/20">
        <div className="flex gap-2 mb-4">
          <Button 
            size="sm" 
            className="flex-1 text-xs rounded-full glass-card hover:bg-white/80 font-medium"
            onClick={onNewChat}
          >
            <UserPlus className="h-3.5 w-3.5 mr-1.5" /> Chat
          </Button>
          <Button 
            size="sm" 
            className="flex-1 text-xs rounded-full glass-card hover:bg-white/80 font-medium"
            onClick={onGroupChat}
          >
            <Users className="h-3.5 w-3.5 mr-1.5" /> Group
          </Button>
        </div>

        {/* Search bar */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-full glass-card border-0 bg-white/50 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-[#0A84FF] focus:bg-white/70"
          />
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 segmented-control mx-auto">
          <button
            onClick={() => setFilterTab("all")}
            className={cn(
              "segmented-control-item",
              filterTab === "all" && "active"
            )}
          >
            All
          </button>
          <button
            onClick={() => setFilterTab("unread")}
            className={cn(
              "segmented-control-item",
              filterTab === "unread" && "active"
            )}
          >
            Unread
          </button>
          <button
            onClick={() => setFilterTab("mentions")}
            className={cn(
              "segmented-control-item",
              filterTab === "mentions" && "active"
            )}
          >
            Mentions
          </button>
        </div>
      </div>

      {/* Conversations list */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {/* Group chat - Welfare Chat */}
          <button
            onClick={() => onSelect("group")}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-chat-lg transition-all duration-200 hover-lift",
              activeId === "group" 
                ? "glass-card bg-white/90 shadow-lg" 
                : "glass-card hover:bg-white/60"
            )}
          >
            <div className="relative flex-shrink-0">
              <div className="h-11 w-11 rounded-full bg-gradient-to-br from-[#0A84FF] to-[#2196F3] flex items-center justify-center shadow-md">
                <Users className="h-5 w-5 text-white" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#10B981] border-2 border-white shadow-sm"></div>
            </div>
            <div className="min-w-0 flex-1 text-left">
              <p className="font-semibold text-sm text-gray-900">Welfare Chat</p>
              <p className="text-xs text-gray-500">{onlineCount} online</p>
            </div>
          </button>

          {/* Divider */}
          {filteredConversations.length > 0 && (
            <div className="px-4 py-2 flex items-center gap-2">
              <div className="flex-1 h-px bg-white/30"></div>
              <span className="text-xs text-gray-500 font-medium">Direct Messages</span>
              <div className="flex-1 h-px bg-white/30"></div>
            </div>
          )}

          {/* Error state */}
          {conversationsError && (
            <div className="p-4 text-center">
              <MessageCircle className="h-8 w-8 mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-red-500 font-medium">Error loading conversations</p>
              <p className="text-xs text-gray-500">{conversationsError.message}</p>
            </div>
          )}
          
          {/* Empty state */}
          {conversations?.length === 0 && !conversationsError && (
            <div className="p-8 text-center">
              <MessageCircle className="h-12 w-12 mx-auto text-gray-300 mb-3 opacity-50" />
              <p className="text-sm text-gray-600 font-medium">No conversations yet</p>
              <p className="text-xs text-gray-500">Start a new chat to begin messaging</p>
            </div>
          )}
          
          {/* Conversations */}
          {filteredConversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => onSelect(conv.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-chat-lg transition-all duration-200 hover-lift",
                activeId === conv.id 
                  ? "glass-card bg-white/90 shadow-lg" 
                  : "glass-card hover:bg-white/60"
              )}
            >
              <div className="relative flex-shrink-0">
                {conv.profilePicture ? (
                  <img src={conv.profilePicture} alt={conv.displayName} className="h-11 w-11 rounded-full object-cover shadow-md" />
                ) : (
                  <div className="h-11 w-11 rounded-full bg-gradient-to-br from-gray-400 to-gray-500 flex items-center justify-center text-white font-semibold shadow-md">
                    {conv.displayName.charAt(0).toUpperCase()}
                  </div>
                )}
                {presenceData?.get(conv.id) && (
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#10B981] border-2 border-white shadow-sm"></div>
                )}
              </div>
              <div className="min-w-0 flex-1 text-left">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-sm text-gray-900 truncate">
                    {conv.displayName}
                  </p>
                  {conv.unreadCount > 0 && (
                    <span className="notification-badge">
                      {conv.unreadCount > 99 ? "99+" : conv.unreadCount}
                    </span>
                  )}
                  {conv.mentionCount > 0 && (
                    <span className="notification-badge mention">
                      @
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 truncate">{conv.type === "private" ? "Private" : "Group"}</p>
              </div>
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
