import { useState, useRef, useEffect } from "react";
import { Link } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { useListPosts, useCreatePost, useReactToPost, useRemovePostReaction, getListPostsQueryKey } from "@workspace/api-client-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Image as ImageIcon, MessageSquare, Share2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { uploadFile } from "@/lib/upload";
import { getSocket } from "@/lib/socket";
import { useQueryClient } from "@tanstack/react-query";

const REACTIONS = [
  { type: "heart", label: "🩷" },
  { type: "laugh", label: "😆" },
  { type: "cry", label: "💔" },
  { type: "angry", label: "😡" },
];

export default function FeedPage() {
  const { user, token } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [content, setContent] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: posts, isLoading } = useListPosts({});
  const createPost = useCreatePost();
  const reactPost = useReactToPost();
  const unreactPost = useRemovePostReaction();

  useEffect(() => {
    if (!token) return;
    const socket = getSocket(token);
    socket.on("new_post", () => {
      queryClient.invalidateQueries({ queryKey: getListPostsQueryKey() });
    });
    return () => {
      socket.off("new_post");
    };
  }, [token, queryClient]);

  const handlePost = async () => {
    if (!content.trim() && !imageFile) return;
    try {
      setIsUploading(true);
      let imageUrl = null;
      if (imageFile && user && token) {
        // We'll upload after post is created if the API requires post ID. 
        // Wait, the spec says POST /api/posts/:id/upload-image. 
        // So we create post first without image, then upload and update.
      }

      const res = await createPost.mutateAsync({ data: { content } });
      
      if (imageFile && token) {
        await uploadFile(`/api/posts/${res.id}/upload-image`, imageFile, token);
      }
      
      setContent("");
      setImageFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      queryClient.invalidateQueries({ queryKey: getListPostsQueryKey() });
    } catch (err: any) {
      toast({ title: "Failed to post", description: err.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const toggleReaction = async (postId: number, type: "heart" | "cry" | "laugh" | "angry", myReaction?: string | null) => {
    try {
      if (myReaction === type) {
        await unreactPost.mutateAsync({ id: postId });
      } else {
        await reactPost.mutateAsync({ id: postId, data: { type } });
      }
      queryClient.invalidateQueries({ queryKey: getListPostsQueryKey() });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Create Post */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <Avatar>
              <AvatarImage src={user?.profilePicture || undefined} />
              <AvatarFallback>{user?.name?.[0]}</AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-4">
              <Textarea
                placeholder="What's on your mind?"
                className="resize-none border-none focus-visible:ring-0 px-0 min-h-[80px] text-lg"
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
              {imageFile && (
                <div className="relative rounded-lg overflow-hidden border bg-muted">
                  <img src={URL.createObjectURL(imageFile)} alt="Upload preview" className="max-h-64 w-auto mx-auto object-cover" />
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    className="absolute top-2 right-2"
                    onClick={() => setImageFile(null)}
                  >
                    Remove
                  </Button>
                </div>
              )}
              <div className="flex items-center justify-between pt-2 border-t">
                <div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                  />
                  <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => fileInputRef.current?.click()}>
                    <ImageIcon className="h-4 w-4 mr-2" /> Photo
                  </Button>
                </div>
                <Button onClick={handlePost} disabled={(!content.trim() && !imageFile) || createPost.isPending || isUploading}>
                  Post
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Feed */}
      <div className="space-y-4">
        {isLoading && <div className="text-center py-8 text-muted-foreground">Loading posts...</div>}
        {posts?.map((post) => (
          <Card key={post.id}>
            <CardHeader className="flex-row gap-4 space-y-0 items-start">
              <Link href={`/profile/${post.author?.id}`}>
                <Avatar className="cursor-pointer">
                  <AvatarImage src={post.author?.profilePicture || undefined} />
                  <AvatarFallback>{post.author?.name?.[0]}</AvatarFallback>
                </Avatar>
              </Link>
              <div className="flex flex-col">
                <Link href={`/profile/${post.author?.id}`}>
                  <span className="font-semibold hover:underline cursor-pointer">{post.author?.name}</span>
                </Link>
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
              <div className="flex items-center gap-1 text-sm text-muted-foreground pt-2">
                {post.reactions?.map((r) => (
                  <span key={r.type} className="flex items-center">
                    {REACTIONS.find(x => x.type === r.type)?.label} {r.count}
                  </span>
                ))}
              </div>
            </CardContent>
            <CardFooter className="border-t pt-4 flex gap-1">
              <div className="flex flex-1 justify-center gap-1">
                {REACTIONS.map((r) => (
                  <Button
                    key={r.type}
                    variant="ghost"
                    size="sm"
                    className={`flex-1 ${post.myReaction === r.type ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}
                    onClick={() => toggleReaction(post.id, r.type as any, post.myReaction)}
                  >
                    <span>{r.label}</span>
                  </Button>
                ))}
              </div>
              <Button variant="ghost" size="sm" className="flex-1 text-muted-foreground">
                <MessageSquare className="h-4 w-4 mr-2" />
                {post.commentCount || 0}
              </Button>
              <Button variant="ghost" size="sm" className="flex-1 text-muted-foreground">
                <Share2 className="h-4 w-4" />
              </Button>
            </CardFooter>
          </Card>
        ))}
        {posts?.length === 0 && (
          <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl">
            No posts yet. Be the first to share something!
          </div>
        )}
      </div>
    </div>
  );
}
