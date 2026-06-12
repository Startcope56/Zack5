import { useState } from "react";
import {
  useListNotifications, useMarkAllNotificationsRead, useMarkNotificationRead,
  useDeleteNotification, useClaimBlueBadge,
  getListNotificationsQueryKey
} from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { UserPlus, Heart, MessageSquare, Bell, X, BadgeCheck, UserRoundCheck } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export default function NotificationsPage() {
  const { data: notifications, isLoading } = useListNotifications();
  const markAllRead = useMarkAllNotificationsRead();
  const markRead = useMarkNotificationRead();
  const deleteNotif = useDeleteNotification();
  const claimBadge = useClaimBlueBadge();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const handleMarkAll = async () => {
    await markAllRead.mutateAsync(undefined as unknown as void);
    queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() });
  };

  const handleClick = async (id: number, read: boolean) => {
    if (!read) {
      await markRead.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() });
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDeletingId(id);
    try {
      await deleteNotif.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() });
    } finally {
      setDeletingId(null);
    }
  };

  const handleClaimBadge = async (e: React.MouseEvent, notifId: number) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const res = await claimBadge.mutateAsync(undefined as any);
      toast({ title: "🎉 " + (res.message || "Blue Badge claimed!") });
      queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  if (isLoading) return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
        {notifications?.some(n => !n.read) && (
          <Button variant="ghost" size="sm" onClick={handleMarkAll} className="text-primary hover:bg-primary/10">
            Mark all as read
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {notifications?.map((n) => {
          let icon = <Bell className="h-5 w-5 text-muted-foreground" />;
          let link = "#";
          let messageParsed: any = null;

          try {
            if (n.message && n.message.startsWith("{")) {
              messageParsed = JSON.parse(n.message);
            }
          } catch {}

          const displayMessage = messageParsed?.text || n.message;

          if (n.type === "friend_request" || n.type === "friend_accepted") {
            icon = <UserPlus className="h-5 w-5 text-blue-500" />;
            link = `/profile/${n.fromUserId}`;
          } else if (n.type === "post_reaction") {
            icon = <Heart className="h-5 w-5 text-red-500" />;
            link = "/feed";
          } else if (n.type === "post_comment") {
            icon = <MessageSquare className="h-5 w-5 text-green-500" />;
            link = "/feed";
          } else if (n.type === "message") {
            icon = <MessageSquare className="h-5 w-5 text-purple-500" />;
            link = `/chat/${n.conversationId}`;
          } else if (n.type === "blue_badge") {
            icon = <BadgeCheck className="h-5 w-5 text-blue-500" />;
            link = "#";
          } else if (n.type === "follow") {
            icon = <UserRoundCheck className="h-5 w-5 text-indigo-500" />;
            link = `/profile/${n.fromUserId}`;
          } else if (n.type === "report_received") {
            icon = <Bell className="h-5 w-5 text-red-500" />;
            link = "/admin";
          }

          return (
            <Link key={n.id} href={link}>
              <Card
                className={`p-4 flex items-start gap-4 cursor-pointer hover:bg-muted/50 transition-colors relative group ${!n.read ? "bg-primary/5 border-primary/20" : ""}`}
                onClick={() => handleClick(n.id, n.read)}
              >
                <div className="relative mt-1">
                  <Avatar>
                    <AvatarImage src={n.fromUser?.profilePicture || undefined} />
                    <AvatarFallback>
                      {n.type === "blue_badge" ? "💙" : (n.fromUser?.name?.[0] || "?")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-2 -right-2 bg-background rounded-full p-1 border shadow-sm">
                    {icon}
                  </div>
                </div>
                <div className="flex-1 min-w-0 pt-1">
                  <p className="text-sm font-medium leading-snug">
                    {n.fromUser && <span className="font-bold mr-1">{n.fromUser.name}</span>}
                    {displayMessage}
                  </p>
                  <span className="text-xs text-muted-foreground mt-1 block">
                    {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                  </span>
                  {/* Badge claim button */}
                  {n.type === "blue_badge" && messageParsed && !messageParsed.claimedAt && (
                    <Button
                      size="sm"
                      className="mt-2 h-7 text-xs"
                      onClick={(e) => handleClaimBadge(e, n.id)}
                      disabled={claimBadge.isPending}
                    >
                      💙 Claim Badge
                    </Button>
                  )}
                </div>
                {!n.read && <div className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />}

                {/* Delete button */}
                <button
                  onClick={(e) => handleDelete(e, n.id)}
                  disabled={deletingId === n.id}
                  className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full bg-gray-100 hover:bg-red-100 text-gray-400 hover:text-red-500"
                  title="Delete notification"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </Card>
            </Link>
          );
        })}
        {notifications?.length === 0 && (
          <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl">
            You have no notifications yet.
          </div>
        )}
      </div>
    </div>
  );
}
