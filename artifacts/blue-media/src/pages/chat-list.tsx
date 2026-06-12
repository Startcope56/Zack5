import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import {
  useListFriends, useListConversations, useCreateGroupConversation,
  useStartBlueAIConversation,
  getListConversationsQueryKey
} from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { MessageSquarePlus, Users, Bot } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { getSocket } from "@/lib/socket";

function BlueBadge() {
  return (
    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full text-white text-[8px] font-bold ml-0.5"
      style={{ background: "#1877f2" }}>✓</span>
  );
}

function BlueAIEntry({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full p-4 flex items-center gap-4 text-left hover:bg-blue-50 active:bg-blue-100 transition-colors rounded-xl mb-1"
      style={{
        background: "linear-gradient(135deg, #f0f7ff 0%, #e8f4fd 100%)",
        border: "2px solid transparent",
        backgroundClip: "padding-box",
        position: "relative",
      }}
    >
      <div className="relative">
        {/* Rainbow border animation */}
        <div className="absolute -inset-1 rounded-full animate-spin" style={{
          background: "conic-gradient(from 0deg, #ff006e, #fb5607, #ffbe0b, #3a86ff, #8338ec, #ff006e)",
          animationDuration: "3s",
        }} />
        <Avatar className="h-12 w-12 relative border-2 border-white">
          <AvatarFallback style={{ background: "linear-gradient(135deg,#1877f2,#0a6bc7)", color: "white", fontSize: 22 }}>
            🤖
          </AvatarFallback>
        </Avatar>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 mb-0.5">
          <h3 className="font-bold text-blue-700">BLUE AI</h3>
          <BlueBadge />
          <span className="text-[9px] font-bold bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full ml-1">AI</span>
        </div>
        <p className="text-sm text-blue-500 truncate">Chat with your AI assistant 💙</p>
      </div>

      <Bot className="h-5 w-5 text-blue-400 shrink-0" />
    </button>
  );
}

export default function ChatListPage() {
  const { user, token } = useAuth();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [groupOpen, setGroupOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedFriends, setSelectedFriends] = useState<number[]>([]);

  const { data: conversations } = useListConversations();
  const { data: friends } = useListFriends({});
  const createGroup = useCreateGroupConversation();
  const startBlueAI = useStartBlueAIConversation();

  useEffect(() => {
    if (!token) return;
    const socket = getSocket(token);
    socket.on("message", () => {
      queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
    });
    return () => { socket.off("message"); };
  }, [token, queryClient]);

  const handleOpenBlueAI = async () => {
    try {
      const conv = await startBlueAI.mutateAsync();
      queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
      setLocation(`/chat/${conv.id}`);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName || selectedFriends.length === 0) return;
    try {
      await createGroup.mutateAsync({ data: { name: groupName, participantIds: selectedFriends } });
      setGroupOpen(false);
      setGroupName("");
      setSelectedFriends([]);
      queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
    } catch (e) {
      console.error(e);
    }
  };

  const toggleFriend = (id: number) => {
    setSelectedFriends(prev => prev.includes(id) ? prev.filter(fid => fid !== id) : [...prev, id]);
  };

  // Filter out BLUE AI from regular conversations list
  const regularConvs = conversations?.filter(conv => {
    const other = conv.participants?.find(p => p.id !== user?.id);
    return !((other as any)?.isBlueAI);
  }) || [];

  const blueAIConv = conversations?.find(conv => {
    const other = conv.participants?.find(p => p.id !== user?.id);
    return (other as any)?.isBlueAI;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Messages</h1>
        <Dialog open={groupOpen} onOpenChange={setGroupOpen}>
          <DialogTrigger asChild>
            <Button size="icon" variant="ghost" className="rounded-full bg-primary/10 text-primary hover:bg-primary/20">
              <MessageSquarePlus className="h-5 w-5" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Group Chat</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Input
                placeholder="Group Name"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
              />
              <div className="space-y-2">
                <p className="text-sm font-medium">Select Friends</p>
                <div className="max-h-60 overflow-y-auto space-y-2 border rounded-md p-2">
                  {friends?.map(friend => (
                    <div key={friend.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`friend-${friend.id}`}
                        checked={selectedFriends.includes(friend.id)}
                        onCheckedChange={() => toggleFriend(friend.id)}
                      />
                      <label htmlFor={`friend-${friend.id}`} className="text-sm font-medium leading-none flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={friend.profilePicture || undefined} />
                          <AvatarFallback>{friend.name[0]}</AvatarFallback>
                        </Avatar>
                        {friend.name}
                      </label>
                    </div>
                  ))}
                  {friends?.length === 0 && <div className="text-sm text-muted-foreground p-2">No friends to add.</div>}
                </div>
              </div>
              <Button onClick={handleCreateGroup} className="w-full" disabled={!groupName || selectedFriends.length === 0 || createGroup.isPending}>
                Create Group
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* BLUE AI entry — always visible at top */}
      <BlueAIEntry onClick={handleOpenBlueAI} />

      {/* Conversations */}
      <div className="space-y-2">
        {regularConvs.map((conv) => {
          const isGroup = conv.type === "group";
          const otherParticipant = !isGroup ? conv.participants?.find(p => p.id !== user?.id) : null;
          const name = isGroup ? conv.name : otherParticipant?.name || "Unknown";
          const avatar = isGroup ? conv.pictureUrl : otherParticipant?.profilePicture;
          const hasBadge = (otherParticipant as any)?.blueBadge;

          return (
            <Link key={conv.id} href={`/chat/${conv.id}`}>
              <Card className={`p-4 flex items-center gap-4 cursor-pointer hover:bg-muted/50 transition-colors ${conv.unreadCount ? "bg-primary/5 border-primary/20" : ""}`}>
                <div className="relative">
                  {isGroup ? (
                    <div className="h-12 w-12 rounded-full bg-secondary/20 flex items-center justify-center text-secondary">
                      {avatar ? <img src={avatar} className="rounded-full w-full h-full object-cover" /> : <Users className="h-6 w-6" />}
                    </div>
                  ) : (
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={avatar || undefined} />
                      <AvatarFallback>{name?.[0]}</AvatarFallback>
                    </Avatar>
                  )}
                  {conv.unreadCount ? (
                    <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground border-2 border-background">
                      {conv.unreadCount}
                    </span>
                  ) : null}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-1">
                    <div className="flex items-center gap-0.5">
                      <h3 className={`font-semibold truncate text-sm ${conv.unreadCount ? "text-primary" : ""}`}>{name}</h3>
                      {hasBadge && <BlueBadge />}
                    </div>
                    {conv.lastMessage && (
                      <span className="text-xs text-muted-foreground ml-2 whitespace-nowrap">
                        {formatDistanceToNow(new Date(conv.lastMessage.createdAt), { addSuffix: false }).replace("about ", "")}
                      </span>
                    )}
                  </div>
                  <p className={`text-sm truncate ${conv.unreadCount ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                    {conv.lastMessage?.content || (conv.lastMessage?.imageUrl ? "Sent an image" : "No messages yet")}
                  </p>
                </div>
              </Card>
            </Link>
          );
        })}
        {regularConvs.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No conversations yet. Start chatting with friends or BLUE AI!
          </div>
        )}
      </div>
    </div>
  );
}
