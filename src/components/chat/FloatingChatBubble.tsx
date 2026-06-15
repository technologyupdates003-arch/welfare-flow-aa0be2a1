import { useState, useRef, useCallback, useEffect } from "react";
import { MessageCircle, X, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import ChatWindow from "./ChatWindow";
import ConversationList from "./ConversationList";
import NewChatDialog from "./NewChatDialog";
import { usePresence } from "@/hooks/usePresence";
import { useNotifications } from "@/hooks/useNotifications";
import chatLogo from "@/assets/chat-logo-watermark.png";

export default function FloatingChatBubble() {
  usePresence();
  useNotifications();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [activeConv, setActiveConv] = useState<string | null>(null);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  // Draggable bubble state
  // On mobile the bottom nav occupies the bottom edge, so lift the bubble above it
  const [pos, setPos] = useState(() => ({
    x: 16,
    y: typeof window !== "undefined" && window.innerWidth < 1024 ? 88 : 24,
  })); // from bottom-right
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, posX: 0, posY: 0 });
  const moved = useRef(false);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    dragging.current = true;
    moved.current = false;
    dragStart.current = { x: e.clientX, y: e.clientY, posX: pos.x, posY: pos.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [pos]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    const dx = dragStart.current.x - e.clientX;
    const dy = dragStart.current.y - e.clientY;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) moved.current = true;
    const newX = Math.max(8, Math.min(window.innerWidth - 64, dragStart.current.posX + dx));
    const newY = Math.max(8, Math.min(window.innerHeight - 64, dragStart.current.posY + dy));
    setPos({ x: newX, y: newY });
  }, []);

  const handlePointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  const handleClick = useCallback(() => {
    if (!moved.current) setOpen(o => !o);
  }, []);

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["total-unread", user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { data: participations } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .eq("user_id", user.id);
      const conversationIds = (participations || []).map(p => p.conversation_id);
      // Count unread in group (null conversation_id) + private conversations
      const { count: groupCount } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .is("conversation_id", null)
        .neq("user_id", user.id)
        .neq("status", "read");
      
      let privateCount = 0;
      if (conversationIds.length > 0) {
        const { count } = await supabase
          .from("messages")
          .select("*", { count: "exact", head: true })
          .in("conversation_id", conversationIds)
          .neq("user_id", user.id)
          .neq("status", "read");
        privateCount = count || 0;
      }
      return (groupCount || 0) + privateCount;
    },
    enabled: !!user && !open,
    refetchInterval: 5000,
  });

  const showChat = activeConv !== null;

  return (
    <>
      {/* Floating draggable bubble */}
      <button
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onClick={handleClick}
        style={{ 
          position: 'fixed', 
          bottom: `${pos.y}px`, 
          right: `${pos.x}px`, 
          zIndex: 50,
          touchAction: 'none',
        }}
        className={cn(
          "h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center transition-none relative",
          open && "rotate-90"
        )}
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
        {!open && unreadCount > 0 && (
          <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center min-w-[24px] animate-pulse">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div
          className={cn(
            "fixed z-50 flex flex-col overflow-hidden animate-scale-in",
            "inset-0 md:inset-auto md:bottom-24 md:right-6 md:w-[380px] md:h-[560px] md:rounded-2xl md:border md:border-border md:shadow-2xl",
            darkMode ? "chat-dark" : "chat-light"
          )}
        >
          <div className={cn(
            "px-4 py-3 flex items-center gap-2 shrink-0",
            darkMode ? "bg-[#075E54] text-white" : "bg-primary text-primary-foreground"
          )}>
            {showChat ? (
              <button onClick={() => setActiveConv(null)} className="mr-1">
                <ArrowLeft className="h-5 w-5" />
              </button>
            ) : null}
            <h3 className="font-semibold text-sm flex-1">
              {showChat ? (activeConv === "group" ? "Welfare Chat" : "Private Chat") : "Chats"}
            </h3>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="text-xs px-2 py-1 rounded-full bg-white/20 hover:bg-white/30"
            >
              {darkMode ? "☀️" : "🌙"}
            </button>
            <button onClick={() => setOpen(false)}>
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className={cn("flex-1 relative min-h-0", darkMode ? "bg-[#0B141A]" : "bg-[#ECE5DD]")}>
            {showChat && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.06]">
                <img src={chatLogo} alt="" width={256} height={256} className="select-none" />
              </div>
            )}
            <div className="relative h-full flex flex-col">
              {showChat ? (
                <ChatWindow conversationId={activeConv} darkMode={darkMode} />
              ) : (
                <ConversationList
                  activeId={activeConv}
                  onSelect={setActiveConv}
                  onNewChat={() => setNewChatOpen(true)}
                  onGroupChat={() => setNewGroupOpen(true)}
                  darkMode={darkMode}
                />
              )}
            </div>
          </div>

          <NewChatDialog open={newChatOpen} onOpenChange={setNewChatOpen} onCreated={(id) => { setActiveConv(id); setNewChatOpen(false); }} />
          <NewChatDialog open={newGroupOpen} onOpenChange={setNewGroupOpen} onCreated={(id) => { setActiveConv(id); setNewGroupOpen(false); }} isGroup />
        </div>
      )}
    </>
  );
}
