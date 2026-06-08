import { useState } from "react";
import { cn } from "@/lib/utils";
import { Reply, Check, CheckCheck, MoreVertical, Trash2, Pencil } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import "@/styles/chat-glassmorphism.css";

interface MessageBubbleProps {
  content: string;
  senderName: string;
  isOwn: boolean;
  time: string;
  reactions: { emoji: string; count: number; reacted: boolean }[];
  replyTo: { senderName: string; content: string } | null;
  onReply: () => void;
  onReact: (emoji: string) => void;
  onDelete?: () => void;
  onEdit?: (newContent: string) => void;
  canEdit?: boolean;
  edited?: boolean;
  isOnline: boolean;
  darkMode?: boolean;
  status?: string; // sent, delivered, read
  profilePicture?: string | null;
  isDeleted?: boolean;
}

const quickEmojis = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

function StatusTicks({ status, darkMode, isOnline }: { status?: string; darkMode: boolean; isOnline?: boolean }) {
  if (!status) return null;
  
  if (status === "read") {
    return (
      <div className="flex items-center gap-0.5">
        <CheckCheck className="h-3.5 w-3.5 text-white opacity-80" />
        {isOnline && <span className="w-1.5 h-1.5 rounded-full bg-white/60" />}
      </div>
    );
  }
  
  if (status === "delivered") {
    return (
      <div className="flex items-center gap-0.5">
        <CheckCheck className="h-3.5 w-3.5 text-white opacity-70" />
        {isOnline && <span className="w-1.5 h-1.5 rounded-full bg-white/60" />}
      </div>
    );
  }
  
  return (
    <div className="flex items-center gap-0.5">
      <Check className="h-3.5 w-3.5 text-white opacity-70" />
      {isOnline && <span className="w-1.5 h-1.5 rounded-full bg-white/60" />}
    </div>
  );
}

export default function MessageBubble({
  content, senderName, isOwn, time, reactions, replyTo, onReply, onReact, onDelete, onEdit, canEdit = false, edited = false, isOnline, darkMode = false, status, profilePicture, isDeleted = false,
}: MessageBubbleProps) {
  const [showActions, setShowActions] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(content);

  const submitEdit = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== content) onEdit?.(trimmed);
    setEditing(false);
  };

  if (isDeleted) {
    return (
      <div className={cn("flex mb-3 gap-2.5 message-animate", isOwn ? "flex-row-reverse justify-end" : "flex-row justify-start")}>
        {!isOwn && (
          <div className="flex-shrink-0 mt-auto">
            {profilePicture ? (
              <img src={profilePicture} alt="" className="h-8 w-8 rounded-full object-cover shadow-sm" />
            ) : (
              <div className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white bg-gradient-to-br from-gray-400 to-gray-500">
                {senderName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        )}
        <div className="flex flex-col max-w-[70%] sm:max-w-[60%] lg:max-w-[50%]">
          <div className={cn(
            "rounded-message px-4 py-2.5 text-sm italic opacity-60 glass-card bg-white/30",
            isOwn ? "rounded-br-none" : "rounded-bl-none"
          )}>
            <p>🚫 This message was deleted</p>
            <span className="text-[11px] block mt-1 text-gray-500">
              {time}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn("flex mb-3 gap-2.5 message-animate", isOwn ? "flex-row-reverse justify-end" : "flex-row justify-start")}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      onTouchStart={() => setShowActions(true)}
    >
      {/* Avatar for others */}
      {!isOwn && (
        <div className="flex-shrink-0 mt-auto">
          {profilePicture ? (
            <img src={profilePicture} alt={senderName} className="h-8 w-8 rounded-full object-cover shadow-sm" />
          ) : (
            <div className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white bg-gradient-to-br from-gray-400 to-gray-500 shadow-sm">
              {senderName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col max-w-[70%] sm:max-w-[60%] lg:max-w-[50%]">
        {/* Sender name for group messages */}
        {!isOwn && (
          <div className="px-2 mb-1 flex items-center gap-1.5">
            <span className="text-xs font-semibold text-[#0A84FF]">
              {senderName}
            </span>
            {isOnline && <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />}
          </div>
        )}

        {/* Main message bubble */}
        <div className={cn(
          "rounded-message px-4 py-2.5 relative group text-sm transition-all duration-200",
          isOwn
            ? "message-bubble-sent text-white rounded-br-none"
            : "message-bubble-received text-gray-900 rounded-bl-none"
        )}>
          {/* Reply preview */}
          {replyTo && (
            <div className={cn(
              "text-xs rounded-md px-2.5 py-1.5 mb-2 border-l-3 backdrop-blur-sm",
              isOwn
                ? "bg-white/20 border-white/50 text-white/90"
                : "bg-black/5 border-[#0A84FF]/50 text-gray-700"
            )}>
              <span className={cn("font-semibold", isOwn ? "text-white" : "text-[#0A84FF]")}>
                {replyTo.senderName}
              </span>
              <p className="truncate opacity-75">{replyTo.content}</p>
            </div>
          )}

          {/* Editing state */}
          {editing ? (
            <div className="flex flex-col gap-2">
              <textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                rows={2}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitEdit(); }
                  if (e.key === "Escape") { setEditValue(content); setEditing(false); }
                }}
                className={cn(
                  "w-full resize-none rounded-md px-2.5 py-1.5 text-sm outline-none border-0 bg-white/20 text-white placeholder-white/60",
                  "focus:bg-white/30 focus:ring-1 focus:ring-white/50"
                )}
              />
              <div className="flex items-center gap-2 justify-end">
                <button onClick={() => { setEditValue(content); setEditing(false); }} className="text-[11px] opacity-75 hover:opacity-100 font-medium">Cancel</button>
                <button onClick={submitEdit} className="text-[11px] font-semibold text-white bg-white/20 px-2.5 py-1 rounded-full">Save</button>
              </div>
            </div>
          ) : (
            <>
              <p className="whitespace-pre-wrap break-words leading-relaxed">{content}</p>
              <span className={cn("text-[10px] block mt-1.5 flex items-center justify-end gap-1", isOwn ? "text-white/70" : "text-gray-500")}>
                {edited && <span className="italic">edited</span>}
                <span>{time}</span>
                {isOwn && <StatusTicks status={status} darkMode={darkMode} isOnline={isOnline} />}
              </span>
            </>
          )}

          {/* Action buttons - hover menu */}
          {showActions && !editing && (
            <div className={cn(
              "absolute -top-9 flex items-center gap-1 rounded-full px-1.5 py-1 shadow-lg z-10 glass-card animate-in fade-in slide-in-from-bottom-2 duration-150",
              isOwn ? "right-0" : "left-0"
            )}>
              <button onClick={onReply} className="p-1.5 hover:bg-white/20 rounded-full transition-colors" title="Reply">
                <Reply className="h-3.5 w-3.5 text-gray-600" />
              </button>
              {quickEmojis.slice(0, 3).map((e) => (
                <button key={e} onClick={() => onReact(e)} className="p-1 hover:scale-125 transition-transform text-sm" title="React">
                  {e}
                </button>
              ))}
              {isOwn && canEdit && onEdit && (
                <button onClick={() => { setEditValue(content); setEditing(true); }} className="p-1.5 hover:bg-white/20 rounded-full transition-colors" title="Edit">
                  <Pencil className="h-3.5 w-3.5 text-gray-600" />
                </button>
              )}
              {isOwn && onDelete && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="p-1.5 hover:bg-white/20 rounded-full transition-colors">
                      <MoreVertical className="h-3.5 w-3.5 text-gray-600" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    {canEdit && onEdit && (
                      <DropdownMenuItem onClick={() => { setEditValue(content); setEditing(true); }}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={onDelete} className="text-red-600">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          )}
        </div>

        {/* Reactions */}
        {reactions.length > 0 && (
          <div className={cn("flex flex-wrap gap-1 mt-1.5 px-1", isOwn ? "justify-end" : "justify-start")}>
            {reactions.map(({ emoji, count, reacted }) => (
              <button
                key={emoji}
                onClick={() => onReact(emoji)}
                className={cn(
                  "flex items-center gap-0.5 text-xs rounded-full px-2.5 py-1 transition-all duration-150 hover:scale-105",
                  reacted
                    ? "glass-card bg-white/80 shadow-md"
                    : "glass-card bg-white/40 hover:bg-white/60"
                )}
              >
                <span>{emoji}</span>
                {count > 1 && <span className="font-semibold text-gray-700">{count}</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
