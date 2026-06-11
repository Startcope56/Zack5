import { useState, useRef, useEffect } from "react";
import { Link } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { useListPosts, useCreatePost, useReactToPost, useRemovePostReaction, useListPostComments, useAddPostComment, getListPostsQueryKey, getListPostCommentsQueryKey, ReactionInputType } from "@workspace/api-client-react";
import type { Comment } from "@workspace/api-client-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Image as ImageIcon, MessageSquare, Share2, Send, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { uploadFile } from "@/lib/upload";
import { getSocket } from "@/lib/socket";
import { useQueryClient } from "@tanstack/react-query";

const REACTIONS = [
  { type: "heart", emoji: "🩷", label: "Love" },
  { type: "laugh", emoji: "😆", label: "Haha" },
  { type: "cry",   emoji: "💔", label: "Sad" },
  { type: "angry", emoji: "😡", label: "Angry" },
];

function CommentSection({ postId }: { postId: number }) {
  const { user, token } = useAuth();
  const queryClient = useQueryClient();
  const [comment, setComment] = useState("");
  const { data: comments } = useListPostComments(postId, { query: { queryKey: getListPostCommentsQueryKey(postId) } });
  const addComment = useAddPostComment();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;
    await addComment.mutateAsync({ id: postId, data: { content: comment.trim() } });
    setComment("");
    queryClient.invalidateQueries({ queryKey: getListPostCommentsQueryKey(postId) });
    queryClient.invalidateQueries({ queryKey: getListPostsQueryKey() });
  };

  return (
    <div className="border-t border-gray-100 pt-3 px-4 pb-2 space-y-2">
      {comments?.map((c: Comment) => (
        <div key={c.id} className="flex gap-2 items-start">
          <Link href={`/profile/${c.author?.id}`}>
            <Avatar className="h-7 w-7 shrink-0 cursor-pointer">
              <AvatarImage src={c.author?.profilePicture || undefined} />
              <AvatarFallback className="text-xs font-bold" style={{ background: "#1877f2", color: "white" }}>
                {c.author?.name?.[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </Link>
          <div className="flex-1 bg-gray-100 rounded-2xl px-3 py-1.5">
            <Link href={`/profile/${c.author?.id}`}>
              <span className="font-semibold text-xs text-gray-800 hover:underline cursor-pointer">{c.author?.name}</span>
            </Link>
            <p className="text-sm text-gray-700">{c.content}</p>
          </div>
        </div>
      ))}
      <form onSubmit={submit} className="flex gap-2 items-center pt-1">
        <Avatar className="h-7 w-7 shrink-0">
          <AvatarImage src={user?.profilePicture || undefined} />
          <AvatarFallback className="text-xs font-bold" style={{ background: "#1877f2", color: "white" }}>
            {user?.name?.[0]?.toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 flex items-center bg-gray-100 rounded-full px-3 py-1.5 gap-2">
          <input
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Write a comment..."
            className="flex-1 bg-transparent text-sm outline-none text-gray-700 placeholder-gray-400"
          />
          <button type="submit" disabled={!comment.trim() || addComment.isPending}
            className="text-blue-500 hover:text-blue-700 disabled:opacity-40 transition">
            <Send className="h-4 w-4" />
          </button>
        </div>
      </form>
    </div>
  );
}

function PostCard({ post }: { post: any }) {
  const [showComments, setShowComments] = useState(false);
  const [hoveredReaction, setHoveredReaction] = useState(false);
  const queryClient = useQueryClient();
  const reactPost = useReactToPost();
  const unreactPost = useRemovePostReaction();

  const toggleReaction = async (type: string) => {
    if (post.myReaction === type) {
      await unreactPost.mutateAsync({ id: post.id });
    } else {
      await reactPost.mutateAsync({ id: post.id, data: { type: type as ReactionInputType } });
    }
    queryClient.invalidateQueries({ queryKey: getListPostsQueryKey() });
  };

  const totalReactions = post.reactions?.reduce((s: number, r: any) => s + r.count, 0) ?? 0;
  const myReactionEmoji = REACTIONS.find(r => r.type === post.myReaction)?.emoji;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden post-card">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <Link href={`/profile/${post.author?.id}`}>
          <Avatar className="h-10 w-10 cursor-pointer ring-2 ring-blue-100">
            <AvatarImage src={post.author?.profilePicture || undefined} />
            <AvatarFallback className="font-bold" style={{ background: "linear-gradient(135deg,#1877f2,#0a6bc7)", color: "white" }}>
              {post.author?.name?.[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </Link>
        <div>
          <Link href={`/profile/${post.author?.id}`}>
            <p className="font-semibold text-gray-900 text-sm hover:underline cursor-pointer leading-none">{post.author?.name}</p>
          </Link>
          <p className="text-xs text-gray-400 mt-0.5">
            {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pb-3">
        <p className="text-gray-800 text-sm whitespace-pre-wrap leading-relaxed">{post.content}</p>
      </div>

      {post.imageUrl && (
        <div className="border-y border-gray-100">
          <img src={post.imageUrl} alt="Post" className="w-full object-cover max-h-[400px]" />
        </div>
      )}

      {/* Reaction counts */}
      {totalReactions > 0 && (
        <div className="px-4 py-1.5 flex items-center gap-1">
          <div className="flex -space-x-1">
            {post.reactions?.filter((r: any) => r.count > 0).slice(0, 3).map((r: any) => (
              <span key={r.type} className="text-sm">{REACTIONS.find(x => x.type === r.type)?.emoji}</span>
            ))}
          </div>
          <span className="text-xs text-gray-400 ml-1">{totalReactions}</span>
          <span className="ml-auto text-xs text-gray-400 hover:underline cursor-pointer"
            onClick={() => setShowComments(v => !v)}>
            {post.commentCount > 0 ? `${post.commentCount} comment${post.commentCount > 1 ? "s" : ""}` : ""}
          </span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="border-t border-gray-100 mx-4" />
      <div className="flex px-2 py-1">
        {/* React button with hover picker */}
        <div className="relative flex-1"
          onMouseEnter={() => setHoveredReaction(true)}
          onMouseLeave={() => setHoveredReaction(false)}>
          {hoveredReaction && (
            <div className="absolute bottom-full left-0 mb-1 bg-white border border-gray-200 rounded-2xl shadow-xl px-2 py-1.5 flex gap-1 z-20">
              {REACTIONS.map(r => (
                <button key={r.type}
                  onClick={() => toggleReaction(r.type)}
                  className="text-2xl hover:scale-125 transition-transform p-0.5 reaction-btn"
                  title={r.label}>
                  {r.emoji}
                </button>
              ))}
            </div>
          )}
          <button
            onClick={() => post.myReaction ? unreactPost.mutateAsync({ id: post.id }).then(() => queryClient.invalidateQueries({ queryKey: getListPostsQueryKey() })) : toggleReaction("heart")}
            className={`w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium transition reaction-btn ${post.myReaction ? "text-blue-600 bg-blue-50" : "text-gray-500 hover:bg-gray-100"}`}>
            <span className="text-base">{myReactionEmoji || "🩷"}</span>
            <span>{post.myReaction ? REACTIONS.find(r => r.type === post.myReaction)?.label : "React"}</span>
          </button>
        </div>

        <button
          onClick={() => setShowComments(v => !v)}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium transition ${showComments ? "text-blue-600 bg-blue-50" : "text-gray-500 hover:bg-gray-100"}`}>
          <MessageSquare className="h-4 w-4" />
          <span>Comment</span>
        </button>

        <button className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium text-gray-500 hover:bg-gray-100 transition">
          <Share2 className="h-4 w-4" />
          <span>Share</span>
        </button>
      </div>

      {showComments && <CommentSection postId={post.id} />}
    </div>
  );
}

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

  useEffect(() => {
    if (!token) return;
    const socket = getSocket(token);
    socket.on("new_post", () => {
      queryClient.invalidateQueries({ queryKey: getListPostsQueryKey() });
    });
    return () => { socket.off("new_post"); };
  }, [token, queryClient]);

  const handlePost = async () => {
    if (!content.trim() && !imageFile) return;
    try {
      setIsUploading(true);
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

  return (
    <div className="space-y-3">
      {/* Composer */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <div className="flex gap-3 items-center">
          <Avatar className="h-10 w-10 shrink-0">
            <AvatarImage src={user?.profilePicture || undefined} />
            <AvatarFallback className="font-bold" style={{ background: "linear-gradient(135deg,#1877f2,#0a6bc7)", color: "white" }}>
              {user?.name?.[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <button
            onClick={() => document.getElementById("post-textarea")?.focus()}
            className="flex-1 text-left px-4 py-2.5 rounded-full bg-gray-100 hover:bg-gray-200 transition text-gray-400 text-sm cursor-text">
            What's on your mind, {user?.name?.split(" ")[0]}?
          </button>
        </div>

        <textarea
          id="post-textarea"
          placeholder={`What's on your mind, ${user?.name?.split(" ")[0]}?`}
          className={`w-full mt-3 resize-none outline-none text-gray-800 text-sm placeholder-gray-400 bg-transparent ${content ? "block" : "hidden"}`}
          rows={3}
          value={content}
          onChange={e => setContent(e.target.value)}
          onFocus={e => {
            const el = e.target as HTMLTextAreaElement;
            el.classList.remove("hidden");
            el.classList.add("block");
            (document.querySelector('[data-post-btn]') as HTMLElement)?.classList.remove("hidden");
          }}
        />

        {imageFile && (
          <div className="mt-3 relative rounded-xl overflow-hidden border border-gray-200">
            <img src={URL.createObjectURL(imageFile)} alt="preview" className="max-h-48 w-auto mx-auto object-cover" />
            <button onClick={() => setImageFile(null)}
              className="absolute top-2 right-2 bg-gray-800/60 hover:bg-gray-800/80 text-white rounded-full p-1 transition">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
          <div className="flex gap-1">
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={e => setImageFile(e.target.files?.[0] || null)} />
            <button onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-green-600 hover:bg-green-50 text-sm font-medium transition">
              <ImageIcon className="h-4 w-4" /> Photo
            </button>
          </div>
          <button
            data-post-btn
            onClick={handlePost}
            disabled={(!content.trim() && !imageFile) || createPost.isPending || isUploading}
            className="px-5 py-1.5 rounded-full text-white text-sm font-bold transition disabled:opacity-50 active:scale-95"
            style={{ background: "linear-gradient(135deg,#1877f2,#0a6bc7)", boxShadow: "0 2px 8px rgba(24,119,242,0.3)" }}>
            {isUploading || createPost.isPending ? "Posting..." : "Post"}
          </button>
        </div>
      </div>

      {/* Posts */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 animate-pulse">
              <div className="flex gap-3 items-center mb-3">
                <div className="h-10 w-10 rounded-full bg-gray-200" />
                <div className="space-y-1.5">
                  <div className="h-3 w-24 bg-gray-200 rounded" />
                  <div className="h-2.5 w-16 bg-gray-200 rounded" />
                </div>
              </div>
              <div className="h-3 bg-gray-200 rounded w-3/4 mb-2" />
              <div className="h-3 bg-gray-200 rounded w-1/2" />
            </div>
          ))}
        </div>
      )}

      {posts?.map(post => <PostCard key={post.id} post={post} />)}

      {!isLoading && posts?.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <div className="text-5xl mb-3">📭</div>
          <p className="font-medium">No posts yet.</p>
          <p className="text-sm mt-1">Be the first to share something!</p>
        </div>
      )}
    </div>
  );
}
