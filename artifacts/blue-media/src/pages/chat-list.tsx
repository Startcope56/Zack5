import { useEffect, useState, useRef } from "react";
import { Link } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { useListFriends, useListConversations, useCreateGroupConversation, getListConversationsQueryKey } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { MessageSquarePlus, Users } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { getSocket } from "@/lib/socket";

export default function ChatListPage() {
  const { user, token } = useAuth();
  const queryClient = useQueryClient();
  const [groupOpen, setGroupOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedFriends, setSelectedFriends] = useState<number[]>([]);

  const { data: conversations } = useListConversations();
  const { data: friends } = useListFriends({});
  const createGroup = useCreateGroupConversation();

  useEffect(() => {
    if (!token) return;
    const socket = getSocket(token);
    socket.on("message", () => {
      queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
    });
    return () => {
      socket.off("message");
    };
  }, [token, queryClient]);

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

  return (
    <div className="space-y-6">
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
                      <label htmlFor={`friend-${friend.id}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-2">
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

      <div className="space-y-2">
        {conversations?.map((conv) => {
          const isGroup = conv.type === "group";
          const otherParticipant = !isGroup ? conv.participants?.find(p => p.id !== user?.id) : null;
          const name = isGroup ? conv.name : otherParticipant?.name || "Unknown";
          const avatar = isGroup ? conv.pictureUrl : otherParticipant?.profilePicture;
          
          return (
            <Link key={conv.id} href={`/chat/${conv.id}`}>
              <Card className={`p-4 flex items-center gap-4 cursor-pointer hover:bg-muted/50 transition-colors ${conv.unreadCount ? 'bg-primary/5 border-primary/20' : ''}`}>
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
                    <h3 className={`font-semibold truncate ${conv.unreadCount ? 'text-primary' : ''}`}>{name}</h3>
                    {conv.lastMessage && (
                      <span className="text-xs text-muted-foreground ml-2 whitespace-nowrap">
                        {formatDistanceToNow(new Date(conv.lastMessage.createdAt), { addSuffix: false }).replace('about ', '')}
                      </span>
                    )}
                  </div>
                  <p className={`text-sm truncate ${conv.unreadCount ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                    {conv.lastMessage?.content || (conv.lastMessage?.imageUrl ? "Sent an image" : "No messages yet")}
                  </p>
                </div>
              </Card>
            </Link>
          );
        })}
        {conversations?.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            No conversations yet. Start chatting with friends!
          </div>
        )}
      </div>
    </div>
  );
}
