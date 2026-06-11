import { useState } from "react";
import { Link } from "wouter";
import { 
  useListFriends, 
  useListFriendRequests, 
  useSearchUsers,
  useAcceptFriendRequest,
  useRejectFriendRequest,
  useRemoveFriend,
  useCreateConversation,
  useSendFriendRequest,
  getListFriendsQueryKey,
  getListFriendRequestsQueryKey
} from "@workspace/api-client-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, UserMinus, MessageSquare, Check, X, UserPlus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useDebounce } from "@/hooks/use-debounce";

export default function FriendsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: friends } = useListFriends({});
  const { data: requests } = useListFriendRequests();
  const { data: searchResults } = useSearchUsers({ q: debouncedSearch }, { query: { enabled: debouncedSearch.length > 0, queryKey: ["searchUsers", debouncedSearch] } });

  const acceptRequest = useAcceptFriendRequest();
  const rejectRequest = useRejectFriendRequest();
  const removeFriend = useRemoveFriend();
  const createConversation = useCreateConversation();
  const sendRequest = useSendFriendRequest();

  const handleAccept = async (id: number) => {
    await acceptRequest.mutateAsync({ id });
    queryClient.invalidateQueries({ queryKey: getListFriendsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListFriendRequestsQueryKey() });
  };

  const handleReject = async (id: number) => {
    await rejectRequest.mutateAsync({ id });
    queryClient.invalidateQueries({ queryKey: getListFriendRequestsQueryKey() });
  };

  const handleUnfriend = async (id: number) => {
    await removeFriend.mutateAsync({ friendId: id });
    queryClient.invalidateQueries({ queryKey: getListFriendsQueryKey() });
  };

  const handleMessage = async (id: number) => {
    const conv = await createConversation.mutateAsync({ data: { participantId: id } });
    setLocation(`/chat/${conv.id}`);
  };

  const handleAddFriend = async (id: number) => {
    await sendRequest.mutateAsync({ data: { addresseeId: id } });
    setSearchQuery(""); // Clear search to show feedback
  };

  return (
    <div className="space-y-6">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input 
          className="pl-9" 
          placeholder="Search for people..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {debouncedSearch.length > 0 ? (
        <div className="space-y-4">
          <h2 className="text-xl font-bold">Search Results</h2>
          <div className="grid gap-3">
            {searchResults?.map(user => (
              <Card key={user.id} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarImage src={user.profilePicture || undefined} />
                    <AvatarFallback>{user.name[0]}</AvatarFallback>
                  </Avatar>
                  <div>
                    <Link href={`/profile/${user.id}`}>
                      <div className="font-semibold hover:underline cursor-pointer">{user.name}</div>
                    </Link>
                  </div>
                </div>
                <Button size="sm" onClick={() => handleAddFriend(user.id)}>
                  <UserPlus className="h-4 w-4 mr-2" /> Add
                </Button>
              </Card>
            ))}
            {searchResults?.length === 0 && (
              <div className="text-muted-foreground text-center py-8">No users found.</div>
            )}
          </div>
        </div>
      ) : (
        <Tabs defaultValue="friends" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="friends">Friends ({friends?.length || 0})</TabsTrigger>
            <TabsTrigger value="requests">Requests ({requests?.length || 0})</TabsTrigger>
          </TabsList>
          
          <TabsContent value="friends" className="mt-4 space-y-3">
            {friends?.map(friend => (
              <Card key={friend.id} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Link href={`/profile/${friend.id}`}>
                    <Avatar className="cursor-pointer">
                      <AvatarImage src={friend.profilePicture || undefined} />
                      <AvatarFallback>{friend.name[0]}</AvatarFallback>
                    </Avatar>
                  </Link>
                  <Link href={`/profile/${friend.id}`}>
                    <div className="font-semibold hover:underline cursor-pointer">{friend.name}</div>
                  </Link>
                </div>
                <div className="flex gap-2">
                  <Button size="icon" variant="secondary" onClick={() => handleMessage(friend.id)}>
                    <MessageSquare className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleUnfriend(friend.id)}>
                    <UserMinus className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            ))}
            {friends?.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">You don't have any friends yet. Use search to find people!</div>
            )}
          </TabsContent>

          <TabsContent value="requests" className="mt-4 space-y-3">
            {requests?.map(req => {
              const user = req.requester;
              if (!user) return null;
              return (
                <Card key={req.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Link href={`/profile/${user.id}`}>
                      <Avatar className="cursor-pointer">
                        <AvatarImage src={user.profilePicture || undefined} />
                        <AvatarFallback>{user.name[0]}</AvatarFallback>
                      </Avatar>
                    </Link>
                    <div className="flex flex-col">
                      <Link href={`/profile/${user.id}`}>
                        <span className="font-semibold hover:underline cursor-pointer">{user.name}</span>
                      </Link>
                      <span className="text-xs text-muted-foreground">wants to be friends</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleAccept(req.id)}>
                      <Check className="h-4 w-4 mr-1" /> Accept
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => handleReject(req.id)}>
                      <X className="h-4 w-4 mr-1" /> Reject
                    </Button>
                  </div>
                </Card>
              )
            })}
            {requests?.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">No pending requests.</div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
