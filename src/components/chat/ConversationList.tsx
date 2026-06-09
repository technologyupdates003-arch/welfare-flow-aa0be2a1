import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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
    <div className="flex flex-col h-full conversation-list-container">
      {/* Header with Filter Tabs - Now at the top */}
      <div className="conversation-list-header">
        <div className="flex items-center justify-between mb-4 px-2">
          <h2 className="text-lg font-bold text-gray-900">Messages</h2>
          <Button
            size="sm"
            className="h-8 w-8 p-0 rounded-full bg-[#0A84FF] hover:bg-[#0A84FF]/90 text-white"
            onClick={onNewChat}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* Filter tabs */}
        <div className="segmented-control w-full justify-center">
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
              "segmented-control-item relative",
              filterTab === "unread" && "active"
            )}
          >
            Unread
          </button>
          <button
            onClick={() => setFilterTab("mentions")}
            className={cn(
              "segmented-control-item relative",
              filterTab === "mentions" && "active"
            )}
          >
            Mentions
            {conversations && conversations.some(c => c.mentionCount > 0) && (
              <span className="absolute -top-1 -right-1 notification-badge text-[10px] px-1.5">4</span>
            )}
          </button>
        </div>
      </div>

      {/* Search bar */}
      <div className="conversation-list-search">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-full glass-card border-0 bg-white/60 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-[#0A84FF] focus:bg-white/80 transition-all"
          />
        </div>
      </div>

      {/* Conversations list */}
      <div className="conversation-list-scroll">
        {/* Group chat - Welfare Chat */}
        <button
          onClick={() => onSelect("group")}
          className={cn(
            "conversation-item",
            activeId === "group" && "active"
          )}
        >
          <div className="conversation-avatar">
            <div className="conversation-avatar-placeholder">
              <Users className="h-5 w-5" />
            </div>
            <div className="avatar-online-dot"></div>
          </div>
          <div className="conversation-info">
            <p className="conversation-name">Welfare Chat</p>
            <p className="conversation-message">{onlineCount} online</p>
          </div>
          {onlineCount > 0 && (
            <div className="conversation-meta">
              <span className="text-[10px] text-green-600 font-semibold">Active</span>
            </div>
          )}
        </button>

        {/* Divider */}
        {filteredConversations.length > 0 && (
          <div className="px-3 py-3 flex items-center gap-2">
            <div className="flex-1 h-px bg-gray-200/60"></div>
            <span className="text-xs text-gray-500 font-medium">Direct</span>
            <div className="flex-1 h-px bg-gray-200/60"></div>
          </div>
        )}

        {/* Error state */}
        {conversationsError && (
          <div className="p-8 text-center">
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
              "conversation-item",
              activeId === conv.id && "active"
            )}
          >
            <div className="conversation-avatar">
              {conv.profilePicture ? (
                <img src={conv.profilePicture} alt={conv.displayName} />
              ) : (
                <div className="conversation-avatar-placeholder">
                  {conv.displayName.charAt(0).toUpperCase()}
                </div>
              )}
              {presenceData?.get(conv.id) && (
                <div className="avatar-online-dot"></div>
              )}
            </div>
            <div className="conversation-info">
              <p className="conversation-name">{conv.displayName}</p>
              <p className="conversation-message">{conv.type === "private" ? "Direct message" : "Group chat"}</p>
            </div>
            <div className="conversation-meta">
              {conv.unreadCount > 0 && (
                <span className="notification-badge">
                  {conv.unreadCount > 99 ? "99+" : conv.unreadCount}
                </span>
              )}
              {conv.mentionCount > 0 && !conv.unreadCount && (
                <span className="notification-badge">@</span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
