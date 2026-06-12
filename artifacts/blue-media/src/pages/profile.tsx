import { useState, useRef } from "react";
import { useParams } from "wouter";
import { useAuth } from "@/context/AuthContext";
import {
  useGetUser,
  useGetUserStats,
  useListPosts,
  useGetFriendshipStatus,
  useGetFollowStatus,
  useUpdateUser,
  useSendFriendRequest,
  useAcceptFriendRequest,
  useRemoveFriend,
  useCreateConversation,
  useFollowUser,
  useUnfollowUser,
  useReportUser,
  useClaimBlueBadge,
  getGetUserQueryKey,
  getListPostsQueryKey,
  getGetUserStatsQueryKey,
  getGetFriendshipStatusQueryKey,
  getGetFollowStatusQueryKey,
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
import { Camera, MapPin, Link as LinkIcon, CalendarDays, UserPlus, UserMinus, UserCheck, MessageSquare, UserRoundCheck, UserRoundX, Flag, MoreHorizontal, BadgeCheck } from "lucide-react";
import { useLocation } from "wouter";

const REPORT_REASONS = [
  { value: "sexual_content", label: "Sexual Content" },
  { value: "harassment", label: "Harassment / Bullying" },
  { value: "hate_speech", label: "Hate Speech" },
  { value: "violence", label: "Violence" },
  { value: "spam", label: "Spam / Fake" },
];

function BlueBadge() {
  return (
    <span title="Verified — Blue Badge" className="inline-flex items-center justify-center w-5 h-5 rounded-full text-white text-[10px] font-bold ml-1 shrink-0"
      style={{ background: "#1877f2" }}>✓</span>
  );
}

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
  const { data: followStatus, refetch: refetchFollow } = useGetFollowStatus(profileId, {
    query: { enabled: !isOwnProfile, queryKey: getGetFollowStatusQueryKey(profileId) }
  });

  const updateUser = useUpdateUser();
  const sendRequest = useSendFriendRequest();
  const acceptRequest = useAcceptFriendRequest();
  const removeFriend = useRemoveFriend();
  const createConversation = useCreateConversation();
  const followUser = useFollowUser();
  const unfollowUser = useUnfollowUser();
  const reportUser = useReportUser();
  const claimBadge = useClaimBlueBadge();

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [showMenu, setShowMenu] = useState(false);
  const [editData, setEditData] = useState({ name: "", bio: "", location: "", website: "" });

  const handleEditOpen = () => {
    if (profileUser) {
      setEditData({ name: profileUser.name || "", bio: profileUser.bio || "", location: profileUser.location || "", website: profileUser.website || "" });
      setEditOpen(true);
    }
  };

  const handleEditSave = async () => {
    try {
      await updateUser.mutateAsync({ id: profileId, data: editData });
      setEditOpen(false);
      queryClient.invalidateQueries({ queryKey: getGetUserQueryKey(profileId) });
      toast({ title: "Profile updated!" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    try {
      await uploadFile(`/api/users/${profileId}/upload-avatar`, file, token);
      queryClient.invalidateQueries({ queryKey: getGetUserQueryKey(profileId) });
      toast({ title: "Profile picture updated!" });
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
      toast({ title: "Cover photo updated!" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    }
  };

  const handleFollow = async () => {
    try {
      await followUser.mutateAsync({ id: profileId });
      queryClient.invalidateQueries({ queryKey: getGetFollowStatusQueryKey(profileId) });
      queryClient.invalidateQueries({ queryKey: getGetUserStatsQueryKey(profileId) });
      toast({ title: `Following ${profileUser?.name}!` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleUnfollow = async () => {
    try {
      await unfollowUser.mutateAsync({ id: profileId });
      queryClient.invalidateQueries({ queryKey: getGetFollowStatusQueryKey(profileId) });
      queryClient.invalidateQueries({ queryKey: getGetUserStatsQueryKey(profileId) });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
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

  const handleReport = async () => {
    if (!reportReason) return;
    try {
      const res = await reportUser.mutateAsync({ id: profileId, data: { reason: reportReason as any } });
      setReportOpen(false);
      setReportReason("");
      toast({ title: "📩 " + (res.message || "Report submitted") });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleClaimBadge = async () => {
    try {
      const res = await claimBadge.mutateAsync(undefined as any);
      queryClient.invalidateQueries({ queryKey: getGetUserQueryKey(profileId) });
      toast({ title: "🎉 " + (res.message || "Blue Badge claimed!") });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  if (profileLoading) return <div className="text-center py-8">Loading profile...</div>;
  if (!profileUser) return <div className="text-center py-8">User not found</div>;

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

            <div className="flex gap-2 items-center">
              {isOwnProfile ? (
                <>
                  {!profileUser.blueBadge && (
                    <Button size="sm" variant="outline" onClick={handleClaimBadge} disabled={claimBadge.isPending} className="border-blue-400 text-blue-600">
                      💙 Claim Badge
                    </Button>
                  )}
                  <Dialog open={editOpen} onOpenChange={setEditOpen}>
                    <DialogTrigger asChild>
                      <Button onClick={handleEditOpen}>Edit Profile</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Edit Profile</DialogTitle></DialogHeader>
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
                        <Button onClick={handleEditSave} className="w-full" disabled={updateUser.isPending}>Save Changes</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </>
              ) : (
                <>
                  {/* Follow button */}
                  {followStatus?.isFollowing ? (
                    <Button variant="secondary" size="sm" onClick={handleUnfollow} disabled={unfollowUser.isPending}>
                      <UserRoundX className="h-4 w-4 mr-1" /> Unfollow
                    </Button>
                  ) : (
                    <Button size="sm" onClick={handleFollow} disabled={followUser.isPending}>
                      <UserRoundCheck className="h-4 w-4 mr-1" /> Follow
                    </Button>
                  )}
                  {/* Friend button */}
                  {friendshipStatus?.status === 'none' && (
                    <Button variant="outline" size="sm" onClick={handleAddFriend}><UserPlus className="h-4 w-4 mr-1" /> Add Friend</Button>
                  )}
                  {friendshipStatus?.status === 'pending_sent' && (
                    <Button variant="secondary" size="sm" disabled>Pending</Button>
                  )}
                  {friendshipStatus?.status === 'pending_received' && (
                    <Button variant="outline" size="sm" onClick={handleAcceptFriend}><UserCheck className="h-4 w-4 mr-1" /> Accept</Button>
                  )}
                  {friendshipStatus?.status === 'friends' && (
                    <Button variant="secondary" size="sm" onClick={handleUnfriend}><UserMinus className="h-4 w-4 mr-1" /> Unfriend</Button>
                  )}
                  <Button size="sm" onClick={handleMessage}><MessageSquare className="h-4 w-4 mr-1" /> Message</Button>
                  {/* 3-dots menu */}
                  <div className="relative">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowMenu(v => !v)}>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                    {showMenu && (
                      <div className="absolute right-0 top-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl z-30 w-44 overflow-hidden">
                        <button
                          onClick={() => { setShowMenu(false); setReportOpen(true); }}
                          className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition"
                        >
                          <Flag className="h-4 w-4" /> Report User
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1 flex-wrap">
              <h1 className="text-2xl font-bold">{profileUser.name}</h1>
              {profileUser.blueBadge && <BlueBadge />}
              {profileUser.isAdmin && (
                <span className="px-2 py-0.5 text-[10px] bg-yellow-100 text-yellow-700 rounded-full font-bold uppercase tracking-wide ml-1">Admin</span>
              )}
              {(profileUser as any).restricted && (
                <span className="px-2 py-0.5 text-[10px] bg-orange-100 text-orange-700 rounded-full font-bold ml-1">Restricted</span>
              )}
            </div>
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
            <div><span className="font-semibold text-foreground">{stats?.friendCount || 0}</span> <span className="text-muted-foreground">friends</span></div>
            <div><span className="font-semibold text-foreground">{stats?.followerCount || followStatus?.followerCount || 0}</span> <span className="text-muted-foreground">followers</span></div>
            <div><span className="font-semibold text-foreground">{stats?.followingCount || 0}</span> <span className="text-muted-foreground">following</span></div>
            <div><span className="font-semibold text-foreground">{stats?.postCount || 0}</span> <span className="text-muted-foreground">posts</span></div>
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
              <div className="flex flex-col flex-1">
                <div className="flex items-center gap-1">
                  <span className="font-semibold">{post.author?.name}</span>
                  {post.author?.blueBadge && <span className="inline-flex items-center justify-center w-4 h-4 rounded-full text-white text-[8px] font-bold" style={{ background: "#1877f2" }}>✓</span>}
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
                </span>
              </div>
            </CardHeader>
            <CardContent>
              {(post as any).bgColor ? (
                <div className="rounded-xl overflow-hidden">
                  <div className="flex items-center justify-center min-h-[120px] px-4 py-6 text-white text-center" style={{ background: (post as any).bgColor }}>
                    <p className="text-white text-lg font-bold whitespace-pre-wrap drop-shadow-sm">{post.content}</p>
                  </div>
                </div>
              ) : (
                <p className="whitespace-pre-wrap">{post.content}</p>
              )}
              {post.imageUrl && (
                <div className="rounded-lg overflow-hidden border mt-3">
                  <img src={post.imageUrl} alt="Post content" className="w-full object-cover max-h-96" />
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {posts?.length === 0 && (
          <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl">
            No posts yet.
          </div>
        )}
      </div>

      {/* Report User Dialog */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Report User 🚩</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-gray-500">Why are you reporting <strong>{profileUser.name}</strong>?</p>
            {REPORT_REASONS.map(r => (
              <button
                key={r.value}
                onClick={() => setReportReason(r.value)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-sm text-left transition ${
                  reportReason === r.value ? "border-red-400 bg-red-50" : "border-gray-200 hover:border-gray-300"
                }`}
              >
                {reportReason === r.value && <span>●</span>} {r.label}
              </button>
            ))}
            <Button onClick={handleReport} className="w-full" variant="destructive" disabled={!reportReason || reportUser.isPending}>
              {reportUser.isPending ? "Submitting..." : "Submit Report"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
