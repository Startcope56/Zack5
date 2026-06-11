import { useState, useRef } from "react";
import { useParams } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { 
  useGetUser, 
  useGetUserStats, 
  useListPosts, 
  useGetFriendshipStatus,
  useUpdateUser,
  useSendFriendRequest,
  useAcceptFriendRequest,
  useRemoveFriend,
  useCreateConversation,
  getGetUserQueryKey,
  getListPostsQueryKey,
  getGetUserStatsQueryKey,
  getGetFriendshipStatusQueryKey
} from "@workspace/api-client-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { uploadFile } from "@/lib/upload";
import { useQueryClient } from "@tanstack/react-query";
import { Camera, MapPin, Link as LinkIcon, CalendarDays, UserPlus, UserMinus, UserCheck, MessageSquare } from "lucide-react";
import { useLocation } from "wouter";

export default function ProfilePage() {
  const { id } = useParams<{ id: string }>();
  const profileId = parseInt(id || "0", 10);
  const { user: currentUser, token } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const isOwnProfile = currentUser?.id === profileId;

  const { data: profileUser, isLoading: profileLoading } = useGetUser(profileId);
  const { data: stats } = useGetUserStats(profileId);
  const { data: posts } = useListPosts({ userId: profileId });
  const { data: friendshipStatus } = useGetFriendshipStatus(profileId, { query: { enabled: !isOwnProfile, queryKey: ["friendshipStatus", profileId] } });

  const updateUser = useUpdateUser();
  const sendRequest = useSendFriendRequest();
  const acceptRequest = useAcceptFriendRequest();
  const removeFriend = useRemoveFriend();
  const createConversation = useCreateConversation();

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editData, setEditData] = useState({
    name: "",
    bio: "",
    location: "",
    website: ""
  });

  const handleEditOpen = () => {
    if (profileUser) {
      setEditData({
        name: profileUser.name || "",
        bio: profileUser.bio || "",
        location: profileUser.location || "",
        website: profileUser.website || ""
      });
      setEditOpen(true);
    }
  };

  const handleEditSave = async () => {
    try {
      await updateUser.mutateAsync({ id: profileId, data: editData });
      setEditOpen(false);
      queryClient.invalidateQueries({ queryKey: getGetUserQueryKey(profileId) });
      toast({ title: "Profile updated" });
    } catch (err: any) {
      toast({ title: "Error updating profile", description: err.message, variant: "destructive" });
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    try {
      await uploadFile(`/api/users/${profileId}/upload-avatar`, file, token);
      queryClient.invalidateQueries({ queryKey: getGetUserQueryKey(profileId) });
      toast({ title: "Profile picture updated" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    }
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    try {
      await uploadFile(`/api/users/${profileId}/upload-cover`, file, token);
      queryClient.invalidateQueries({ queryKey: getGetUserQueryKey(profileId) });
      toast({ title: "Cover photo updated" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    }
  };

  const handleAddFriend = async () => {
    try {
      await sendRequest.mutateAsync({ data: { addresseeId: profileId } });
      queryClient.invalidateQueries({ queryKey: getGetFriendshipStatusQueryKey(profileId) });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleAcceptFriend = async () => {
    if (friendshipStatus?.requestId) {
      try {
        await acceptRequest.mutateAsync({ id: friendshipStatus.requestId });
        queryClient.invalidateQueries({ queryKey: getGetFriendshipStatusQueryKey(profileId) });
      } catch (err: any) {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      }
    }
  };

  const handleUnfriend = async () => {
    try {
      await removeFriend.mutateAsync({ friendId: profileId });
      queryClient.invalidateQueries({ queryKey: getGetFriendshipStatusQueryKey(profileId) });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleMessage = async () => {
    try {
      const conv = await createConversation.mutateAsync({ data: { participantId: profileId } });
      setLocation(`/chat/${conv.id}`);
    } catch (err: any) {
      toast({ title: "Error starting chat", description: err.message, variant: "destructive" });
    }
  };

  if (profileLoading) {
    return <div className="text-center py-8">Loading profile...</div>;
  }

  if (!profileUser) {
    return <div className="text-center py-8">User not found</div>;
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Cover and Avatar */}
      <div className="relative bg-card rounded-xl overflow-hidden shadow-sm">
        <div 
          className="h-48 md:h-64 w-full bg-muted relative group cursor-pointer"
          onClick={() => isOwnProfile && coverInputRef.current?.click()}
        >
          {profileUser.coverPicture ? (
            <img src={profileUser.coverPicture} alt="Cover" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900 dark:to-indigo-900" />
          )}
          {isOwnProfile && (
            <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera className="text-white h-8 w-8" />
            </div>
          )}
        </div>
        
        <div className="px-4 pb-4">
          <div className="relative flex justify-between items-end -mt-12 md:-mt-16 mb-4">
            <div className="relative group cursor-pointer" onClick={() => isOwnProfile && avatarInputRef.current?.click()}>
              <Avatar className="h-24 w-24 md:h-32 md:w-32 border-4 border-card bg-muted">
                <AvatarImage src={profileUser.profilePicture || undefined} className="object-cover" />
                <AvatarFallback className="text-4xl">{profileUser.name[0]}</AvatarFallback>
              </Avatar>
              {isOwnProfile && (
                <div className="absolute inset-0 bg-black/20 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera className="text-white h-6 w-6" />
                </div>
              )}
            </div>
            
            <div className="flex gap-2">
              {isOwnProfile ? (
                <Dialog open={editOpen} onOpenChange={setEditOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={handleEditOpen}>Edit Profile</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Edit Profile</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Name</Label>
                        <Input value={editData.name} onChange={(e) => setEditData({ ...editData, name: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Bio</Label>
                        <Textarea value={editData.bio} onChange={(e) => setEditData({ ...editData, bio: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Location</Label>
                        <Input value={editData.location} onChange={(e) => setEditData({ ...editData, location: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Website</Label>
                        <Input value={editData.website} onChange={(e) => setEditData({ ...editData, website: e.target.value })} />
                      </div>
                      <Button onClick={handleEditSave} className="w-full">Save Changes</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              ) : (
                <>
                  {friendshipStatus?.status === 'none' && (
                    <Button onClick={handleAddFriend}><UserPlus className="h-4 w-4 mr-2"/> Add Friend</Button>
                  )}
                  {friendshipStatus?.status === 'pending_sent' && (
                    <Button variant="secondary" disabled>Pending Request</Button>
                  )}
                  {friendshipStatus?.status === 'pending_received' && (
                    <Button onClick={handleAcceptFriend}><UserCheck className="h-4 w-4 mr-2"/> Accept Request</Button>
                  )}
                  {friendshipStatus?.status === 'friends' && (
                    <Button variant="secondary" onClick={handleUnfriend}><UserMinus className="h-4 w-4 mr-2"/> Unfriend</Button>
                  )}
                  <Button variant="default" onClick={handleMessage}><MessageSquare className="h-4 w-4 mr-2"/> Message</Button>
                </>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <h1 className="text-2xl font-bold">{profileUser.name}</h1>
            {profileUser.bio && <p className="text-muted-foreground">{profileUser.bio}</p>}
          </div>

          <div className="flex flex-wrap gap-y-2 gap-x-4 mt-4 text-sm text-muted-foreground">
            {profileUser.location && (
              <div className="flex items-center gap-1">
                <MapPin className="h-4 w-4" /> {profileUser.location}
              </div>
            )}
            {profileUser.website && (
              <div className="flex items-center gap-1">
                <LinkIcon className="h-4 w-4" /> 
                <a href={profileUser.website} target="_blank" rel="noreferrer" className="text-primary hover:underline">{profileUser.website}</a>
              </div>
            )}
            <div className="flex items-center gap-1">
              <CalendarDays className="h-4 w-4" /> Joined {new Date(profileUser.createdAt).toLocaleDateString()}
            </div>
          </div>

          <div className="flex gap-4 mt-4 text-sm">
            <div><span className="font-semibold text-foreground">{stats?.friendCount || 0}</span> friends</div>
            <div><span className="font-semibold text-foreground">{stats?.postCount || 0}</span> posts</div>
          </div>
        </div>
      </div>

      <input type="file" ref={avatarInputRef} className="hidden" accept="image/*" onChange={handleAvatarUpload} />
      <input type="file" ref={coverInputRef} className="hidden" accept="image/*" onChange={handleCoverUpload} />

      {/* User's Posts */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold px-1">Posts</h2>
        {posts?.map((post) => (
          <Card key={post.id}>
            <CardHeader className="flex-row gap-4 space-y-0 items-start">
              <Avatar>
                <AvatarImage src={post.author?.profilePicture || undefined} />
                <AvatarFallback>{post.author?.name?.[0]}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="font-semibold">{post.author?.name}</span>
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="whitespace-pre-wrap">{post.content}</p>
              {post.imageUrl && (
                <div className="rounded-lg overflow-hidden border">
                  <img src={post.imageUrl} alt="Post content" className="w-full object-cover max-h-96" />
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {posts?.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            No posts yet.
          </div>
        )}
      </div>
    </div>
  );
}
