import { useState, useRef, useEffect } from "react";
import { Link } from "wouter";
import { useAuth } from "@/context/AuthContext";
import {
  useListPosts, useCreatePost, useReactToPost, useRemovePostReaction,
  useListPostComments, useAddPostComment, useDeletePost, useReportPost,
  getListPostsQueryKey, getListPostCommentsQueryKey, ReactionInputType,
} from "@workspace/api-client-react";
import type { Comment } from "@workspace/api-client-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Image as ImageIcon, MessageSquare, Share2, Send, X, MoreHorizontal, Trash2, Flag, Palette } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { uploadFile } from "@/lib/upload";
import { getSocket } from "@/lib/socket";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const REACTIONS = [
  { type: "heart", emoji: "🩷", label: "Love" },
  { type: "laugh", emoji: "😆", label: "Haha" },
  { type: "cry",   emoji: "💔", label: "Sad" },
  { type: "angry", emoji: "😡", label: "Angry" },
];

const BG_COLORS = [
  { label: "None", value: null, preview: "#ffffff" },
  { label: "Blue", value: "linear-gradient(135deg,#1877f2,#0a6bc7)", preview: "#1877f2" },
  { label: "Sunset", value: "linear-gradient(135deg,#f093fb,#f5576c)", preview: "#f093fb" },
  { label: "Ocean", value: "linear-gradient(135deg,#4facfe,#00f2fe)", preview: "#4facfe" },
  { label: "Forest", value: "linear-gradient(135deg,#43e97b,#38f9d7)", preview: "#43e97b" },
  { label: "Night", value: "linear-gradient(135deg,#0c3483,#a2b6df)", preview: "#0c3483" },
  { label: "Gold", value: "linear-gradient(135deg,#f6d365,#fda085)", preview: "#f6d365" },
  { label: "Rose", value: "linear-gradient(135deg,#fbc2eb,#a6c1ee)", preview: "#fbc2eb" },
];

const REPORT_REASONS = [
  { value: "sexual_content", label: "Sexual Content" },
  { value: "harassment", label: "Harassment / Bullying" },
  { value: "hate_speech", label: "Hate Speech" },
  { value: "violence", label: "Violence" },
  { value: "spam", label: "Spam / Fake" },
];

function BadgeIcon() {
  return (
    <span title="Blue Badge — Verified" className="inline-flex items-center justify-center w-4 h-4 rounded-full text-white text-[8px] font-bold ml-0.5 shrink-0"
      style={{ background: "#1877f2" }}>✓</span>
  );
}

function CommentSection({ postId }: { postId: number }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [comment, setComment] = useState("");
  const { data: comments } = useListPostComments(postId, { query: { queryKey: getListPostCommentsQueryKey(postId) } });
  const addComment = useAddPostComment();
  const { toast } = useToast();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;
    try {
      await addComment.mutateAsync({ id: postId, data: { content: comment.trim() } });
      setComment("");
      queryClient.invalidateQueries({ queryKey: getListPostCommentsQueryKey(postId) });
      queryClient.invalidateQueries({ queryKey: getListPostsQueryKey() });
    } catch (err: any) {
      if (err?.response?.data?.profanity) {
        toast({ title: "❌ Hindi pwede ang masamang salita!", description: "Keep your comments respectful.", variant: "destructive" });
      } else {
        toast({ title: "Failed to comment", description: err.message, variant: "destructive" });
      }
    }
  };

  return (
    <div className="border-t border-gray-100 pt-3 px-4 pb-3 space-y-2">
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
            <div className="flex items-center gap-1">
              <Link href={`/profile/${c.author?.id}`}>
                <span className="font-semibold text-xs text-gray-800 hover:underline cursor-pointer">{c.author?.name}</span>
              </Link>
              {(c.author as any)?.blueBadge && <BadgeIcon />}
            </div>
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

function ReactionPicker({ onPick }: { onPick: (type: string) => void }) {
  return (
    <div className="absolute bottom-full left-0 mb-1 bg-white border border-gray-200 rounded-2xl shadow-xl px-2 py-1.5 flex gap-1 z-20">
      {REACTIONS.map(r => (
        <button
          key={r.type}
          onPointerDown={e => { e.preventDefault(); onPick(r.type); }}
          className="text-2xl hover:scale-125 transition-transform p-0.5"
          title={r.label}
        >
          {r.emoji}
        </button>
      ))}
    </div>
  );
}

function PostCard({ post, currentUserId, isAdmin }: { post: any; currentUserId: number; isAdmin: boolean }) {
  const [showComments, setShowComments] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const reactPost = useReactToPost();
  const unreactPost = useRemovePostReaction();
  const deletePost = useDeletePost();
  const reportPost = useReportPost();
  const pickerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const isOwnPost = post.userId === currentUserId;
  const canDelete = isOwnPost || isAdmin;

  const toggleReaction = async (type: string) => {
    setShowPicker(false);
    if (post.myReaction === type) {
      await unreactPost.mutateAsync({ id: post.id });
    } else {
      await reactPost.mutateAsync({ id: post.id, data: { type: type as ReactionInputType } });
    }
    queryClient.invalidateQueries({ queryKey: getListPostsQueryKey() });
  };

  const handleReactPress = () => {
    if (post.myReaction) {
      unreactPost.mutateAsync({ id: post.id }).then(() =>
        queryClient.invalidateQueries({ queryKey: getListPostsQueryKey() })
      );
    } else {
      setShowPicker(v => !v);
    }
  };

  const handleDelete = async () => {
    setShowMenu(false);
    try {
      await deletePost.mutateAsync({ id: post.id });
      queryClient.invalidateQueries({ queryKey: getListPostsQueryKey() });
      toast({ title: "Post deleted" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleReport = async () => {
    if (!reportReason) return;
    try {
      const res = await reportPost.mutateAsync({ id: post.id, data: { reason: reportReason as any } });
      setReportOpen(false);
      setReportReason("");
      toast({ title: "📩 " + (res.message || "Report submitted") });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  useEffect(() => {
    if (!showPicker) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setShowPicker(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showPicker]);

  useEffect(() => {
    if (!showMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMenu]);

  const totalReactions = post.reactions?.reduce((s: number, r: any) => s + r.count, 0) ?? 0;
  const myReactionEmoji = REACTIONS.find(r => r.type === post.myReaction)?.emoji;
  const hasBgColor = !!post.bgColor;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
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
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <Link href={`/profile/${post.author?.id}`}>
              <p className="font-semibold text-gray-900 text-sm hover:underline cursor-pointer leading-none">{post.author?.name}</p>
            </Link>
            {post.author?.blueBadge && <BadgeIcon />}
            {post.author?.isAdmin && (
              <span className="px-1.5 py-0.5 text-[9px] bg-yellow-100 text-yellow-700 rounded-full font-bold uppercase tracking-wide ml-0.5">Admin</span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
          </p>
        </div>

        {/* 3-dots menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowMenu(v => !v)}
            className="p-1.5 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition"
          >
            <MoreHorizontal className="h-5 w-5" />
          </button>
          {showMenu && (
            <div className="absolute right-0 top-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl z-30 w-44 overflow-hidden">
              {canDelete && (
                <button
                  onClick={handleDelete}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete Post
                </button>
              )}
              {!isOwnPost && (
                <button
                  onClick={() => { setShowMenu(false); setReportOpen(true); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition"
                >
                  <Flag className="h-4 w-4" />
                  Report Post
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Content — supports color background */}
      {hasBgColor ? (
        <div className="mx-4 mb-3 rounded-xl overflow-hidden">
          <div
            className="flex items-center justify-center min-h-[160px] px-6 py-8 text-white text-center"
            style={{ background: post.bgColor }}
          >
            <p className="text-white text-lg font-bold whitespace-pre-wrap leading-snug drop-shadow-sm">
              {post.content}
            </p>
          </div>
        </div>
      ) : (
        <div className="px-4 pb-3">
          <p className="text-gray-800 text-sm whitespace-pre-wrap leading-relaxed">{post.content}</p>
        </div>
      )}

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
          <button
            className="ml-auto text-xs text-gray-400 hover:underline"
            onClick={() => setShowComments(v => !v)}
          >
            {post.commentCount > 0 ? `${post.commentCount} comment${post.commentCount > 1 ? "s" : ""}` : ""}
          </button>
        </div>
      )}

      {/* Action Buttons */}
      <div className="border-t border-gray-100 mx-4" />
      <div className="flex px-2 py-1">
        <div className="relative flex-1" ref={pickerRef}>
          {showPicker && <ReactionPicker onPick={toggleReaction} />}
          <button
            onClick={handleReactPress}
            className={`w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium transition active:scale-95 ${
              post.myReaction ? "text-blue-600 bg-blue-50" : "text-gray-500 hover:bg-gray-100"
            }`}
          >
            <span className="text-base">{myReactionEmoji || "🩷"}</span>
            <span>{post.myReaction ? REACTIONS.find(r => r.type === post.myReaction)?.label : "React"}</span>
          </button>
        </div>

        <button
          onClick={() => setShowComments(v => !v)}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium transition active:scale-95 ${
            showComments ? "text-blue-600 bg-blue-50" : "text-gray-500 hover:bg-gray-100"
          }`}
        >
          <MessageSquare className="h-4 w-4" />
          <span>Comment</span>
        </button>

        <button className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium text-gray-500 hover:bg-gray-100 transition active:scale-95">
          <Share2 className="h-4 w-4" />
          <span>Share</span>
        </button>
      </div>

      {showComments && <CommentSection postId={post.id} />}

      {/* Report Dialog */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Report Post 🚩</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-gray-500">Why are you reporting this post?</p>
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
            <Button
              onClick={handleReport}
              className="w-full"
              variant="destructive"
              disabled={!reportReason || reportPost.isPending}
            >
              {reportPost.isPending ? "Submitting..." : "Submit Report"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function FeedPage() {
  const { user, token } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [bgColor, setBgColor] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showBgPicker, setShowBgPicker] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: posts, isLoading } = useListPosts({});
  const createPost = useCreatePost();

  useEffect(() => {
    if (!token) return;
    const socket = getSocket(token);
    socket.on("new_post", () => {
      queryClient.invalidateQueries({ queryKey: getListPostsQueryKey() });
    });
    socket.on("post_deleted", () => {
      queryClient.invalidateQueries({ queryKey: getListPostsQueryKey() });
    });
    return () => { socket.off("new_post"); socket.off("post_deleted"); };
  }, [token, queryClient]);

  const openComposer = () => {
    setOpen(true);
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const closeComposer = () => {
    setOpen(false);
    setContent("");
    setImageFile(null);
    setBgColor(null);
    setShowBgPicker(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handlePost = async () => {
    if (!content.trim() && !imageFile) return;
    try {
      setIsUploading(true);
      const res = await createPost.mutateAsync({ data: { content, bgColor } });
      if (imageFile && token) {
        await uploadFile(`/api/posts/${res.id}/upload-image`, imageFile, token);
      }
      closeComposer();
      queryClient.invalidateQueries({ queryKey: getListPostsQueryKey() });
    } catch (err: any) {
      if (err?.response?.data?.profanity) {
        toast({ title: "❌ Hindi pwede ang masamang salita!", description: "Your post contains inappropriate language. Keep it respectful!", variant: "destructive" });
      } else {
        toast({ title: "Failed to post", description: err.message, variant: "destructive" });
      }
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-3">

      {/* Composer trigger */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3">
        <div className="flex gap-3 items-center">
          <Avatar className="h-10 w-10 shrink-0">
            <AvatarImage src={user?.profilePicture || undefined} />
            <AvatarFallback className="font-bold" style={{ background: "linear-gradient(135deg,#1877f2,#0a6bc7)", color: "white" }}>
              {user?.name?.[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <button
            onClick={openComposer}
            className="flex-1 text-left px-4 py-2.5 rounded-full bg-gray-100 hover:bg-gray-200 active:bg-gray-300 transition text-gray-400 text-sm cursor-pointer select-none"
          >
            What's on your mind, {user?.name?.split(" ")[0]}?
          </button>
        </div>
        <div className="mt-2 pt-2 border-t border-gray-100 flex gap-2">
          <button
            onClick={openComposer}
            className="flex-1 flex items-center justify-center gap-2 py-1.5 rounded-lg text-green-600 hover:bg-green-50 active:bg-green-100 text-sm font-medium transition"
          >
            <ImageIcon className="h-4 w-4" /> Photo
          </button>
          <button
            onClick={() => { openComposer(); setShowBgPicker(true); }}
            className="flex-1 flex items-center justify-center gap-2 py-1.5 rounded-lg text-purple-600 hover:bg-purple-50 active:bg-purple-100 text-sm font-medium transition"
          >
            <Palette className="h-4 w-4" /> Color
          </button>
        </div>
      </div>

      {/* Composer modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40"
          onClick={e => { if (e.target === e.currentTarget) closeComposer(); }}>
          <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 sticky top-0 bg-white z-10">
              <span className="font-bold text-gray-900">Create Post</span>
              <button onClick={closeComposer} className="p-1 rounded-full hover:bg-gray-100 transition">
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            {/* Author */}
            <div className="flex items-center gap-3 px-4 pt-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={user?.profilePicture || undefined} />
                <AvatarFallback className="font-bold" style={{ background: "linear-gradient(135deg,#1877f2,#0a6bc7)", color: "white" }}>
                  {user?.name?.[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex items-center gap-1">
                <span className="font-semibold text-gray-900">{user?.name}</span>
                {(user as any)?.blueBadge && <BadgeIcon />}
              </div>
            </div>

            {/* Color background preview + textarea */}
            <div className="px-4 pt-2 pb-3">
              {bgColor ? (
                <div className="rounded-xl overflow-hidden mb-2" style={{ background: bgColor, minHeight: 120 }}>
                  <textarea
                    ref={textareaRef}
                    placeholder="What's on your mind?"
                    className="w-full resize-none outline-none text-white text-lg font-bold placeholder-white/60 bg-transparent p-4 min-h-[120px] text-center"
                    rows={4}
                    value={content}
                    onChange={e => setContent(e.target.value)}
                  />
                </div>
              ) : (
                <textarea
                  ref={textareaRef}
                  placeholder={`What's on your mind, ${user?.name?.split(" ")[0]}?`}
                  className="w-full resize-none outline-none text-gray-800 text-base placeholder-gray-400 bg-transparent min-h-[100px]"
                  rows={4}
                  value={content}
                  onChange={e => setContent(e.target.value)}
                />
              )}
            </div>

            {/* Background color picker */}
            {showBgPicker && (
              <div className="px-4 pb-3">
                <p className="text-xs font-semibold text-gray-500 mb-2">Background Color</p>
                <div className="flex gap-2 flex-wrap">
                  {BG_COLORS.map(c => (
                    <button
                      key={c.label}
                      onClick={() => setBgColor(c.value)}
                      className={`w-8 h-8 rounded-full border-2 transition ${
                        bgColor === c.value ? "border-blue-500 scale-110" : "border-gray-200"
                      }`}
                      style={{ background: c.value || "#ffffff" }}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Image preview */}
            {imageFile && (
              <div className="mx-4 mb-3 relative rounded-xl overflow-hidden border border-gray-200">
                <img src={URL.createObjectURL(imageFile)} alt="preview" className="max-h-48 w-auto mx-auto object-cover" />
                <button onClick={() => setImageFile(null)}
                  className="absolute top-2 right-2 bg-gray-800/60 hover:bg-gray-800/80 text-white rounded-full p-1 transition">
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Footer */}
            <div className="px-4 pb-4 flex items-center justify-between gap-3 border-t border-gray-100 pt-3">
              <div className="flex gap-1">
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*"
                  onChange={e => setImageFile(e.target.files?.[0] || null)} />
                <button onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-green-600 hover:bg-green-50 text-sm font-medium transition">
                  <ImageIcon className="h-4 w-4" /> Photo
                </button>
                <button
                  onClick={() => setShowBgPicker(v => !v)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition ${showBgPicker ? "bg-purple-100 text-purple-600" : "text-purple-600 hover:bg-purple-50"}`}
                >
                  <Palette className="h-4 w-4" /> Color
                </button>
              </div>
              <button
                onClick={handlePost}
                disabled={(!content.trim() && !imageFile) || createPost.isPending || isUploading}
                className="px-6 py-2 rounded-full text-white text-sm font-bold transition disabled:opacity-50 active:scale-95"
                style={{ background: "linear-gradient(135deg,#1877f2,#0a6bc7)", boxShadow: "0 2px 8px rgba(24,119,242,0.3)" }}
              >
                {isUploading || createPost.isPending ? "Posting..." : "Post"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Posts */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 animate-pulse">
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

      {posts?.map(post => (
        <PostCard
          key={post.id}
          post={post}
          currentUserId={user?.id || 0}
          isAdmin={user?.isAdmin || false}
        />
      ))}

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
