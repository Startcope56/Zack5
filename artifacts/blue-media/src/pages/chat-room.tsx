import { useEffect, useState, useRef } from "react";
import { useParams, Link } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { 
  useGetConversation, 
  useListMessages, 
  useSendMessage, 
  useMarkConversationRead,
  useReactToMessage,
  getListMessagesQueryKey,
  getGetConversationQueryKey,
  getGetUnreadCountQueryKey
} from "@workspace/api-client-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Image as ImageIcon, Send, Users } from "lucide-react";
import { getSocket } from "@/lib/socket";
import { useQueryClient } from "@tanstack/react-query";
import { uploadFile } from "@/lib/upload";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const EMOJIS = ["🩷", "⭐", "💔", "💤", "😆"];

export default function ChatRoomPage() {
  const { id } = useParams<{ id: string }>();
  const convId = parseInt(id || "0", 10);
  const { user, token } = useAuth();
  const queryClient = useQueryClient();

  const [message, setMessage] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: conv } = useGetConversation(convId);
  const { data: messages } = useListMessages(convId);
  const sendMessage = useSendMessage();
  const markRead = useMarkConversationRead();
  const reactToMsg = useReactToMessage();

  useEffect(() => {
    if (!token) return;
    const socket = getSocket(token);
    socket.emit("join_conversation", { conversationId: convId });

    const handleMsg = () => {
      queryClient.invalidateQueries({ queryKey: getListMessagesQueryKey(convId) });
      markRead.mutate({ id: convId });
      queryClient.invalidateQueries({ queryKey: getGetUnreadCountQueryKey() });
    };

    socket.on("message", handleMsg);
    socket.on("message_seen", handleMsg);
    
    markRead.mutate({ id: convId });

    return () => {
      socket.off("message", handleMsg);
      socket.off("message_seen", handleMsg);
      // could emit leave
    };
  }, [convId, token, queryClient, markRead]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() && !imageFile) return;

    try {
      let imageUrl = null;
      if (imageFile && token) {
        imageUrl = await uploadFile(`/api/conversations/${convId}/messages/upload`, imageFile, token);
      }
      
      const socket = getSocket(token!);
      // Optimistic or just wait for server. Let's wait for server.
      await sendMessage.mutateAsync({ id: convId, data: { content: message, imageUrl } });
      setMessage("");
      setImageFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      console.error(err);
    }
  };

  const handleReact = async (msgId: number, emoji: string) => {
    try {
      await reactToMsg.mutateAsync({ id: convId, msgId, data: { emoji } });
      queryClient.invalidateQueries({ queryKey: getListMessagesQueryKey(convId) });
    } catch (e) {
      console.error(e);
    }
  };

  if (!conv) return <div className="p-8 text-center">Loading...</div>;

  const isGroup = conv.type === "group";
  const otherParticipant = !isGroup ? conv.participants?.find(p => p.id !== user?.id) : null;
  const name = isGroup ? conv.name : otherParticipant?.name || "Unknown";
  const avatar = isGroup ? conv.pictureUrl : otherParticipant?.profilePicture;

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] -mt-6 -mx-4">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b bg-card shadow-sm z-10 sticky top-0">
        <Link href="/chat">
          <Button variant="ghost" size="icon" className="rounded-full">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex items-center gap-3">
          {isGroup ? (
            <div className="h-10 w-10 rounded-full bg-secondary/20 flex items-center justify-center text-secondary">
              {avatar ? <img src={avatar} className="rounded-full w-full h-full object-cover" /> : <Users className="h-5 w-5" />}
            </div>
          ) : (
            <Avatar className="h-10 w-10">
              <AvatarImage src={avatar || undefined} />
              <AvatarFallback>{name?.[0]}</AvatarFallback>
            </Avatar>
          )}
          <div>
            <h2 className="font-semibold text-base leading-none">{name}</h2>
            {isGroup && <span className="text-xs text-muted-foreground">{conv.participants?.length} members</span>}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div 
        className="flex-1 overflow-y-auto p-4 space-y-4"
        style={{ backgroundColor: conv.backgroundTheme || 'transparent' }}
      >
        {messages?.map((msg, i) => {
          const isMine = msg.senderId === user?.id;
          const showName = isGroup && !isMine && (i === 0 || messages[i-1].senderId !== msg.senderId);
          
          return (
            <div key={msg.id} className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}>
              {showName && <span className="text-xs text-muted-foreground mb-1 ml-1">{msg.sender?.name}</span>}
              <div className="flex items-end gap-2 max-w-[80%] group">
                <Popover>
                  <PopoverTrigger asChild>
                    <div className={`relative px-4 py-2 rounded-2xl cursor-pointer ${isMine ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted text-foreground rounded-bl-sm"}`}>
                      {msg.imageUrl && (
                        <img src={msg.imageUrl} alt="attached" className="max-w-full rounded-lg mb-2" />
                      )}
                      <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                      
                      {/* Reactions display */}
                      {msg.reactions && msg.reactions.length > 0 && (
                        <div className={`absolute -bottom-3 ${isMine ? "right-2" : "left-2"} bg-background border rounded-full px-1.5 py-0.5 text-[10px] flex shadow-sm gap-1`}>
                          {msg.reactions.map(r => <span key={r.id}>{r.emoji}</span>)}
                        </div>
                      )}
                    </div>
                  </PopoverTrigger>
                  <PopoverContent side="top" align={isMine ? "end" : "start"} className="w-auto p-2 flex gap-1 rounded-full">
                    {EMOJIS.map(e => (
                      <button key={e} onClick={() => handleReact(msg.id, e)} className="text-xl hover:scale-125 transition-transform p-1">
                        {e}
                      </button>
                    ))}
                  </PopoverContent>
                </Popover>
              </div>
              <div className="flex items-center gap-1 mt-1">
                <span className="text-[10px] text-muted-foreground">{new Date(msg.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                {isMine && (
                  <span className="text-[10px] text-primary font-medium">
                    {msg.seenBy && msg.seenBy.length > 1 ? "Seen" : "Sent"}
                  </span>
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 bg-card border-t mt-auto">
        {imageFile && (
          <div className="mb-2 relative inline-block">
            <img src={URL.createObjectURL(imageFile)} alt="preview" className="h-16 rounded border" />
            <Button variant="destructive" size="icon" className="absolute -top-2 -right-2 h-5 w-5 rounded-full" onClick={() => setImageFile(null)}>
              <span className="text-[10px]">✕</span>
            </Button>
          </div>
        )}
        <form onSubmit={handleSend} className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="image/*"
            onChange={(e) => setImageFile(e.target.files?.[0] || null)}
          />
          <Button type="button" variant="ghost" size="icon" className="rounded-full text-muted-foreground shrink-0" onClick={() => fileInputRef.current?.click()}>
            <ImageIcon className="h-5 w-5" />
          </Button>
          <Input 
            className="rounded-full bg-muted/50 border-transparent focus-visible:ring-1 focus-visible:bg-background"
            placeholder="Message..." 
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <Button type="submit" size="icon" className="rounded-full shrink-0" disabled={(!message.trim() && !imageFile) || sendMessage.isPending}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
